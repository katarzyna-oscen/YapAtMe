import { MODULE_REGISTRY } from './modules'

export async function buildAllowedFiles(listTree) {
  const tree = await listTree()
  const paths = []

  if (Array.isArray(tree)) {
    for (const mod of MODULE_REGISTRY) {
      const dir = tree.find((entry) => entry.kind === 'directory' && entry.name === mod.vaultFolder)
      const files = dir?.children || []
      for (const file of files) {
        if (file.name.endsWith('.md') && !file.name.startsWith('_') && !file.name.startsWith('.')) {
          paths.push(file.path || `${mod.vaultFolder}/${file.name}`)
        }
      }
    }
    return paths
  }

  for (const mod of MODULE_REGISTRY) {
    const files = tree[mod.vaultFolder] || []
    for (const file of files) {
      if (file.name.endsWith('.md') && !file.name.startsWith('_') && !file.name.startsWith('.')) {
        paths.push(file.path || `${mod.vaultFolder}/${file.name}`)
      }
    }
  }

  return paths
}
