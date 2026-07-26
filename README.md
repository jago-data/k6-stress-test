# k6 Stress Test

A configurable [k6](https://k6.io/) stress test. The target API URL, API key, load
profile, and pass/fail thresholds are all set through a `.env` file — no need to
touch the test code.

## Files

| File               | Purpose                                                  |
| ------------------ | -------------------------------------------------------- |
| `stress-test.js`   | The k6 test (ramp up → sustain → ramp down).             |
| `config.js`        | Reads config from environment variables with defaults.   |
| `.env.example`     | Template for your settings. Copy to `.env`.              |
| `run.sh`           | Loads `.env` and runs k6.                                |

## Setup

1. **Install k6** — https://grafana.com/docs/k6/latest/set-up/install-k6/
   - macOS: `brew install k6`
   - Debian/Ubuntu: see the install docs (apt repo)
   - Windows: `winget install k6 --source winget` or `choco install k6`

2. **Configure**:
   ```bash
   cp .env.example .env
   # edit .env — set API_URL and API_KEY at minimum
   ```

3. **Run**:
   ```bash
   ./run.sh
   ```

## Configuration (.env)

| Variable          | Description                                              | Default |
| ----------------- | -------------------------------------------------------- | ------- |
| `API_URL`         | Target endpoint URL.                                     | —       |
| `API_KEY`         | API key sent in the auth header.                         | —       |
| `HTTP_METHOD`     | GET, POST, PUT, PATCH, DELETE, HEAD.                     | GET     |
| `REQUEST_BODY`    | JSON string body for POST/PUT/PATCH.                     | (empty) |
| `AUTH_HEADER`     | Header name for the key. `Authorization` → `Bearer <key>`; anything else sends the raw key. | Authorization |
| `MAX_VUS`         | Peak virtual users.                                      | 200     |
| `RAMP_UP`         | Ramp-up duration.                                        | 30s     |
| `SUSTAIN`         | Sustain-at-peak duration.                                | 1m      |
| `RAMP_DOWN`       | Ramp-down duration.                                      | 30s     |
| `P95_MAX_MS`      | Threshold: fail if p95 latency exceeds this (ms).        | 500     |
| `MAX_ERROR_RATE`  | Threshold: fail if error rate exceeds this (0.01 = 1%).  | 0.01    |
| `REQUEST_TIMEOUT` | Per-request timeout.                                     | 30s     |
| `SLEEP_SECONDS`   | Sleep per VU between iterations.                          | 1       |

## Examples

Override any value at run time without editing `.env`:

```bash
# Heavier load for a single run
MAX_VUS=500 SUSTAIN=5m ./run.sh

# Save results to JSON
./run.sh --out json=results.json

# POST with a body
# (in .env) HTTP_METHOD=POST, REQUEST_BODY={"name":"test"}
./run.sh
```

You can also run k6 directly and pass variables with `-e`:

```bash
k6 run -e API_URL=https://api.example.com -e API_KEY=abc123 stress-test.js
```

## Thresholds

The run exits non-zero (fails) if either threshold is breached — useful for CI:

- **p95 latency** above `P95_MAX_MS`
- **error rate** above `MAX_ERROR_RATE`
