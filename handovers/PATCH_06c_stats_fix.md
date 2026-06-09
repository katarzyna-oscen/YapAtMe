# Patch 06c — Fix Stats Box and Last Mentioned
**Problems:** Stats box is full-width and looks broken when only one stat exists. Date format falls back to raw ISO string for dates >7 days. Last mentioned chip stands out awkwardly as a separate element.  
**Fix:** Move last mentioned into the pill row with role/relationship. Stats row (delegates + talk-about) only renders when counts are non-zero. Fix date formatting.

---

## Step 1 — index.css: remove the bordered stats box, inline stats

Open `src/core/PersonViewer.jsx`. Find the stats box div and the pill row. Replace both sections with a unified metadata row:

```jsx
{/* Metadata row — role + relationship + last mentioned + open counts */}
<div style={{ display: 'flex', gap: 6, marginBottom: 28, flexWrap: 'wrap', alignItems: 'center' }}>

  {/* Role pill */}
  <PillInput value={role} onChange={setRole} placeholder="Role" />

  {/* Relationship pill */}
  <PillInput value={relationship} onChange={setRelationship} placeholder="Relationship" />

  {/* Delegate count — read-only, shown only if > 0 */}
  {delegateCount > 0 && (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px',
      background: 'transparent',
      border: '1px solid var(--border)',
      borderRadius: 5,
      fontSize: 12,
      color: 'var(--text-very-dim)',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ fontWeight: 600, color: 'var(--text)' }}>{delegateCount}</span>
      {delegateCount === 1 ? 'delegate' : 'delegates'}
    </span>
  )}

  {/* Talk-about count — read-only, shown only if > 0 */}
  {talkAboutCount > 0 && (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px',
      background: 'transparent',
      border: '1px solid var(--border)',
      borderRadius: 5,
      fontSize: 12,
      color: 'var(--text-very-dim)',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{talkAboutCount}</span>
      to talk about
    </span>
  )}

</div>
```

Remove the old `{hasStats && ( <div style={{ ...statsBox... }}> )}` block entirely — it is replaced by the chips above.

Also remove the `hasStats` computed variable since it's no longer needed:

```js
// REMOVE:
const hasStats = delegateCount > 0 || talkAboutCount > 0 || lastMentioned
```

---

## Step 2 — Fix formatMentionAge

Remove the `formatMentionAge` function entirely — it is no longer used.

## Step 3 — Remove now-unused state and parsing

In `PersonViewer.jsx` remove:
- `const [lastMentioned, setLastMentioned] = useState(null)` state declaration
- The entire `## Recent Mentions` body-parsing block inside `loadStats` that sets `lastMentioned`

---

## Build check

1. `bun run build` — passes
2. **Metadata row** — name at 30px, then a single row of pills: `[UX designer / Prof II]` `[direct report]` — clean, no extra chips unless there are open task counts
3. **No stats when empty** — new person file shows only `+ Role` and `+ Relationship` placeholders, nothing else
5. **Count chips appear** — after processing a note that delegates to this person, reload the person file → delegate chip appears inline in the pill row
6. **No floating card** — the large bordered stats box is gone entirely
