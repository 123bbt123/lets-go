-- ====================================================================
-- let's go · username 登录版迁移脚本
-- 在 Supabase SQL Editor 中【完整执行】这个文件即可
-- 会删除旧的 3 张表（里面的测试数据会清空）并重建为 username 版
-- ====================================================================

-- 1) 删旧表（外键挂在 auth.users 上，必须删了重建）
drop table if exists public.exercise_records cascade;
drop table if exists public.categories cascade;
drop table if exists public.user_settings cascade;

-- 2) 用户表：username 唯一，同名 = 同一账号（跨设备同步的依据）
create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  created_at timestamptz not null default now()
);

create index idx_app_users_username on public.app_users(username);

-- 3) 设置表
create table public.user_settings (
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

-- 4) 分类表
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  parent_id uuid references public.categories(id) on delete cascade,
  name text not null,
  type text check (type in ('strength','cardio','recovery')),
  sort_order int not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_categories_user on public.categories(user_id);
create index idx_categories_parent on public.categories(parent_id);

-- 5) 运动记录表
create table public.exercise_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  started_at timestamptz not null,
  duration_seconds int not null check (duration_seconds >= 0),
  allocations jsonb not null default '[]'::jsonb,
  note text,
  created_at timestamptz not null default now()
);

create index idx_records_user on public.exercise_records(user_id);
create index idx_records_started on public.exercise_records(started_at desc);

-- 6) 关闭 RLS（前端用 anon key 直接访问，按 user_id 过滤）
alter table public.app_users disable row level security;
alter table public.user_settings disable row level security;
alter table public.categories disable row level security;
alter table public.exercise_records disable row level security;