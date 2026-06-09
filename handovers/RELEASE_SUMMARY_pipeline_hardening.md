# Release summary — Inbox → Routing → Tasks pipeline
*Session: 2026-05-23*

---

## Tasks page

- Remove, comment, and menu actions are now reliable
- Comments are editable and timestamped
- Category and done/restore state persist correctly across reloads
- Freshness chips render as styled age labels, not raw "1d" text
- Drag/drop reordering respects category boundaries
- Task row truncation fixed — long titles no longer overflow into the entity column
- Entity links are less fragile — reassigning a task to a different entity saves correctly
- Wikilink display normalised — `[[Name]]` renders cleanly instead of showing escaped brackets or doubled syntax
- Task titles sanitised on write/read — bad forms like `\[[[Name]]]` and leaked date headings no longer appear in the UI

---

## Inbox processing and routing

- Processed notes now move from `inbox/` to `notes/` properly — no leftover marker files
- Processed notes auto-open in the viewer after completion
- Routing hashtags inserted inline next to the relevant sentence, not dumped as a block at the bottom of the note
- Duplicate routed items are deduplicated before writing to entity files
- `important` and `urgent` tags preserved through the routing pipeline
- People routing is more deterministic — known people matched case-insensitively
- Auto-linking: known people names written as `[[Name]]` in routed content
- Urgent people items route to `Talk About` / Needs Your Call instead of always defaulting to Delegate
- LLM JSON parsing hardened — noisy or malformed model responses no longer crash processing

---

## Entities, tags, and display

- Tags pipeline introduced: extraction, normalisation, indexing, autocomplete
- Hashtags visually distinct in the editor (inline styling, not raw `#text`)
- Wikilinks styled inline — no more raw bracket syntax visible in Milkdown
- Existing entity detection is case-insensitive and canonicalised
- Unknown entities can be created directly from the routing review screen
- New entity creation uses the full shared templates (Summary, sections, placeholder text) instead of sparse stubs
- Deterministic fallback for ambiguous people mentions (e.g. "Muffin needs to eat") — creates a review suggestion without duplicating it on re-runs

---

## Still pending

See `KNOWN_ISSUES_tasks_and_loader.md` for the remaining tasks UI issues and the dot grid loader component.  
Next planned: Ideas entity viewer (Patch 09), Dashboard redesign (H09).
