// Central config: everything is read from environment variables (__ENV),
// which run.sh populates from your .env file. Sensible defaults are applied
// so the script still runs if a variable is missing.

function env(name, fallback) {
  const v = __ENV[name];
  return v === undefined || v === '' ? fallback : v;
}

function num(name, fallback) {
  const v = env(name, undefined);
  const n = v === undefined ? fallback : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  apiUrl: env('API_URL', 'http://127.0.0.1:8799/health'),
  apiKey: env('API_KEY', ''),
  method: env('HTTP_METHOD', 'GET').toUpperCase(),
  body: env('REQUEST_BODY', ''),
  authHeader: env('AUTH_HEADER', 'Authorization'),

  maxVus: num('MAX_VUS', 200),
  rampUp: env('RAMP_UP', '30s'),
  sustain: env('SUSTAIN', '1m'),
  rampDown: env('RAMP_DOWN', '30s'),

  p95MaxMs: num('P95_MAX_MS', 500),
  maxErrorRate: num('MAX_ERROR_RATE', 0.01),

  requestTimeout: env('REQUEST_TIMEOUT', '30s'),
  sleepSeconds: num('SLEEP_SECONDS', 1),
};

// Build request headers, attaching the API key in the configured header.
export function buildHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (config.apiKey) {
    if (config.authHeader.toLowerCase() === 'authorization') {
      headers[config.authHeader] = `Bearer ${config.apiKey}`;
    } else {
      headers[config.authHeader] = config.apiKey;
    }
  }
  return headers;
}
