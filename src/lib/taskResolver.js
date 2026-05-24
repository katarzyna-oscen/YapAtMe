const INDEX_PATH = 'context/tasks-index.json'
const DONE_PATH = 'archive/tasks.md'

export async function resolveTask(readFile, writeFile, taskId) {
	const raw = await readFile(INDEX_PATH)
	const entries = JSON.parse(raw)
	const target = entries.find((entry) => entry.id === taskId)
	if (!target) return

	const next = entries.filter((entry) => entry.id !== taskId)
	await writeFile(INDEX_PATH, JSON.stringify(next, null, 2))

	let done = ''
	try {
		done = await readFile(DONE_PATH)
	} catch {
		done = '# Resolved Tasks\n\n'
	}

	const date = new Date().toISOString().split('T')[0]
	const line = `- [x] ${target.title} · ${target.file} · resolved ${date}`
	const suffix = done.endsWith('\n') ? '' : '\n'
	await writeFile(DONE_PATH, `${done}${suffix}${line}\n`)
}

