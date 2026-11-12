#!/usr/bin/env bash
set -euo pipefail

# Resolve paths relative to this script so it also works from other directories.
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd -- "$project_dir"

echo "Building alice-mindnight…"
node alice-mindnight/scripts/build.mjs build

echo "Building alice-sidebar…"
node alice-sidebar/build.mjs

echo "Building alice-mmd…"
npm --prefix alice-mmd run build

echo "Build complete."
echo "Theme:  $project_dir/dist/alice-mindnight/"
echo "Plugin: $project_dir/dist/alice-sidebar/"
echo "Mermaid: $project_dir/dist/alice-mmd/"
