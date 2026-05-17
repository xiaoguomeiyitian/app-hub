#!/bin/bash
set -euo pipefail

# ============================================================
# app-hub 初始化脚本
# 功能：清理 git 忽略目录 → 安装所有依赖 → 构建 → 启动
# 用法：bash scripts/init.sh [--skip-clean] [--skip-build] [--only-core]
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

# ---------- 参数解析 ----------
SKIP_CLEAN=false
SKIP_BUILD=false
ONLY_CORE=false

for arg in "$@"; do
  case "$arg" in
    --skip-clean) SKIP_CLEAN=true ;;
    --skip-build) SKIP_BUILD=true ;;
    --only-core)  ONLY_CORE=true ;;
    --help|-h)
      echo "用法: bash scripts/init.sh [选项]"
      echo ""
      echo "选项:"
      echo "  --skip-clean  跳过清理 git 忽略目录"
      echo "  --skip-build  跳过构建步骤"
      echo "  --only-core   仅初始化核心服务（hub-server + lobby-web + packages）"
      echo "  --help, -h    显示帮助"
      exit 0
      ;;
    *)
      echo "未知参数: $arg"
      echo "使用 --help 查看帮助"
      exit 1
      ;;
  esac
done

# ---------- 工具函数 ----------
log()  { echo -e "\033[1;36m==>\033[0m $*"; }
warn() { echo -e "\033[1;33m⚠\033[0m  $*"; }
err()  { echo -e "\033[1;31m✗\033[0m  $*"; }
ok()   { echo -e "\033[1;32m✓\033[0m  $*"; }

# 带进度显示的 npm install
npm_install() {
  local dir="$1"
  local label="$2"
  log "安装依赖: $label"
  if (cd "$dir" && npm install --ignore-scripts 2>&1 | tail -3); then
    ok "依赖安装完成: $label"
  else
    err "依赖安装失败: $label"
    return 1
  fi
}

# ============================================================
# Step 1: 清理 git 忽略目录
# ============================================================
if [ "$SKIP_CLEAN" = false ]; then
  log "Step 1: 清理 git 忽略目录..."

  CLEAN_TARGETS=(
    "static"
    "data"
    "reports"
  )

  # 清理根目录 node_modules（可选，保留以加速）
  # rm -rf node_modules

  for target in "${CLEAN_TARGETS[@]}"; do
    if [ -d "$target" ]; then
      rm -rf "$target"
      ok "已清理: $target/"
    fi
  done

  # 清理所有子项目的 node_modules 和 dist
  log "清理子项目 node_modules 和 dist..."
  find apps packages lobby-web hub-server \
    -name "node_modules" -type d -prune -exec rm -rf {} + 2>/dev/null || true
  find apps packages lobby-web hub-server \
    -name "dist" -type d -prune -exec rm -rf {} + 2>/dev/null || true

  # 清理数据库和日志文件
  find . -maxdepth 3 -name "*.db" -delete 2>/dev/null || true
  find . -maxdepth 3 -name "*.log" -delete 2>/dev/null || true
  find . -maxdepth 3 -name "*-shm" -delete 2>/dev/null || true
  find . -maxdepth 3 -name "-wal" -delete 2>/dev/null || true

  ok "清理完成"
else
  log "Step 1: 跳过清理（--skip-clean）"
fi

# ============================================================
# Step 2: 安装核心依赖
# ============================================================
log "Step 2: 安装核心依赖..."

# 根目录
if [ -f "package.json" ]; then
  npm_install "$ROOT_DIR" "根目录"
fi

# hub-server
if [ -d "hub-server" ] && [ -f "hub-server/package.json" ]; then
  npm_install "$ROOT_DIR/hub-server" "hub-server"
fi

# lobby-web
if [ -d "lobby-web" ] && [ -f "lobby-web/package.json" ]; then
  npm_install "$ROOT_DIR/lobby-web" "lobby-web"
fi

# packages
for pkg in packages/*/; do
  if [ -f "$pkg/package.json" ]; then
    npm_install "$ROOT_DIR/$pkg" "$(basename "$pkg")"
  fi
done

# ============================================================
# Step 3: 安装子项目依赖
# ============================================================
if [ "$ONLY_CORE" = false ]; then
  log "Step 3: 安装子项目依赖..."

  # 统计项目数
  TOTAL=$(find apps -maxdepth 2 -name "package.json" -not -path "*/node_modules/*" | wc -l)
  CURRENT=0
  FAILED=()

  while IFS= read -r pkg_json; do
    proj_dir="$(dirname "$pkg_json")"
    proj_name="$(basename "$proj_dir")"
    CURRENT=$((CURRENT + 1))

    printf "  [%3d/%3d] %s\n" "$CURRENT" "$TOTAL" "$proj_name"

    if ! (cd "$proj_dir" && npm install --ignore-scripts 2>&1 | tail -1); then
      FAILED+=("$proj_name")
      err "安装失败: $proj_name"
    fi
  done < <(find apps -maxdepth 2 -name "package.json" -not -path "*/node_modules/*" | sort)

  if [ ${#FAILED[@]} -gt 0 ]; then
    warn "以下项目依赖安装失败:"
    printf "    %s\n" "${FAILED[@]}"
  else
    ok "全部 $TOTAL 个子项目依赖安装完成"
  fi
else
  log "Step 3: 跳过子项目（--only-core）"
fi

# ============================================================
# Step 4: 构建
# ============================================================
if [ "$SKIP_BUILD" = false ]; then
  log "Step 4: 构建核心服务..."

  # 构建 hub-server
  if [ -d "hub-server" ]; then
    log "构建 hub-server..."
    if (cd hub-server && npm run build); then
      ok "hub-server 构建完成"
    else
      err "hub-server 构建失败"
    fi
  fi

  # 构建 packages
  for pkg in packages/*/; do
    if [ -f "$pkg/package.json" ]; then
      pkg_name="$(basename "$pkg")"
      if grep -q '"build"' "$pkg/package.json" 2>/dev/null; then
        log "构建 $pkg_name..."
        if (cd "$pkg" && npm run build 2>/dev/null); then
          ok "$pkg_name 构建完成"
        else
          warn "$pkg_name 构建跳过（无构建脚本或构建失败）"
        fi
      fi
    fi
  done

  # 构建子项目（可选，耗时较长）
  if [ "$ONLY_CORE" = false ]; then
    log "构建子项目..."
    BUILD_TOTAL=0
    BUILD_PASSED=0
    BUILD_FAILED=()

    while IFS= read -r pkg_json; do
      proj_dir="$(dirname "$pkg_json")"
      proj_name="$(basename "$proj_dir")"
      BUILD_TOTAL=$((BUILD_TOTAL + 1))

      if (cd "$proj_dir" && npm run build > /dev/null 2>&1); then
        BUILD_PASSED=$((BUILD_PASSED + 1))
      else
        BUILD_FAILED+=("$proj_name")
      fi
    done < <(find apps -maxdepth 2 -name "package.json" -not -path "*/node_modules/*" | sort)

    ok "子项目构建: $BUILD_PASSED/$BUILD_TOTAL 成功"
    if [ ${#BUILD_FAILED[@]} -gt 0 ]; then
      warn "构建失败项目:"
      printf "    %s\n" "${BUILD_FAILED[@]}"
    fi
  fi
else
  log "Step 4: 跳过构建（--skip-build）"
fi

# ============================================================
# Step 5: 启动
# ============================================================
log "Step 5: 启动服务..."

# 确保数据目录存在
mkdir -p data

log "启动 hub-server..."
log "访问地址: https://97.383636.xyz/code/20008/"
log "健康检查: https://97.383636.xyz/code/20008/health"
log ""
log "按 Ctrl+C 停止服务"
log ""

cd hub-server
exec npm start
