// 升降级判定逻辑
// 规则：
// - 连续 2 周（当前周 + 上周）三大类（力量/有氧/拉伸）完成率均 ≥ 100% → 可升级（+1 级），目标 +5%
// - 连续 2 周三大类完成率均 ≤ 50% → 可降级（-1 级），目标 -5%
// - 单次只能 ±1 级，不跳级

import { CategoryType, ExerciseRecord } from '../types';
import { startOfWeek, endOfWeek, getCurrentWeekRange, getPreviousWeekRange } from './week';

export interface CategoryTotals {
  strength: number;
  cardio: number;
  recovery: number;
}

export function sumSecondsByType(records: ExerciseRecord[], type: CategoryType, categoryIds: Set<string>): number {
  let total = 0;
  for (const r of records) {
    for (const a of r.allocations) {
      if (categoryIds.has(a.category_id)) {
        total += a.seconds;
      }
    }
  }
  return total;
}

// 给定一组记录和分类id映射，返回三大类时长总和（秒）
export function computeTotalsByType(
  records: ExerciseRecord[],
  typeToChildIds: Record<CategoryType, string[]>
): CategoryTotals {
  const result: CategoryTotals = { strength: 0, cardio: 0, recovery: 0 };
  for (const r of records) {
    for (const a of r.allocations) {
      for (const t of ['strength', 'cardio', 'recovery'] as CategoryType[]) {
        if (typeToChildIds[t].includes(a.category_id)) {
          result[t] += a.seconds;
          break;
        }
      }
    }
  }
  return result;
}

// 完成率（按 0~1 算）
export function completionRates(totals: CategoryTotals, goals: CategoryTotals): CategoryTotals {
  return {
    strength: goals.strength > 0 ? totals.strength / (goals.strength * 60) : 0,
    cardio: goals.cardio > 0 ? totals.cardio / (goals.cardio * 60) : 0,
    recovery: goals.recovery > 0 ? totals.recovery / (goals.recovery * 60) : 0,
  };
}

// 检查一组完成率是否三个都达到（≥）阈值
export function allAbove(rates: CategoryTotals, threshold: number): boolean {
  return rates.strength >= threshold && rates.cardio >= threshold && rates.recovery >= threshold;
}

// 检查一组完成率是否三个都低于（≤）阈值
export function allBelow(rates: CategoryTotals, threshold: number): boolean {
  return rates.strength <= threshold && rates.cardio <= threshold && rates.recovery <= threshold;
}

export interface LevelCheckResult {
  canLevelUp: boolean;
  canLevelDown: boolean;
  currentWeekRates: CategoryTotals;
  previousWeekRates: CategoryTotals;
}

// 给定：记录、当前等级的目标（min/周）、顶级分类 → 子项id映射
export function evaluateLevel(
  records: ExerciseRecord[],
  currentGoalsMin: CategoryTotals,
  typeToChildIds: Record<CategoryType, string[]>
): LevelCheckResult {
  const cur = getCurrentWeekRange();
  const prev = getPreviousWeekRange();

  const curRecords = records.filter(r => {
    const t = new Date(r.started_at);
    return t >= cur.start && t <= cur.end;
  });
  const prevRecords = records.filter(r => {
    const t = new Date(r.started_at);
    return t >= prev.start && t <= prev.end;
  });

  const curTotals = computeTotalsByType(curRecords, typeToChildIds);
  const prevTotals = computeTotalsByType(prevRecords, typeToChildIds);

  const curRates = completionRates(curTotals, currentGoalsMin);
  const prevRates = completionRates(prevTotals, currentGoalsMin);

  // 两周完全没有任何运动时长时，不做升降级判定
  // （否则新用户/长期未记录会被误判为「连续两周完成率 ≤50%」而提示降级）
  const hasAnyActivity =
    curTotals.strength + curTotals.cardio + curTotals.recovery > 0 ||
    prevTotals.strength + prevTotals.cardio + prevTotals.recovery > 0;

  // 升级：连续两周三类完成率均 ≥100%
  // 降级：连续两周三类完成率均 ≤50%
  // 两者互斥，不会同时成立
  const canLevelUp = hasAnyActivity && allAbove(curRates, 1.0) && allAbove(prevRates, 1.0);
  const canLevelDown = !canLevelUp && hasAnyActivity && allBelow(curRates, 0.5) && allBelow(prevRates, 0.5);

  return {
    canLevelUp,
    canLevelDown,
    currentWeekRates: curRates,
    previousWeekRates: prevRates,
  };
}

// 升/降级后更新目标：每级 +5% / -5%
export function applyLevelMultiplier(baseGoals: CategoryTotals, level: number): CategoryTotals {
  // 基础目标是 Lv1 时
  // Lv n：base * (1 + 0.05*(n-1))
  const factor = 1 + 0.05 * (level - 1);
  return {
    strength: Math.round(baseGoals.strength * factor),
    cardio: Math.round(baseGoals.cardio * factor),
    recovery: Math.round(baseGoals.recovery * factor),
  };
}

export const DEFAULT_BASE_GOALS_MIN: CategoryTotals = {
  strength: 80,
  cardio: 100,
  recovery: 30,
};