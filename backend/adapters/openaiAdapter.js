// Aether OpenAI Provider Adapter
// Securely handles OpenAI API communication, streaming token events, and tool registry execution.

function sanitizeError(msg) {
  if (!msg) return 'OpenAI request failed'
  // Mask any accidental API key leaks (sk-...)
  return String(msg).replace(/sk-[A-Za-z0-9_-]{20,}/g, 'sk-***[REDACTED]***')
}

async function runOpenAIAgent({
  token,
  model,
  userMessage,
  mode,
  context,
  systemPrompt,
  toolRegistry,
  helpers,
  onEvent
}) {
  if (!token || !String(token).trim()) {
    const errText = 'OpenAI API key is not configured. Please add your OpenAI token in Settings (Ctrl+,) or the Token Vault.'
    onEvent('agent.error', { error: errText, provider: 'openai', model })
    onEvent('error', { error: errText, provider: 'openai', model })
    return
  }

  const cleanToken = String(token).trim()
  const m = model || 'gpt-4o-mini'
  const isReasoning = m.startsWith('o1') || m.startsWith('o3')

  const messages = [
    { role: 'system', content: systemPrompt(mode) }
  ]
  if (context) messages.push({ role: 'user', content: `Current editor context:\n${context}` })
  messages.push({ role: 'user', content: userMessage })

  const tools = (mode === 'agent' || mode === 'editor') ? toolRegistry.toOpenAITools() : undefined

  for (let step = 0; step < 8; step++) {
    const body = {
      model: m,
      messages,
      stream: true
    }
    if (!isReasoning) {
      body.temperature = 0.3
    }
    if (tools && tools.length) {
      body.tools = tools
    }

    let resp
    try {
      resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })
    } catch (err) {
      const cleanErr = sanitizeError(`Network error connecting to OpenAI: ${err.message}`)
      onEvent('agent.error', { error: cleanErr, provider: 'openai', model: m })
      onEvent('error', { error: cleanErr })
      return
    }

    if (!resp.ok) {
      let errMsg = `OpenAI API returned HTTP ${resp.status}`
      try {
        const errJson = await resp.json()
        if (errJson.error?.message) {
          errMsg = errJson.error.message
        }
      } catch {}
      const safeErr = sanitizeError(errMsg)
      onEvent('agent.error', { error: safeErr, provider: 'openai', model: m })
      onEvent('error', { error: safeErr })
      return
    }

    // Process OpenAI SSE Stream
    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    let fullText = ''
    const toolCallsMap = {}

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue
        const dataStr = trimmed.slice(5).trim()
        if (dataStr === '[DONE]') continue

        try {
          const chunk = JSON.parse(dataStr)
          const delta = chunk.choices?.[0]?.delta
          if (!delta) continue

          if (delta.content) {
            fullText += delta.content
            onEvent('message.delta', { text: delta.content, fullText })
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0
              if (!toolCallsMap[idx]) {
                toolCallsMap[idx] = { id: tc.id || '', name: tc.function?.name || '', argsStr: '' }
              }
              if (tc.id) toolCallsMap[idx].id = tc.id
              if (tc.function?.name) toolCallsMap[idx].name = tc.function.name
              if (tc.function?.arguments) toolCallsMap[idx].argsStr += tc.function.arguments
            }
          }
        } catch {}
      }
    }

    const toolCalls = Object.values(toolCallsMap)

    if (!toolCalls.length) {
      onEvent('message', { text: fullText })
      onEvent('agent.completed', { ok: true })
      onEvent('done', { ok: true })
      return
    }

    // Record assistant's call into message history
    messages.push({
      role: 'assistant',
      content: fullText || null,
      tool_calls: toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: tc.argsStr }
      }))
    })

    // Execute each tool via the unified Tool Registry
    for (const call of toolCalls) {
      let args = {}
      try { args = JSON.parse(call.argsStr || '{}') } catch { args = {} }

      onEvent('tool.requested', { id: call.id, name: call.name, args })
      onEvent('tool.started', { id: call.id, name: call.name, args })
      onEvent('tool', { name: call.name, args, status: 'running' })

      const output = toolRegistry.executeTool(call.name, args, helpers)

      onEvent('tool.completed', { id: call.id, name: call.name, args, output: String(output).slice(0, 4000) })
      onEvent('tool', { name: call.name, args, status: 'done', output: String(output).slice(0, 4000) })

      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: String(output).slice(0, 12000)
      })
    }
  }

  const limitMsg = 'Stopped after reaching maximum tool loop iterations.'
  onEvent('message', { text: limitMsg })
  onEvent('agent.completed', { ok: true, notice: limitMsg })
  onEvent('done', { ok: true })
}

module.exports = {
  runOpenAIAgent
}
