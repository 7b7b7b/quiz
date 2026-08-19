export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/quiz/')) {
      return handleApiRequest(request, env);
    }
    if (!env.ASSETS) {
      return new Response('Missing ASSETS binding', { status: 500 });
    }
    return env.ASSETS.fetch(request);
  }
};

function responseJson(body, options = {}) {
  return new Response(JSON.stringify(body), {
    status: options.status || 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

async function handleApiRequest(request, env) {
  const url = new URL(request.url);
  if (url.pathname === '/api/quiz/complete') {
    if (request.method !== 'POST') {
      return responseJson({ ok: false, message: 'method_not_allowed' }, { status: 405 });
    }
    return submitResult(request, env);
  }
  if (url.pathname === '/api/quiz/stats') {
    if (request.method !== 'GET') {
      return responseJson({ ok: false, message: 'method_not_allowed' }, { status: 405 });
    }
    const score = Number(url.searchParams.get('score'));
    return getStats(env, Number.isFinite(score) ? score : null);
  }
  return responseJson({ ok: false, message: 'not_found' }, { status: 404 });
}

async function submitResult(request, env) {
  if (!env.DB) {
    return responseJson({ ok: false, message: 'database_not_configured' }, { status: 500 });
  }

  const payload = await parseJsonBody(request);
  const errors = validatePayload(payload);
  if (errors.length > 0) {
    return responseJson({ ok: false, message: 'invalid_payload', errors }, { status: 400 });
  }

  const startedAt = Date.now();

  const safeAttemptToken = String(payload.attemptToken || '').slice(0, 120);

  try {
    const insertAttempt = await env.DB.prepare(
      `INSERT INTO quiz_attempts (
        session_id,
        attempt_token,
        total_score,
        question_count,
        over_count,
        under_count,
        exact_count,
        duration_ms,
        created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
    )
      .bind(
        String(payload.sessionId || ''),
        safeAttemptToken,
        Number(payload.totalScore),
        Number(payload.questionCount),
        Number(payload.overCount),
        Number(payload.underCount),
        Number(payload.exactCount),
        Number(payload.durationMs),
        startedAt
      )
      .run();

    const attemptId = insertAttempt?.meta?.last_row_id;
    if (!attemptId) {
      throw new Error('failed_to_get_attempt_id');
    }

    const answerRows = Array.isArray(payload.answers) ? payload.answers : [];
    if (answerRows.length > 0) {
      const stmts = answerRows.map((answer, idx) => {
        return env.DB.prepare(
          `INSERT INTO quiz_answers (
            attempt_id,
            question_index,
            category,
            score,
            direction
          ) VALUES (?1, ?2, ?3, ?4, ?5)`
        ).bind(
          attemptId,
          idx,
          String(answer.category || ''),
          Number(answer.score),
          String(answer.direction || 'exact')
        );
      });
      await env.DB.batch(stmts);
    }

    return responseJson({ ok: true, attemptId, duplicate: false, completedAt: startedAt });
  } catch (err) {
    const msg = String(err?.message || err);
    if (msg.includes('UNIQUE constraint failed')) {
      return responseJson({ ok: true, duplicate: true, message: 'result_already_submitted' });
    }
    return responseJson({ ok: false, message: msg }, { status: 500 });
  }
}

async function getStats(env, score) {
  if (!env.DB) {
    return responseJson({ ok: false, message: 'database_not_configured' }, { status: 500 });
  }

  const totalRow = await env.DB.prepare(
    `SELECT
      COUNT(*) AS totalAttempts,
      ROUND(COALESCE(AVG(total_score), 0), 2) AS averageScore,
      ROUND(COALESCE(AVG(duration_ms), 0), 2) AS averageDurationMs
      FROM quiz_attempts`
  ).first();

  const distRows = await env.DB.prepare(
    `SELECT
      CAST((CAST(total_score / 10 AS INTEGER) * 10) AS INTEGER) AS bucketStart,
      COUNT(*) AS count
      FROM quiz_attempts
      GROUP BY bucketStart
      ORDER BY bucketStart`
  ).all();

  const rows = await env.DB.prepare(
    `SELECT
      a.category,
      COUNT(*) AS totalQuestions,
      ROUND(AVG(a.score), 2) AS avgScore,
      SUM(CASE WHEN a.direction = 'over' THEN 1 ELSE 0 END) AS overCount,
      SUM(CASE WHEN a.direction = 'under' THEN 1 ELSE 0 END) AS underCount
      FROM quiz_answers a
      WHERE a.category <> ''
      GROUP BY a.category
      ORDER BY CAST(avgScore AS REAL) DESC`
  ).all();

  const scoreDistribution = Array.from({ length: 11 }, (_, idx) => ({
    bucketStart: idx * 10,
    bucketEnd: Math.min(100, idx * 10 + 9),
    count: 0
  }));

  for (const row of distRows.results || []) {
    const bucketStart = Number(row?.bucketStart);
    const idx = Math.min(10, Math.max(0, Math.round(bucketStart / 10)));
    if (!scoreDistribution[idx]) continue;
    scoreDistribution[idx].count = Number(row.count) || 0;
  }

  const categoryStats = (rows.results || []).map((item) => ({
    category: String(item.category || ''),
    totalQuestions: Number(item.totalQuestions) || 0,
    avgScore: Number(item.avgScore) || 0,
    overCount: Number(item.overCount) || 0,
    underCount: Number(item.underCount) || 0
  }));

  let percentile = null;
  let atOrBelow = 0;
  const totalAttempts = Number(totalRow?.totalAttempts) || 0;
  if (Number.isFinite(score) && totalAttempts > 0) {
    const rankRow = await env.DB.prepare(
      `SELECT
        COUNT(*) AS totalAttempts,
        SUM(CASE WHEN total_score <= ?1 THEN 1 ELSE 0 END) AS atOrBelow
        FROM quiz_attempts`
    ).bind(score).first();
    atOrBelow = Number(rankRow?.atOrBelow) || 0;
    const totalForPercentile = Number(rankRow?.totalAttempts) || 0;
    if (totalForPercentile > 0) {
      percentile = Math.min(100, Math.max(0, (atOrBelow / totalForPercentile) * 100));
    }
  }

  return responseJson({
    ok: true,
    totalAttempts,
    averageScore: Number(totalRow?.averageScore) || 0,
    averageDurationMs: Number(totalRow?.averageDurationMs) || 0,
    scoreDistribution,
    categoryStats,
    percentile,
    atOrBelow,
    score
  });
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return ['payload must be object'];
  }
  const errors = [];
  if (!payload.sessionId || typeof payload.sessionId !== 'string') {
    errors.push('sessionId is required');
  }
  if (!payload.attemptToken || typeof payload.attemptToken !== 'string') {
    errors.push('attemptToken is required');
  }
  if (!Number.isFinite(Number(payload.totalScore))) {
    errors.push('totalScore must be number');
  }
  if (!Number.isFinite(Number(payload.questionCount)) || Number(payload.questionCount) <= 0) {
    errors.push('questionCount must be positive');
  }
  if (!Number.isFinite(Number(payload.durationMs)) || Number(payload.durationMs) < 0) {
    errors.push('durationMs must be non-negative number');
  }
  if (!Array.isArray(payload.answers) || payload.answers.length === 0) {
    errors.push('answers must be a non-empty array');
  }
  return errors;
}

async function parseJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
