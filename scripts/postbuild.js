// 构建后生成 404.html 兜底
// 静态托管直接访问 /records 这类 SPA 子路径时，服务器找不到文件会返回 404；
// 多数平台（含 EdgeOne Pages、GitHub Pages）在找不到文件时会回落到 404.html，
// 内容同 index.html 且资源用相对路径，于是 SPA 路由能正常接管，页面照常显示。
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve(process.cwd(), 'dist');
const indexHtml = resolve(dist, 'index.html');

if (!existsSync(indexHtml)) {
  console.warn('[postbuild] 未找到 dist/index.html，跳过生成 404.html');
  process.exit(0);
}

copyFileSync(indexHtml, resolve(dist, '404.html'));
console.log('[postbuild] 已生成 dist/404.html（SPA 子路径兜底）');
