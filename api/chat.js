export const config = { runtime: 'edge' };

// ============================================================
//  LOGGING HELPERS — color-coded, timestamped, structured
// ============================================================
const _ts = () => new Date().toISOString();
const log = {
  info:  (...a) => console.log(  `[${_ts()}] ℹ️  INFO `, ...a),
  ok:    (...a) => console.log(  `[${_ts()}] ✅  OK   `, ...a),
  warn:  (...a) => console.warn( `[${_ts()}] ⚠️  WARN `, ...a),
  error: (...a) => console.error(`[${_ts()}] ❌  ERROR`, ...a),
  debug: (...a) => console.log(  `[${_ts()}] 🐛  DEBUG`, ...a),
  api:   (...a) => console.log(  `[${_ts()}] 🌐  API  `, ...a),
};

export default async function handler(req) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const debugLog = [];              // accumulate per-request debug trail
  const pushDebug = (entry) => { debugLog.push({ t: _ts(), ...entry }); };

  log.info(`[${requestId}] ── NEW REQUEST ─────────────────────────`);
  log.debug(`[${requestId}] Method: ${req.method}  URL: ${req.url}`);

  // ── CORS preflight ──
  if (req.method === 'OPTIONS') {
    log.info(`[${requestId}] CORS preflight — returning 200`);
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  try {
    // ── Parse body ──
    let body;
    try {
      body = await req.json();
      log.debug(`[${requestId}] Parsed body:`, JSON.stringify(body).slice(0, 500));
      pushDebug({ step: 'parse_body', ok: true, keys: Object.keys(body) });
    } catch (parseErr) {
      log.error(`[${requestId}] Body parse failed:`, parseErr.message);
      pushDebug({ step: 'parse_body', ok: false, error: parseErr.message });
      return new Response(JSON.stringify({
        reply: 'Invalid request body — expected JSON with { "message": "..." }',
        debug: debugLog,
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const { message } = body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      log.warn(`[${requestId}] Empty or missing "message" field`);
      pushDebug({ step: 'validate_message', ok: false, received: typeof message });
      return new Response(JSON.stringify({
        reply: 'Missing "message" field in request body.',
        debug: debugLog,
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    log.info(`[${requestId}] User message (${message.length} chars): "${message.slice(0, 120)}…"`);
    pushDebug({ step: 'validate_message', ok: true, len: message.length });

    // ── API key check ──
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      log.error(`[${requestId}] 🔑 GOOGLE_GEMINI_API_KEY is NOT set in environment!`);
      pushDebug({ step: 'api_key_check', ok: false });
      return new Response(JSON.stringify({
        reply: 'Server config error: GOOGLE_GEMINI_API_KEY is not set. Add it in Vercel → Settings → Environment Variables.',
        debug: debugLog,
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    const maskedKey = apiKey.slice(0, 6) + '…' + apiKey.slice(-4);
    log.ok(`[${requestId}] 🔑 API key present (${maskedKey}), length=${apiKey.length}`);
    pushDebug({ step: 'api_key_check', ok: true, masked: maskedKey, len: apiKey.length });

    // ── Model cascade ──
    // Each entry: [model_name, api_version]
    // We try v1beta first (newer models), then v1 (stable/older).
    // gemini-2.0-flash is confirmed to exist on v1beta (your logs showed 429, not 404).
    const modelEntries = [
      ['gemini-2.0-flash',     'v1beta'],
      ['gemini-2.0-flash',     'v1'    ],
      ['gemini-1.5-flash',     'v1'    ],
      ['gemini-1.5-pro',       'v1'    ],
    ];
    log.info(`[${requestId}] Will try ${modelEntries.length} model+version combos`);
    modelEntries.forEach(([m, v]) => log.info(`[${requestId}]   → ${m} (${v})`));

    let lastError = '';
    const MAX_429_RETRIES = 2;           // retry rate-limited calls up to 2 times
    const RATE_LIMIT_WAIT_MS = 3000;     // wait 3s between 429 retries

    // Helper: sleep
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    // Helper: attempt one model call (with 429 retry)
    async function tryModel(model, apiVersion) {
      const apiUrl = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`;
      const payload = { contents: [{ parts: [{ text: message }] }] };

      for (let retry = 0; retry <= MAX_429_RETRIES; retry++) {
        const retryLabel = retry > 0 ? ` (429-retry #${retry})` : '';
        log.api(`[${requestId}] POST ${apiVersion}/models/${model}:generateContent${retryLabel}`);
        log.debug(`[${requestId}] URL (masked): …/${apiVersion}/models/${model}:generateContent?key=***`);
        pushDebug({ step: 'model_attempt', model, apiVersion, retry });

        const t0 = Date.now();
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const elapsed = Date.now() - t0;

        log.api(`[${requestId}] Response: status=${response.status} (${elapsed}ms)${retryLabel}`);
        pushDebug({ step: 'api_response', model, apiVersion, status: response.status, ms: elapsed, retry });

        let data;
        try {
          data = await response.json();
          log.debug(`[${requestId}] Response keys: ${Object.keys(data).join(', ')}`);
        } catch (jsonErr) {
          log.error(`[${requestId}] JSON parse failed:`, jsonErr.message);
          pushDebug({ step: 'api_json_parse', model, ok: false, error: jsonErr.message });
          return { ok: false, error: `JSON parse error from ${model}` };
        }

        // ── Success ──
        if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
          const replyText = data.candidates[0].content.parts[0].text;
          log.ok(`[${requestId}] ✅ SUCCESS  model=${model} (${apiVersion})  reply_len=${replyText.length}  ${elapsed}ms`);
          pushDebug({ step: 'success', model, apiVersion, reply_len: replyText.length, ms: elapsed });
          return { ok: true, replyText, model, elapsed };
        }

        // ── 429 Rate limit — retry after delay ──
        if (response.status === 429 && retry < MAX_429_RETRIES) {
          // Try to parse the suggested wait time from the error message
          const errMsg = data.error?.message || '';
          const waitMatch = errMsg.match(/retry in ([\d.]+)s/i);
          const waitSec = waitMatch ? Math.min(parseFloat(waitMatch[1]), 10) : RATE_LIMIT_WAIT_MS / 1000;
          const waitMs = Math.ceil(waitSec * 1000);
          log.warn(`[${requestId}] ⏳ 429 Rate-limited on ${model} — waiting ${waitMs}ms then retrying…`);
          pushDebug({ step: 'rate_limit_wait', model, waitMs, retry: retry + 1 });
          await sleep(waitMs);
          continue;      // retry same model
        }

        // ── Other failure ──
        const errDetail = data.error?.message || JSON.stringify(data).slice(0, 300);
        log.warn(`[${requestId}] Model ${model} (${apiVersion}) rejected: ${errDetail}`);
        pushDebug({ step: 'model_rejected', model, apiVersion, status: response.status, error: errDetail });

        if (data.error?.code === 403) {
          log.error(`[${requestId}] 403 Forbidden — key may lack access to ${model}`);
        }

        return { ok: false, error: errDetail };
      }
      return { ok: false, error: `429 persisted after ${MAX_429_RETRIES} retries on ${model}` };
    }

    // ── Try each model+version combo ──
    for (let i = 0; i < modelEntries.length; i++) {
      const [model, apiVersion] = modelEntries[i];
      const attempt = i + 1;
      log.api(`[${requestId}] ── Attempt ${attempt}/${modelEntries.length}  model=${model}  version=${apiVersion}`);

      try {
        const result = await tryModel(model, apiVersion);

        if (result.ok) {
          return new Response(JSON.stringify({
            reply: result.replyText,
            model_used: `${result.model}`,
            latency_ms: result.elapsed,
            debug: debugLog,
          }), { headers: { 'Content-Type': 'application/json' } });
        }

        lastError = result.error;
      } catch (fetchErr) {
        log.error(`[${requestId}] Fetch exception on ${model} (${apiVersion}):`, fetchErr.message);
        pushDebug({ step: 'fetch_exception', model, apiVersion, error: fetchErr.message });
        lastError = fetchErr.message;
      }
    }

    // ── All models exhausted ──
    log.error(`[${requestId}] ❌ ALL ${models.length} MODELS FAILED.  Last error: ${lastError}`);
    pushDebug({ step: 'all_models_failed', error: lastError });

    return new Response(JSON.stringify({
      reply: `All models failed. Last error: ${lastError}`,
      debug: debugLog,
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    log.error(`[${requestId}] 💥 UNHANDLED EXCEPTION:`, err.message, err.stack);
    pushDebug({ step: 'unhandled_exception', error: err.message, stack: err.stack });
    return new Response(JSON.stringify({
      reply: `Server error: ${err.message}`,
      debug: debugLog,
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
