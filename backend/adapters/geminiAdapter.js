// Aether Google Gemini Provider Adapter
// Securely handles Gemini API communication, streaming token events, and tool registry execution.

function sanitizeError(msg) {
  if (!msg) return 'Gemini request failed'
  // Mask any accidental API key leaks in URLs or messages
  return String(msg)
    .replace(/key=[A-Za-z0-9_-]{20,}/g, 'key=***[REDACTED]***')
    .replace(/AIza[0-9A-Za-z-_]{35}/g, 'AIza***[REDACTED]***')
}

function geminiPartsToText(parts) {
  return (parts || []).filter((p) => p.text).map((p) => p.text).join('')
}

async function runGeminiAgent({
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
    const errText = 'Gemini API key is not configured. Get a free key at aistudio.google.com with zero credit card required, then paste it in Settings (Ctrl+,) or the Token Vault.'
    onEvent('agent.error', { error: errText, provider: 'gemini', model })
    onEvent('error', { error: errText, provider: 'gemini', model })
    return
  }

  const cleanToken = String(token).trim()
  let m = model || 'gemini-2.0-flash'
  if (m.includes('thinking-exp')) m = 'gemini-2.0-flash'

  const contents = []
  const intro = systemPrompt(mode) + (context ? `\n\nCurrent editor context:\n${context}` : '')
  contents.push({
    role: 'user',
    parts: [{ text: `${intro}\n\nUser request:\n${userMessage}` }]
  })

  const tools = (mode === 'agent' || mode === 'editor') ? toolRegistry.toGeminiTools() : undefined

  for (let step = 0; step < 8; step++) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:streamGenerateContent?alt=sse&key=${encodeURIComponent(cleanToken)}`
    const body = { contents }
    if (!m.includes('thinking')) {
      body.generationConfig = { temperature: 0.3 }
    }
    if (tools && tools.length) {
      body.tools = tools
    }

    let resp
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
    } catch (err) {
      const cleanErr = sanitizeError(`Network error connecting to Gemini: ${err.message}`)
      onEvent('agent.error', { error: cleanErr, provider: 'gemini', model: m })
      onEvent('error', { error: cleanErr })
      return
    }

    if (!resp.ok) {
      let errMsg = `Gemini API returned HTTP ${resp.status}`
      try {
        const errJson = await resp.json()
        if (errJson.error?.message) {
          errMsg = errJson.error.message
        }
      } catch {}
      const safeErr = sanitizeError(errMsg)
      onEvent('agent.error', { error: safeErr, provider: 'gemini', model: m })
      onEvent('error', { error: safeErr })
      return
    }

    // Process Gemini SSE Stream
    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    let fullText = ''
    const fnCalls = []
    const allCandidateParts = []

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
        try {
          const chunk = JSON.parse(dataStr)
          const cand = chunk.candidates?.[0]
          const parts = cand?.content?.parts || []
          for (const p of parts) {
            allCandidateParts.push(p)
            if (p.text) {
              fullText += p.text
              onEvent('message.delta', { text: p.text, fullText })
            }
            if (p.functionCall) {
              fnCalls.push(p.functionCall)
            }
          }
        } catch {}
      }
    }

    if (!fnCalls.length) {
      onEvent('message', { text: fullText || geminiPartsToText(allCandidateParts) })
      onEvent('agent.completed', { ok: true })
      onEvent('done', { ok: true })
      return
    }

    // Record model's function calls into history
    contents.push({ role: 'model', parts: allCandidateParts })

    // Execute each tool via the unified Tool Registry
    const responseParts = []
    for (const call of fnCalls) {
      const name = call.name
      const args = call.args || {}

      onEvent('tool.requested', { name, args })
      onEvent('tool.started', { name, args })
      onEvent('tool', { name, args, status: 'running' })

      const output = toolRegistry.executeTool(name, args, helpers)

      onEvent('tool.completed', { name, args, output: String(output).slice(0, 4000) })
      onEvent('tool', { name, args, status: 'done', output: String(output).slice(0, 4000) })

      responseParts.push({
        functionResponse: {
          name,
          response: { result: String(output).slice(0, 12000) }
        }
      })
    }

    contents.push({ role: 'user', parts: responseParts })
  }

  const limitMsg = 'Stopped after reaching maximum tool loop iterations.'
  onEvent('message', { text: limitMsg })
  onEvent('agent.completed', { ok: true, notice: limitMsg })
  onEvent('done', { ok: true })
}

module.exports = {
  runGeminiAgent
}
