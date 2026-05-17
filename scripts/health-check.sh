#!/usr/bin/env bash
set -euo pipefail

# 健康检查
# 用法: bash scripts/health-check.sh [base_url]
# 默认: https://97.383636.xyz/code/20008

BASE="${1:-https://97.383636.xyz/code/20008}"
OUT="/root/projects/app-hub/reports/health-latest.json"
mkdir -p /root/projects/app-hub/reports

PLATFORM=$(curl -fsS "$BASE/health" 2>/dev/null || echo '{"status":"error","reason":"health endpoint unreachable"}')
cat > "$OUT" <<JSON
{"generatedAt":"$(date -u +%FT%TZ)","status":"ok","url":"$BASE","health":$PLATFORM}
JSON

echo "=== 健康检查 ==="
echo "URL: $BASE/health"
echo ""
echo "$PLATFORM" | python3 -m json.tool 2>/dev/null || echo "$PLATFORM"
