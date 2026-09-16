-- ====================================================================
-- let's go · 数据库 Schema（username 登录版，无 Supabase Auth）
-- 在 Supabase SQL Editor 中执行整个文件即可
-- ====================================================================

-- 0) app_users（纯用户名登录，每个用户名一个账户，跨设备共享）
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_app_users_username on public.app_users(username);

-- 1) user_settings（每个用户一行设置）
create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  level int not null default 1,
  strength_goal_min int not null default 80,
  cardio_goal_min int not null default 100,
  recovery_goal_min int not null default 30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- 2) categories（顶级 + 子项，自引用）
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  parent_id uuid references public.categories(id) on delete cascade,
  name text not null,
  type text check (type in ('strength','cardio','recovery')),
  sort_order int not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_categories_user on public.categories(user_id);
create index if not exists idx_categories_parent on public.categories(parent_id);

-- 3) exercise_records（运动记录 + 分配 JSON）
create table if not exists public.exercise_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  started_at timestamptz not null,
  duration_seconds int not null check (duration_seconds >= 0),
  allocations jsonb not null default '[]'::jsonb,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_records_user on public.exercise_records(user_id);
create index if not exists idx_records_started on public.exercise_records(started_at desc);

-- ====================================================================
-- RLS：关闭行级安全（个人 demo + 客户端按 user_id 强过滤）
-- 如果你以后要暴露给真实用户，记得回来打开 RLS 并加策略
-- ====================================================================
alter table public.app_users disable row level security;
alter table public.user_settings disable row level security;
alter table public.categories disable row level security;
alter table public.exercise_records disable row level security;

-- ====================================================================
-- 不再需要 Supabase Auth（邮箱 OTP / 匿名登录全部停用）
-- 之前的 schema 用的是 auth.users(id) 作外键，上面已经把外键切到
-- public.app_users(id)。如果是从旧 schema 升级，需要先清空旧表：
--   truncate table public.exercise_records cascade;
--   truncate table public.categories cascade;
--   truncate table public.user_settings cascade;
-- 然后再跑本脚本的建表语句（已用 create table if not exists，不会重复建）
-- ====================================================================