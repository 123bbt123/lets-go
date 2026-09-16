# 数据库 Schema 使用说明

## 部署步骤

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)，打开本项目 `alcawantuqfuzifyazhd`。
2. 在左侧菜单 **SQL Editor** → **New query**，把 `schema.sql` 整段粘贴进去执行。
3. 在 **Authentication → Providers** 找到 **Anonymous**，打开开关（Sign in with anonymous）。
4. 完成后前端 `signInAnonymously()` 会自动创建匿名用户，每个浏览器一个独立身份。

## 表结构

| 表 | 作用 |
|----|------|
| `user_settings` | 单行用户设置：等级 + 三类周目标 |
| `categories` | 顶级 + 子项分类，自引用 `parent_id` |
| `exercise_records` | 运动记录，`allocations` JSON 存分配比例 |

## RLS 策略

所有表都开启了行级安全策略，前端 anon key 只能读/写 `user_id = auth.uid()` 的数据，
不同匿名用户之间完全隔离。