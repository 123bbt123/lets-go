// 大类选择弹窗（首页结束计时时先选大类，再选子项+比例）

import { Category } from '../types';
import { TYPE_LABEL } from '../types';

interface Props {
  topCategories: Category[];
  onPick: (top: Category) => void;
  onCancel: () => void;
}

export function TopCategoryPicker({ topCategories, onPick, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6">
        <h3 className="text-lg font-semibold text-slate-800">选择本次运动类型</h3>
        <p className="text-sm text-slate-500 mt-1 mb-4">大类选好后可分配到子项</p>
        <div className="space-y-3">
          {topCategories.map(t => (
            <button
              key={t.id}
              onClick={() => onPick(t)}
              className="w-full text-left border border-slate-200 hover:border-brand-400 hover:bg-brand-50/40 rounded-xl p-4 flex items-center gap-3 active:scale-[0.99] transition-all"
            >
              <span
                className="w-2 h-8 rounded-full"
                style={{ backgroundColor: t.type === 'strength' ? '#ef4444' : t.type === 'cardio' ? '#10b981' : '#8b5cf6' }}
              />
              <div className="flex-1">
                <div className="font-medium text-slate-800">{t.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {t.type ? TYPE_LABEL[t.type] : ''}
                </div>
              </div>
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          ))}
        </div>
        <button className="mt-6 btn-secondary w-full py-3" onClick={onCancel}>
          取消
        </button>
      </div>
    </div>
  );
}