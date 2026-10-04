// Aether Unified Tool Registry
// Translates native tools to OpenAI, Gemini, and XML representations with zero tool duplication.

const fs = require('fs')
const path = require('path')

const TOOLS = [
  {
    name: 'list_dir',
    description: 'List files and folders in a workspace path. Use empty path for root.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative directory path' }
      }
    }
  },
  {
    name: 'read_file',
    description: 'Read a text file from the local workspace.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative file path' }
      },
      required: ['path']
    }
  },
  {
    name: 'write_file',
    description: 'Create or overwrite a text file in the workspace.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'search_code',
    description: 'Search text across local workspace files.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' }
      },
      required: ['query']
    }
  }
]

function toOpenAITools() {
  return TOOLS.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }
  }))
}

function toGeminiTools() {
  return [{
    functionDeclarations: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }))
  }]
}

function executeTool(name, args, { root, safeJoin, toRel, collectFiles, SKIP_DIRS }) {
  try {
    if (name === 'list_dir') {
      const abs = safeJoin(args.path || '')
      const entries = fs.readdirSync(abs, { withFileTypes: true })
        .filter((e) => !SKIP_DIRS?.has(e.name))
        .map((e) => ({
          name: e.name,
          path: toRel(path.join(abs, e.name)),
          type: e.isDirectory() ? 'dir' : 'file'
        }))
      return JSON.stringify(entries, null, 2)
    }
    if (name === 'read_file') {
      const abs = safeJoin(args.path || '')
      const stat = fs.statSync(abs)
      if (stat.size > 200000) return 'File too large to read in one pass.'
      return fs.readFileSync(abs, 'utf8')
    }
    if (name === 'write_file') {
      const abs = safeJoin(args.path || '')
      fs.mkdirSync(path.dirname(abs), { recursive: true })
      fs.writeFileSync(abs, String(args.content ?? ''), 'utf8')
      return `Wrote ${toRel(abs)}`
    }
    if (name === 'search_code') {
      const q = String(args.query || '').trim()
      if (!q) return 'Empty query'
      const files = []
      collectFiles(root(), files)
      const needle = q.toLowerCase()
      const hits = []
      for (const file of files) {
        if (hits.length >= 40) break
        let text
        try {
          if (fs.statSync(file).size > 400000) continue
          text = fs.readFileSync(file, 'utf8')
        } catch {
          continue
        }
        const lines = text.split('\n')
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(needle)) {
            hits.push(`${toRel(file)}:${i + 1}: ${lines[i].trim().slice(0, 140)}`)
            if (hits.length >= 40) break
          }
        }
      }
      return hits.length ? hits.join('\n') : 'No matches'
    }
    return `Unknown tool ${name}`
  } catch (err) {
    return `Tool error: ${err.message}`
  }
}

module.exports = {
  TOOLS,
  toOpenAITools,
  toGeminiTools,
  executeTool
}
