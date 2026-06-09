import { useState } from 'react'
import { MODULE_REGISTRY } from '../lib/modules'
import { generateFile } from '../lib/templates'
import { invalidateFileIndex } from '../lib/fileIndex'
import { restoreTasksForRecreatedPerson } from '../lib/tasksIndex'
import { PrimaryButton, SecondaryButton } from './ui/Buttons'

const TYPE_TO_MODULE = { person: 'people', project: 'projects', idea: 'ideas' }

export default function EntityCreateModal({ unknown, readFile, writeFile, onCreated, onCancel }) {
  const [name, setName] = useState(unknown.name)
  const [relationship, setRelationship] = useState('')
  const [role, setRole] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const mod = MODULE_REGISTRY.find((moduleDef) => moduleDef.id === (TYPE_TO_MODULE[unknown.type] || unknown.type))

  if (!mod) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-6 w-96">
          <p className="text-[var(--danger)] text-sm">Unknown module type: {unknown.type}</p>
          <div className="mt-4">
            <SecondaryButton onClick={onCancel}>Close</SecondaryButton>
          </div>
        </div>
      </div>
    )
  }

  const handleCreate = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError(null)

    try {
      const slug = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .slice(0, 60)

      const normalizedSlug = slug
        ? `${slug.charAt(0).toUpperCase()}${slug.slice(1)}`
        : 'Untitled'

      const filePath = `${mod.vaultFolder}/${normalizedSlug}.md`
      const generated = generateFile(mod.vaultFolder, name.trim(), {
        relationship,
        role,
      })
      const finalContent = generated.content

      await writeFile(filePath, finalContent)
      if (mod.vaultFolder === 'people' && typeof readFile === 'function') {
        await restoreTasksForRecreatedPerson(readFile, writeFile, filePath)
      }
      await invalidateFileIndex()
      onCreated(filePath)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--panel)] border border-[var(--border-strong)] rounded-xl p-6 w-[420px] shadow-2xl">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Create {mod.singularLabel || mod.label}</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            New file in <span className="font-mono text-xs">{mod.vaultFolder}/</span>
          </p>
        </div>

        <label className="block mb-4">
          <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
            className="mt-1.5 w-full bg-[var(--panel-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors"
            placeholder={`${mod.singularLabel || mod.label} name...`}
          />
        </label>

        {mod.vaultFolder === 'people' && (
          <>
            <label className="block mb-4">
              <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Relationship</span>
              <input
                type="text"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="mt-1.5 w-full bg-[var(--panel-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors"
                placeholder="Friend, colleague, client..."
              />
            </label>

            <label className="block mb-4">
              <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Role</span>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="mt-1.5 w-full bg-[var(--panel-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors"
                placeholder="Designer, engineer, partner..."
              />
            </label>
          </>
        )}

        {error && <p className="text-xs text-[var(--danger)] mb-4">{error}</p>}

        <div className="flex items-center justify-end gap-3">
          <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
          <PrimaryButton
            onClick={handleCreate}
            disabled={saving || !name.trim()}
          >
            {saving ? 'Creating…' : `Create ${mod.singularLabel || mod.label}`}
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}
