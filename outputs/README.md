# 问卷 MVP：生活数字直觉测验（可直接部署）

## 你要做的事（3 步）

1. 将 `outputs/index.html` 上传到你的静态站点目录。
2. 在 Cloudflare 上为该站点绑定自定义域名子域名，例如 `quiz.wormforce.net`。
3. 打开即可访问。

---

## 方案 A（推荐）：Cloudflare Pages（最省事）

1. 先到 Cloudflare Dashboard -> Workers & Pages -> Create application -> Pages project。
2. 选择 `Upload` 方式，或者先建一个仓库再接 Git 部署。
3. 上传/提交时只包含 `index.html`。
4. 部署完成后，进入 `Custom domains`，添加 `quiz.wormforce.net`。
5. 在 DNS 中保持一条 CNAME：
   - Name: `quiz`
   - Target: 你的 Pages 目标域名（或由 Cloudflare 自动托管）
   - Proxy: 打开

> 你现在是用 Cloudflare 买的域名（已经在 Cloudflare 托管 DNS 的话），这会非常顺。

---

## 方案 B：Cloudflare R2 + 静态网站

- 适合你未来内容多、想托管更多文件的情况。
- 上传 `index.html` 到 R2 bucket 并开启静态网站托管。
- 再用自定义域名 CNAME 指向该站点。

---

## 我已经帮你做好的

- 一份可直接打开的 MVP 页面（`index.html`）
- 题目覆盖生物/物理/机器/计算机/经济（共 12 题）
- 支持：
  - 随机出题
  - 每题即时打分
  - 按领域分析分数
  - 总体高估 / 低估倾向统计
  - 重新开始

## 文件

- `index.html`：最终可运行页面

