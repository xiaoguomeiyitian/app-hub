#!/usr/bin/env bash
set -euo pipefail

# 检查常用端口占用状态
# 用法: bash scripts/check-port.sh

PORTS=(20000 20001 20002 20003 20004 20005 20006 20007 20008 20009)
OUT="/root/projects/app-hub/reports/ports-latest.json"
mkdir -p /root/projects/app-hub/reports

printf '{"generatedAt":"%s","status":"ok","ports":[' "$(date -u +%FT%TZ)" > "$OUT"
first=1
for p in "${PORTS[@]}"; do
  if [[ $first -eq 0 ]]; then printf ',' >> "$OUT"; fi
  first=0
  if ss -ltn 2>/dev/null | awk '{print $4}' | grep -q ":$p$"; then state="open"; else state="free"; fi
  printf '{"port":%s,"state":"%s"}' "$p" "$state" >> "$OUT"
done
printf ']}' >> "$OUT"

cat "$OUT"
