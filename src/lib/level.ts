// 升降级判定逻辑
// 规则（以「本周任务完成进度」为准，该进度 = 三个任务池各自封顶 100% 后取平均）：
// - 连续 2 周（当前周 + 上周）总进度均 ≥ 80% → 可升级（+1 级），目标 +5%
// - 连续 2 周总进度均 < 50% → 可降级（-1 级），目标 -5%
// - 单次只能 ±1 级，不跳级
// 注意：因为每项封顶，偏科不会拉高进度——只练一项时进度上限是 1/3，
// 连续两周如此会被判为「低于 50%」而提示降级。

import { CategoryType, ExerciseRecord } from '../types';
import { startOfWeek, endOfWeek, getCurrentWeekRange, getPreviousWeekRange } from './week';

export interface CategoryTotals {
  strength: number;
  cardio: number;
  recovery: number;
}

// 升降级阈值（总进度，0~1）
export const LEVEL_UP_THRESHOLD = 0.8;
export const LEVEL_DOWN_THRESHOLD = 0.5;

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

// 完成率（按 0~1 算，不封顶，超过 100% 就会大于 1）
export function completionRates(totals: CategoryTotals, goals: CategoryTotals): CategoryTotals {
  return {
    strength: goals.strength > 0 ? totals.strength / (goals.strength * 60) : 0,
    cardio: goals.cardio > 0 ? totals.cardio / (goals.cardio * 60) : 0,
    recovery: goals.recovery > 0 ? totals.recovery / (goals.recovery * 60) : 0,
  };
}

// 完成率，但每一项封顶到 100%（1.0）
export function cappedRates(totals: CategoryTotals, goals: CategoryTotals): CategoryTotals {
  return {
    strength: goals.strength > 0 ? Math.min(totals.strength / (goals.strength * 60), 1) : 0,
    cardio: goals.cardio > 0 ? Math.min(totals.cardio / (goals.cardio * 60), 1) : 0,
    recovery: goals.recovery > 0 ? Math.min(totals.recovery / (goals.recovery * 60), 1) : 0,
  };
}

/**
 * 本周总进度（0~1）：三个任务池各自封顶到 100% 之后取平均。
 * 偏科不计入——某一项做到 300% 也只按 100% 算。
 * 所以只练一项时进度最多 1/3 ≈ 33%，三项都达标才是 100%。
 */
export function overallProgress(totals: CategoryTotals, goals: CategoryTotals): number {
  const capped = cappedRates(totals, goals);
  return (capped.strength + capped.cardio + capped.recovery) / 3;
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
  // 首页那个「本周任务完成」的总进度（封顶后取平均）
  currentWeekProgress: number;
  previousWeekProgress: number;
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

  // 总进度：三个任务池各自封顶 100% 后取平均（与首页进度条同一套算法）
  const curProgress = overallProgress(curTotals, currentGoalsMin);
  const prevProgress = overallProgress(prevTotals, currentGoalsMin);

  // 升级：连续两周总进度都达到 80%
  // 降级：连续两周总进度都低于 50%
  // 两者互斥，不会同时成立
  const canLevelUp = hasAnyActivity && curProgress >= LEVEL_UP_THRESHOLD && prevProgress >= LEVEL_UP_THRESHOLD;
  const canLevelDown =
    !canLevelUp && hasAnyActivity && curProgress < LEVEL_DOWN_THRESHOLD && prevProgress < LEVEL_DOWN_THRESHOLD;

  return {
    canLevelUp,
    canLevelDown,
    currentWeekRates: curRates,
    previousWeekRates: prevRates,
    currentWeekProgress: curProgress,
    previousWeekProgress: prevProgress,
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