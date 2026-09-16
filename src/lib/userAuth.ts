// 纯 username 登录：localStorage 记一个 username，跨设备输入同名会绑到同一个账号
// 不依赖 Supabase Auth，anon key 直接查 app_users 表

import { supabase, setUsernameHeader } from './supabase';

const STORAGE_KEY = 'letsgo.username';

export interface AppUser {
  id: string;
  username: string;
  created_at: string;
}

export function getStoredUsername(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredUsername(username: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, username);
  } catch {
    // 隐私模式可能写不进去，忽略
  }
}

export function clearStoredUsername(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ---------- 地址栏携带用户名 ----------
// 手机浏览器（尤其 iOS Safari）隔一段时间会清掉 localStorage，
// 导致每次打开链接都要重新设置用户名。把用户名写进地址栏后，
// 只要用这个链接打开就能自动登录，同时会重新写回 localStorage。

const URL_PARAM = 'u';

export function getUsernameFromUrl(): string | null {
  try {
    const raw = new URLSearchParams(window.location.search).get(URL_PARAM);
    const clean = (raw ?? '').trim();
    return clean || null;
  } catch {
    return null;
  }
}

// 切换账号时必须把地址栏的用户名也清掉，否则刷新后又会用旧用户名自动登录
export function clearUsernameFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(URL_PARAM)) return;
    url.searchParams.delete(URL_PARAM);
    window.history.replaceState({}, '', url.toString());
  } catch {
    // ignore
  }
}

export function writeUsernameToUrl(username: string): void {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get(URL_PARAM) === username) return;
    url.searchParams.set(URL_PARAM, username);
    window.history.replaceState({}, '', url.toString());
  } catch {
    // ignore
  }
}

// 查询或创建用户：同名 username 永远返回同一个 user_id（保证跨设备共享）
export async function loginByUsername(username: string): Promise<AppUser> {
  const clean = username.trim();
  if (!clean) throw new Error('用户名不能为空');
  if (clean.length > 32) throw new Error('用户名不能超过 32 个字符');
  if (!/^[\w\u4e00-\u9fa5\-.]+$/.test(clean)) {
    throw new Error('用户名只能包含字母、数字、中文、横线、点');
  }

  // 先自报家门：后续所有请求都会带上用户名，数据库按它校验权限
  setUsernameHeader(clean);

  // 先查：username 必须唯一（unique 约束保证）
  const { data: existing, error: selectErr } = await supabase
    .from('app_users')
    .select('*')
    .eq('username', clean)
    .maybeSingle();
  if (selectErr) throw selectErr;
  if (existing) {
    setStoredUsername(clean);
    return existing as AppUser;
  }

  // 不存在则创建（并发情况靠 unique 约束兜底）
  const { data: created, error: insertErr } = await supabase
    .from('app_users')
    .insert({ username: clean })
    .select()
    .single();
  if (insertErr) {
    // 如果是唯一冲突（说明其他设备刚创建过），再查一次
    if (insertErr.code === '23505') {
      const { data: retry } = await supabase
        .from('app_users')
        .select('*')
        .eq('username', clean)
        .single();
      if (retry) {
        setStoredUsername(clean);
        return retry as AppUser;
      }
    }
    throw insertErr;
  }
  setStoredUsername(clean);
  return created as AppUser;
}

// 启动时调用：读 localStorage 的 username，查到 user 就返回
export async function getCurrentAppUser(): Promise<AppUser | null> {
  const username = getStoredUsername();
  if (!username) return null;
  setUsernameHeader(username);
  const { data, error } = await supabase
    .from('app_users')
    .select('*')
    .eq('username', username)
    .maybeSingle();
  if (error) {
    console.warn('查询用户失败', error);
    return null;
  }
  return (data as AppUser) ?? null;
}

// 切换账号：清掉 localStorage 即可
export async function signOut(): Promise<void> {
  clearStoredUsername();
  setUsernameHeader(null);
}