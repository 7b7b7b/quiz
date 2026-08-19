# 生活数字直觉测验（quiz）

## 本地/仓库结构
- `outputs/index.html`：前端页面
- `worker.js`：Cloudflare Worker（静态资源服务 + 统计 API）
- `wrangler.jsonc`：部署配置
- `migrations/0001_init.sql`：D1 数据库建表语句

## 目标
每位用户完成测验后会把结果上报到 `POST /api/quiz/complete`，并可在结果页查看公开统计：`GET /api/quiz/stats`。

## 创建 D1 并绑定
```bash
wrangler d1 create quiz-stats
wrangler d1 execute quiz-stats --file migrations/0001_init.sql
```

把 `d1 database id` 填回 `wrangler.jsonc` 中的 `d1_databases[0].database_id`。

## 发布
```bash
git add .
git commit -m "..."
git push
```

在 Cloudflare 控制台中确保该项目部署使用的是根目录的 `wrangler.jsonc`。

## API 说明
- `POST /api/quiz/complete`
  - body：`{ sessionId, attemptToken, totalScore, questionCount, overCount, underCount, exactCount, durationMs, answers }`
  - `answers` 中的每项：`{ questionIndex, category, score, direction }`
    - `direction` 取值：`over` / `under` / `exact`
- `GET /api/quiz/stats?score=xx`
  - 返回 `totalAttempts`、`averageScore`、`averageDurationMs`、`scoreDistribution`、`categoryStats`、`percentile`
