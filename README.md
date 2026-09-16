# Let's Go · 让一分钟的运动也有意义

运动计时与记录应用。按下开始计时，结束后把时长分配到具体项目，按周统计力量 / 有氧 / 拉伸三类目标的完成情况，并根据连续两周的表现提示升级或降级。

线上地址：https://123bbt123.github.io/lets-go/

## 技术栈

- Vite 5 + React 18 + TypeScript
- Tailwind CSS
- Supabase（Postgres）做数据存储与跨设备同步
- ECharts 画周折线图

## 本地运行

```bash
npm install
cp .env.example .env.local   # 填入自己的 Supabase 地址与 anon key
npm run dev                  # http://localhost:5173
```

其他命令：

```bash
npm run build     # 构建到 dist/，并自动生成 404.html（SPA 子路径兜底）
npm run preview   # 本地预览构建结果
```

## 目录结构

```
src/
  components/     界面组件（计时器、运动模式、分配弹窗、补录弹窗、周折线图等）
  pages/          页面（首页 / 任务池 / 运动记录 / 设置 / 等级设置 / 用户名设置）
  lib/            数据访问（data.ts）、等级判定（level.ts）、周与时间工具、登录
  store/          全局状态（Context）
supabase/         建表与权限相关 SQL，改动数据库时按需在 SQL Editor 执行
scripts/          构建后处理脚本
public/           图标、manifest、Service Worker
```

## 登录与数据

没有密码体系。第一次打开时输入一个用户名即可，**同名即同一账号**，在不同设备输入相同用户名就会读到同一份数据。

每次请求会在请求头里带上当前用户名（base64 编码，兼容中文），Supabase 的行级安全策略据此判断这条数据是不是你的。这能挡住拿到密钥的陌生人，但**不是强认证**——知道你的用户名的人仍可冒充。要更强的安全需要改成邮箱登录。

## 数据表

- `app_users`：用户名到用户 id 的映射
- `user_settings`：等级与三类周目标
- `categories`：任务池分类（大类 + 子项）
- `exercise_records`：运动记录，时长按项目分配存在 `allocations` 里

## 部署

本仓库用两个分支：

- `main`：源码
- `gh-pages`：构建产物，GitHub Pages 从这里发布

更新线上内容的流程：

```bash
npm run build
# 把 dist/ 的内容同步到 gh-pages 分支后推送
```

Pages 的发布源是 `gh-pages` 分支的根目录，**不要**把它切回 `main`，否则线上会变成源码页面。

### 图标相关

- `manifest.json` 里的 `start_url` / `scope` / 图标路径都用**绝对地址**。
  写在子路径部署时用相对路径，部分手机会解析成根域名导致打开 404。
- 必须保留 Service Worker（`public/sw.js`）。没有它，手机只会创建普通快捷方式，
  不会使用 manifest 里指定的图标。
- 改完图标后，已添加到桌面的旧图标不会自动更新，需要删掉重新添加。
