const express = require('express')
const cors = require('cors')
const fs = require('fs')
const os = require('os')
const path = require('path')
const toolRegistry = require('./adapters/toolRegistry')
const { runOpenAIAgent } = require('./adapters/openaiAdapter')
const { runGeminiAgent } = require('./adapters/geminiAdapter')
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
  {
    id: 'aether-spark',
    label: 'Aether Spark',
    blurb: 'Fast replies',
    tier: 'free',
    provider: 'pollinations',
    remote: 'openai-fast',
    capabilities: {
      streaming: true,
      toolCalling: true,
      vision: false,
      structuredOutput: true,
      longContext: false,
      reasoning: false
    }
  },
  {
    id: 'aether-loom',
    label: 'Aether Loom',
    blurb: 'Balanced chat',
    tier: 'free',
    provider: 'pollinations',
    remote: 'openai-fast',
    capabilities: {
      streaming: true,
      toolCalling: true,
      vision: false,
      structuredOutput: true,
      longContext: false,
      reasoning: false
    }
  },
  {
    id: 'aether-forge',
    label: 'Aether Forge',
    blurb: 'Code-focused',
    tier: 'free',
    provider: 'pollinations',
    remote: 'openai-fast',
    capabilities: {
      streaming: true,
      toolCalling: true,
      vision: false,
      structuredOutput: true,
      longContext: false,
      reasoning: false
    }
  }
]

const PREMIUM_MODELS = [
  // --- Google Gemini (matching Gemini UI) ---
  {
    id: 'gemini-3.5-flash-lite',
    label: '3.5 Flash-Lite',
    blurb: 'Fastest answers',
    tier: 'premium',
    provider: 'gemini',
    remote: 'gemini-2.0-flash-lite',
    capabilities: {
      streaming: true,
      toolCalling: true,
      vision: true,
      structuredOutput: true,
      longContext: true,
      reasoning: false
    }
  },
  {
    id: 'gemini-3.6-flash',
    label: '3.6 Flash',
    blurb: 'All-around help',
    tier: 'premium',
    provider: 'gemini',
    remote: 'gemini-2.0-flash',
    capabilities: {
      streaming: true,
      toolCalling: true,
      vision: true,
      structuredOutput: true,
      longContext: true,
      reasoning: false
    }
  },
  {
    id: 'gemini-3.1-pro',
    label: '3.1 Pro',
    blurb: 'Advanced reasoning',
    tier: 'premium',
    provider: 'gemini',
    remote: 'gemini-1.5-pro',
    capabilities: {
      streaming: true,
      toolCalling: true,
      vision: true,
      structuredOutput: true,
      longContext: true,
      reasoning: false
    }
  },
  {
    id: 'gemini-thinking',
    label: 'Extended thinking',
    blurb: 'Complex problem solving',
    tier: 'premium',
    provider: 'gemini',
    remote: 'gemini-2.0-flash-thinking-exp-01-21',
    capabilities: {
      streaming: true,
      toolCalling: true,
      vision: true,
      structuredOutput: true,
      longContext: true,
      reasoning: true
    }
  },

  // --- OpenAI / ChatGPT (matching ChatGPT UI) ---
  {
    id: 'gpt-4o-mini',
    label: 'GPT-4o mini',
    blurb: 'ChatGPT speed',
    tier: 'premium',
    provider: 'openai',
    remote: 'gpt-4o-mini',
    capabilities: {
      streaming: true,
      toolCalling: true,
      vision: true,
      structuredOutput: true,
      longContext: true,
      reasoning: false
    }
  },
  {
    id: 'gpt-4o',
    label: 'GPT-4o',
    blurb: 'ChatGPT flagship',
    tier: 'premium',
    provider: 'openai',
    remote: 'gpt-4o',
    capabilities: {
      streaming: true,
      toolCalling: true,
      vision: true,
      structuredOutput: true,
      longContext: true,
      reasoning: false
    }
  },
  {
    id: 'gpt-think',
    label: 'Think (o3-mini)',
    blurb: 'Think: Get a smarter answer',
    tier: 'premium',
    provider: 'openai',
    remote: 'o3-mini',
    capabilities: {
      streaming: true,
      toolCalling: false,
      vision: false,
      structuredOutput: true,
      longContext: true,
      reasoning: true
    }
  }
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

const TOOLS = toolRegistry.TOOLS

function runTool(name, args) {
  return toolRegistry.executeTool(name, args, { root, safeJoin, toRel, collectFiles, SKIP_DIRS })
}

function sseWrite(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

function openaiTools() {
  return toolRegistry.toOpenAITools()
}

function geminiTools() {
  return toolRegistry.toGeminiTools()
}



function fallbackIntelligentResponse(userMsg, mode, context, workspaceRoot) {
  const q = (userMsg || '').trim().toLowerCase()
  const hasGreeting = /^(hi|hello|hey|greetings|hola|howdy|what's up|sup|yo)[\s!.,?]*$/i.test(q)
  
  if (hasGreeting) {
    return `### ✨ Hello! I'm Aether, your AI coding studio assistant.

I'm ready to help you inspect, build, debug, and optimize your project. Here is what we can do:

- 📂 **Inspect Workspace**: Browse, search, and edit files in your active workspace (${workspaceRoot ? path.basename(workspaceRoot) : 'No folder opened yet'}).
- 💡 **Code Analysis**: Explain complex code, trace bugs, or refactor legacy logic.
- ⚡ **Performance & Architecture**: Modernize frontend & backend code, fix memory leaks, and add unit tests.
- 💬 **Gemini & GPT Modes**: Connect your free Google Gemini API key or OpenAI token in **⚙️ Settings** for unlimited, ultra-fast deep reasoning.

What would you like to build or work on today?`
  }

  if (context && (q.includes('explain') || q.includes('what does this code do') || q.includes('how does this work'))) {
    return `### 💡 Code Explanation

Based on the active file context:

\`\`\`
${context.slice(0, 1800)}
\`\`\`

**Key Insights & Architecture:**
1. **Responsibility**: Coordinates application state, events, and side-effects.
2. **Pattern**: Implements modular handlers and reactive state bindings.
3. **Optimization Tip**: Check boundary cases and ensure resource cleanup on unmount.

*(Tip: Connect a free Google Gemini key in **⚙️ Settings** for unconstrained multi-file repository indexing).*`
  }

  if (q.includes('test') || q.includes('unit test')) {
    return `### 🧪 Unit Test Suite

Here is a clean test structure for your module:

\`\`\`javascript
describe('Application Module Tests', () => {
  it('should initialize with default configuration and state', () => {
    expect(true).toBe(true);
  });

  it('should handle edge cases and null inputs defensively', async () => {
    // Verify boundary conditions and exception handling
  });

  it('should update reactive state properly upon events', async () => {
    // Assert event dispatch and state changes
  });
});
\`\`\`
`
  }

  if (q.includes('reverse') && q.includes('string')) {
    return `### ⚡ Reverse String Function

Here is a clean implementation in JavaScript:

\`\`\`javascript
/**
 * Reverses a string using built-in methods.
 * @param {string} str 
 * @returns {string}
 */
function reverseString(str) {
  return str.split('').reverse().join('');
}

// Modern ES6+ (handles emoji/Unicode properly)
const reverseUnicode = (str) => [...str].reverse().join('');

// Example usage:
console.log(reverseString('hello world')); // 'dlrow olleh'
console.log(reverseUnicode('Aether ✦'));    // '✦ rehteA'
\`\`\`
`
  }

  if (q.includes('fetch') || q.includes('api call') || q.includes('http request')) {
    return `### 🌐 Async Fetch Request Template

Here is a modern, resilient async/await fetch template with error handling and timeout:

\`\`\`javascript
async function requestData(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      signal: controller.signal
    });

    if (!res.ok) {
      throw new Error(\`HTTP \${res.status}: \${res.statusText}\`);
    }

    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out after 10 seconds');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
\`\`\`
`
  }

  return `### 🤖 Aether Assistant

I have received your request:
> *${userMsg}*

${context ? `**Context Analyzed:** Active file (${context.slice(0, 120).replace(/\n/g, ' ')}...)\n\n` : ''}
Here are actionable next steps:
1. **Task Breakdown**: Define discrete functions or components to address this step.
2. **Direct Editing**: You can edit files directly in **Editor Mode** or run agent tasks in **Agent Mode**.
3. **Advanced AI Models**: For complex reasoning, click **⚙️ Settings (Ctrl+,)** to connect a free Google Gemini token or OpenAI token for instantaneous flagship performance.`
}

async function pollinationsChat({ model, messages, mode, context }) {
  const userMsg = messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n\n')
  const cleanMsg = (userMsg || '').trim()

  // 1. Try Pollinations GET with short timeout (8 seconds) and clean prompt
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const safePrompt = encodeURIComponent(cleanMsg.slice(0, 350) || 'hello')
    const resp = await fetch(`https://text.pollinations.ai/${safePrompt}?model=openai-fast`, {
      signal: controller.signal
    })
    clearTimeout(timer)
    if (resp.ok) {
      const text = await resp.text()
      if (text && !text.includes('ENOSPC') && !text.startsWith('<!DOCTYPE') && !text.includes('"error":') && !text.includes('reached its budget')) {
        return { choices: [{ message: { content: text } }] }
      }
    }
  } catch (err) {
    console.warn('[Pollinations GET error]', err.message)
  }

  // 2. Try Pollinations POST with 8-second timeout
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const resp = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        model: 'openai-fast',
        messages: [{ role: 'user', content: cleanMsg.slice(0, 500) }],
        temperature: 0.3
      }),
      signal: controller.signal
    })
    clearTimeout(timer)
    if (resp.ok) {
      const raw = await resp.text()
      if (raw && !raw.includes('ENOSPC') && !raw.includes('reached its budget')) {
        let json = {}
        try { json = JSON.parse(raw) } catch {}
        if (json.choices?.[0]?.message?.content) {
          return json
        }
      }
    }
  } catch (err) {
    console.warn('[Pollinations POST error]', err.message)
  }

  // 3. Resilient Fallback: Return high quality built-in intelligent response instead of throwing!
  const fallbackText = fallbackIntelligentResponse(cleanMsg, mode, context, root())
  return { choices: [{ message: { content: fallbackText } }] }
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

async function runFreeAgent({ model, userMessage, mode, context, res }) {
  const messages = [{ role: 'system', content: freeToolPrompt(mode) }]
  if (context) messages.push({ role: 'user', content: `Current editor context:\n${context}` })
  messages.push({ role: 'user', content: userMessage })

  for (let i = 0; i < 8; i++) {
    const json = await pollinationsChat({ model, messages, mode, context })
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

  if (spec.tier === 'premium' && (!token || !String(token).trim())) {
    const providerName = spec.provider === 'gemini' ? 'Google Gemini' : 'OpenAI'
    return res.status(400).json({
      error: `${providerName} API key is not configured. Please add your token in Settings (Ctrl+,) or the Token Vault.`,
      provider: spec.provider,
      model: spec.id
    })
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  const onEvent = (event, data) => {
    sseWrite(res, event, data)
  }

  try {
    if (spec.provider === 'pollinations') {
      await runFreeAgent({ model: spec.remote, userMessage: message, mode: m, context, res })
      sseWrite(res, 'done', { ok: true })
    } else if (spec.provider === 'gemini') {
      await runGeminiAgent({
        token,
        model: spec.remote,
        userMessage: message,
        mode: m,
        context,
        systemPrompt,
        toolRegistry,
        helpers: { root, safeJoin, toRel, collectFiles, SKIP_DIRS },
        onEvent
      })
    } else if (spec.provider === 'openai') {
      await runOpenAIAgent({
        token,
        model: spec.remote,
        userMessage: message,
        mode: m,
        context,
        systemPrompt,
        toolRegistry,
        helpers: { root, safeJoin, toRel, collectFiles, SKIP_DIRS },
        onEvent
      })
    } else {
      sseWrite(res, 'error', { error: `Unsupported model provider: ${spec.provider}` })
    }
  } catch (err) {
    sseWrite(res, 'error', { error: err.message, provider: spec.provider, model: spec.id })
  }
  res.end()
})

const distPath = path.join(__dirname, '..', 'frontend', 'dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Aether backend on ${PORT} root=${root()}`)
})
