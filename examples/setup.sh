#!/usr/bin/env bash
# Copies a sample app out of this repo into its own git repository so a coding agent can commit to it.
# Usage: examples/setup.sh habits ~/direct-apps/bloom
set -euo pipefail
name="${1:?usage: setup.sh <habits|dashboard> <target-dir>}"
target="${2:?usage: setup.sh <habits|dashboard> <target-dir>}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -d "$here/$name" ] || { echo "Unknown sample: $name"; exit 1; }
[ -e "$target" ] && { echo "$target already exists"; exit 1; }
mkdir -p "$target"
cp -R "$here/$name/." "$target/"
cp "$here/serve.mjs" "$target/serve.mjs"
printf '.direct.json\nnode_modules\n' > "$target/.gitignore"
cd "$target"
git init -q
git add -A
git commit -qm "Initial sample app"
echo "Created $target ($(git rev-parse --short HEAD)). Serve it with: node serve.mjs . 4173"
