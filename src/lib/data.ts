// 数据访问层：封装 Supabase 调用

import { supabase } from './supabase';
import { Category, CategoryType, ExerciseRecord, RecordAllocation, TOP_CATEGORIES, UserSettings } from '../types';
import { DEFAULT_BASE_GOALS_MIN } from './level';

// ---------- 用户设置 ----------

export async function fetchSettings(userId: string): Promise<UserSettings | null> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function ensureSettings(userId: string): Promise<UserSettings> {
  const existing = await fetchSettings(userId);
  if (existing) return existing;
  const base = DEFAULT_BASE_GOALS_MIN;
  const insert = {
    user_id: userId,
    level: 1,
    strength_goal_min: base.strength,
    cardio_goal_min: base.cardio,
    recovery_goal_min: base.recovery,
  };
  const { data, error } = await supabase
    .from('user_settings')
    .insert(insert)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSettings(userId: string, patch: Partial<UserSettings>): Promise<UserSettings> {
  const { data, error } = await supabase
    .from('user_settings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------- 分类 ----------

export async function fetchCategories(userId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// 首次进入时初始化默认分类（3 大类 + 子项）
export async function ensureDefaultCategories(userId: string): Promise<Category[]> {
  const existing = await fetchCategories(userId);
  if (existing.length > 0) return existing;

  const rows: Partial<Category>[] = [];
  let order = 0;

  for (const top of TOP_CATEGORIES) {
    const topId = crypto.randomUUID();
    rows.push({
      id: topId,
      user_id: userId,
      parent_id: null,
      name: top.name,
      type: top.type,
      sort_order: order++,
      is_default: true,
    });
    for (const childName of top.defaultChildren) {
      rows.push({
        id: crypto.randomUUID(),
        user_id: userId,
        parent_id: topId,
        name: childName,
        type: null,
        sort_order: order++,
        is_default: true,
      });
    }
  }

  const { error } = await supabase.from('categories').insert(rows);
  if (error) throw error;
  return fetchCategories(userId);
}

export async function createCategory(
  userId: string,
  parent: Category,
  name: string
): Promise<Category> {
  const siblings = parent._children ?? [];
  const order = siblings.length;
  const insert: Partial<Category> = {
    user_id: userId,
    parent_id: parent.id,
    name,
    type: null,
    sort_order: order,
    is_default: false,
  };
  const { data, error } = await supabase.from('categories').insert(insert).select().single();
  if (error) throw error;
  return data;
}

export async function renameCategory(cat: Category, name: string): Promise<void> {
  const { error } = await supabase.from('categories').update({ name }).eq('id', cat.id);
  if (error) throw error;
}

export async function deleteCategory(cat: Category): Promise<void> {
  // 如果是顶级分类，连同子项一起删
  if (!cat.parent_id) {
    await supabase.from('categories').delete().eq('parent_id', cat.id);
  }
  const { error } = await supabase.from('categories').delete().eq('id', cat.id);
  if (error) throw error;
}

/**
 * 删除子分类，并先把历史记录里引用它的时长迁移到父分类。
 * 不做迁移的话，记录的 allocations 会残留已不存在的 category_id，
 * 导致这部分时长在统计和图表里凭空消失。
 * 返回受影响的记录条数。
 */
export async function deleteCategoryWithReassign(
  userId: string,
  cat: Category
): Promise<{ movedRecords: number }> {
  // 顶级分类没有父级可迁移，直接删除（当前 UI 也只允许删子项）
  if (!cat.parent_id) {
    await deleteCategory(cat);
    return { movedRecords: 0 };
  }

  const fallbackId = cat.parent_id;
  const records = await fetchRecords(userId);
  const affected = records.filter(
    r => Array.isArray(r.allocations) && r.allocations.some(a => a.category_id === cat.id)
  );

  for (const r of affected) {
    // 把 cat.id 换成父分类 id，同一条记录里出现重复 id 时合并秒数
    const merged: RecordAllocation[] = [];
    for (const a of r.allocations) {
      const id = a.category_id === cat.id ? fallbackId : a.category_id;
      const existing = merged.find(m => m.category_id === id);
      if (existing) existing.seconds += a.seconds;
      else merged.push({ category_id: id, seconds: a.seconds });
    }
    await updateRecordAllocations(r.id, merged);
  }

  await deleteCategory(cat);
  return { movedRecords: affected.length };
}

// ---------- 运动记录 ----------

export async function fetchRecords(userId: string): Promise<ExerciseRecord[]> {
  const { data, error } = await supabase
    .from('exercise_records')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(r => ({ ...r, allocations: r.allocations as RecordAllocation[] }));
}

export async function createRecord(
  userId: string,
  startedAt: Date,
  durationSeconds: number,
  allocations: RecordAllocation[],
  note: string | null = null
): Promise<ExerciseRecord> {
  const startedIso = startedAt.toISOString();

  // 幂等兜底：2 分钟内已有「相同开始时间 + 相同时长」的记录就直接返回，不再写入。
  // 防止重复提交、多端并发把同一段运动记成两条。
  // 限定时间窗是为了不误伤补录（补录可能故意填一个已存在的时刻）。
  const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: existing, error: dupErr } = await supabase
    .from('exercise_records')
    .select('*')
    .eq('user_id', userId)
    .eq('started_at', startedIso)
    .eq('duration_seconds', durationSeconds)
    .gte('created_at', since)
    .maybeSingle();
  if (!dupErr && existing) {
    return { ...existing, allocations: existing.allocations as RecordAllocation[] };
  }

  const insert = {
    user_id: userId,
    started_at: startedIso,
    duration_seconds: durationSeconds,
    allocations,
    note,
  };
  const { data, error } = await supabase.from('exercise_records').insert(insert).select().single();
  if (error) throw error;
  return { ...data, allocations: data.allocations as RecordAllocation[] };
}

export async function updateRecordAllocations(
  recordId: string,
  allocations: RecordAllocation[]
): Promise<void> {
  const { error } = await supabase
    .from('exercise_records')
    .update({ allocations })
    .eq('id', recordId);
  if (error) throw error;
}

export async function deleteRecord(recordId: string): Promise<void> {
  const { error } = await supabase.from('exercise_records').delete().eq('id', recordId);
  if (error) throw error;
}

// ---------- 重置 ----------

// 还原原始数据：清空运动记录 + 恢复默认分类 + 等级/目标回到 Lv.1 初始值
export async function resetUserData(userId: string): Promise<void> {
  const { error: eRecords } = await supabase
    .from('exercise_records')
    .delete()
    .eq('user_id', userId);
  if (eRecords) throw eRecords;

  const { error: eCategories } = await supabase
    .from('categories')
    .delete()
    .eq('user_id', userId);
  if (eCategories) throw eCategories;

  // 重新写入默认分类（ensureDefaultCategories 检测到空表会自动建）
  await ensureDefaultCategories(userId);

  const base = DEFAULT_BASE_GOALS_MIN;
  await updateSettings(userId, {
    level: 1,
    strength_goal_min: base.strength,
    cardio_goal_min: base.cardio,
    recovery_goal_min: base.recovery,
  });
}