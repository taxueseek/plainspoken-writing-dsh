#!/usr/bin/env bash
# 把 plainspoken-writing 项目里的 Python 引擎同步进插件，保证发行包自带可运行引擎。
# 用法：bash scripts/sync-engine.sh [项目路径]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="${1:-$ROOT/../plainspoken-writing}"

if [ ! -f "$PROJECT/cli.py" ]; then
  echo "找不到 $PROJECT/cli.py，请把项目路径作为第一个参数传入" >&2
  exit 1
fi

mkdir -p "$ROOT/engine"
rsync -a --delete --exclude '__pycache__' "$PROJECT/core/" "$ROOT/engine/core/"
rsync -a --delete "$PROJECT/rules/" "$ROOT/engine/rules/"
cp "$PROJECT/cli.py" "$ROOT/engine/cli.py"
echo "已同步引擎：$PROJECT -> $ROOT/engine"
