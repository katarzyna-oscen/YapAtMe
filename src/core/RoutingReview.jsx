import { useMemo, useState } from 'react'

function renderWikilinks(text) {
	const parts = String(text || '').split(/(\[\[[^\]]+\]\])/g)
	return parts.map((part, idx) => {
		const m = part.match(/^\[\[([^\]]+)\]\]$/)
		if (!m) return <span key={idx}>{part}</span>
		return (
			<span key={idx} style={{ color: 'oklch(0.88 0.16 96)', textDecoration: 'underline', textDecorationColor: 'oklch(0.88 0.16 96 / 0.45)' }}>
				{m[1]}
			</span>
		)
	})
}

export default function RoutingReview({ result, onApprove, onDismiss, onDone, onCreateEntity }) {
	const [approvedIds, setApprovedIds] = useState(new Set())
	const [createdKeys, setCreatedKeys] = useState(new Set())
	const changes = result?.changes || []
	const unknown = result?.unknown_entities || []

	const remaining = useMemo(
		() => changes.filter((c) => !approvedIds.has(c.id)),
		[changes, approvedIds]
	)

	const handleApprove = async (change) => {
		await onApprove(change)
		setApprovedIds((prev) => new Set([...prev, change.id]))
	}

	const handleDismiss = (change) => {
		onDismiss(change.id)
		setApprovedIds((prev) => new Set([...prev, change.id]))
	}

	const handleCreate = (entity) => {
		const key = `${entity.type}-${entity.name}`
		if (createdKeys.has(key)) return
		setCreatedKeys((prev) => new Set([...prev, key]))
		onCreateEntity(entity)
	}

	return (
		<div className="fixed inset-0 z-50 bg-[var(--bg-primary)]/95 backdrop-blur-sm overflow-y-auto">
			<div className="max-w-4xl mx-auto px-6 py-8">
				<div className="flex items-center justify-between mb-6">
					<div>
						<h2 className="text-xl font-semibold text-[var(--text-primary)]">Review Routing</h2>
						<p className="text-sm text-[var(--text-muted)] mt-1">
							{remaining.length} pending {remaining.length === 1 ? 'change' : 'changes'}
						</p>
					</div>
					<button
						onClick={onDone}
						className="px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--bg-primary)] text-sm font-medium hover:opacity-90"
					>
						Done
					</button>
				</div>

				{unknown.length > 0 && (
					<div className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
						<h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Unknown entities</h3>
						<div className="space-y-2">
							{unknown.map((entity, idx) => (
								<div key={`${entity.type}-${entity.name}-${idx}`} className="flex items-center justify-between rounded-md border border-[var(--border)] px-3 py-2">
									<div>
										<p className="text-sm text-[var(--text-primary)]">{entity.name}</p>
										<p className="text-xs text-[var(--text-muted)]">{entity.type}</p>
									</div>
									{createdKeys.has(`${entity.type}-${entity.name}`) ? (
										<span className="px-3 py-1.5 rounded-md text-xs text-[var(--accent)] border border-[var(--accent)]/30">
											Created ✓
										</span>
									) : (
										<button
											onClick={() => handleCreate(entity)}
											className="px-3 py-1.5 rounded-md text-xs border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
										>
											Create
										</button>
									)}
								</div>
							))}
						</div>
					</div>
				)}

				<div className="space-y-3">
					{remaining.length === 0 ? (
							<div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6 text-center text-sm text-[var(--text-muted)]">
							All proposed changes have been handled.
						</div>
					) : (
						remaining.map((change) => (
							<div key={change.id} className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
								<div className="flex items-start justify-between gap-4">
									<div className="min-w-0">
											<p className="text-sm font-medium text-[var(--text-primary)] truncate">{renderWikilinks(change.title || 'Proposed update')}</p>
										<p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
											{change.target_file} · {change.target_section} · {change.marker}
										</p>
									</div>
									<div className="flex items-center gap-2 shrink-0">
										<button
											onClick={() => handleDismiss(change)}
											className="px-3 py-1.5 rounded-md text-xs border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
										>
											Dismiss
										</button>
										<button
											onClick={() => handleApprove(change)}
											className="px-3 py-1.5 rounded-md text-xs bg-[var(--accent)] text-[var(--bg-primary)] font-medium hover:opacity-90"
										>
											Approve
										</button>
									</div>
								</div>
									<div className="mt-3 text-xs text-[var(--text-secondary)] whitespace-pre-wrap font-mono bg-[var(--bg-input)] border border-[var(--border)] rounded p-3">
										{renderWikilinks(change.content)}
									</div>
							</div>
						))
					)}
				</div>
			</div>
		</div>
	)
}

