const express = require('express')
const cors = require('cors')
const fs = require('fs')
const os = require('os')
const path = require('path')
const app = express()
const PORT = process.env.PORT || 3090
const HOME = process.env.HOME || os.homedir() || '/root'
const DEFAULT_ROOT = process.env.AETHER_ROOT ? path.resolve(process.env.AETHER_ROOT) : null
let workspaceRoot = DEFAULT_ROOT
const BLOCKED_ROOTS = ['/proc', '/sys', '/dev']

function root() {
  return workspaceRoot
}

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.cache',
  '__pycache__', '.venv', 'venv', '.turbo', '.idea', '.vscode'
])

const TEXT_EXT = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.md', '.txt',
  '.css', '.scss', '.html', '.htm', '.py', '.go', '.rs', '.java', '.kt',
  '.yml', '.yaml', '.toml', '.env', '.sh', '.bash', '.zsh', '.sql',
  '.xml', '.svg', '.vue', '.svelte', '.php', '.rb', '.c', '.h', '.cpp',
  '.hpp', '.cs', '.swift', '.lua', '.r', '.dockerfile', '.gitignore',
  '.editorconfig', '.prettierrc', '.eslintrc'
])

app.use(cors())
app.use(express.json({ limit: '8mb' }))

function safeJoin(rel) {
  const base = root()
  if (!base) {
    const err = new Error('No workspace folder opened')
    err.status = 400
    throw err
  }
  const cleaned = String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '')
  const abs = path.resolve(base, cleaned)
  const prefix = base.endsWith(path.sep) ? base : base + path.sep
  if (abs !== base && !abs.startsWith(prefix)) {
    const err = new Error('Path outside workspace')
    err.status = 400
    throw err
  }
  return abs
}

function toRel(abs) {
  const base = root()
  if (!base) return abs
  const rel = path.relative(base, abs)
  return rel.split(path.sep).join('/')
}

function assertBrowsable(abs) {
  const resolved = path.resolve(abs)
  if (BLOCKED_ROOTS.some((b) => resolved === b || resolved.startsWith(b + path.sep))) {
    const err = new Error('Path is blocked')
    err.status = 400
    throw err
  }
  return resolved
}

function isTextFile(filePath) {
  const base = path.basename(filePath)
  if (base.startsWith('.') && !base.includes('.')) return true
  const ext = path.extname(filePath).toLowerCase()
  if (!ext) return true
  return TEXT_EXT.has(ext)
}

function walkTree(dir, depth, maxDepth) {
  if (!dir) return { name: null, path: '', type: 'dir', children: [] }
  const name = path.basename(dir)
  const rel = toRel(dir)
  let children = []
  if (depth < maxDepth) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
        .filter((e) => !SKIP_DIRS.has(e.name) && e.name !== '.DS_Store')
        .sort((a, b) => {
          if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
          return a.name.localeCompare(b.name)
        })
      children = entries.map((e) => {
        const full = path.join(dir, e.name)
        if (e.isDirectory()) return walkTree(full, depth + 1, maxDepth)
        return { name: e.name, path: toRel(full), type: 'file' }
      })
    } catch {
      children = []
    }
  }
  return { name: rel === '' ? (root() ? path.basename(root()) : null) : name, path: rel, type: 'dir', children }
}

function collectFiles(dir, acc) {
  if (!dir) return
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) collectFiles(full, acc)
    else if (isTextFile(full)) acc.push(full)
  }
}

const FREE_MODELS = [
  { id: 'aether-spark', label: 'Aether Spark', blurb: 'Fast replies', tier: 'free', provider: 'pollinations', remote: 'openai-fast' },
  { id: 'aether-loom', label: 'Aether Loom', blurb: 'Balanced chat', tier: 'free', provider: 'pollinations', remote: 'openai' },
  { id: 'aether-forge', label: 'Aether Forge', blurb: 'Code-focused', tier: 'free', provider: 'pollinations', remote: 'qwen-coder' }
]

const PREMIUM_MODELS = [
  // --- Google Gemini (matching Gemini UI) ---
  { id: 'gemini-3.5-flash-lite', label: '3.5 Flash-Lite', blurb: 'Fastest answers', tier: 'premium', provider: 'gemini', remote: 'gemini-2.0-flash-lite' },
  { id: 'gemini-3.6-flash', label: '3.6 Flash', blurb: 'All-around help', tier: 'premium', provider: 'gemini', remote: 'gemini-2.0-flash' },
  { id: 'gemini-3.1-pro', label: '3.1 Pro', blurb: 'Advanced reasoning', tier: 'premium', provider: 'gemini', remote: 'gemini-1.5-pro' },
  { id: 'gemini-thinking', label: 'Extended thinking', blurb: 'Complex problem solving', tier: 'premium', provider: 'gemini', remote: 'gemini-2.0-flash-thinking-exp-01-21' },

  // --- OpenAI / ChatGPT (matching ChatGPT UI) ---
  { id: 'gpt-4o-mini', label: 'GPT-4o mini', blurb: 'ChatGPT speed', tier: 'premium', provider: 'openai', remote: 'gpt-4o-mini' },
  { id: 'gpt-4o', label: 'GPT-4o', blurb: 'ChatGPT flagship', tier: 'premium', provider: 'openai', remote: 'gpt-4o' },
  { id: 'gpt-think', label: 'Think (o3-mini)', blurb: 'Think: Get a smarter answer', tier: 'premium', provider: 'openai', remote: 'o3-mini' }
]

const ALL_MODELS = [...FREE_MODELS, ...PREMIUM_MODELS]
const MODEL_MAP = Object.fromEntries(ALL_MODELS.map((m) => [m.id, m]))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: 'aether', workspace: root() })
})

app.get('/api/network', (_req, res) => {
  const nets = os.networkInterfaces()
  const addresses = []
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push({ iface: name, ip: net.address })
      }
    }
  }
  res.json({ addresses, port: 4576 })
})

app.get('/api/models', (_req, res) => {
  res.json({ free: FREE_MODELS, premium: PREMIUM_MODELS })
})

app.get('/api/workspace', (_req, res) => {
  const current = root()
  res.json({ root: current, name: current ? path.basename(current) : null, home: HOME })
})

app.delete('/api/workspace', (_req, res) => {
  workspaceRoot = null
  res.json({ ok: true, root: null, name: null })
})

app.post('/api/workspace', (req, res) => {
  try {
    const requested = String(req.body.path || '').trim()
    if (!requested) return res.status(400).json({ error: 'path required' })
    const abs = assertBrowsable(requested)
    const stat = fs.statSync(abs)
    if (!stat.isDirectory()) return res.status(400).json({ error: 'Not a directory' })
    fs.accessSync(abs, fs.constants.R_OK)
    workspaceRoot = abs
    res.json({ ok: true, root: root(), name: path.basename(root()) })
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message })
  }
})

app.get('/api/browse', (req, res) => {
  try {
    const requested = String(req.query.path || HOME)
    const abs = assertBrowsable(requested)
    const stat = fs.statSync(abs)
    if (!stat.isDirectory()) return res.status(400).json({ error: 'Not a directory' })
    const parent = path.dirname(abs)
    const entries = fs.readdirSync(abs, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !SKIP_DIRS.has(e.name))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 200)
      .map((e) => ({
        name: e.name,
        path: path.join(abs, e.name)
      }))
    res.json({
      path: abs,
      parent: parent === abs ? null : parent,
      name: path.basename(abs) || abs,
      entries
    })
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message })
  }
})

app.get('/api/tree', (req, res) => {
  try {
    const current = root()
    if (!current) return res.json({ name: null, path: '', type: 'dir', children: [] })
    const depth = Math.min(Number(req.query.depth) || 4, 8)
    res.json(walkTree(current, 0, depth))
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

app.get('/api/file', (req, res) => {
  try {
    const abs = safeJoin(req.query.path || '')
    const stat = fs.statSync(abs)
    if (stat.isDirectory()) {
      const entries = fs.readdirSync(abs, { withFileTypes: true })
        .filter((e) => !SKIP_DIRS.has(e.name))
        .map((e) => ({
          name: e.name,
          path: toRel(path.join(abs, e.name)),
          type: e.isDirectory() ? 'dir' : 'file'
        }))
      return res.json({ type: 'dir', path: toRel(abs), entries })
    }
    if (!isTextFile(abs) && stat.size > 2 * 1024 * 1024) {
      return res.status(400).json({ error: 'Binary or oversized file' })
    }
    const content = fs.readFileSync(abs, 'utf8')
    res.json({ type: 'file', path: toRel(abs), content, size: stat.size })
  } catch (err) {
    res.status(err.status || 404).json({ error: err.message })
  }
})

app.put('/api/file', (req, res) => {
  try {
    const abs = safeJoin(req.body.path || '')
    const content = req.body.content
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'content must be a string' })
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, content, 'utf8')
    res.json({ ok: true, path: toRel(abs) })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

app.post('/api/mkdir', (req, res) => {
  try {
    const abs = safeJoin(req.body.path || '')
    fs.mkdirSync(abs, { recursive: true })
    res.json({ ok: true, path: toRel(abs) })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

app.get('/api/search', (req, res) => {
  try {
    if (!root()) return res.json({ results: [] })
    const q = String(req.query.q || '').trim()
    if (!q || q.length < 2) return res.json({ results: [] })
    const files = []
    collectFiles(root(), files)
    const needle = q.toLowerCase()
    const results = []
    for (const file of files) {
      if (results.length >= 80) break
      let text
      try {
        const stat = fs.statSync(file)
        if (stat.size > 800000) continue
        text = fs.readFileSync(file, 'utf8')
      } catch {
        continue
      }
      const lines = text.split('\n')
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(needle)) {
          results.push({
            path: toRel(file),
            line: i + 1,
            preview: lines[i].trim().slice(0, 180)
          })
          if (results.length >= 80) break
        }
      }
    }
    res.json({ results })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

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

function runTool(name, args) {
  try {
    if (name === 'list_dir') {
      const abs = safeJoin(args.path || '')
      const entries = fs.readdirSync(abs, { withFileTypes: true })
        .filter((e) => !SKIP_DIRS.has(e.name))
        .map((e) => ({ name: e.name, path: toRel(path.join(abs, e.name)), type: e.isDirectory() ? 'dir' : 'file' }))
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

function sseWrite(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

function openaiTools() {
  return TOOLS.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }
  }))
}

function geminiTools() {
  return [{
    functionDeclarations: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }))
  }]
}

async function openaiChat({ token, model, messages, tools }) {
  const m = model || 'gpt-4o-mini'
  const isReasoning = m.startsWith('o1') || m.startsWith('o3')
  const body = {
    model: m,
    messages
  }
  if (!isReasoning) {
    body.temperature = 0.3
  }
  if (tools) body.tools = tools
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
  const json = await resp.json()
  if (!resp.ok) {
    const msg = json.error?.message || `OpenAI HTTP ${resp.status}`
    throw new Error(msg)
  }
  return json
}

async function geminiChat({ token, model, contents, tools }) {
  const m = model || 'gemini-2.0-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(token)}`
  const body = { contents }
  if (!m.includes('thinking')) {
    body.generationConfig = { temperature: 0.3 }
  }
  if (tools) body.tools = tools
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const json = await resp.json()
  if (!resp.ok) {
    const msg = json.error?.message || `Gemini HTTP ${resp.status}`
    throw new Error(msg)
  }
  return json
}

async function pollinationsChat({ model, messages }) {
  const resp = await fetch('https://text.pollinations.ai/openai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Referer: 'https://aether.studio'
    },
    body: JSON.stringify({
      model: model || 'openai-fast',
      messages,
      temperature: 0.3
    })
  })
  const raw = await resp.text()
  let json = {}
  try { json = JSON.parse(raw) } catch { json = { choices: [{ message: { content: raw } }] } }
  if (!resp.ok) {
    const msg = json.error?.message || json.message || `Free model HTTP ${resp.status}`
    throw new Error(msg)
  }
  if (typeof json === 'string') json = { choices: [{ message: { content: json } }] }
  return json
}

function extractToolCall(text) {
  const match = String(text || '').match(/<tool\s+name="([a-z_]+)">([\s\S]*?)<\/tool>/i)
  if (!match) return null
  let args = {}
  try { args = JSON.parse(match[2].trim() || '{}') } catch { args = {} }
  return { name: match[1], args, raw: match[0] }
}

function stripTools(text) {
  return String(text || '').replace(/<tool\s+name="[a-z_]+">[\s\S]*?<\/tool>/gi, '').trim()
}

function freeToolPrompt(mode) {
  return `${systemPrompt(mode)}

You may call tools by emitting exactly this XML, then stop:
<tool name="list_dir">{"path":""}</tool>
<tool name="read_file">{"path":"relative/file"}</tool>
<tool name="write_file">{"path":"relative/file","content":"..."}</tool>
<tool name="search_code">{"query":"text"}</tool>
Never invent tool results. After a tool result arrives, continue. When finished, reply in plain text with no tool tags.`
}

function systemPrompt(mode) {
  const current = root()
  const base = current
    ? `You are Aether, a local coding studio assistant. Workspace root: ${current}.\nYou can read and write local files with tools. Prefer small, precise edits.\nNever print API keys. Be concise and practical.`
    : `You are Aether, a coding studio assistant. No project folder is currently opened. Inform the user to open a project folder using the "Open Folder" button before editing workspace files.`
  if (mode === 'agent') {
    return `${base}
Agent mode: inspect the workspace with tools before changing files. Use list_dir, search_code, read_file, then write_file when needed.
After finishing, summarize what you did.`
  }
  return `${base}
Editor mode: help with the currently open file. Explain, rewrite, or patch code. Use tools if you need extra context.`
}

async function runOpenAIAgent({ token, model, userMessage, mode, context, res }) {
  const messages = [
    { role: 'system', content: systemPrompt(mode) }
  ]
  if (context) messages.push({ role: 'user', content: `Current editor context:\n${context}` })
  messages.push({ role: 'user', content: userMessage })

  for (let i = 0; i < 8; i++) {
    const json = await openaiChat({
      token,
      model,
      messages,
      tools: mode === 'agent' || mode === 'editor' ? openaiTools() : undefined
    })
    const choice = json.choices?.[0]?.message
    if (!choice) throw new Error('Empty OpenAI response')
    messages.push(choice)
    const calls = choice.tool_calls || []
    if (!calls.length) {
      sseWrite(res, 'message', { text: choice.content || '' })
      return
    }
    for (const call of calls) {
      const name = call.function.name
      let args = {}
      try { args = JSON.parse(call.function.arguments || '{}') } catch { args = {} }
      sseWrite(res, 'tool', { name, args, status: 'running' })
      const output = runTool(name, args)
      sseWrite(res, 'tool', { name, args, status: 'done', output: String(output).slice(0, 4000) })
      messages.push({ role: 'tool', tool_call_id: call.id, content: String(output).slice(0, 12000) })
    }
  }
  sseWrite(res, 'message', { text: 'Stopped after too many tool steps.' })
}

function geminiPartsToText(parts) {
  return (parts || []).filter((p) => p.text).map((p) => p.text).join('')
}

async function runGeminiAgent({ token, model, userMessage, mode, context, res }) {
  const contents = []
  const intro = systemPrompt(mode) + (context ? `\n\nCurrent editor context:\n${context}` : '')
  contents.push({
    role: 'user',
    parts: [{ text: `${intro}\n\nUser request:\n${userMessage}` }]
  })

  for (let i = 0; i < 8; i++) {
    const json = await geminiChat({
      token,
      model,
      contents,
      tools: geminiTools()
    })
    const cand = json.candidates?.[0]
    const parts = cand?.content?.parts || []
    const fnCalls = parts.filter((p) => p.functionCall)
    if (!fnCalls.length) {
      sseWrite(res, 'message', { text: geminiPartsToText(parts) || '' })
      return
    }
    contents.push({ role: 'model', parts })
    const responseParts = []
    for (const p of fnCalls) {
      const name = p.functionCall.name
      const args = p.functionCall.args || {}
      sseWrite(res, 'tool', { name, args, status: 'running' })
      const output = runTool(name, args)
      sseWrite(res, 'tool', { name, args, status: 'done', output: String(output).slice(0, 4000) })
      responseParts.push({
        functionResponse: {
          name,
          response: { result: String(output).slice(0, 12000) }
        }
      })
    }
    contents.push({ role: 'user', parts: responseParts })
  }
  sseWrite(res, 'message', { text: 'Stopped after too many tool steps.' })
}

async function runFreeAgent({ model, userMessage, mode, context, res }) {
  const messages = [{ role: 'system', content: freeToolPrompt(mode) }]
  if (context) messages.push({ role: 'user', content: `Current editor context:\n${context}` })
  messages.push({ role: 'user', content: userMessage })

  for (let i = 0; i < 8; i++) {
    const json = await pollinationsChat({ model, messages })
    const text = json.choices?.[0]?.message?.content || json.message || ''
    if (!text) throw new Error('Empty free-model response')
    const call = extractToolCall(text)
    if (!call) {
      sseWrite(res, 'message', { text: stripTools(text) || text })
      return
    }
    sseWrite(res, 'tool', { name: call.name, args: call.args, status: 'running' })
    const output = runTool(call.name, call.args)
    sseWrite(res, 'tool', { name: call.name, args: call.args, status: 'done', output: String(output).slice(0, 4000) })
    messages.push({ role: 'assistant', content: text })
    messages.push({ role: 'user', content: `Tool ${call.name} result:\n${String(output).slice(0, 12000)}` })
  }
  sseWrite(res, 'message', { text: 'Stopped after too many tool steps.' })
}


app.post('/api/chat', async (req, res) => {
  const { token, model, message, mode, context } = req.body || {}
  if (!message) return res.status(400).json({ error: 'message required' })
  const spec = MODEL_MAP[model] || MODEL_MAP['aether-spark']
  const m = mode === 'editor' ? 'editor' : 'agent'

  if (spec.tier === 'premium' && !token) {
    return res.status(400).json({ error: 'Premium model needs a ChatGPT or Gemini token' })
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  try {
    if (spec.provider === 'pollinations') {
      await runFreeAgent({ model: spec.remote, userMessage: message, mode: m, context, res })
    } else if (spec.provider === 'gemini') {
      await runGeminiAgent({ token, model: spec.remote, userMessage: message, mode: m, context, res })
    } else {
      await runOpenAIAgent({ token, model: spec.remote, userMessage: message, mode: m, context, res })
    }
    sseWrite(res, 'done', { ok: true })
  } catch (err) {
    sseWrite(res, 'error', { error: err.message })
  }
  res.end()
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Aether backend on ${PORT} root=${root()}`)
})
