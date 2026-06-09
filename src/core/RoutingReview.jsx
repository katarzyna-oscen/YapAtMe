import { useMemo, useState } from 'react'
import { PrimaryButton, SecondaryButton } from '../components/ui/Buttons'

function makeContentKey(change) {
	return [
		String(change?.title || '').trim().toLowerCase(),
		String(change?.marker || '').trim().toLowerCase(),
		String(change?.content || '').trim().toLowerCase().slice(0, 120),
	].join('||')
}

function normalizePreviewText(text) {
	return String(text || '')
		.replace(/^\s*-\s*\[[ xX]\]\s*/gm, '')
		.trim()
}

function renderWikilinks(text, onWikilinkClick) {
	const parts = String(text || '').split(/(\[\[[^\]]+\]\])/g)
	return parts.map((part, idx) => {
		const m = part.match(/^\[\[([^\]]+)\]\]$/)
		if (!m) return <span key={idx}>{part}</span>
		return (
			<button
				type="button"
				key={idx}
				onClick={() => onWikilinkClick?.(m[1])}
				style={{ color: 'oklch(0.88 0.16 96)', textDecoration: 'underline', textDecorationColor: 'oklch(0.88 0.16 96 / 0.45)', background: 'transparent', border: 'none', padding: 0, margin: 0, cursor: 'pointer', font: 'inherit' }}
			>
				{m[1]}
			</button>
		)
	})
}

export default function RoutingReview({ result, onApprove, onDismiss, onDone, onCancel, onWikilinkClick }) {
	const [approvedIds, setApprovedIds] = useState(new Set())
	const changes = result?.changes || []

	const remaining = useMemo(
		() => changes.filter((c) => !approvedIds.has(c.id)),
		[changes, approvedIds]
	)

	const groupedRemaining = useMemo(() => {
		const groups = new Map()
		for (const change of remaining) {
			const key = makeContentKey(change)
			const current = groups.get(key)
			if (current) {
				current.items.push(change)
			} else {
				groups.set(key, {
					key,
					title: change.title,
					content: change.content,
					marker: change.marker,
					items: [change],
				})
			}
		}
		return [...groups.values()]
	}, [remaining])

	const handleApproveGroup = async (group) => {
		for (const change of group.items) {
			await onApprove(change)
		}
		setApprovedIds((prev) => {
			const next = new Set(prev)
			for (const change of group.items) next.add(change.id)
			return next
		})
	}

	const handleDismissGroup = (group) => {
		for (const change of group.items) {
			onDismiss(change.id)
		}
		setApprovedIds((prev) => {
			const next = new Set(prev)
			for (const change of group.items) next.add(change.id)
			return next
		})
	}

	const handleApproveAll = async () => {
		for (const group of groupedRemaining) {
			for (const change of group.items) {
				await onApprove(change)
			}
		}
		setApprovedIds((prev) => {
			const next = new Set(prev)
			for (const change of remaining) next.add(change.id)
			return next
		})
	}

	return (
		<div className="fixed inset-0 z-50 bg-[var(--bg-primary)]/95 backdrop-blur-sm overflow-y-auto">
			<div className="max-w-4xl mx-auto px-6 py-8">
				<div className="flex items-center justify-between mb-6">
					<div>
						<h2 className="text-xl font-semibold text-[var(--text-primary)]">Review Routing</h2>
						<p className="text-sm text-[var(--text-muted)] mt-1">
							{groupedRemaining.length} pending {groupedRemaining.length === 1 ? 'change' : 'changes'}
						</p>
					</div>
					<div className="flex items-center gap-2">
						<SecondaryButton onClick={handleApproveAll} disabled={groupedRemaining.length === 0}>Approve All</SecondaryButton>
						<SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
						<PrimaryButton onClick={onDone}>Done</PrimaryButton>
					</div>
				</div>

				<div className="space-y-3">
					{groupedRemaining.length === 0 ? (
							<div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6 text-center text-sm text-[var(--text-muted)]">
							All proposed changes have been handled.
						</div>
					) : (
						groupedRemaining.map((group) => (
							<div key={group.key} className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
								<div className="flex items-start justify-between gap-4">
									<div className="min-w-0">
										<p className="text-sm font-medium text-[var(--text-primary)] truncate">{renderWikilinks(group.title || 'Proposed update', onWikilinkClick)}</p>
										<div className="text-xs text-[var(--text-muted)] mt-1 space-y-0.5">
											{group.items.map((item) => (
												<div key={item.id}>{item.target_file} · {item.target_section}</div>
											))}
											<div>{group.marker}</div>
										</div>
									</div>
									<div className="flex items-center gap-2 shrink-0">
										<button
											onClick={() => handleDismissGroup(group)}
											className="px-3 py-1.5 rounded-md text-xs border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
										>
											Dismiss
										</button>
										<button
											onClick={() => handleApproveGroup(group)}
											className="px-3 py-1.5 rounded-md text-xs bg-[var(--accent)] text-[var(--bg-primary)] font-medium hover:opacity-90"
										>
											Approve
										</button>
									</div>
								</div>
									<div className="mt-3 text-xs text-[var(--text-secondary)] whitespace-pre-wrap font-mono bg-[var(--bg-input)] border border-[var(--border)] rounded p-3">
										{renderWikilinks(normalizePreviewText(group.content), onWikilinkClick)}
									</div>
							</div>
						))
					)}
				</div>
			</div>
		</div>
	)
}

