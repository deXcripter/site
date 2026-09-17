#!/usr/bin/env bash
#
# Verifies the crawler logging pipeline end to end:
# starts the built site, simulates a non-rendering bot and a rendering bot,
# then reads the verdict back out of BigQuery.
#
# Run from the site/ directory:  bash scripts/verify-bigquery.sh
#
set -euo pipefail

PORT="${PORT:-3320}"
BASE="http://127.0.0.1:${PORT}"
LOG="$(mktemp -t crawler-verify-XXXXXX.log)"

echo "==> Building"
npx next build > /dev/null 2>&1 || { echo "build failed"; exit 1; }

echo "==> Starting server on ${PORT}"
npx next start -p "${PORT}" > "${LOG}" 2>&1 &
SERVER_PID=$!
trap 'kill ${SERVER_PID} 2>/dev/null || true' EXIT

for _ in $(seq 1 40); do
  curl -s -o /dev/null -m 2 "${BASE}/" && break
  sleep 1
done

echo "==> Simulating GPTBot (fetches HTML, never runs JS)"
curl -s -o /tmp/crawler-verify.html -w "    http %{http_code}\n" -m 20 \
  -A "Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)" \
  -H "x-crawl-asn: 20473" -H "cf-ipcountry: US" \
  "${BASE}/lab/ai-crawler"

printf "    static block in raw HTML : "; grep -c 'data-probe="static"' /tmp/crawler-verify.html || true
printf "    js blocks in raw HTML    : "; grep -c 'data-probe="js-' /tmp/crawler-verify.html || true

echo "==> Simulating Bingbot (fetches HTML, then runs JS)"
curl -s -o /dev/null -w "    page  http %{http_code}\n" -m 20 \
  -A "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)" \
  -H "x-crawl-asn: 8075" -H "cf-ipcountry: GB" \
  "${BASE}/lab/ai-crawler"

curl -s -o /dev/null -w "    probe http %{http_code}\n" -m 20 \
  -A "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)" \
  -H "x-crawl-asn: 8075" \
  "${BASE}/api/crawler/text?rid=verify-bing-001"

echo "==> Waiting for background inserts"
sleep 20

echo "==> Insert errors in server log (expect none):"
grep -c 'insert failed' "${LOG}" || echo "    0"

echo "==> Reading the verdict back from BigQuery"
curl -s -m 90 "${BASE}/api/crawler/logs?limit=10" | python3 -c '
import json, sys
d = json.load(sys.stdin)
if d.get("error"):
    print("    ERROR:", d["error"]); sys.exit(1)
print("    verdicts:")
for v in d.get("verdicts", []):
    verdict = "renders JS" if v["js_executions"] else "no JS execution"
    print(f"      {v[\"bot_name\"]:<12} {v[\"requests\"]:>3} req  {v[\"js_executions\"]:>3} js   {verdict}")
print("    recent hits:", len(d.get("hits", [])))
'

echo
echo "Expected: GPTBot shows requests with 0 js, Bingbot shows requests with 1 js."
echo "Remember to delete the simulated rows before publishing:"
echo "  bq query --use_legacy_sql=false \"DELETE FROM \\\`\${GCP_PROJECT_ID}.dexcripter_lab.crawler_hits\\\` WHERE TRUE\""
