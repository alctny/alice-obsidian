#!/usr/bin/env bash
set -euo pipefail

# Resolve paths relative to this script so it also works from other directories.
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd -- "$project_dir"

echo "Building alice-midnight…"
node alice-midnight/scripts/build.mjs build

echo "Building alice-sidebar…"
node alice-sidebar/build.mjs

echo "Build complete."
echo "Theme:  $project_dir/dist/alice-midnight/"
echo "Plugin: $project_dir/dist/alice-sidebar/"
