// Web File System Access API & Virtual Workspace Provider
// Allows opening and editing local projects directly in the browser with ZERO local backend dependencies.

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.cache',
  '__pycache__', '.venv', 'venv', '.turbo', '.idea', '.vscode'
])

export function isNativeFSSupported() {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
}

export async function pickNativeDirectory() {
  if (!isNativeFSSupported()) {
    throw new Error('Native File System Access API not supported in this browser.')
  }
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
  return handle
}

export async function buildTreeFromHandle(dirHandle, relPath = '', depth = 0, maxDepth = 5) {
  const children = []
  if (depth < maxDepth) {
    const entries = []
    try {
      for await (const entry of dirHandle.values()) {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
        entries.push(entry)
      }
    } catch {
      return { name: dirHandle.name, path: relPath, type: 'dir', children: [] }
    }

    entries.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    for (const entry of entries) {
      const childRel = relPath ? `${relPath}/${entry.name}` : entry.name
      if (entry.kind === 'directory') {
        const sub = await buildTreeFromHandle(entry, childRel, depth + 1, maxDepth)
        children.push(sub)
      } else {
        children.push({ name: entry.name, path: childRel, type: 'file' })
      }
    }
  }

  return {
    name: relPath === '' ? dirHandle.name : dirHandle.name,
    path: relPath,
    type: 'dir',
    children
  }
}

async function resolveFileHandle(dirHandle, relPath, create = false) {
  const parts = String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '').split('/')
  const fileName = parts.pop()
  let curr = dirHandle

  for (const part of parts) {
    if (!part) continue
    curr = await curr.getDirectoryHandle(part, { create })
  }

  return await curr.getFileHandle(fileName, { create })
}

export async function readFileFromHandle(dirHandle, relPath) {
  const fileHandle = await resolveFileHandle(dirHandle, relPath, false)
  const file = await fileHandle.getFile()
  const content = await file.text()
  return { content, size: file.size, type: 'file' }
}

export async function writeFileToHandle(dirHandle, relPath, content) {
  const fileHandle = await resolveFileHandle(dirHandle, relPath, true)
  const writable = await fileHandle.createWritable()
  await writable.write(content)
  await writable.close()
  return { ok: true, path: relPath }
}

export async function searchInHandle(dirHandle, query, maxHits = 40) {
  const needle = query.toLowerCase()
  const hits = []

  async function walk(handle, relPath) {
    if (hits.length >= maxHits) return
    for await (const entry of handle.values()) {
      if (hits.length >= maxHits) break
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
      const childRel = relPath ? `${relPath}/${entry.name}` : entry.name
      if (entry.kind === 'directory') {
        await walk(entry, childRel)
      } else if (entry.kind === 'file') {
        try {
          const file = await entry.getFile()
          if (file.size > 500000) continue
          const text = await file.text()
          const lines = text.split('\n')
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(needle)) {
              hits.push({
                path: childRel,
                line: i + 1,
                preview: lines[i].trim().slice(0, 160)
              })
              if (hits.length >= maxHits) break
            }
          }
        } catch {}
      }
    }
  }

  await walk(dirHandle, '')
  return hits
}

// Fallback Virtual Workspace for browsers without File System Access API
export function buildVirtualTreeFromFiles(fileList) {
  const root = { name: 'project', path: '', type: 'dir', children: [] }
  const fileMap = new Map()

  for (const file of Array.from(fileList)) {
    const rel = file.webkitRelativePath || file.name
    const parts = rel.split('/')
    if (parts.some((p) => SKIP_DIRS.has(p))) continue

    let curr = root
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      if (i === 0) root.name = part
      let next = curr.children.find((c) => c.name === part && c.type === 'dir')
      if (!next) {
        const currRel = parts.slice(1, i + 1).join('/')
        next = { name: part, path: currRel, type: 'dir', children: [] }
        curr.children.push(next)
      }
      curr = next
    }

    const fileName = parts[parts.length - 1]
    const filePath = parts.slice(1).join('/') || fileName
    curr.children.push({ name: fileName, path: filePath, type: 'file' })
    fileMap.set(filePath, file)
  }

  return { root, fileMap }
}
