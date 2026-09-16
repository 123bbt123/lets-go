import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Check .env file.');
}

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// ---------- 每次请求自报家门 ----------
// 应用没走 Supabase 登录，服务器分不清请求来自谁。
// 这里在请求头里带上当前用户名，配合数据库的访问策略做校验。
// 注意：用户名可能是中文，而 HTTP 头只能放 ASCII，所以统一用 base64 编码后再发。

const USERNAME_HEADER = 'x-username';

function toBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// 设置/清除用户名请求头；之后这个 client 发出的所有请求都会带上
export function setUsernameHeader(username: string | null): void {
  const rest = (supabase as unknown as { rest?: { headers?: Record<string, string> } }).rest;
  if (!rest) return;
  const headers: Record<string, string> = { ...(rest.headers ?? {}) };
  if (username) {
    headers[USERNAME_HEADER] = toBase64Utf8(username);
  } else {
    delete headers[USERNAME_HEADER];
  }
  rest.headers = headers;
}
