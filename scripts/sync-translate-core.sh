#!/usr/bin/env bash
# MV3 can only load files under extension/. Copy translate-core src into vendor.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
rsync -a --delete "$ROOT/packages/translate-core/src/" "$ROOT/extension/vendor/translate-core/"
echo "synced → extension/vendor/translate-core/"
