import { useState, useEffect } from 'react';
import { Category } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  topCategories: Category[];
  childrenByParent: Record<string, Category[]>;
  onAdd: (top: Category, name: string) => void;
  onRename: (cat: Category, name: string) => void;
  onDelete: (cat: Category) => Promise<{ movedRecords: number } | void>;
  // 该分类被多少条历史记录引用
  usageCount: (categoryId: string) => number;
}

export function CategoryManager({
  open, onClose, topCategories, childrenByParent, onAdd, onRename, onDelete, usageCount,
}: Props) {
  const [editing, setEditing] = useState<Category | null>(null);
  const [addingTo, setAddingTo] = useState<Category | null>(null);
  const [text, setText] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setEditing(null);
      setAddingTo(null);
      setText('');
      setNotice(null);
    }
  }, [open]);

  function startAdd(top: Category) {
    setAddingTo(top);
    setEditing(null);
    setText('');
  }

  function startRename(cat: Category) {
    setEditing(cat);
    setAddingTo(null);
    setText(cat.name);
  }

  function commit() {
    const t = text.trim();
    if (!t) return;
    if (addingTo) onAdd(addingTo, t);
    else if (editing) onRename(editing, t);
    setEditing(null);
    setAddingTo(null);
    setText('');
  }

  function parentNameOf(cat: Category): string {
    return topCategories.find(t => t.id === cat.parent_id)?.name ?? '所属大类';
  }

  async function confirmDelete(cat: Category) {
    const isTop = !cat.parent_id;
    const used = usageCount(cat.id);

    let msg = isTop
      ? `删除「${cat.name}」？其所有子项也会被删除。`
      : `删除「${cat.name}」？`;

    if (!isTop && used > 0) {
      msg += `\n\n该分类已被 ${used} 条运动记录使用。删除后这些时长会自动并入「${parentNameOf(cat)}」，不会丢失。`;
    }

    if (!confirm(msg)) return;

    const res = await onDelete(cat);
    if (res && res.movedRecords > 0) {
      setNotice(`已删除「${cat.name}」，${res.movedRecords} 条记录中的时长已并入「${parentNameOf(cat)}」`);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">管理任务池</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </div>

        {notice && (
          <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800">
            {notice}
          </div>
        )}

        <div className="space-y-4">
          {topCategories.map(top => (
            <div key={top.id} className="border border-slate-200 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium text-slate-700">{top.name}</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startAdd(top)}
                    className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                  >
                    + 添加子项
                  </button>
                </div>
              </div>
              <div className="mt-2 space-y-1">
                {(childrenByParent[top.id] ?? []).map(s => (
                  <div key={s.id} className="flex items-center justify-between py-1.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-sm text-slate-600">
                      · {s.name}
                      {usageCount(s.id) > 0 && (
                        <span className="ml-1.5 text-[10px] text-slate-400">{usageCount(s.id)} 条记录</span>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => startRename(s)} className="text-xs text-slate-500 hover:text-brand-600">重命名</button>
                      <button onClick={() => confirmDelete(s)} className="text-xs text-slate-500 hover:text-red-500">删除</button>
                    </div>
                  </div>
                ))}
                {(childrenByParent[top.id] ?? []).length === 0 && (
                  <div className="text-xs text-slate-400">无子项（点击上方"添加子项"创建）</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {(editing || addingTo) && (
          <div className="mt-5 border-t pt-4">
            <div className="text-xs text-slate-500 mb-2">
              {addingTo ? `为「${addingTo.name}」添加子项` : `重命名「${editing?.name}」`}
            </div>
            <div className="flex gap-2">
              <input
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="名称"
                autoFocus
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
              />
              <button className="btn-secondary px-4 py-2" onClick={() => { setEditing(null); setAddingTo(null); }}>
                取消
              </button>
              <button className="btn-primary px-4 py-2" onClick={commit}>保存</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}