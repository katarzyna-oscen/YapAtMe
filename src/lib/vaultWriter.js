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
