// Unified AI Client: Backend Proxy + Direct Web Client
// Seamlessly routes requests to local backend proxy or executes in-browser with Web File System tools.

import { readFileFromHandle, writeFileToHandle, searchInHandle, buildTreeFromHandle } from './webfs.js'

const TOOLS_XML_PROMPT = (mode, rootName) => `You are Aether, a coding studio assistant. Workspace: ${rootName || 'Local Project'}.
You can inspect and edit local project files using tools.
To use tools, emit exactly this XML syntax, then stop:
<tool name="list_dir">{"path":""}</tool>
<tool name="read_file">{"path":"relative/file"}</tool>
<tool name="write_file">{"path":"relative/file","content":"..."}</tool>
<tool name="search_code">{"query":"text"}</tool>
When finished, reply in plain text with no tool tags.`

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
  // 1. Try local backend /api/chat first if available
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        model: model.id,
        message,
        mode,
        context
      })
    })

    const ctype = res.headers.get('content-type') || ''
    if (res.ok && ctype.includes('text/event-stream')) {
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
  } catch {
    // Backend unavailable or running standalone in web app - fall back to Direct Web Mode
  }

  // 2. Direct Web Mode (Zero backend dependency)
  if (model.tier === 'free' || model.provider === 'pollinations') {
    const messages = [
      { role: 'system', content: TOOLS_XML_PROMPT(mode, dirHandle?.name) }
    ]
    if (context) messages.push({ role: 'user', content: `Current editor context:\n${context}` })
    messages.push({ role: 'user', content: message })

    for (let i = 0; i < 8; i++) {
      const endpoint = proxyUrl ? `${proxyUrl.replace(/\/$/, '')}/https://text.pollinations.ai/openai` : 'https://text.pollinations.ai/openai'
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model.remote || 'openai-fast',
          messages,
          temperature: 0.3
        })
      })

      const raw = await resp.text()
      let json = {}
      try { json = JSON.parse(raw) } catch { json = { choices: [{ message: { content: raw } }] } }
      const text = json.choices?.[0]?.message?.content || json.message || raw || ''
      const call = extractToolCall(text)

      if (!call) {
        onEvent('message', { text: stripTools(text) || text })
        onEvent('done', { ok: true })
        return
      }

      onEvent('tool', { name: call.name, args: call.args, status: 'running' })
      const output = await runLocalTool(dirHandle, call.name, call.args)
      onEvent('tool', { name: call.name, args: call.args, status: 'done', output: String(output).slice(0, 4000) })

      messages.push({ role: 'assistant', content: text })
      messages.push({ role: 'user', content: `Tool ${call.name} result:\n${String(output).slice(0, 8000)}` })
    }

    onEvent('message', { text: 'Stopped after multiple tool steps.' })
    onEvent('done', { ok: true })
    return
  }

  if (model.provider === 'gemini') {
    if (!token) throw new Error('Gemini API key is required')
    const m = model.remote || 'gemini-2.0-flash'
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(token)}`
    const intro = `${TOOLS_XML_PROMPT(mode, dirHandle?.name)}${context ? `\n\nEditor Context:\n${context}` : ''}`

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${intro}\n\nUser request:\n${message}` }] }]
      })
    })

    const json = await resp.json()
    if (!resp.ok) throw new Error(json.error?.message || `Gemini Error ${resp.status}`)
    const text = json.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || ''
    onEvent('message', { text: stripTools(text) || text })
    onEvent('done', { ok: true })
    return
  }

  if (model.provider === 'openai') {
    if (!token) throw new Error('OpenAI API key is required')
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
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(reqBody)
    })

    const json = await resp.json()
    if (!resp.ok) throw new Error(json.error?.message || `OpenAI Error ${resp.status}`)
    const text = json.choices?.[0]?.message?.content || ''
    onEvent('message', { text: stripTools(text) || text })
    onEvent('done', { ok: true })
    return
  }
}
