// 补录：忘记按开始计时时，手动补一条记录
// 只需要三样东西：项目、时长、运动时间

import { useEffect, useMemo, useState } from 'react';
import { useApp, groupCategoriesByParent } from '../store/useApp';
import { Category } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: (minutes: number) => void;
}

const QUICK_MINUTES = [10, 20, 30, 45, 60];

// datetime-local 需要的本地时间字符串：YYYY-MM-DDTHH:mm
function nowLocalInput(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function topColor(type: Category['type']): string {
  if (type === 'strength') return '#ef4444';
  if (type === 'cardio') return '#10b981';
  if (type === 'recovery') return '#8b5cf6';
  return '#64748b';
}

export function ManualEntryDialog({ open, onClose, onSaved }: Props) {
  const { categories, createRecord } = useApp();
  const { top, childrenByParent } = useMemo(
    () => groupCategoriesByParent(categories),
    [categories]
  );

  const [topId, setTopId] = useState<string>('');
  const [minutes, setMinutes] = useState<Record<string, number>>({});
  const [when, setWhen] = useState<string>(nowLocalInput);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 每次打开都重置成干净状态
  useEffect(() => {
    if (!open) return;
    setTopId('');
    setMinutes({});
    setWhen(nowLocalInput());
    setError(null);
    setSaving(false);
  }, [open]);

  if (!open) return null;

  const activeTopId = topId || top[0]?.id || '';
  const activeTop = top.find(t => t.id === activeTopId) ?? null;
  const children = childrenByParent[activeTopId] ?? [];
  // 大类没有子项时，就直接记在大类上
  const rows: Category[] = children.length > 0 ? children : (activeTop ? [activeTop] : []);

  const totalMin = rows.reduce((s, r) => s + (minutes[r.id] ?? 0), 0);

  function setRowMinutes(id: string, val: number) {
    const v = Math.max(0, Math.min(1440, Math.round(val) || 0));
    setMinutes(prev => ({ ...prev, [id]: v }));
  }

  async function save() {
    if (saving) return;

    const allocs = rows
      .filter(r => (minutes[r.id] ?? 0) > 0)
      .map(r => ({ category_id: r.id, seconds: Math.round((minutes[r.id] ?? 0) * 60) }));

    const totalSec = allocs.reduce((s, a) => s + a.seconds, 0);
    if (totalSec <= 0) {
      setError('请至少给一个项目填上时长');
      return;
    }

    const startedAt = new Date(when);
    if (isNaN(startedAt.getTime())) {
      setError('请选择运动时间');
      return;
    }
    if (startedAt.getTime() > Date.now() + 60_000) {
      setError('运动时间不能晚于现在');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await createRecord(startedAt, totalSec, allocs, '补录');
      onSaved?.(Math.round(totalSec / 60));
      onClose();
    } catch (e) {
      setError('保存失败：' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">补录运动</h3>
            <div className="text-xs text-slate-400 mt-0.5">忘记录时就手动补一条</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </div>

        {/* 运动时间 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">运动时间</label>
          <input
            type="datetime-local"
            value={when}
            onChange={e => setWhen(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:border-brand-400 focus:outline-none"
          />
        </div>

        {/* 选择大类 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">项目类别</label>
          <div className="grid grid-cols-3 gap-2">
            {top.map(t => {
              const active = t.id === activeTopId;
              return (
                <button
                  key={t.id}
                  onClick={() => { setTopId(t.id); setMinutes({}); }}
                  className={`py-2 rounded-xl text-sm border transition ${
                    active ? 'text-white font-medium' : 'text-slate-600 bg-white'
                  }`}
                  style={
                    active
                      ? { backgroundColor: topColor(t.type), borderColor: topColor(t.type) }
                      : { borderColor: '#e2e8f0' }
                  }
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* 具体项目 + 时长 */}
        <div className="mb-1">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-700">时长（分钟）</label>
            <span className="text-xs text-slate-500 tabular-nums">合计 {totalMin} 分钟</span>
          </div>

          {rows.length === 0 ? (
            <div className="text-xs text-slate-400">暂无可选项目</div>
          ) : (
            <div className="space-y-2">
              {rows.map(r => (
                <div key={r.id} className="flex items-center gap-3">
                  <span className="flex-1 text-sm text-slate-700 truncate">{r.name}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={1440}
                    step={1}
                    value={minutes[r.id] ?? ''}
                    placeholder="0"
                    onChange={e => setRowMinutes(r.id, Number(e.target.value))}
                    className="w-20 border border-slate-300 rounded-lg px-3 py-2 text-sm text-center tabular-nums focus:border-brand-400 focus:outline-none"
                  />
                  <span className="text-xs text-slate-400 w-6">分钟</span>
                </div>
              ))}
            </div>
          )}

          {/* 常用时长快捷填入：只填一项时直接给第一个项目赋值 */}
          {rows.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {QUICK_MINUTES.map(m => (
                <button
                  key={m}
                  onClick={() => setRowMinutes(rows[0].id, m)}
                  className="px-2.5 py-1 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition"
                >
                  {m} 分钟
                </button>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>
        )}

        <div className="mt-5 flex gap-3">
          <button className="btn-secondary flex-1 py-3" onClick={onClose} disabled={saving}>
            取消
          </button>
          <button
            className="btn-primary flex-1 py-3 disabled:opacity-50"
            onClick={save}
            disabled={saving || totalMin <= 0}
          >
            {saving ? '保存中…' : '记录'}
          </button>
        </div>
      </div>
    </div>
  );
}
