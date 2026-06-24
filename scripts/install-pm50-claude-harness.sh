#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/install-pm50-claude-harness.sh <target-project-root> [--force]

Copies the Product Manager 5.0 Claude Code Harness into another project.

Default behavior:
- Creates .claude and scripts folders as needed.
- Does not overwrite existing product docs or CLAUDE.md.
- Overwrites Harness-managed .claude files only with --force.

After install:
1. Run git init in the target project if it is not already a git repo.
2. Open the project in Claude Code and trust the project .claude layer when prompted.
3. Review/trust the hooks after first copy or after hook edits.
USAGE
}

if [ "${1:-}" = "" ] || [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
  exit 0
fi

source_root="$(cd "$(dirname "$0")/.." && pwd)"
target="$(cd "$1" && pwd)"
force="${2:-}"

copy_file() {
  src="$1"
  dst="$2"
  if [ -e "$dst" ] && [ "$force" != "--force" ]; then
    echo "skip existing: $dst"
    return 0
  fi
  mkdir -p "$(dirname "$dst")"
  cp "$src" "$dst"
  echo "copy: $dst"
}

copy_dir() {
  src="$1"
  dst="$2"
  if [ -e "$dst" ] && [ "$force" != "--force" ]; then
    echo "skip existing dir: $dst"
    return 0
  fi
  rm -rf "$dst"
  mkdir -p "$(dirname "$dst")"
  cp -R "$src" "$dst"
  echo "copy dir: $dst"
}

copy_file "$source_root/CLAUDE.md" "$target/CLAUDE.md"
copy_file "$source_root/README.md" "$target/PM50-CLAUDE-HARNESS.md"
copy_file "$source_root/Product-Spec.md" "$target/Product-Spec.md"
copy_file "$source_root/Product-Spec-CHANGELOG.md" "$target/Product-Spec-CHANGELOG.md"
copy_file "$source_root/Design-Brief.md" "$target/Design-Brief.md"
copy_file "$source_root/DEV-PLAN.md" "$target/DEV-PLAN.md"

copy_dir "$source_root/.claude/skills" "$target/.claude/skills"
copy_dir "$source_root/.claude/agents" "$target/.claude/agents"
copy_dir "$source_root/.claude/hooks" "$target/.claude/hooks"
copy_file "$source_root/.claude/settings.json" "$target/.claude/settings.json"
copy_file "$source_root/.claude/EVOLUTION.md" "$target/.claude/EVOLUTION.md"

mkdir -p "$target/.claude/evolution" "$target/.claude/state"
touch "$target/.claude/evolution/signals.jsonl"
if [ ! -e "$target/.claude/evolution/proposals.md" ] || [ "$force" = "--force" ]; then
  cp "$source_root/.claude/evolution/proposals.md" "$target/.claude/evolution/proposals.md"
fi
printf '0\n' > "$target/.claude/state/review-needed"
chmod +x "$target/.claude/hooks"/*.sh

echo "PM5.0 Claude Code Harness installed in: $target"

