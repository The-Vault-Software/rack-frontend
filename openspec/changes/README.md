# Changes

Active SDD changes live in subdirectories named after the change
(e.g., `openspec/changes/add-dark-mode/`). Each change folder follows the
SDD pipeline: `exploration.md` → `proposal.md` → `specs/` → `design.md` →
`tasks.md` → `verify-report.md`, with `state.yaml` tracking phase progression.

Completed changes are moved to `archive/YYYY-MM-DD-{change-name}/` by
`sdd-archive`. The archive is an audit trail — never delete or modify it.