import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './store/useApp';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { TaskPool } from './pages/TaskPool';
import { Records } from './pages/Records';
import { Settings } from './pages/Settings';
import { LevelSettings } from './pages/LevelSettings';
import UsernameSetup from './pages/UsernameSetup';
import {
  AppUser,
  getCurrentAppUser,
  getStoredUsername,
  getUsernameFromUrl,
  loginByUsername,
  writeUsernameToUrl,
} from './lib/userAuth';

// 解析当前用户：地址栏 ?u=用户名 优先（可用来免输入直达），否则读本地存储
async function resolveAppUser(): Promise<AppUser | null> {
  const fromUrl = getUsernameFromUrl();
  if (fromUrl) {
    if (fromUrl === getStoredUsername()) {
      return getCurrentAppUser();
    }
    try {
      return await loginByUsername(fromUrl);
    } catch (e) {
      console.warn('地址栏用户名登录失败，回退到本地存储', e);
    }
  }
  return getCurrentAppUser();
}

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // 登录后把用户名写进地址栏，之后用这个链接打开就能直接进首页
  useEffect(() => {
    if (user) writeUsernameToUrl(user.username);
  }, [user]);

  // 启动 + 监听跨标签页 username 变化
  useEffect(() => {
    let mounted = true;
    (async () => {
      const u = await resolveAppUser();
      if (mounted) {
        setUser(u);
        setAuthReady(true);
      }
    })();

    function refresh() {
      if (!mounted) return;
      getCurrentAppUser().then(u => mounted && setUser(u));
    }

    // 跨标签页登录/登出同步
    window.addEventListener('storage', refresh);
    // 当前标签页 storage 写入不会触发 storage 事件，所以也监听一个自定义事件
    window.addEventListener('letsgo:auth-changed', refresh);
    return () => {
      mounted = false;
      window.removeEventListener('storage', refresh);
      window.removeEventListener('letsgo:auth-changed', refresh);
    };
  }, []);

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        加载中…
      </div>
    );
  }

  if (!user) {
    return <UsernameSetup />;
  }

  return (
    <AppProvider userId={user.id}>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pool" element={<TaskPool />} />
          <Route path="/records" element={<Records />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/level" element={<LevelSettings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </AppProvider>
  );
}