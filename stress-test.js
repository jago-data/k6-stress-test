import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { config, buildHeaders } from './config.js';

// Custom metrics for clearer reporting.
const errorRate = new Rate('failed_requests');
const latency = new Trend('request_latency', true);

// Stress profile: ramp up to MAX_VUS, hold, then ramp down.
export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: config.rampUp, target: config.maxVus },
        { duration: config.sustain, target: config.maxVus },
        { duration: config.rampDown, target: 0 },
      ],
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
  console.log(`Target:  ${config.method} ${config.apiUrl}`);
  console.log(`Profile: 0 -> ${config.maxVus} VUs  (${config.rampUp} / ${config.sustain} / ${config.rampDown})`);
}

export default function () {
  const params = {
    headers: buildHeaders(),
    timeout: config.requestTimeout,
    tags: { name: 'target_api' },
  };

  let res;
  const hasBody = config.body && config.method !== 'GET' && config.method !== 'HEAD';
  if (hasBody) {
    res = http.request(config.method, config.apiUrl, config.body, params);
  } else {
    res = http.request(config.method, config.apiUrl, null, params);
  }

  const ok = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
    'response has body': (r) => r.body && r.body.length > 0,
  });

  errorRate.add(!ok);
  latency.add(res.timings.duration);

  sleep(config.sleepSeconds);
}
