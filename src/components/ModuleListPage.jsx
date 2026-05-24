import { useState, useEffect } from 'react'
import VaultFileViewer from './VaultFileViewer'

export default function ModuleListPage({ label, vaultFolder, readFile, writeFile, listTree }) {
	const [files, setFiles] = useState([])
	const [selected, setSelected] = useState(null)
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		loadFiles()
	}, [vaultFolder])

	const loadFiles = async () => {
		setLoading(true)
		try {
			const tree = await listTree()
			let entries = []

			if (Array.isArray(tree)) {
				const dir = tree.find((entry) => entry.kind === 'directory' && entry.name === vaultFolder)
				entries = (dir?.children || [])
					.filter((file) => file.name.endsWith('.md') && !file.name.startsWith('_') && !file.name.startsWith('.'))
					.map((file) => ({ name: file.name.replace('.md', ''), path: file.path || `${vaultFolder}/${file.name}` }))
					.sort((a, b) => a.name.localeCompare(b.name))
			} else {
				entries = (tree[vaultFolder] || [])
					.filter((file) => file.name.endsWith('.md') && !file.name.startsWith('_') && !file.name.startsWith('.'))
					.map((file) => ({ name: file.name.replace('.md', ''), path: file.path || `${vaultFolder}/${file.name}` }))
					.sort((a, b) => a.name.localeCompare(b.name))
			}

			setFiles(entries)
			if (entries.length > 0) setSelected(entries[0])
			else setSelected(null)
		} catch {
			setFiles([])
			setSelected(null)
		}
		setLoading(false)
	}

	if (loading) return <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">Loading…</div>

	if (files.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center h-full text-center px-8">
				<p className="text-[var(--text-muted)] text-sm">No {label.toLowerCase()} yet.</p>
				<p className="text-[var(--text-muted)] text-xs mt-1">
					Process a note or use the Create button in routing review to add the first entry.
				</p>
			</div>
		)
	}

	return (
		<div className="flex h-full overflow-hidden">
			<div className="w-56 shrink-0 border-r border-[var(--border)] overflow-y-auto py-4">
				<p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider px-4 mb-2">
					{label} · {files.length}
				</p>
				{files.map((file) => (
					<button
						key={file.path}
						onClick={() => setSelected(file)}
						className={`w-full text-left px-4 py-2 text-sm transition-colors ${selected?.path === file.path ? 'bg-[var(--panel-pop)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
					>
						{file.name}
					</button>
				))}
			</div>
			<div className="flex-1 overflow-hidden">
				{selected ? (
					<VaultFileViewer
						filePath={selected.path}
						readFile={readFile}
						writeFile={writeFile}
					/>
				) : null}
			</div>
		</div>
	)
}

