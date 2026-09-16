import { useMemo, useState } from 'react';
import { useApp, groupCategoriesByParent } from '../store/useApp';
import { WeeklyChart } from '../components/WeeklyChart';
import { CategoryManager } from '../components/CategoryManager';
import { Category } from '../types';
import { formatMinutes } from '../lib/time';

export function TaskPool() {
  const { categories, records, settings, addCategory, renameCategory, removeCategory } = useApp();
  const { top, childrenByParent } = groupCategoriesByParent(categories);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);

  // 每个分类被多少条历史记录引用（用于删除前提示）
  const usageCount = useMemo(() => {
    const counter: Record<string, number> = {};
    for (const r of records) {
      const seen = new Set<string>();
      for (const a of r.allocations ?? []) {
        if (seen.has(a.category_id)) continue; // 同一条记录只计一次
        seen.add(a.category_id);
        counter[a.category_id] = (counter[a.category_id] ?? 0) + 1;
      }
    }
    return (categoryId: string) => counter[categoryId] ?? 0;
  }, [records]);

  function toggle(id: string) {
    setExpanded(prev => (prev === id ? null : id));
  }

  return (
    <div className="relative space-y-4">
      <header className="px-1">
        <div className="text-xs text-slate-400">任务池</div>
        <h1 className="text-2xl font-bold text-slate-800">你的运动版图</h1>
      </header>

      <div className="space-y-3">
        {top.map(t => {
          const children = childrenByParent[t.id] ?? [];
          const color =
            t.type === 'strength' ? '#ef4444' :
            t.type === 'cardio' ? '#10b981' : '#8b5cf6';
          const isExpanded = expanded === t.id;

          const { timeSec, childStats, completionPercent } = computeStats(t, children, records, settings ? {
            strength: settings.strength_goal_min,
            cardio: settings.cardio_goal_min,
            recovery: settings.recovery_goal_min,
          } : undefined);

          return (
            <div key={t.id} className="card">
              <button
                className="w-full text-left flex items-center gap-3"
                onClick={() => toggle(t.id)}
              >
                <span className="w-2 h-12 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between">
                    <span className="text-base font-semibold text-slate-800">{t.name}</span>
                    <span className="text-sm text-slate-500 tabular-nums">{completionPercent}%</span>
                  </div>
                  <div className="mt-1 text-sm text-slate-500 tabular-nums">本周 {formatMinutes(timeSec)}</div>
                  <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all"
                      style={{ width: `${Math.min(100, completionPercent)}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
                <svg viewBox="0 0 24 24" className={`w-5 h-5 text-slate-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {/* 子项列表 */}
              {children.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-3 space-y-2">
                  {children.map(c => {
                    const s = childStats[c.id] ?? { sec: 0, pct: 0 };
                    return (
                      <div key={c.id} className="flex items-center gap-2">
                        <span className="text-sm text-slate-700 w-16 flex-shrink-0">{c.name}</span>
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full"
                            style={{ width: `${Math.min(100, s.pct)}%`, backgroundColor: color }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 tabular-nums w-12 text-right flex-shrink-0">{formatMinutes(s.sec)}</span>
                        <span className="text-xs text-slate-400 tabular-nums w-10 text-right flex-shrink-0">{s.pct}%</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {isExpanded && (
                <WeeklyChart topCategory={t} childCategories={children} records={records} />
              )}
            </div>
          );
        })}
      </div>

      {/* 管理按钮：右下角浮动 */}
      <button
        onClick={() => setManagerOpen(true)}
        className="fixed bottom-24 right-4 z-30 w-12 h-12 rounded-full bg-brand-600 hover:bg-brand-700 text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        aria-label="管理任务池"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      <CategoryManager
        open={managerOpen}
        onClose={() => setManagerOpen(false)}
        topCategories={top}
        childrenByParent={childrenByParent}
        onAdd={addCategory}
        onRename={renameCategory}
        onDelete={removeCategory}
        usageCount={usageCount}
      />
    </div>
  );
}

// 计算各大类本周时长、子项在大类内的占比、完成率（基于 settings）
function computeStats(top: Category, children: Category[], records: any[], settingsMin?: { strength: number; cardio: number; recovery: number }) {
  const childIds = new Set(children.map(c => c.id));
  if (children.length === 0) childIds.add(top.id); // 无子项时使用顶级 id
  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  const dow = monday.getDay();
  const offset = (dow + 6) % 7;
  monday.setDate(monday.getDate() - offset);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 7);
  sunday.setMilliseconds(-1);

  const weekRecords = records.filter(r => {
    const t = new Date(r.started_at);
    return t >= monday && t <= sunday;
  });

  let timeSec = 0;
  const childStats: Record<string, { sec: number; pct: number }> = {};
  for (const c of children) childStats[c.id] = { sec: 0, pct: 0 };

  for (const r of weekRecords) {
    for (const a of r.allocations) {
      if (childIds.has(a.category_id)) {
        timeSec += a.seconds;
        // 仅在属于子项时记录到子项 stats
        if (children.find(c => c.id === a.category_id)) {
          childStats[a.category_id].sec += a.seconds;
        }
      }
    }
  }

  const total = timeSec || 1;
  for (const c of children) {
    childStats[c.id].pct = Math.round((childStats[c.id].sec / total) * 100);
  }

  let completionPercent = 0;
  if (settingsMin && top.type) {
    const goalMin = settingsMin[top.type];
    completionPercent = goalMin > 0 ? Math.round((timeSec / (goalMin * 60)) * 100) : 0;
  }

  return { timeSec, childStats, completionPercent };
}