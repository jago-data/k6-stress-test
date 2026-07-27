import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { config, buildHeaders, buildUrl, buildBody } from './config.js';

// Custom metrics for clearer reporting.
const errorRate = new Rate('failed_requests');
const latency = new Trend('request_latency', true);

// A duration is "zero" when empty or its numeric part is 0 (e.g. "0", "0s").
function isZeroDuration(d) {
  if (!d) return true;
  const n = parseFloat(d);
  return !Number.isFinite(n) || n === 0;
}

// Stress profile: ramp up to MAX_VUS, hold, then (optionally) ramp down.
// Set RAMP_DOWN=0s to skip the ramp-down stage entirely.
const stages = [
  { duration: config.rampUp, target: config.maxVus },
  { duration: config.sustain, target: config.maxVus },
];
if (!isZeroDuration(config.rampDown)) {
  stages.push({ duration: config.rampDown, target: 0 });
}

export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages,
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    // Fail the run if p95 latency or error rate exceed configured limits.
    http_req_duration: [`p(95)<${config.p95MaxMs}`],
    failed_requests: [`rate<${config.maxErrorRate}`],
  },
};

// One-time setup: log what we're targeting.
export function setup() {
  console.log(`Target:  ${config.method} ${buildUrl()}`);
  console.log(`Profile: 0 -> ${config.maxVus} VUs  (${config.rampUp} / ${config.sustain} / ${config.rampDown})`);
}

export default function () {
  const params = {
    headers: buildHeaders(),
    timeout: config.requestTimeout,
    tags: { name: 'target_api' },
  };

  const url = buildUrl();
  const body = buildBody();
  const res = http.request(config.method, url, body, params);

  const ok = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
    'response has body': (r) => r.body && r.body.length > 0,
  });

  errorRate.add(!ok);
  latency.add(res.timings.duration);

  // On failure, log why once per VU (status 0 = transport error: timeout,
  // DNS, connection refused, TLS). Keeps output readable under load while
  // still surfacing the root cause.
  if (!ok && __ITER === 0) {
    console.error(
      `request failed: status=${res.status} error_code=${res.error_code} error="${res.error}"`
    );
  }

  sleep(config.sleepSeconds);
}
