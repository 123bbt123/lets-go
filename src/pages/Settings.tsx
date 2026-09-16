// 设置页：用户名 + 等级入口 + 切换账号
// 等级相关设置在独立的 /level 页面

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store/useApp';
import { signOut, getStoredUsername, clearUsernameFromUrl } from '../lib/userAuth';

export function Settings() {
  const { settings } = useApp();
  const navigate = useNavigate();

  if (!settings) {
    return <div className="text-center text-slate-400 py-12">设置加载中…</div>;
  }

  return (
    <div className="space-y-4">
      <header className="px-1">
        <div className="text-xs text-slate-400">设置</div>
        <h1 className="text-2xl font-bold text-slate-800">设置</h1>
      </header>

      <AccountCard
        username={getStoredUsername()}
        level={settings.level}
        onOpenLevel={() => navigate('/level')}
      />
    </div>
  );
}

function AccountCard({
  username, level, onOpenLevel,
}: {
  username: string | null;
  level: number;
  onOpenLevel: () => void;
}) {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (!confirm('确定要切换账号吗？切换后需要重新输入用户名。')) return;
    setSigningOut(true);
    try {
      await signOut();
      // 同时清掉地址栏用户名，避免刷新后又自动登回这个账号
      clearUsernameFromUrl();
      // 触发当前标签页的监听，回到 UsernameSetup
      window.dispatchEvent(new Event('letsgo:auth-changed'));
    } catch (e) {
      alert('切换失败：' + (e as Error).message);
      setSigningOut(false);
    }
  }

  return (
    <div className="card relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-brand-100 rounded-full -mr-12 -mt-12 opacity-50" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-slate-500">当前用户</div>
            <div className="mt-1 text-2xl font-bold text-slate-900 truncate">{username ?? '未知'}</div>
            <div className="text-xs text-slate-400 mt-0.5">同一用户名跨设备自动同步数据</div>
          </div>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex-shrink-0 px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-full hover:bg-slate-50 disabled:opacity-50"
          >
            {signingOut ? '切换中…' : '切换账号'}
          </button>
        </div>

        <button
          onClick={onOpenLevel}
          className="mt-3 flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 pl-3 pr-2.5 py-1.5 active:scale-[0.97] transition-transform"
        >
          <span className="text-sm font-bold text-brand-700">Lv.{level}</span>
          <span className="text-xs text-brand-600">任务设置</span>
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-brand-500" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
