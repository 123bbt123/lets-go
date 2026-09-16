import { useState } from 'react';
import { loginByUsername } from '../lib/userAuth';

export default function UsernameSetup() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const valid = username.trim().length > 0 && username.trim().length <= 32;

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!valid || loading) return;
    setError('');
    setLoading(true);
    try {
      await loginByUsername(username);
      // 通知 App.tsx 重新读取用户，自动切到主页
      window.dispatchEvent(new Event('letsgo:auth-changed'));
    } catch (e: any) {
      setError(humanizeError(e));
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500 text-white text-3xl mb-3">
            🏃
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Let's go</h1>
          <p className="text-slate-500 mt-1 text-sm">让一分钟的运动也存在意义</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-7">
          <h2 className="text-lg font-semibold text-slate-900 mb-1">设置一个用户名</h2>
          <p className="text-slate-500 text-sm mb-5">
            同一用户名在不同设备上会自动同步数据。换浏览器/清缓存后重新输入即可恢复。
          </p>

          <label className="block text-sm font-medium text-slate-700 mb-2">用户名</label>
          <input
            type="text"
            autoFocus
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="比如：runner-2026"
            maxLength={32}
            className="w-full px-4 py-3 border border-slate-200 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
          />

          <button
            type="submit"
            disabled={!valid || loading}
            className="w-full py-3 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 transition"
          >
            {loading ? '进入中…' : '开始记录 →'}
          </button>

          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>
          )}

          <ul className="mt-5 text-xs text-slate-400 space-y-1">
            <li>• 不需要邮箱，不需要密码</li>
            <li>• 支持中英文、数字、横线、点</li>
            <li>• 首次输入会自动注册，同名即同一账号</li>
          </ul>
        </form>
      </div>
    </div>
  );
}

function humanizeError(e: any): string {
  const msg = (e?.message || String(e)).toLowerCase();
  if (msg.includes('username') && (msg.includes('invalid') || msg.includes('check'))) {
    return '用户名只能包含字母、数字、中文、横线、点';
  }
  if (msg.includes('network') || msg.includes('fetch')) return '网络异常，请检查连接';
  if (msg.includes('超过') || msg.includes('32')) return '用户名不能超过 32 个字符';
  return e?.message || '操作失败，请重试';
}