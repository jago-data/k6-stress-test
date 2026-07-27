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
  // Customer identifier sent with each request.
  cifNo: env('CIF_NO', ''),

  maxVus: num('MAX_VUS', 200),
  rampUp: env('RAMP_UP', '30s'),
  sustain: env('SUSTAIN', '1m'),
  rampDown: env('RAMP_DOWN', '30s'),

  // Target throughput in requests/second. When > 0 the test switches to
  // fixed-RPS mode (k6 arrival-rate executor) unless LOAD_MODE overrides.
  targetRps: num('TARGET_RPS', 0),

  p95MaxMs: num('P95_MAX_MS', 500),
  maxErrorRate: num('MAX_ERROR_RATE', 0.01),

  requestTimeout: env('REQUEST_TIMEOUT', '30s'),
  sleepSeconds: num('SLEEP_SECONDS', 1),
};

// Load mode: 'vus' (fixed concurrent users) or 'rps' (fixed throughput).
// Auto-selects 'rps' when TARGET_RPS is set; LOAD_MODE forces either.
config.loadMode = env('LOAD_MODE', config.targetRps > 0 ? 'rps' : 'vus').toLowerCase();

// Build request headers. The API expects only Accept: application/json
// (no Content-Type).
export function buildHeaders() {
  const headers = {
    Accept: 'application/json',
  };
  if (config.apiKey) {
    if (config.authHeader.toLowerCase() === 'authorization') {
      headers[config.authHeader] = `Bearer ${config.apiKey}`;
    } else {
      headers[config.authHeader] = config.apiKey;
    }
  }
  return headers;
}

// Whether this method carries a request body.
function methodHasBody(method) {
  return method !== 'GET' && method !== 'HEAD' && method !== 'DELETE';
}

// Resolve the final URL, appending cifNo as a query param for body-less
// methods (GET/HEAD/DELETE).
export function buildUrl() {
  let url = config.apiUrl;
  if (config.cifNo && !methodHasBody(config.method)) {
    const sep = url.indexOf('?') === -1 ? '?' : '&';
    url = `${url}${sep}cifNo=${encodeURIComponent(config.cifNo)}`;
  }
  return url;
}

// Resolve the request body. Explicit REQUEST_BODY wins; otherwise, for
// body-carrying methods, send { cifNo } as JSON when a cifNo is configured.
export function buildBody() {
  if (!methodHasBody(config.method)) return null;
  if (config.body) return config.body;
  if (config.cifNo) return JSON.stringify({ cifNo: config.cifNo });
  return null;
}
