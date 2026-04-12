#!/usr/bin/env bash
# Harborwatch scraper helper
# Usage: ./scrape.sh [--year 2026] [--key <api-key>] [--port KTN] [--local]

set -euo pipefail

YEAR=2026
API="https://harborwatch-api.onrender.com"
PORT_FILTER=""
KEY="${HARBORWATCH_API_KEY:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --year)  YEAR="$2";        shift 2 ;;
    --key)   KEY="$2";         shift 2 ;;
    --port)  PORT_FILTER="$2"; shift 2 ;;
    --local) API="http://localhost:8000"; shift ;;
    *)
      echo "Usage: $0 [--year YEAR] [--key API_KEY] [--port PORT_CODE] [--local]"
      exit 1
      ;;
  esac
done

if [[ -z "$KEY" ]]; then
  echo "Error: API key required. Pass --key <key> or set HARBORWATCH_API_KEY." >&2
  exit 1
fi

ARGS=(--year "$YEAR" --api "$API" --key "$KEY")
[[ -n "$PORT_FILTER" ]] && ARGS+=(--port "$PORT_FILTER")

echo "⚓ Scraping year=$YEAR api=$API${PORT_FILTER:+ port=$PORT_FILTER}"
node "$(dirname "$0")/import-pdfs.mjs" "${ARGS[@]}"
