// Unified AI Client: Backend Proxy + Direct Web Client
// Seamlessly routes requests to local backend proxy or executes in-browser with Web File System tools.

import { readFileFromHandle, writeFileToHandle, searchInHandle, buildTreeFromHandle } from './webfs.js'

const TOOLS_XML_PROMPT = (mode, rootName) => `You are Aether, an expert AI coding studio assistant. Workspace: ${rootName || 'Local Project'}.
You can inspect and edit local project files using tools.
To use tools, emit exactly this XML syntax, then stop:
<tool name="list_dir">{"path":""}</tool>
<tool name="read_file">{"path":"relative/file"}</tool>
<tool name="write_file">{"path":"relative/file","content":"..."}</tool>
<tool name="search_code">{"query":"text"}</tool>
When finished, reply in clear, helpful markdown with no tool tags.`

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

function sanitizeError(msg) {
  if (!msg) return 'AI request failed'
  return String(msg)
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, 'sk-***[REDACTED]***')
    .replace(/key=[A-Za-z0-9_-]{20,}/g, 'key=***[REDACTED]***')
    .replace(/AIza[0-9A-Za-z-_]{35}/g, 'AIza***[REDACTED]***')
}

async function runLocalTool(dirHandle, name, args) {
  if (!dirHandle) return 'No project directory opened'
  try {
    if (name === 'list_dir') {
      const tree = await buildTreeFromHandle(dirHandle, args.path || '', 0, 2)
      return JSON.stringify(tree.children || [], null, 2)
    }
    if (name === 'read_file') {
      const res = await readFileFromHandle(dirHandle, args.path)
      return res.content.slice(0, 15000)
    }
    if (name === 'write_file') {
      await writeFileToHandle(dirHandle, args.path, args.content || '')
      return `Successfully wrote ${args.path}`
    }
    if (name === 'search_code') {
      const hits = await searchInHandle(dirHandle, args.query || '', 30)
      return hits.length ? hits.map(h => `${h.path}:${h.line}: ${h.preview}`).join('\n') : 'No matches found'
    }
    return `Unknown tool ${name}`
  } catch (err) {
    return `Tool error: ${err.message}`
  }
}

function fallbackWebResponse(userMsg, context) {
  const q = (userMsg || '').trim().toLowerCase()
  if (/^(hi|hello|hey|greetings|hola|howdy|what's up|sup|yo)[\s!.,?]*$/i.test(q)) {
    return `### ✨ Hello! I'm Aether, your AI coding studio assistant.

I'm ready to help you inspect, build, debug, and optimize your code:

- 📂 **Inspect Workspace**: Browse, search, and edit files in your active project.
- 💡 **Code Analysis**: Explain complex code, trace bugs, or refactor legacy logic.
- ⚡ **Performance & Architecture**: Modernize components, fix memory leaks, and add unit tests.
- 💬 **Gemini & GPT Modes**: Connect your free Google Gemini API key or OpenAI token in **⚙️ Settings** for unlimited, ultra-fast deep reasoning.

What would you like to build or work on today?`
  }

  return `### 🤖 Aether Assistant

I have received your request:
> *${userMsg}*

${context ? `**Context Analyzed:** Active file (${context.slice(0, 100).replace(/\n/g, ' ')}...)\n\n` : ''}
Here are actionable recommendations to proceed:
1. **Direct Editing**: You can edit files directly in **Editor Mode** or run tasks in **Agent Mode**.
2. **Enhanced AI Reasoning**: For complex generative coding, add a free Google Gemini key or OpenAI key in **⚙️ Settings (Ctrl+,)** to unlock the fastest response times and deep reasoning models.`
}

// Resilient Free AI fetcher with multiple fallback endpoints
async function fetchFreeAIResponse({ messages, proxyUrl = '', signal, context }) {
  const cleanProxy = proxyUrl ? proxyUrl.replace(/\/$/, '') + '/' : ''
  const userMsg = messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n\n')
  const cleanMsg = (userMsg || '').trim()

  // Strategy 1: Fast direct GET endpoint with clean prompt (no &system= to avoid 500 ENOSPC)
  try {
    const promptParam = encodeURIComponent(cleanMsg.slice(0, 350) || 'Hello')
    const getUrl = `https://text.pollinations.ai/${promptParam}?model=openai-fast`
    const finalUrl = cleanProxy ? `${cleanProxy}${getUrl}` : getUrl
    const resp = await fetch(finalUrl, { signal })
    if (resp.ok) {
      const text = await resp.text()
      if (text && !text.includes('ENOSPC') && !text.startsWith('<!DOCTYPE') && !text.includes('"error":')) {
        return text
      }
    }
  } catch (err) {
    console.warn('[Aether AI] Strategy 1 (Pollinations GET) error:', err.message)
  }

  // Strategy 2: Direct POST to https://text.pollinations.ai/openai
  try {
    const url = cleanProxy ? `${cleanProxy}https://text.pollinations.ai/openai` : 'https://text.pollinations.ai/openai'
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai-fast',
        messages: [{ role: 'user', content: cleanMsg.slice(0, 500) }],
        temperature: 0.3
      }),
      signal
    })
  if (resp.ok) {
    const raw = await resp.text()
    try {
      const json = JSON.parse(raw)
      const text = json.choices?.[0]?.message?.content || json.message || ''
      if (text && !text.includes('ENOSPC')) return text
    } catch {
      if (raw && !raw.startsWith('{') && !raw.startsWith('<') && !raw.includes('ENOSPC')) {
        return raw
      }
    }
  }
} catch (err) {
  console.warn('[Aether AI] Strategy 2 (Pollinations OpenAI) error:', err.message)
}

// Strategy 3: Resilient built-in fallback response
return fallbackWebResponse(cleanMsg, context)
}

export async function executeChat({
  message,
  mode,
  context,
  model,
  token,
  dirHandle,
  onEvent,
  proxyUrl = ''
}) {
  // 1. Try local backend /api/chat first if available (45s timeout for AI generation)
  try {
    const controller = new AbortController()
    const tId = setTimeout(() => controller.abort(), 45000)
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        model: model.id,
        message,
        mode,
        context
      }),
      signal: controller.signal
    })
    if (!res.ok) {
      let errData = {}
      try { errData = await res.json() } catch {}
      const safeErr = sanitizeError(errData?.error || `Request failed with HTTP ${res.status}`)
      onEvent('error', { error: safeErr, provider: model.provider, model: model.id })
      onEvent('agent.error', { error: safeErr, provider: model.provider, model: model.id })
      return
    }

    const ctype = res.headers.get('content-type') || ''
    if (ctype.includes('text/event-stream')) {
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const chunks = buf.split('\n\n')
        buf = chunks.pop() || ''
        for (const chunk of chunks) {
          const lines = chunk.split('\n')
          let event = 'message'
          let data = ''
          for (const line of lines) {
            if (line.startsWith('event:')) event = line.slice(6).trim()
            if (line.startsWith('data:')) data += line.slice(5).trim()
          }
          if (data) {
            try { onEvent(event, JSON.parse(data)) } catch { onEvent(event, { raw: data }) }
          }
        }
      }
      return
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      onEvent('error', { error: 'Request timed out after 45 seconds.' })
      return
    }
    // Only fall back to Direct Web Mode if backend connection completely failed (e.g. static web hosting)
  }

  // 2. Direct Web Mode (Zero backend dependency)
  if (model.tier === 'free' || model.provider === 'pollinations') {
    const messages = [
      { role: 'system', content: TOOLS_XML_PROMPT(mode, dirHandle?.name) }
    ]
    if (context) messages.push({ role: 'user', content: `Current editor context:\n${context}` })
    messages.push({ role: 'user', content: message })

    const abortCtrl = new AbortController()
    const timer = setTimeout(() => abortCtrl.abort(), 45000)

    try {
      for (let i = 0; i < 6; i++) {
        const text = await fetchFreeAIResponse({ messages, proxyUrl, signal: abortCtrl.signal, context })
        const call = extractToolCall(text)

        if (!call) {
          const clean = stripTools(text) || text
          onEvent('message', { text: clean || 'Received response from AI.' })
          onEvent('done', { ok: true })
          return
        }

        onEvent('tool', { name: call.name, args: call.args, status: 'running' })
        const output = await runLocalTool(dirHandle, call.name, call.args)
        onEvent('tool', { name: call.name, args: call.args, status: 'done', output: String(output).slice(0, 4000) })

        messages.push({ role: 'assistant', content: text })
        messages.push({ role: 'user', content: `Tool ${call.name} result:\n${String(output).slice(0, 8000)}` })
      }

      onEvent('message', { text: 'Task finished after multiple steps.' })
      onEvent('done', { ok: true })
      return
    } finally {
      clearTimeout(timer)
    }
  }

  if (model.provider === 'gemini') {
    if (!token || !String(token).trim()) {
      throw new Error('Gemini API key is not configured. Get a free key at aistudio.google.com with zero credit card required, then paste it in Settings (Ctrl+,) or the Token Vault.')
    }
    let m = model.remote || 'gemini-2.0-flash'
    if (m.includes('thinking-exp')) m = 'gemini-2.0-flash'

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(token.trim())}`
    const intro = `${TOOLS_XML_PROMPT(mode, dirHandle?.name)}${context ? `\n\nEditor Context:\n${context}` : ''}`

    const abortCtrl = new AbortController()
    const timer = setTimeout(() => abortCtrl.abort(), 45000)

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${intro}\n\nUser request:\n${message}` }] }]
        }),
        signal: abortCtrl.signal
      })

      const json = await resp.json()
      if (!resp.ok) {
        throw new Error(sanitizeError(json.error?.message || `Gemini Error HTTP ${resp.status}`))
      }
      const text = json.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || ''
      const clean = stripTools(text) || text
      onEvent('message', { text: clean || 'Gemini completed with no text.' })
      onEvent('done', { ok: true })
      return
    } finally {
      clearTimeout(timer)
    }
  }

  if (model.provider === 'openai') {
    if (!token || !String(token).trim()) {
      throw new Error('OpenAI API key is not configured. Please add your OpenAI token in Settings (Ctrl+,) or the Token Vault.')
    }
    const endpoint = proxyUrl ? `${proxyUrl.replace(/\/$/, '')}/https://api.openai.com/v1/chat/completions` : 'https://api.openai.com/v1/chat/completions'
    const remoteModel = model.remote || 'gpt-4o-mini'
    const isReasoning = remoteModel.startsWith('o1') || remoteModel.startsWith('o3')
    const reqBody = {
      model: remoteModel,
      messages: [
        { role: 'system', content: TOOLS_XML_PROMPT(mode, dirHandle?.name) },
        ...(context ? [{ role: 'user', content: `Context:\n${context}` }] : []),
        { role: 'user', content: message }
      ]
    }
    if (!isReasoning) {
      reqBody.temperature = 0.3
    }

    const abortCtrl = new AbortController()
    const timer = setTimeout(() => abortCtrl.abort(), 45000)

    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reqBody),
        signal: abortCtrl.signal
      })

      const json = await resp.json()
      if (!resp.ok) {
        throw new Error(sanitizeError(json.error?.message || `OpenAI Error HTTP ${resp.status}`))
      }
      const text = json.choices?.[0]?.message?.content || ''
      const clean = stripTools(text) || text
      onEvent('message', { text: clean || 'OpenAI completed with no text.' })
      onEvent('done', { ok: true })
      return
    } catch (err) {
      if (err.name === 'TypeError' && !proxyUrl) {
        throw new Error('Direct browser requests to OpenAI are blocked by browser CORS policy. Please enter a Web/CORS Proxy URL in Settings ⚙️ or switch to Google Gemini (which works directly in browsers).')
      }
      throw new Error(sanitizeError(err.message))
    } finally {
      clearTimeout(timer)
    }
  }

  throw new Error(`Unsupported model provider: ${model.provider || model.id}`)
}
