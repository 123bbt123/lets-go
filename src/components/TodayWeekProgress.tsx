// 今日/本周完成进度卡片

import { useMemo } from 'react';
import { Category, ExerciseRecord } from '../types';
import { groupCategoriesByParent, typeToChildIds } from '../store/useApp';
import { startOfWeek, endOfWeek } from '../lib/week';
import { formatShortMinutes } from '../lib/time';
import { computeTotalsByType, completionRates, overallProgress } from '../lib/level';
import { UserSettings } from '../types';

interface Props {
  records: ExerciseRecord[];
  categories: Category[];
  settings: UserSettings | null;
}

export function TodayWeekProgress({ records, categories, settings }: Props) {
  const today = new Date();
  const weekStart = startOfWeek(today);
  const weekEnd = endOfWeek(today);

  const todayRecords = records.filter(r => {
    const t = new Date(r.started_at);
    return t.getFullYear() === today.getFullYear() && t.getMonth() === today.getMonth() && t.getDate() === today.getDate();
  });
  const weekRecords = records.filter(r => {
    const t = new Date(r.started_at);
    return t >= weekStart && t <= weekEnd;
  });

  const todaySec = todayRecords.reduce((s, r) => s + r.duration_seconds, 0);
  const map = typeToChildIds(categories);
  const weekTotals = computeTotalsByType(weekRecords, map);

  const goals = {
    strength: settings?.strength_goal_min ?? 80,
    cardio: settings?.cardio_goal_min ?? 100,
    recovery: settings?.recovery_goal_min ?? 30,
  };

  // 总进度：每个任务池封顶到 100% 后取平均（偏科不算数，三项都达标才是 100%）
  const progress = overallProgress(weekTotals, goals);
  const percent = Math.round(progress * 100);

  // 各任务池自己的完成率照常显示原始值，超额就显示超额（120% 就是 120%），不做封顶
  const each = completionRates(weekTotals, goals);
  const eachPct = (v: number) => Math.round(v * 100);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="card">
        <div className="text-xs text-slate-500">今日运动</div>
        <div className="mt-1 text-2xl font-bold text-slate-800 tabular-nums">{formatShortMinutes(todaySec)}</div>
      </div>
      <div className="card">
        <div className="text-xs text-slate-500">本周任务完成</div>
        <div className="mt-1 text-2xl font-bold text-brand-700 tabular-nums">{percent}%</div>
        <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 transition-all"
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>
        <div className="mt-1.5 text-[10px] text-slate-400 tabular-nums">
          力量 {eachPct(each.strength)}% · 有氧 {eachPct(each.cardio)}% · 拉伸 {eachPct(each.recovery)}%
        </div>
      </div>
    </div>
  );
}