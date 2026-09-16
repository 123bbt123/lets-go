-- ============================================================
-- let's go · 紧急修复：关闭 4 张表的 RLS
-- （username 登录方案不需要 RLS，前端按 user_id 过滤）
-- 在 Supabase SQL Editor 中执行
-- ============================================================

-- 先删掉可能存在的旧策略（避免 RLS 开启时残留 policy 拦截）
drop policy if exists "app_users_select" on public.app_users;
drop policy if exists "app_users_insert" on public.app_users;
drop policy if exists "app_users_update" on public.app_users;
drop policy if exists "app_users_delete" on public.app_users;

-- 关闭所有表的 RLS
alter table public.app_users disable row level security;
alter table public.user_settings disable row level security;
alter table public.categories disable row level security;
alter table public.exercise_records disable row level security;