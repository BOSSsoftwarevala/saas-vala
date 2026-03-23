#!/usr/bin/env bash
set -Eeuo pipefail

# bulk-upload.sh
# Usage:
#   ./public/vala-agent/bulk-upload.sh --api-base "https://your-domain.com" --token "$VALA_TOKEN" --dir "./data"
#
# Notes:
# - Expects JSON files in --dir
# - Sends each file as JSON to: POST {apiBase}/api/vala-agent/bulk-upload
# - Fails fast on HTTP errors
# - Retries transient failures

usage() {
  cat <<'USAGE'
bulk-upload.sh

Required:
  --api-base   Base URL (e.g. https://example.com)
  --token      Bearer token for API authentication
  --dir        Directory containing *.json files

Optional:
  --endpoint   Endpoint path (default: /api/vala-agent/bulk-upload)
  --concurrency N   Number of parallel uploads (default: 4)
  --timeout    Curl max-time seconds (default: 120)
  --retries    Retries per file for transient failures (default: 3)

Example:
  ./public/vala-agent/bulk-upload.sh --api-base "https://example.com" --token "$VALA_TOKEN" --dir "./data"
USAGE
}

API_BASE=""
TOKEN=""
DIR=""
ENDPOINT="/api/vala-agent/bulk-upload"
CONCURRENCY="4"
TIMEOUT="120"
RETRIES="3"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-base)
      API_BASE="${2:-}"; shift 2;;
    --token)
      TOKEN="${2:-}"; shift 2;;
    --dir)
      DIR="${2:-}"; shift 2;;
    --endpoint)
      ENDPOINT="${2:-}"; shift 2;;
    --concurrency)
      CONCURRENCY="${2:-}"; shift 2;;
    --timeout)
      TIMEOUT="${2:-}"; shift 2;;
    --retries)
      RETRIES="${2:-}"; shift 2;;
    -h|--help)
      usage; exit 0;;
    *)
      echo "Unknown arg: $1" >&2
      usage
      exit 2
      ;;
  esac
done

if [[ -z "${API_BASE}" || -z "${TOKEN}" || -z "${DIR}" ]]; then
  echo "Missing required args." >&2
  usage
  exit 2
fi

if [[ ! -d "${DIR}" ]]; then
  echo "Directory not found: ${DIR}" >&2
  exit 2
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required." >&2
  exit 2
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required." >&2
  exit 2
fi

API_BASE="${API_BASE%/}"
URL="${API_BASE}${ENDPOINT}"

mapfile -d '' FILES < <(find "${DIR}" -maxdepth 1 -type f -name '*.json' -print0 | sort -z)

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "No .json files found in ${DIR}" >&2
  exit 0
fi

upload_one() {
  local file="$1"
  local attempt=1
  local max_attempts="${RETRIES}"

  # Validate JSON before sending (fast fail)
  if ! jq -e . "${file}" >/dev/null 2>&1; then
    echo "Invalid JSON: ${file}" >&2
    return 10
  fi

  while (( attempt <= max_attempts )); do
    # Capture body+status reliably
    local tmp
    tmp="$(mktemp)"
    local code="000"

    code="$(
      curl -sS \
        --retry 0 \
        --max-time "${TIMEOUT}" \
        -o "${tmp}" \
        -w "%{http_code}" \
        -X POST "${URL}" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H "Content-Type: application/json" \
        --data-binary @"${file}" \
      || echo "000"
    )"

    if [[ "${code}" =~ ^2[0-9][0-9]$ ]]; then
      rm -f "${tmp}"
      echo "OK  ${file}"
      return 0
    fi

    # Retry on common transient codes
    if [[ "${code}" == "429" || "${code}" == "500" || "${code}" == "502" || "${code}" == "503" || "${code}" == "504" || "${code}" == "000" ]]; then
      echo "RETRY(${attempt}/${max_attempts}) ${file} -> HTTP ${code}" >&2
      rm -f "${tmp}"
      attempt=$((attempt + 1))
      sleep $((attempt * 2))
      continue
    fi

    echo "FAIL ${file} -> HTTP ${code}" >&2
    echo "Response:" >&2
    sed -n '1,200p' "${tmp}" >&2 || true
    rm -f "${tmp}"
    return 20
  done

  echo "FAIL ${file} -> exhausted retries" >&2
  return 21
}

export -f upload_one
export URL TOKEN TIMEOUT RETRIES

# Prefer xargs for portability (macOS/Linux)
printf '%s\0' "${FILES[@]}" | xargs -0 -n 1 -P "${CONCURRENCY}" bash -lc 'upload_one "$@"' _
