function getPriorityChip(task) {
  const tags = Array.isArray(task?.tags) ? task.tags.map((tag) => String(tag).toLowerCase()) : []
  const text = String(task?.title || '').toLowerCase()

  if (tags.includes('urgent') || /\b(urgent|asap|immediately|critical|blocker)\b/.test(text)) {
    return 'urgent'
  }
  if (tags.includes('important') || tags.includes('priority') || /\b(important|high-priority|priority)\b/.test(text)) {
    return 'important'
  }
  return null
}

export default function TaskPanel({ tasks = [], sections = [], onResolve }) {
  const groupedSections = sections
    .map((section) => ({
      section,
      tasks: tasks.filter((task) => task?.section === section),
    }))
    .filter((group) => group.tasks.length > 0)

  if (groupedSections.length === 0) return null

  return (
    <div style={{ marginBottom: 28 }}>
      {groupedSections.map(({ section, tasks: sectionTasks }) => (
        <section key={section} style={{ marginBottom: 18 }}>
          <div
            style={{
              fontSize: 10.5,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text-very-dim)',
              marginBottom: 8,
              fontWeight: 600,
            }}
          >
            {section.replace(/^##\s*/, '')} · {sectionTasks.length}
          </div>
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 10,
              overflow: 'hidden',
              background: 'var(--panel)',
            }}
          >
            {sectionTasks.map((task, index) => (
              <div
                key={task.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderTop: index === 0 ? 'none' : '1px solid var(--border-subtle)',
                }}
              >
                <button
                  onClick={() => onResolve?.(task.id)}
                  title="Resolve task"
                  style={{
                    width: 18,
                    height: 18,
                    flexShrink: 0,
                    border: '1.5px solid var(--border-strong)',
                    borderRadius: 5,
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
                <div style={{ fontSize: 13, color: 'var(--text)', minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ minWidth: 0, flex: 1 }}>{task.title}</span>
                  {getPriorityChip(task) && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '2px 7px',
                        borderRadius: 999,
                        background: 'oklch(0.65 0.2 25 / 0.12)',
                        border: '1px solid oklch(0.65 0.2 25 / 0.30)',
                        color: 'oklch(0.78 0.18 25)',
                        fontSize: 10.5,
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      {getPriorityChip(task)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}