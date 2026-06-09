export async function appendToSection(readFile, writeFile, filePath, targetSection, content) {
  let current = ''
  try {
    current = await readFile(filePath)
  } catch {
    current = `${targetSection}\n`
  }

  if (!current.includes(targetSection)) {
    const next = `${current.trimEnd()}\n\n${targetSection}\n${content}\n`
    await writeFile(filePath, next)
    return
  }

  const lines = current.split('\n')
  const sectionIndex = lines.findIndex((line) => line.trim() === targetSection.trim())
  let insertIndex = lines.length
  for (let i = sectionIndex + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      insertIndex = i
      break
    }
  }

  const before = lines.slice(0, insertIndex)
  const after = lines.slice(insertIndex)
  const toInsert = content.endsWith('\n') ? content : `${content}\n`
  const next = `${before.join('\n')}\n${toInsert}${after.join('\n')}`.replace(/\n{3,}/g, '\n\n')
  await writeFile(filePath, next)
}

export async function prependToSection(readFile, writeFile, filePath, heading, content, noteDateSlug) {
  let raw = ''
  try {
    raw = await readFile(filePath)
  } catch {}

  if (noteDateSlug) {
    const dateTag = `[[${noteDateSlug}]]`
    const lines = raw.split('\n')
    const existingIdx = lines.findIndex((line) => String(line || '').trimStart().startsWith(dateTag))
    if (existingIdx !== -1) {
      lines[existingIdx] = content
      await writeFile(filePath, lines.join('\n'))
      return
    }
  }

  const lines = raw.split('\n')
  const headingIdx = lines.findIndex(
    (line) => line.trim().toLowerCase() === heading.trim().toLowerCase()
  )

  if (headingIdx === -1) {
    await writeFile(filePath, raw.trimEnd() + `\n${heading}\n${content}\n`)
    return
  }

  // Ensure the entry ends with \n so that join('\n') produces a blank-line
  // separator between adjacent entries and prevents them from concatenating.
  const entryLine = content.endsWith('\n') ? content : `${content}\n`
  lines.splice(headingIdx + 1, 0, entryLine)
  // If the entry immediately after the inserted one is another non-blank,
  // non-heading line (i.e. entries are adjacent with no separator), insert a blank.
  const afterIdx = headingIdx + 2
  if (
    afterIdx < lines.length &&
    lines[afterIdx] &&
    !lines[afterIdx].startsWith('#') &&
    lines[afterIdx] !== ''
  ) {
    lines.splice(afterIdx, 0, '')
  }
  await writeFile(filePath, lines.join('\n'))
}

export async function moveFile(readFile, writeFile, deleteFile, fromPath, toPath) {
  const content = await readFile(fromPath)
  await writeFile(toPath, content)

  if (typeof deleteFile === 'function') {
    await deleteFile(fromPath)
    return
  }

  // Fallback when delete is not available.
  await writeFile(fromPath, `_moved -> ${toPath}\n`)
}
