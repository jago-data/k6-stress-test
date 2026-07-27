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

// Build the stage list (ramp up -> hold -> optional ramp down). `target` is a
// VU count in vus mode or a per-second rate in rps mode.
function buildStages(peak) {
  const s = [
    { duration: config.rampUp, target: peak },
    { duration: config.sustain, target: peak },
  ];
  if (!isZeroDuration(config.rampDown)) {
    s.push({ duration: config.rampDown, target: 0 });
  }
  return s;
}

// Pick the scenario based on load mode.
//  - vus: ramping-vus, holds a fixed number of concurrent users (MAX_VUS).
//  - rps: ramping-arrival-rate, holds a fixed throughput (TARGET_RPS),
//         allocating up to MAX_VUS to sustain that rate.
let scenario;
if (config.loadMode === 'rps') {
  scenario = {
    executor: 'ramping-arrival-rate',
    startRate: 0,
    timeUnit: '1s',
    preAllocatedVUs: config.maxVus,
    maxVUs: config.maxVus,
    stages: buildStages(config.targetRps),
  };
} else {
  scenario = {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: buildStages(config.maxVus),
    gracefulRampDown: '10s',
  };
}

export const options = {
  scenarios: { stress: scenario },
  thresholds: {
    // Fail the run if p95 latency or error rate exceed configured limits.
    http_req_duration: [`p(95)<${config.p95MaxMs}`],
    failed_requests: [`rate<${config.maxErrorRate}`],
  },
};

// One-time setup: log what we're targeting.
export function setup() {
  console.log(`Target:  ${config.method} ${buildUrl()}`);
  const rd = isZeroDuration(config.rampDown) ? 'none' : config.rampDown;
  if (config.loadMode === 'rps') {
    console.log(`Profile: RPS mode -> ${config.targetRps} req/s  (ramp ${config.rampUp} / hold ${config.sustain} / down ${rd}); up to ${config.maxVus} VUs`);
  } else {
    console.log(`Profile: VU mode -> ${config.maxVus} concurrent VUs  (ramp ${config.rampUp} / hold ${config.sustain} / down ${rd})`);
  }
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

  // In RPS mode the arrival-rate executor controls pacing, so no think time.
  if (config.loadMode !== 'rps') {
    sleep(config.sleepSeconds);
  }
}
