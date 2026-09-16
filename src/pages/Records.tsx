import { useState } from 'react';
import { useApp, groupCategoriesByParent, categoryById } from '../store/useApp';
import { Category, ExerciseRecord, RecordAllocation } from '../types';
import { formatMinutes, formatTimeRange } from '../lib/time';
import { RecordEditDialog } from '../components/RecordEditDialog';
import { ManualEntryDialog } from '../components/ManualEntryDialog';

const TYPE_COLOR: Record<string, string> = {
  strength: '#ef4444',
  cardio: '#10b981',
  recovery: '#8b5cf6',
};

function colorForType(t: string | null | undefined): string {
  if (!t) return '#64748b';
  return TYPE_COLOR[t] ?? '#64748b';
}

export function Records() {
  const { categories, records, updateRecord, removeRecord } = useApp();
  const { top, childrenByParent } = groupCategoriesByParent(categories);
  const catMap = categoryById(categories);

  const [editRec, setEditRec] = useState<ExerciseRecord | null>(null);
  const [editTop, setEditTop] = useState<Category | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // 找一条记录对应的顶级分类（用于打开编辑弹窗）
  function findTopCategoryFor(rec: ExerciseRecord): Category | null {
    const firstAllocId = rec.allocations[0]?.category_id;
    if (!firstAllocId) return null;
    const cat = catMap[firstAllocId];
    if (!cat) return null;
    if (!cat.parent_id) {
      // 顶级（无子项时的记录）
      return cat;
    }
    return top.find(x => x.id === cat.parent_id) ?? null;
  }

  function startEdit(rec: ExerciseRecord) {
    const t = findTopCategoryFor(rec);
    if (!t) return;
    setEditRec(rec);
    setEditTop(t);
  }

  async function handleSaveEdit(allocs: RecordAllocation[]) {
    if (!editRec) return;
    await updateRecord(editRec.id, allocs);
    setEditRec(null);
    setEditTop(null);
  }

  async function handleDelete(rec: ExerciseRecord) {
    if (!confirm('确认删除这条记录？')) return;
    await removeRecord(rec.id);
  }

  return (
    <div className="space-y-4">
      <header className="px-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-slate-400">运动记录</div>
          <h1 className="text-2xl font-bold text-slate-800">记录你的每一次</h1>
          <div className="mt-1 text-sm text-slate-500">共 {records.length} 条记录</div>
        </div>
        <button
          onClick={() => setManualOpen(true)}
          className="flex-shrink-0 mt-1 px-3.5 py-1.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-full active:scale-95 transition"
        >
          + 补录
        </button>
      </header>

      {records.length === 0 ? (
        <div className="card text-center text-slate-500 py-12">
          还没有运动记录
          <div className="mt-2 text-xs">到首页按下 let's go 开始你的第一次运动</div>
          <div className="mt-1 text-xs">忘了记？点右上角「补录」手动补一条</div>
        </div>
      ) : (
      <div className="space-y-2">
        {records.map(r => {
          const mainTop = findTopCategoryFor(r);
          const topLabel = mainTop?.name ?? '运动';
          const topColor = colorForType(mainTop?.type);

          const allocSummary = r.allocations.map(a => {
            const cat = catMap[a.category_id];
            if (cat && !cat.parent_id) {
              // 无子项顶级记录：显示顶级名
              return { name: cat.name, sec: a.seconds };
            }
            return { name: cat?.name ?? '未知', sec: a.seconds };
          });

          return (
            <div key={r.id} className="card flex items-start gap-3">
              <div className="w-1 self-stretch rounded-full" style={{ backgroundColor: topColor }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-medium text-slate-800 text-sm truncate">{topLabel}</span>
                    {r.note === '补录' && (
                      <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200">
                        补录
                      </span>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-sm font-bold text-slate-800 tabular-nums">{formatMinutes(r.duration_seconds)}</div>
                </div>
                <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  {formatTimeRange(new Date(r.started_at), r.duration_seconds)}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {allocSummary.map((a, i) => (
                    <span key={i} className="chip bg-slate-100 text-slate-600">
                      {a.name} {formatMinutes(a.sec)}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => startEdit(r)}
                  className="text-xs text-brand-600 hover:text-brand-700 px-2 py-1"
                >
                  修改
                </button>
                <button
                  onClick={() => handleDelete(r)}
                  className="text-xs text-slate-400 hover:text-red-500 px-2 py-1"
                >
                  删除
                </button>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {manualOpen && (
        <ManualEntryDialog
          open={manualOpen}
          onClose={() => setManualOpen(false)}
          onSaved={min => {
            setToast(`已补录 ${min} 分钟`);
            window.setTimeout(() => setToast(null), 2200);
          }}
        />
      )}

      {editRec && editTop && (
        <RecordEditDialog
          topCategory={editTop}
          topColor={colorForType(editTop.type)}
          totalSeconds={editRec.duration_seconds}
          initialAllocations={editRec.allocations}
          onCancel={() => { setEditRec(null); setEditTop(null); }}
          onConfirm={handleSaveEdit}
        />
      )}

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 bg-slate-900/90 text-white text-sm px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}