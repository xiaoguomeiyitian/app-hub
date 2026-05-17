#!/bin/bash
set -euo pipefail

# ============================================================
# app-hub 构建脚本
# 功能：安装依赖 + 构建所有子项目（或抽样构建）
# 用法：bash scripts/build-all.sh [sample N]
#  默认：构建所有项目
# 示例：bash scripts/build-all.sh sample 10  （抽样10个）
# ============================================================

cd "$(dirname "$0")/.."

total=0
passed=0
failed=()
projects=()

# ---------- 确定项目列表 ----------
if [[ "${1:-}" == "sample" && -n "${2:-}" ]]; then
  count=$2
  mapfile -t projects < <(find apps -mindepth 2 -maxdepth 2 -type d | shuf -n "$count")
else
  mapfile -t projects < <(find apps -mindepth 2 -maxdepth 2 -type d | sort)
fi

echo "========================================"
echo "  app-hub 构建 (${#projects[@]} 个项目)"
echo "========================================"
echo ""

# ---------- 安装核心依赖 ----------
log() { echo -e "\033[1;36m==>\0033[0m $*"; }
warn() { echo -e "\033[1;33m⚠\033[0m  $*"; }
err()  { echo -e "\033[1;31m✗\033[0m  $*"; }
ok()   { echo -e "\033[1;32m✓\033[0m  $*"; }

log "安装核心依赖..."

for pkg_dir in hub-server lobby-web packages/*/; do
  if [ -f "$pkg_dir/package.json" ]; then
    pkg_name="$(basename "$pkg_dir")"
    printf "  安装 %-20s" "$pkg_name..."
    if (cd "$pkg_dir" && npm install --ignore-scripts > /dev/null 2>&1); then
      ok "完成"
    else
      err "失败: $pkg_name"
    fi
  fi
done

echo ""

# ---------- 安装子项目依赖 + 构建 ----------
echo "开始构建 ${#projects[@]} 个子项目..."
echo ""

for proj in "${projects[@]}"; do
  total=$((total+1))
  proj_name="$(basename "$proj")"
  printf "[%3d/%3d] %-30s" "$total" "$total" "$proj_name"

  # 安装依赖
  if ! (cd "$proj" && npm install --ignore-scripts > /dev/null 2>&1); then
    err "依赖安装失败"
    failed+=("$proj_name (依赖安装失败)")
    continue
  fi

  # 检查是否有构建脚本
  if ! grep -q '"build"' "$proj/package.json" 2>/dev/null; then
    echo "  (跳过，无构建脚本)"
    passed=$((passed + 1))
    continue
  fi

  # 构建
  if (cd "$proj" && npm run build > /dev/null 2>&1); then
    passed=$((passed + 1))

    # 检查 dist 目录
    if [[ ! -d "$proj/dist" ]] || [[ -z "$(ls -A "$proj/dist" 2>/dev/null)" ]]; then
      echo "  ⚠ dist/ 为空"
    else
      echo "  ✓"
    fi
  else
    err "构建失败"
    failed+=("$proj_name")
  fi
done

# ---------- 汇总 ----------
echo ""
echo "========================================"
echo "  构建汇总"
echo "========================================"
echo "  总计:   $total"
echo "  成功:   $passed"
echo "  失败:   ${#failed[@]}"

if ((${#failed[@]} > 0)); then
  echo ""
  echo "  失败项目:"
  printf "    %s\n" "${failed[@]}"
  exit 1
fi

echo ""
ok "全部构建完成！"
