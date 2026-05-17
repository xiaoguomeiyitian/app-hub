#!/usr/bin/env bash
set -euo pipefail

# 部署验证：检查项目 HTML/JS/CSS 是否可正常访问
# 用法: bash scripts/verify-deploy.sh [base_url] [project_name]
# 默认: https://97.383636.xyz/code/20008 app-lobby

BASE="${1:-https://97.383636.xyz/code/20008}"
PROJECT="${2:-app-lobby}"
OUT_DIR="/root/projects/app-hub/reports/deploy"
mkdir -p "$OUT_DIR"
HTML_FILE=$(mktemp)

HTML_CODE=$(curl -fsS -o "$HTML_FILE" -w '%{http_code}' "$BASE/$PROJECT/" 2>/dev/null || echo "000")
JS_PATH=$(grep -oE '(src|href)="/[^"]+\.js"' "$HTML_FILE" | head -n1 | grep -oE '/[^"]+' || true)
CSS_PATH=$(grep -oE 'href="/[^"]+\.css"' "$HTML_FILE" | head -n1 | grep -oE '/[^"]+' || true)

JS_CODE=0
CSS_CODE=0
if [[ -n "$JS_PATH" ]]; then
  JS_CODE=$(curl -fsS -o /dev/null -w '%{http_code}' "$BASE$JS_PATH" 2>/dev/null || echo "000")
else
  JS_CODE=404
fi
if [[ -n "$CSS_PATH" ]]; then
  CSS_CODE=$(curl -fsS -o /dev/null -w '%{http_code}' "$BASE$CSS_PATH" 2>/dev/null || echo "000")
else
  CSS_CODE=404
fi

STATUS=ok
FAIL_REASON=""
if [[ "$HTML_CODE" != "200" || "$JS_CODE" != "200" || "$CSS_CODE" != "200" ]]; then
  STATUS=error
  FAIL_REASON="html=$HTML_CODE js=$JS_CODE css=$CSS_CODE jsPath=${JS_PATH:-missing} cssPath=${CSS_PATH:-missing}"
fi

cat > "$OUT_DIR/$PROJECT.json" <<JSON
{"generatedAt":"$(date -u +%FT%TZ)","status":"$STATUS","project":"$PROJECT","htmlHttp":$HTML_CODE,"jsHttp":$JS_CODE,"cssHttp":$CSS_CODE,"jsPath":"${JS_PATH:-}","cssPath":"${CSS_PATH:-}","failReason":"$FAIL_REASON"}
JSON

rm -f "$HTML_FILE"

echo "=== 部署验证: $PROJECT ==="
echo "  HTML: $HTML_CODE"
echo "  JS:   $JS_CODE (${JS_PATH:-missing})"
echo "  CSS:  $CSS_CODE (${CSS_PATH:-missing})"
echo "  状态: $STATUS"
if [[ -n "$FAIL_REASON" ]]; then
  echo "  原因: $FAIL_REASON"
fi
