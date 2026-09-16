import { useEffect, useState } from 'react';
import { Category, RecordAllocation } from '../types';
import { formatMinutes } from '../lib/time';
import { useApp } from '../store/useApp';

interface Props {
  topCategory: Category;
  topColor: string;
  totalSeconds: number;
  onCancel: () => void;
  onConfirm: (allocs: RecordAllocation[]) => void | Promise<void>;
}

export function AllocationDialog({ topCategory, topColor, totalSeconds, onCancel, onConfirm }: Props) {
  const { categories } = useApp();
  const children = categories
    .filter(c => c.parent_id === topCategory.id)
    .sort((a, b) => a.sort_order - b.sort_order);

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [ratios, setRatios] = useState<Record<string, number>>({});
  // 提交中锁：createRecord 是异步的，没这层保护时重复点确认会写出两条一样的记录
  const [submitting, setSubmitting] = useState(false);

  async function submit(allocs: RecordAllocation[]) {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(allocs);
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    const ids = Object.keys(selected).filter(k => selected[k]);
    if (ids.length === 0) {
      setRatios({});
      return;
    }
    setRatios(prev => {
      const next = { ...prev };
      const assignedIds = ids.filter(id => next[id] != null);
      const unassignedIds = ids.filter(id => next[id] == null);
      const assignedSum = assignedIds.reduce((sum, id) => sum + (next[id] ?? 0), 0);
      const remaining = Math.max(0, 100 - assignedSum);
      const each = unassignedIds.length > 0 ? remaining / unassignedIds.length : 0;
      for (const id of unassignedIds) next[id] = Math.round(each * 10) / 10;
      return next;
    });
  }, [selected]);

  function changeRatio(id: string, val: number) {
    setRatios(prev => {
      const ids = Object.keys(selected).filter(k => selected[k]);
      const next = { ...prev, [id]: Math.max(0, Math.min(100, val)) };
      const others = ids.filter(x => x !== id);
      const otherSum = others.reduce((s, x) => s + (next[x] ?? 0), 0);
      const remain = Math.max(0, 100 - next[id]);
      const otherTotal = others.reduce((s, x) => s + (next[x] ?? 0), 0) || 1;
      for (const x of others) {
        const portion = otherSum > 0 ? (next[x] / otherTotal) * remain : remain / others.length;
        next[x] = Math.round(portion * 10) / 10;
      }
      return next;
    });
  }

  function toggle(id: string) {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }));
  }

  const selectedIds = Object.keys(selected).filter(k => selected[k]);
  const ratioSum = selectedIds.reduce((s, id) => s + (ratios[id] ?? 0), 0);
  const canSubmit = selectedIds.length > 0 && Math.abs(ratioSum - 100) < 0.5;

  const allocs: RecordAllocation[] = selectedIds.map(id => ({
    category_id: id,
    seconds: Math.round((ratios[id] / 100) * totalSeconds),
  }));

  if (children.length === 0) {
    return (
      <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center">
        <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6">
          <h3 className="text-lg font-semibold text-slate-800">记录到「{topCategory.name}」</h3>
          <p className="mt-2 text-sm text-slate-500">
            本次运动：<b>{formatMinutes(totalSeconds)}</b>，将全部计入该任务。
          </p>
          <div className="mt-6 flex gap-3">
            <button className="btn-secondary flex-1 py-3" onClick={onCancel} disabled={submitting}>取消</button>
            <button
              className="btn-primary flex-1 py-3 disabled:opacity-60"
              style={{ backgroundColor: topColor }}
              disabled={submitting}
              onClick={() => submit([{ category_id: topCategory.id, seconds: totalSeconds }])}
            >
              {submitting ? '保存中…' : '确认'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: topColor }} />
          <h3 className="text-lg font-semibold text-slate-800">记录到「{topCategory.name}」</h3>
        </div>
        <p className="text-sm text-slate-500 mb-4">本次运动：<b>{formatMinutes(totalSeconds)}</b></p>

        <div className="space-y-3">
          {children.map(c => {
            const sel = !!selected[c.id];
            const ratio = ratios[c.id] ?? 0;
            const sec = Math.round((ratio / 100) * totalSeconds);
            return (
              <div key={c.id} className={`border rounded-xl p-3 ${sel ? 'border-brand-400 bg-brand-50/40' : 'border-slate-200'}`}>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sel}
                    onChange={() => toggle(c.id)}
                    className="w-5 h-5 accent-brand-600"
                  />
                  <span className="flex-1 text-sm font-medium text-slate-700">{c.name}</span>
                  {sel && (
                    <span className="text-xs text-slate-500 tabular-nums">
                      {ratio.toFixed(0)}% · {formatMinutes(sec)}
                    </span>
                  )}
                </label>
                {sel && selectedIds.length > 1 && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-8">0</span>
                    <input
                      type="range"
                      className="alloc flex-1"
                      min={0}
                      max={100}
                      step={1}
                      value={ratio}
                      onChange={e => changeRatio(c.id, Number(e.target.value))}
                      style={{
                        background: `linear-gradient(to right, ${topColor} 0%, ${topColor} ${ratio}%, #e2e8f0 ${ratio}%, #e2e8f0 100%)`,
                      }}
                    />
                    <span className="text-xs text-slate-400 w-8 text-right">100</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 text-xs text-slate-500 flex justify-between">
          <span>已选 {selectedIds.length} 项</span>
          <span className={Math.abs(ratioSum - 100) > 0.5 ? 'text-red-500' : 'text-emerald-600'}>
            比例合计：{ratioSum.toFixed(0)}%
          </span>
        </div>

        <div className="mt-6 flex gap-3">
          <button className="btn-secondary flex-1 py-3" onClick={onCancel} disabled={submitting}>取消</button>
          <button
            className="btn-primary flex-1 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => canSubmit && submit(allocs)}
            disabled={!canSubmit || submitting}
          >
            {submitting ? '保存中…' : '确认保存'}
          </button>
        </div>
      </div>
    </div>
  );
}