# Sync Harness

Sync project-agnostic harness files between this project and the shared template.

## Direction

Ask which direction:
- **Pull** — update this project's commands from `~/.claude/templates/harness/`
- **Push** — update the template from this project's improved commands

If the user doesn't specify, default to **pull** (template → project).

## Files That Sync

These are project-agnostic and should stay in sync across all projects:

| Template file | Project file |
|---|---|
| `~/.claude/templates/harness/commands/session-start.md` | `.claude/commands/session-start.md` |
| `~/.claude/templates/harness/commands/session-end.md` | `.claude/commands/session-end.md` |
| `~/.claude/templates/harness/commands/precommit.md` | `.claude/commands/precommit.md` |
| `~/.claude/templates/harness/commands/simplify.md` | `.claude/commands/simplify.md` |
| `~/.claude/templates/harness/commands/sync-harness.md` | `.claude/commands/sync-harness.md` |
| `~/.claude/templates/harness/config/schemas/sprint_contract.schema.json` | `config/schemas/sprint_contract.schema.json` |

## Files That Do NOT Sync

These are project-specific and must never be overwritten by sync:

- `config/rubrics/persona-review.json` — project-specific personas
- `.claude/hooks/post-compact.sh` — project-specific critical rules
- `.claude/hooks/stop-guard.sh` — may have project-specific reminders
- `.claude/settings.json` — project-specific hook wiring

## Pull (template → project)

1. For each syncable file, compare template version against project version.
2. If the template has `{{PLACEHOLDER}}` markers, preserve the project's resolved values.
   Key placeholders and their project-specific resolutions:
   - `{{TEST_COMMAND}}` — read from project's current files (e.g., `bun test`, `npm test`, `pytest`)
   - `{{MEMORY_PATH}}` — read from project's current files (e.g., `C:\Users\jeffb\.claude\projects\...`)
   - `{{PROJECT_NAME}}` — read from CLAUDE.md header
3. Copy template content → project file, replacing `{{PLACEHOLDER}}` with resolved values.
4. Report which files were updated and which were already current.

## Push (project → template)

1. For each syncable file, read the project version.
2. Replace project-specific values back to placeholders:
   - Test command → `{{TEST_COMMAND}}`
   - Memory path → `{{MEMORY_PATH}}`
   - Project name → `{{PROJECT_NAME}}`
3. Write templatized version → template file.
4. Report which template files were updated.

## After Sync

```bash
# Show what changed
git diff --stat .claude/commands/ config/schemas/
```

If pull: commit the updated project files.
If push: report that the template is updated (template is outside git).
