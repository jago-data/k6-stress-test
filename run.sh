#!/usr/bin/env bash
# Loads variables from .env and runs the k6 stress test.
# Usage: ./run.sh [extra k6 args...]
#   e.g. ./run.sh --out json=results.json

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "No .env file found. Copy .env.example to .env and edit it:" >&2
  echo "  cp .env.example .env" >&2
  exit 1
fi

if ! command -v k6 >/dev/null 2>&1; then
  echo "k6 is not installed. See: https://grafana.com/docs/k6/latest/set-up/install-k6/" >&2
  exit 1
fi

# Load .env as DEFAULTS: a variable already set in the environment takes
# precedence, so `MAX_VUS=500 ./run.sh` overrides the .env value.
while IFS= read -r line || [[ -n "${line}" ]]; do
  # Skip blank lines and comments.
  [[ -z "${line}" || "${line}" =~ ^[[:space:]]*# ]] && continue
  # Only handle NAME=VALUE lines.
  [[ "${line}" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue
  key="${BASH_REMATCH[1]}"
  val="${BASH_REMATCH[2]}"
  # Strip surrounding single/double quotes if present.
  val="${val%\"}"; val="${val#\"}"
  val="${val%\'}"; val="${val#\'}"
  # Set only if not already provided in the environment.
  if [[ -z "${!key+x}" ]]; then
    export "${key}=${val}"
  fi
done < "${ENV_FILE}"

exec k6 run "${SCRIPT_DIR}/stress-test.js" "$@"
