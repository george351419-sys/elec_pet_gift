# Product Manager 5.0 Harness

This directory is a Claude Code-first product development Harness based on Product Manager 5.0, with Product Manager 4.0 kept only where deterministic gates are still valuable.

## What Is Included

- `CLAUDE.md`: project operating layer and routing rules.
- `.claude/skills/`: 11 reusable skills for product discovery, design, planning, building, review, release, goals, and evolution.
- `.claude/agents/`: two custom subagents, `code-reviewer` and `evolution-runner`.
- `.claude/settings.json` and `.claude/hooks/`: lifecycle hooks for command checks, review gates, feedback capture, and evolution reminders.
- `.claude/evolution/`: queued correction signals and pending proposals.
- `Product-Spec.md`, `Design-Brief.md`, `DEV-PLAN.md`: source-of-truth templates.

## First Use In A New Project

1. Copy these files into the project root.
2. Initialize git before relying on git-root hook resolution: `git init`.
3. Open the project in Claude Code and trust the project `.claude/` layer when prompted.
4. Run `/hooks` and review/trust the project hooks after first copy or after hook edits.
5. Start with a product idea. Claude Code should route to `product-spec-builder` if `Product-Spec.md` is still empty.

You can also install from this template directory:

```bash
scripts/install-pm50-claude-harness.sh /path/to/target-project
```

Use `--force` only when you intentionally want to overwrite existing Harness files.

## Validation

From the target project root, run:

```bash
python3 -m json.tool .claude/settings.json >/dev/null
.claude/hooks/stop-gate.sh
.claude/hooks/check-evolution.sh
find .claude/skills -name SKILL.md | wc -l
```

Expected: JSON parses, both hooks exit cleanly on a fresh install, and the skill count is 11.

## Operating Rhythm

- One session should normally complete one feature or one bounded decision.
- Update docs before code when requirements change.
- Use `goal-creator` only for bounded development or release work with evidence-based completion criteria.
- After feature work, spawn `code-reviewer` and loop fixes until two-stage review passes.
- Let `evolution-runner` digest queued correction signals before major new work.

## Important Claude Code Notes

- Project hooks in `.claude/settings.json` load only after the project `.claude/` layer is trusted.
- Claude Code discovers project instructions from `CLAUDE.md`; this Harness stores reusable workflows in `.claude/skills`.
- Custom agents are Markdown files in `.claude/agents/`.
- Hook commands run from the session working directory, so this Harness resolves paths through the git root when possible.
