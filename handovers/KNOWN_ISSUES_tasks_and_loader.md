# Tasks Page — Known Issues (pinned for next patch)

Screenshot date: 2026-05-23. Build is partially working — tasks load, categories render, TypeDots show, drag handles visible.

---

## Issues confirmed from screenshot + user report

### 1. Missing header buttons
Clear done and Toggle Comments buttons are not appearing in the top nav. Likely because:
- `doneInSection` count is 0 (no ticked tasks yet) so ClearDone is correctly hidden
- `tasksWithComments` is empty so ToggleComments is correctly hidden
- BUT: user says buttons are "missing" — verify they appear once a task is ticked or a comment is added. If they never appear, check the conditional rendering logic.

### 2. Age display looks wrong
The "1d" text is rendering as plain unstyled text next to the project name, not as a distinct chip. The design shows it as a small muted label separated from the project name. Fix: ensure the age span has `color: var(--text-very-dim)` and is visually separated from the project name. It should read: `[TypeDot] [project-name]   [1d]   [···]`

### 3. Double-click edit only works on task text, not project name
`EditableField` is only wired to the task text. The project name span is not using `EditableField`. Fix: wrap the project name display in `EditableField` as specified in Step 5d of Patch 08.

### 4. Remove doesn't work
The "Remove" option in the 3-dot menu fires `onDelete` but the task remains visible. Likely cause: `resolveTask` is failing silently (the task gets removed from UI state but `resolveTask` throws because the task ID doesn't exist in `tasks-index.json` the way it expects, or the function signature mismatch). Fix: add a try/catch around `resolveTask` in `onDelete` and log the error. Also ensure the task is removed from UI state regardless of whether the vault write succeeds.

### 5. Comments not working
Comment thread is not opening. The 3-dot menu should have "Comment" as the first item — if Remove doesn't work, Comment likely doesn't either. Root cause is probably the same menu wiring issue. Fix: confirm `onAction` / `onDelete` / `onSetCommentsOpen` are all correctly passed to `TaskRow`.

### 6. No freshness chip
The design shows an age chip (styled pill) next to each task. Currently just plain "1d" text. Fix: style it properly — small text, `var(--text-very-dim)` color, `flexShrink: 0`, positioned at the far right before the 3-dots.

---

## Also pending (separate patch)

### Dot grid loader
User approved the demo (snake + wave modes preferred). Needs implementation as a `DotGrid` component to replace:
- The spinning sparkle on Process Note button while processing
- Vault loading state (before a folder is opened)
- Sidebar sync animation
Component: `<canvas>` driven by `requestAnimationFrame`, 5×5 dots, configurable mode and size. No external dependencies.
