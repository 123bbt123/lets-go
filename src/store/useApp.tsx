// 全局数据 store：单一 Context，避免引入额外依赖

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  Category,
  CategoryType,
  ExerciseRecord,
  RecordAllocation,
  UserSettings,
} from '../types';
import * as Data from '../lib/data';

interface AppContextValue {
  ready: boolean;
  userId: string | null;
  settings: UserSettings | null;
  categories: Category[];
  records: ExerciseRecord[];
  reloadCategories: () => Promise<void>;
  reloadRecords: () => Promise<void>;
  reloadSettings: () => Promise<void>;
  reloadAll: () => Promise<void>;

  // mutations
  saveSettings: (patch: Partial<UserSettings>) => Promise<void>;
  addCategory: (parent: Category, name: string) => Promise<void>;
  renameCategory: (cat: Category, name: string) => Promise<void>;
  removeCategory: (cat: Category) => Promise<{ movedRecords: number }>;
  createRecord: (
    startedAt: Date,
    durationSeconds: number,
    allocations: RecordAllocation[],
    note?: string | null
  ) => Promise<void>;
  updateRecord: (recordId: string, allocations: RecordAllocation[]) => Promise<void>;
  removeRecord: (recordId: string) => Promise<void>;
  resetAll: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

export function AppProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [records, setRecords] = useState<ExerciseRecord[]>([]);

  const reloadCategories = useCallback(async () => {
    if (!userId) return;
    const cats = await Data.ensureDefaultCategories(userId);
    setCategories(cats);
  }, [userId]);

  const reloadRecords = useCallback(async () => {
    if (!userId) return;
    const recs = await Data.fetchRecords(userId);
    setRecords(recs);
  }, [userId]);

  const reloadSettings = useCallback(async () => {
    if (!userId) return;
    const s = await Data.ensureSettings(userId);
    setSettings(s);
  }, [userId]);

  const reloadAll = useCallback(async () => {
    if (!userId) return;
    await Promise.all([
      Data.ensureSettings(userId).then(s => setSettings(s)),
      Data.ensureDefaultCategories(userId).then(c => setCategories(c)),
      Data.fetchRecords(userId).then(r => setRecords(r)),
    ]);
  }, [userId]);

  const saveSettings = useCallback(async (patch: Partial<UserSettings>) => {
    if (!userId) return;
    const s = await Data.updateSettings(userId, patch);
    setSettings(s);
  }, [userId]);

  const addCategory = useCallback(async (parent: Category, name: string) => {
    if (!userId) return;
    await Data.createCategory(userId, parent, name);
    await reloadCategories();
  }, [userId, reloadCategories]);

  const renameCategory = useCallback(async (cat: Category, name: string) => {
    await Data.renameCategory(cat, name);
    await reloadCategories();
  }, [reloadCategories]);

  // 删除子分类时，历史记录里引用它的时长会并入父分类，避免统计丢失
  const removeCategory = useCallback(async (cat: Category): Promise<{ movedRecords: number }> => {
    if (!userId) return { movedRecords: 0 };
    const res = await Data.deleteCategoryWithReassign(userId, cat);
    await reloadCategories();
    if (res.movedRecords > 0) await reloadRecords();
    return res;
  }, [userId, reloadCategories, reloadRecords]);

  const createRecord = useCallback(async (
    startedAt: Date,
    durationSeconds: number,
    allocations: RecordAllocation[],
    note: string | null = null
  ) => {
    if (!userId) return;
    await Data.createRecord(userId, startedAt, durationSeconds, allocations, note);
    await reloadRecords();
  }, [userId, reloadRecords]);

const updateRecord = useCallback(async (recordId: string, allocations: RecordAllocation[]): Promise<void> => {
    await Data.updateRecordAllocations(recordId, allocations);
    await reloadRecords();
  }, [reloadRecords]);

  const removeRecord = useCallback(async (recordId: string) => {
    await Data.deleteRecord(recordId);
    await reloadRecords();
  }, [reloadRecords]);

  // 还原原始数据：清空记录 + 默认分类 + Lv.1 默认目标，然后整体刷新
  const resetAll = useCallback(async () => {
    if (!userId) return;
    await Data.resetUserData(userId);
    await reloadAll();
  }, [userId, reloadAll]);

  // userId 变化时（登录/切换）重新加载
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    (async () => {
      try {
        const [s, c, r] = await Promise.all([
          Data.ensureSettings(userId),
          Data.ensureDefaultCategories(userId),
          Data.fetchRecords(userId),
        ]);
        if (cancelled) return;
        setSettings(s);
        setCategories(c);
        setRecords(r);
        setReady(true);
      } catch (err) {
        console.error('初始化失败', err);
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const value = useMemo<AppContextValue>(() => ({
    ready,
    userId,
    settings,
    categories,
    records,
    reloadCategories,
    reloadRecords,
    reloadSettings,
    reloadAll,
    saveSettings,
    addCategory,
    renameCategory,
    removeCategory,
    createRecord,
    updateRecord,
    removeRecord,
    resetAll,
  }), [ready, userId, settings, categories, records, reloadCategories, reloadRecords, reloadSettings, reloadAll, saveSettings, addCategory, renameCategory, removeCategory, createRecord, updateRecord, removeRecord, resetAll]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ---------- helpers ----------

export function groupCategoriesByParent(categories: Category[]): {
  top: Category[];
  childrenByParent: Record<string, Category[]>;
} {
  const top = categories.filter(c => !c.parent_id).sort((a, b) => a.sort_order - b.sort_order);
  const childrenByParent: Record<string, Category[]> = {};
  for (const c of categories) {
    if (c.parent_id) {
      if (!childrenByParent[c.parent_id]) childrenByParent[c.parent_id] = [];
      childrenByParent[c.parent_id].push(c);
    }
  }
  for (const k in childrenByParent) {
    childrenByParent[k].sort((a, b) => a.sort_order - b.sort_order);
  }
  return { top, childrenByParent };
}

export function typeToChildIds(categories: Category[]): Record<CategoryType, string[]> {
  const map: Record<CategoryType, string[]> = { strength: [], cardio: [], recovery: [] };
  const { childrenByParent } = groupCategoriesByParent(categories);
  for (const top of categories.filter(c => !c.parent_id)) {
    const t = top.type;
    if (!t) continue;
    const kids = childrenByParent[top.id] ?? [];
    if (kids.length === 0) {
      map[t] = [top.id];
    } else {
      map[t] = kids.map(c => c.id);
    }
  }
  return map;
}

export function categoryById(categories: Category[]): Record<string, Category> {
  const m: Record<string, Category> = {};
  for (const c of categories) m[c.id] = c;
  return m;
}
