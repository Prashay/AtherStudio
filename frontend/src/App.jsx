import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { QRCodeSVG, downloadQRCodePNG } from './qrcode.jsx'
import {
  isNativeFSSupported,
  pickNativeDirectory,
  buildTreeFromHandle,
  readFileFromHandle,
  writeFileToHandle,
  searchInHandle,
  buildVirtualTreeFromFiles
} from './webfs.js'
import { executeChat } from './aiClient.js'
import { MarkdownViewer } from './MarkdownViewer.jsx'
import { SettingsModal, loadSettings, saveSettings } from './SettingsModal.jsx'
import { TaskHistoryModal, loadTaskHistory, saveTaskHistory } from './TaskHistoryModal.jsx'

const STORE_KEY = 'aether.vault'
const MODEL_KEY = 'aether.model'
const USER_KEY = 'aether.username'
const WELCOME_SEEN_KEY = 'aether.welcome_seen'

function loadVault() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveVault(c) {
  localStorage.setItem(STORE_KEY, JSON.stringify(c))
}

const DEFAULT_MODELS = {
  free: [
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
  ],
  premium: [
    // --- Google Gemini ---
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
      remote: 'gemini-2.0-flash',
      capabilities: {
        streaming: true,
        toolCalling: true,
        vision: true,
        structuredOutput: true,
        longContext: true,
        reasoning: true
      }
    },

    // --- OpenAI / ChatGPT ---
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
}

function MiniRobot({ mode }) {
  return (
    <div className={`mini-bot ${mode}`} aria-hidden="true">
      <div className="orbit-ring" />
      <div className="orbit-dot" />
      <div className="bot">
        <div className="antenna">
          <span className="bead" />
        </div>
        <div className="head">
          <div className="visor">
            <span className="eye" />
            <span className="eye" />
          </div>
        </div>
        <div className="torso">
          <span className="core" />
        </div>
        <div className="arm left" />
        <div className="arm right" />
        <div className="leg left" />
        <div className="leg right" />
      </div>
    </div>
  )
}

function AppleAiOrb({ size = 150 }) {
  const canvasRef = useRef(null)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animationId
    let t = 0

    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    // 16 3D Orbiting Quantum Stardust Particles
    const particles = Array.from({ length: 16 }, (_, i) => ({
      angle: (i / 16) * Math.PI * 2,
      speed: 0.012 + (i % 4) * 0.006,
      radiusX: (size * 0.40) + (i % 3) * 6,
      radiusY: (size * 0.24) + ((i + 2) % 3) * 5,
      tilt: -0.32 + ((i % 5) * 0.14),
      size: 1.4 + (i % 3) * 0.8,
      color: ['#00f0ff', '#ff2d55', '#a855f7', '#ffd60a', '#ffffff', '#38bdf8'][i % 6]
    }))

    const render = () => {
      ctx.clearRect(0, 0, size, size)
      const cx = size / 2
      const cy = size / 2
      const r = size * 0.40

      t += hovered ? 0.042 : 0.026

      // 1. Core Sphere Clipping & Cosmic Atmosphere
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.clip()

      // Deep dark cosmic background
      const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
      bgGrad.addColorStop(0, '#160a30')
      bgGrad.addColorStop(0.68, '#090317')
      bgGrad.addColorStop(1, '#030109')
      ctx.fillStyle = bgGrad
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2)

      // Dynamic swirling fluid plasma blooms
      const blooms = [
        { x: cx + Math.cos(t * 0.7) * (r * 0.32), y: cy + Math.sin(t * 0.5) * (r * 0.28), rad: r * 0.82, col: 'rgba(0, 240, 255, 0.46)' },
        { x: cx + Math.sin(t * 0.8) * (r * 0.35), y: cy + Math.cos(t * 0.85) * (r * 0.3), rad: r * 0.85, col: 'rgba(244, 63, 94, 0.46)' },
        { x: cx - Math.cos(t * 0.45) * (r * 0.3), y: cy - Math.sin(t * 0.65) * (r * 0.3), rad: r * 0.78, col: 'rgba(168, 85, 247, 0.52)' },
        { x: cx + Math.cos(t * 1.05) * (r * 0.2), y: cy + Math.sin(t * 1.05) * (r * 0.2), rad: r * 0.55, col: 'rgba(255, 214, 10, 0.32)' }
      ]

      blooms.forEach(b => {
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.rad)
        g.addColorStop(0, b.col)
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = g
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
      })

      // 2. 60fps Harmonic Siri Wave Ribbons (Lighter additive blending)
      ctx.globalCompositeOperation = 'lighter'

      const waveConfigs = [
        { color: '#00f0ff', f1: 0.045, s1: 2.2, a1: 15, f2: 0.09, s2: -1.6, a2: 7, width: 2.8, blur: 12 },
        { color: '#ff2d55', f1: 0.038, s1: -1.9, a1: 17, f2: 0.08, s2: 2.1, a2: 8, width: 2.4, blur: 12 },
        { color: '#a855f7', f1: 0.052, s1: 1.6, a1: 13, f2: 0.07, s2: -2.2, a2: 6, width: 2.2, blur: 9 },
        { color: '#ffffff', f1: 0.062, s1: 2.7, a1: 10, f2: 0.11, s2: 1.8, a2: 5, width: 1.8, blur: 14 }
      ]

      const ampMult = hovered ? 1.35 : 1.0
      const startX = cx - r
      const endX = cx + r

      waveConfigs.forEach((wc) => {
        ctx.beginPath()
        ctx.strokeStyle = wc.color
        ctx.lineWidth = wc.width
        ctx.shadowColor = wc.color
        ctx.shadowBlur = wc.blur

        for (let x = startX; x <= endX; x += 2) {
          const norm = (x - startX) / (r * 2)
          const envelope = Math.sin(norm * Math.PI)
          const waveY = cy + (
            Math.sin(x * wc.f1 + t * wc.s1) * (wc.a1 * ampMult) +
            Math.cos(x * wc.f2 + t * wc.s2) * (wc.a2 * ampMult)
          ) * envelope

          if (x === startX) {
            ctx.moveTo(x, waveY)
          } else {
            ctx.lineTo(x, waveY)
          }
        }
        ctx.stroke()
      })

      // Pulsing Singularity Energy Core
      const corePulse = 1 + Math.sin(t * 3.2) * 0.15
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 20 * corePulse)
      coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
      coreGrad.addColorStop(0.25, 'rgba(0, 240, 255, 0.65)')
      coreGrad.addColorStop(0.65, 'rgba(168, 85, 247, 0.25)')
      coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = coreGrad
      ctx.beginPath()
      ctx.arc(cx, cy, 20 * corePulse, 0, Math.PI * 2)
      ctx.fill()

      ctx.restore()

      // 3. 3D Orbiting Quantum Stardust Particles (around & over the sphere)
      ctx.save()
      particles.forEach((p) => {
        p.angle += p.speed * (hovered ? 1.45 : 1.0)
        const cosT = Math.cos(p.tilt)
        const sinT = Math.sin(p.tilt)
        const rawX = Math.cos(p.angle) * p.radiusX
        const rawY = Math.sin(p.angle) * p.radiusY

        const px = cx + rawX * cosT - rawY * sinT
        const py = cy + rawX * sinT + rawY * cosT

        const depth = Math.sin(p.angle)
        const pScale = 0.65 + 0.45 * (depth + 1) * 0.5
        const pAlpha = 0.25 + 0.75 * (depth + 1) * 0.5

        ctx.beginPath()
        ctx.arc(px, py, p.size * pScale, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = pAlpha
        ctx.shadowColor = p.color
        ctx.shadowBlur = 10
        ctx.fill()
      })
      ctx.restore()

      animationId = requestAnimationFrame(render)
    }

    render()
    return () => cancelAnimationFrame(animationId)
  }, [size, hovered])

  return (
    <div
      className="siri-stage"
      style={{ width: size, height: size }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="siri-aurora" />

      {/* 3D Holographic Orbit Gyro Rings */}
      <div className="siri-gyro ring-x">
        <span className="siri-satellite sat-1" />
      </div>
      <div className="siri-gyro ring-y">
        <span className="siri-satellite sat-2" />
      </div>
      <div className="siri-gyro ring-z" />

      {/* Real-time 60fps Harmonic Siri Neural Canvas */}
      <canvas
        ref={canvasRef}
        className="siri-canvas"
        style={{ width: size, height: size }}
      />

      {/* Crystal Glass Specular Lens & Edge Refraction */}
      <div className="siri-lens-glass" />

      {/* Floating Starlight Sparkles */}
      <div className="siri-star star-1">✦</div>
      <div className="siri-star star-2">✦</div>
      <div className="siri-star star-3">✦</div>
      <div className="siri-star star-4">✦</div>
    </div>
  )
}

function FileGlyph({ type, open }) {
  if (type === 'dir') return <span className="ico">{open ? 'v' : '>'}</span>
  return <span className="ico">.</span>
}

function TreeNode({ node, depth, active, onOpen, openDirs, toggleDir }) {
  const isDir = node.type === 'dir'
  const open = openDirs.has(node.path)
  return (
    <div>
      <div
        className={`tree-item ${active === node.path ? 'on' : ''}`}
        style={{ paddingLeft: 6 + depth * 10 }}
        onClick={() => (isDir ? toggleDir(node.path) : onOpen(node.path))}
      >
        <FileGlyph type={node.type} open={open} />
        <span>{node.name}</span>
      </div>
      {isDir && open && node.children?.map((child) => (
        <TreeNode
          key={child.path || child.name}
          node={child}
          depth={depth + 1}
          active={active}
          onOpen={onOpen}
          openDirs={openDirs}
          toggleDir={toggleDir}
        />
      ))}
    </div>
  )
}

async function parseSse(response, onEvent) {
  const reader = response.body.getReader()
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
}

export default function App() {
  const [mode, setMode] = useState(() => {
    try {
      const param = new URLSearchParams(window.location.search).get('mode')
      if (param && ['agent', 'chat', 'editor'].includes(param)) return param
    } catch {}
    return 'agent'
  })
  const [tree, setTree] = useState(null)
  const [openDirs, setOpenDirs] = useState(() => new Set(['']))
  const [tabs, setTabs] = useState([])
  const [active, setActive] = useState('')
  const [dirty, setDirty] = useState({})
  const [search, setSearch] = useState('')
  const [hits, setHits] = useState([])
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [vaultOpen, setVaultOpen] = useState(false)
  const [vaultTab, setVaultTab] = useState('openai')
  const [catalog, setCatalog] = useState(DEFAULT_MODELS)
  const [modelId, setModelId] = useState(() => localStorage.getItem(MODEL_KEY) || 'aether-spark')
  const allModels = useMemo(() => [...(catalog?.free || []), ...(catalog?.premium || [])], [catalog])
  const selected = useMemo(() => allModels.find((m) => m.id === modelId) || allModels[0] || DEFAULT_MODELS.free[0], [allModels, modelId])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [vault, setVault] = useState(() => ({
    openai: '',
    gemini: '',
    proxyUrl: '',
    ...loadVault()
  }))
  const [workspace, setWorkspace] = useState({ name: null, root: null })
  const [webDirHandle, setWebDirHandle] = useState(null)
  const [virtualFiles, setVirtualFiles] = useState(null)
  const fileInputRef = useRef(null)
  const [folderOpen, setFolderOpen] = useState(false)
  const [browse, setBrowse] = useState(null)
  const [browseErr, setBrowseErr] = useState('')
  const [pane, setPane] = useState('editor')
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [installed, setInstalled] = useState(false)
  const [appModalOpen, setAppModalOpen] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search)
      return p.get('download') === '1' || p.get('install') === '1' || p.get('app') === '1'
    } catch {
      return false
    }
  })
  const [guideTab, setGuideTab] = useState('phone')
  const [qrMode, setQrMode] = useState('auto') // 'auto' | 'local' | 'cloud'
  const [qrDownloaded, setQrDownloaded] = useState(false)
  const [networkInfo, setNetworkInfo] = useState({ addresses: [], port: 4576 })
  const [copied, setCopied] = useState(false)

  const isMobileClient = useMemo(() => {
    if (typeof window === 'undefined') return false
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768
  }, [])

  const isIOSClient = useMemo(() => {
    if (typeof window === 'undefined') return false
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  }, [])

  const isAndroidClient = useMemo(() => {
    if (typeof window === 'undefined') return false
    return /Android/i.test(navigator.userAgent)
  }, [])

  const targetQrUrl = useMemo(() => {
    const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    if (!isLocalHost) {
      const origin = window.location.origin
      const cleanPath = window.location.pathname.replace(/\/+$/, '')
      return `${origin}${cleanPath}/?download=1`
    }
    if (qrMode === 'cloud') {
      return 'https://prashay.github.io/AtherStudio/?download=1'
    }
    const host = networkInfo.addresses?.[0]?.ip || window.location.hostname
    const port = window.location.port || networkInfo.port || '4576'
    return `${window.location.protocol}//${host}:${port}/?download=1`
  }, [networkInfo, qrMode])

  const handleDownloadQR = () => {
    const ok = downloadQRCodePNG(targetQrUrl, 'aether-studio-qr.png')
    if (ok) {
      setQrDownloaded(true)
      setTimeout(() => setQrDownloaded(false), 2500)
    }
  }

  const handleDownloadShortcut = () => {
    try {
      const content = `[InternetShortcut]\nURL=${targetQrUrl}\n`
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'AetherStudio.url'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (e) {
      console.error(e)
    }
  }

  const feedRef = useRef(null)
  const chatInputRef = useRef(null)
  const [tokenGuideOpen, setTokenGuideOpen] = useState(false)
  const [tokenGuideTab, setTokenGuideTab] = useState('gemini') // 'gemini' | 'openai'
  const openTokenHelper = (provider = 'gemini') => {
    setTokenGuideTab(provider === 'openai' ? 'openai' : 'gemini')
    setTokenGuideOpen(true)
  }
  const [userName, setUserName] = useState(() => localStorage.getItem(USER_KEY) || '')
  const [welcomeModalOpen, setWelcomeModalOpen] = useState(() => {
    try {
      if (new URLSearchParams(window.location.search).get('welcome') === 'true') return true
    } catch {}
    return false
  })
  const [nameDraft, setNameDraft] = useState(() => localStorage.getItem(USER_KEY) || '')
  const [centerDraft, setCenterDraft] = useState('')
  const [capsulePickerOpen, setCapsulePickerOpen] = useState(false)
  const [bookmarksOpen, setBookmarksOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [plusMenuOpen, setPlusMenuOpen] = useState(false)
  const [listening, setListening] = useState(false)
  const [msgMenuIdx, setMsgMenuIdx] = useState(null)
  const [msgFeedback, setMsgFeedback] = useState({})
  const [copiedMsgIdx, setCopiedMsgIdx] = useState(null)
  const [speakingIdx, setSpeakingIdx] = useState(null)
  const [settings, setSettings] = useState(() => loadSettings())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mdMode, setMdMode] = useState(() => {
    const s = loadSettings()
    return s.mdDefaultMode || 'reader'
  })
  const [taskHistory, setTaskHistory] = useState(() => loadTaskHistory())
  const [historyOpen, setHistoryOpen] = useState(false)
  const [isTempChat, setIsTempChat] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState(() => 'sess_' + Date.now())

  // Automatically sync current conversation into Task History if not in Temp Chat
  useEffect(() => {
    if (isTempChat || !messages.length) return
    const firstUserMsg = messages.find((m) => m.role === 'user')?.text || ''
    const title = firstUserMsg ? firstUserMsg.slice(0, 52).replace(/\n/g, ' ') : `Task Session`

    setTaskHistory((prev) => {
      const existingIdx = prev.findIndex((s) => s.id === currentSessionId)
      const sessionObj = {
        id: currentSessionId,
        title,
        mode,
        modelId: selected.id,
        modelLabel: selected.label,
        updatedAt: Date.now(),
        createdAt: existingIdx >= 0 ? prev[existingIdx].createdAt : Date.now(),
        messages
      }
      let next
      if (existingIdx >= 0) {
        next = [sessionObj, ...prev.filter((s) => s.id !== currentSessionId)]
      } else {
        next = [sessionObj, ...prev]
      }
      next = next.slice(0, 60)
      saveTaskHistory(next)
      return next
    })
  }, [messages, isTempChat, currentSessionId, mode, selected])

  const startNewChat = (asTemp = false) => {
    const newId = 'sess_' + Date.now()
    setCurrentSessionId(newId)
    setIsTempChat(asTemp)
    setMessages([])
    setDraft('')
    setCenterDraft('')
    setTimeout(() => chatInputRef.current?.focus(), 60)
  }

  const toggleTempChat = () => {
    if (isTempChat) {
      setIsTempChat(false)
    } else {
      startNewChat(true)
    }
  }

  const handleSelectSession = (session) => {
    setCurrentSessionId(session.id)
    setIsTempChat(false)
    setMessages(session.messages || [])
    if (session.mode) setMode(session.mode)
    if (session.modelId) pickModel(session.modelId)
    setDraft('')
  }

  const handleDeleteSession = (sessionId) => {
    setTaskHistory((prev) => {
      const next = prev.filter((s) => s.id !== sessionId)
      saveTaskHistory(next)
      return next
    })
    if (currentSessionId === sessionId) {
      startNewChat(false)
    }
  }

  const handleClearAllHistory = () => {
    setTaskHistory([])
    saveTaskHistory([])
  }

  const handleExportSession = (session, format = 'markdown') => {
    const msgs = session.messages || []
    if (!msgs.length) return
    let text = ''
    let filename = `aether-session-${session.title?.replace(/[^a-z0-9_-]/gi, '_') || session.id}`
    let mimeType = 'text/markdown'

    if (format === 'json') {
      text = JSON.stringify(session, null, 2)
      filename += '.json'
      mimeType = 'application/json'
    } else {
      text = `# ${session.title || 'Aether Studio Task'}\n**Date:** ${new Date(session.updatedAt || session.createdAt).toLocaleString()}\n**Mode:** ${session.mode}\n**Model:** ${session.modelLabel}\n\n---\n\n`
      msgs.forEach((m) => {
        if (m.role === 'user') text += `### 👤 User\n\n${m.text}\n\n`
        else if (m.role === 'ai') text += `### ✨ ${session.modelLabel || 'AI'}\n\n${m.text}\n\n`
        else if (m.role === 'error') text += `### ⚠️ Notice\n\n${m.text}\n\n`
        else if (m.role === 'tool') text += `> 🔧 Tool: **${m.name}** (${m.status})\n\n`
      })
      filename += '.md'
    }

    const blob = new Blob([text], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    if (settings.theme) {
      document.documentElement.setAttribute('data-theme', settings.theme)
    }
  }, [settings.theme])

  const exportErrorLog = (errorText, index, format = 'markdown') => {
    const lastUserPrompt = [...messages.slice(0, index + 1)].reverse().find((m) => m.role === 'user')?.text || ''
    const timestamp = new Date().toISOString()

    if (format === 'json') {
      const data = {
        timestamp,
        error: errorText,
        model: selected,
        userPrompt: lastUserPrompt,
        mode,
        appVersion: '1.0.0',
        userAgent: navigator.userAgent
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `aether-error-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      return
    }

    const mdReport = `# Aether Studio Error Diagnostic Report
**Date:** ${new Date().toLocaleString()}
**Model:** ${selected.label} (${selected.id}) [${selected.tier}]
**Provider:** ${selected.provider}
**Studio Mode:** ${mode}

---

## ⚠️ Error Details
\`\`\`
${errorText}
\`\`\`

## 💬 Context Prompt
${lastUserPrompt ? `> ${lastUserPrompt}` : '*(No prior prompt in thread)*'}

## 🛠️ Diagnostic Environment
- App Version: Aether Studio v1.0.0
- Web FS Active: ${Boolean(webDirHandle)}
- User Agent: ${navigator.userAgent}
`
    const blob = new Blob([mdReport], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `aether-error-${Date.now()}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const exportChatSession = (format = 'markdown') => {
    if (!messages.length) return
    let text = ''
    let filename = `aether-chat-${new Date().toISOString().slice(0, 10)}`
    let mimeType = 'text/markdown'

    if (format === 'json') {
      text = JSON.stringify({
        exportedAt: new Date().toISOString(),
        model: selected,
        messages
      }, null, 2)
      filename += '.json'
      mimeType = 'application/json'
    } else {
      text = `# Aether Studio Chat Transcript\n**Date:** ${new Date().toLocaleString()}\n**Active Model:** ${selected.label}\n\n---\n\n`
      messages.forEach((m) => {
        if (m.role === 'user') {
          text += `### 👤 User\n\n${m.text}\n\n`
        } else if (m.role === 'ai') {
          text += `### ✨ ${selected.label}\n\n${m.text}\n\n`
        } else if (m.role === 'error') {
          text += `### ⚠️ AI Error Notice\n\n${m.text}\n\n`
        } else if (m.role === 'tool') {
          text += `> 🔧 Tool: **${m.name}** (${m.status})\n\n`
        }
      })
      filename += '.md'
    }

    const blob = new Blob([text], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const createNewFile = (defaultName = 'notes.md') => {
    const existing = tabs.find((t) => t.path === defaultName)
    if (!existing) {
      setTabs((prev) => [...prev, { path: defaultName, content: '# Notes\n\nStart writing markdown or code here...\n' }])
    }
    setActive(defaultName)
    setMode('editor')
  }

  useEffect(() => {
    const handleDocClick = () => setMsgMenuIdx(null)
    if (msgMenuIdx !== null) {
      window.addEventListener('click', handleDocClick)
      return () => window.removeEventListener('click', handleDocClick)
    }
  }, [msgMenuIdx])

  const handleListen = useCallback((text, idx) => {
    if (!('speechSynthesis' in window)) {
      alert('Speech synthesis is not supported on this browser.')
      return
    }
    if (speakingIdx === idx) {
      window.speechSynthesis.cancel()
      setSpeakingIdx(null)
      return
    }
    window.speechSynthesis.cancel()
    const cleanText = text.replace(/```[\s\S]*?```/g, 'Code block omitted.')
    const utter = new SpeechSynthesisUtterance(cleanText)
    utter.onend = () => setSpeakingIdx(null)
    utter.onerror = () => setSpeakingIdx(null)
    setSpeakingIdx(idx)
    window.speechSynthesis.speak(utter)
  }, [speakingIdx])

  const [leftWidth, setLeftWidth] = useState(() => {
    try {
      const saved = localStorage.getItem('aether.left_width')
      return saved ? Math.max(160, Math.min(700, parseInt(saved, 10))) : 260
    } catch {
      return 260
    }
  })

  const [rightWidth, setRightWidth] = useState(() => {
    try {
      const saved = localStorage.getItem('aether.right_width')
      return saved ? Math.max(240, Math.min(850, parseInt(saved, 10))) : 360
    } catch {
      return 360
    }
  })

  const [isResizing, setIsResizing] = useState(null)

  const startResizeLeft = useCallback((e) => {
    e.preventDefault()
    setIsResizing('left')
    document.body.classList.add('resizing-col')

    const onMouseMove = (moveEvent) => {
      const minW = 160
      const maxW = Math.max(minW, Math.floor(window.innerWidth * 0.45))
      const newWidth = Math.max(minW, Math.min(moveEvent.clientX, maxW))
      setLeftWidth(newWidth)
    }

    const onMouseUp = () => {
      document.body.classList.remove('resizing-col')
      setIsResizing(null)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      setLeftWidth((w) => {
        try { localStorage.setItem('aether.left_width', String(w)) } catch {}
        return w
      })
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [])

  const startResizeRight = useCallback((e) => {
    e.preventDefault()
    setIsResizing('right')
    document.body.classList.add('resizing-col')

    const onMouseMove = (moveEvent) => {
      const minW = 240
      const maxW = Math.max(minW, Math.floor(window.innerWidth * 0.55))
      const newWidth = Math.max(minW, Math.min(window.innerWidth - moveEvent.clientX, maxW))
      setRightWidth(newWidth)
    }

    const onMouseUp = () => {
      document.body.classList.remove('resizing-col')
      setIsResizing(null)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      setRightWidth((w) => {
        try { localStorage.setItem('aether.right_width', String(w)) } catch {}
        return w
      })
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [])

  const handleTouchLeft = useCallback((e) => {
    const touch = e.touches[0]
    if (!touch) return
    setIsResizing('left')

    const onTouchMove = (moveEvent) => {
      const t = moveEvent.touches[0]
      if (!t) return
      const minW = 160
      const maxW = Math.max(minW, Math.floor(window.innerWidth * 0.45))
      const newWidth = Math.max(minW, Math.min(t.clientX, maxW))
      setLeftWidth(newWidth)
    }

    const onTouchEnd = () => {
      setIsResizing(null)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      setLeftWidth((w) => {
        try { localStorage.setItem('aether.left_width', String(w)) } catch {}
        return w
      })
    }

    window.addEventListener('touchmove', onTouchMove)
    window.addEventListener('touchend', onTouchEnd)
  }, [])

  const handleTouchRight = useCallback((e) => {
    const touch = e.touches[0]
    if (!touch) return
    setIsResizing('right')

    const onTouchMove = (moveEvent) => {
      const t = moveEvent.touches[0]
      if (!t) return
      const minW = 240
      const maxW = Math.max(minW, Math.floor(window.innerWidth * 0.55))
      const newWidth = Math.max(minW, Math.min(window.innerWidth - t.clientX, maxW))
      setRightWidth(newWidth)
    }

    const onTouchEnd = () => {
      setIsResizing(null)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      setRightWidth((w) => {
        try { localStorage.setItem('aether.right_width', String(w)) } catch {}
        return w
      })
    }

    window.addEventListener('touchmove', onTouchMove)
    window.addEventListener('touchend', onTouchEnd)
  }, [])

  const formattedName = useMemo(() => {
    if (!userName) return ''
    return userName.charAt(0).toUpperCase() + userName.slice(1)
  }, [userName])

  const modelShortName = useMemo(() => {
    if (!selected) return 'Spark'
    let name = selected.name || selected.label || ''
    name = name.replace(' (Free)', '').replace('Aether ', '')
    return name
  }, [selected])

  const toggleListening = (target = 'center') => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRec) {
      alert('Speech recognition is not supported in this browser. Please type your prompt.')
      return
    }
    if (listening) {
      setListening(false)
      return
    }
    try {
      const recognition = new SpeechRec()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'en-US'
      recognition.onstart = () => setListening(true)
      recognition.onresult = (e) => {
        const transcript = e.results[0]?.[0]?.transcript || ''
        if (transcript) {
          if (target === 'draft') {
            setDraft((prev) => (prev ? `${prev} ${transcript}` : transcript))
          } else {
            setCenterDraft((prev) => (prev ? `${prev} ${transcript}` : transcript))
          }
        }
        setListening(false)
      }
      recognition.onerror = () => setListening(false)
      recognition.onend = () => setListening(false)
      recognition.start()
    } catch {
      setListening(false)
    }
  }

  const current = tabs.find((t) => t.path === active)

  const loadWorkspace = useCallback(() => {
    fetch('/api/workspace')
      .then((r) => r.json())
      .then((d) => {
        if (d.root) {
          setWorkspace({ name: d.name || 'workspace', root: d.root })
          fetch('/api/tree').then((r) => r.json()).then(setTree).catch(() => {})
        } else {
          setWorkspace({ name: null, root: null })
          setTree(null)
        }
      })
      .catch(() => {
        setWorkspace({ name: null, root: null })
        setTree(null)
      })
  }, [])

  useEffect(() => {
    loadWorkspace()
    fetch('/api/models').then((r) => r.json()).then((d) => {
      if (d.free && d.premium) setCatalog(d)
    }).catch(() => {})
    fetch('/api/network').then((r) => r.json()).then((d) => {
      if (d?.addresses) setNetworkInfo(d)
    }).catch(() => {})

    const onBeforeInstall = (e) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setInstalled(true)
    }
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [loadWorkspace])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setLeftOpen((v) => !v)
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        setRightOpen((v) => !v)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault()
        setSettingsOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const triggerInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const res = await installPrompt.userChoice
    if (res?.outcome === 'accepted') {
      setInstalled(true)
      setInstallPrompt(null)
      setAppModalOpen(false)
    }
  }

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight
  }, [messages])

  useEffect(() => {
    const q = search.trim()
    if (q.length < 2) {
      setHits([])
      return
    }
    const t = setTimeout(async () => {
      if (webDirHandle) {
        try {
          const results = await searchInHandle(webDirHandle, q)
          setHits(results)
        } catch {
          setHits([])
        }
      } else {
        fetch(`/api/search?q=${encodeURIComponent(q)}`)
          .then((r) => r.json())
          .then((d) => setHits(d.results || []))
          .catch(() => setHits([]))
      }
    }, 220)
    return () => clearTimeout(t)
  }, [search, webDirHandle])

  const toggleDir = useCallback((p) => {
    setOpenDirs((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }, [])

  const openFile = useCallback(async (p) => {
    try {
      let content = ''
      if (webDirHandle) {
        const res = await readFileFromHandle(webDirHandle, p)
        content = res.content
      } else if (virtualFiles && virtualFiles.has(p)) {
        content = await virtualFiles.get(p).text()
      } else {
        const res = await fetch(`/api/file?path=${encodeURIComponent(p)}`)
        const data = await res.json()
        if (data.type !== 'file') return
        content = data.content
      }
      setTabs((prev) => {
        if (prev.some((t) => t.path === p)) return prev
        return [...prev, { path: p, content }]
      })
      setActive(p)
      setPane('editor')
    } catch (err) {
      alert('Could not open file: ' + err.message)
    }
  }, [webDirHandle, virtualFiles])

  const updateContent = (value) => {
    setTabs((prev) => prev.map((t) => (t.path === active ? { ...t, content: value } : t)))
    setDirty((d) => ({ ...d, [active]: true }))
  }

  const saveFile = async () => {
    if (!current) return
    try {
      if (webDirHandle) {
        await writeFileToHandle(webDirHandle, current.path, current.content)
        setDirty((d) => ({ ...d, [current.path]: false }))
      } else {
        await fetch('/api/file', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: current.path, content: current.content })
        })
        setDirty((d) => ({ ...d, [current.path]: false }))
      }
    } catch (err) {
      alert('Failed to save file: ' + err.message)
    }
  }

  const persistVault = (next) => {
    setVault(next)
    saveVault(next)
  }

  const openLocalFolder = async () => {
    if (isNativeFSSupported()) {
      try {
        const handle = await pickNativeDirectory()
        setWebDirHandle(handle)
        setVirtualFiles(null)
        setWorkspace({ name: handle.name, root: 'local:' + handle.name })
        const treeData = await buildTreeFromHandle(handle)
        setTree(treeData)
        setTabs([])
        setActive('')
        setDirty({})
        setHits([])
        setSearch('')
      } catch (err) {
        if (err.name !== 'AbortError') {
          openFolderPicker()
        }
      }
    } else {
      if (fileInputRef.current) {
        fileInputRef.current.click()
      } else {
        openFolderPicker()
      }
    }
  }

  const handleVirtualInput = (e) => {
    const files = e.target.files
    if (!files || !files.length) return
    const { root: treeData, fileMap } = buildVirtualTreeFromFiles(files)
    setVirtualFiles(fileMap)
    setWebDirHandle(null)
    setWorkspace({ name: treeData.name, root: 'virtual:' + treeData.name })
    setTree(treeData)
    setTabs([])
    setActive('')
    setDirty({})
    setHits([])
    setSearch('')
  }

  const closeProject = async () => {
    setWebDirHandle(null)
    setVirtualFiles(null)
    setWorkspace({ name: null, root: null })
    setTree(null)
    setTabs([])
    setActive('')
    setDirty({})
    setHits([])
    setSearch('')
    fetch('/api/workspace', { method: 'DELETE' }).catch(() => {})
  }

  const loadBrowse = async (dir) => {
    setBrowseErr('')
    const url = dir ? `/api/browse?path=${encodeURIComponent(dir)}` : '/api/browse'
    const res = await fetch(url)
    const data = await res.json()
    if (!res.ok) {
      setBrowseErr(data.error || 'Cannot open folder')
      return
    }
    setBrowse(data)
  }

  const openFolderPicker = async () => {
    setFolderOpen(true)
    await loadBrowse(workspace.root || undefined)
  }

  const selectFolder = async () => {
    if (!browse?.path) return
    const res = await fetch('/api/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: browse.path })
    })
    const data = await res.json()
    if (!res.ok) {
      setBrowseErr(data.error || 'Could not open folder')
      return
    }
    setWebDirHandle(null)
    setVirtualFiles(null)
    setTabs([])
    setActive('')
    setDirty({})
    setSearch('')
    setHits([])
    setOpenDirs(new Set(['']))
    setFolderOpen(false)
    loadWorkspace()
  }

  const premiumToken = (model) => {
    if (!model || model.tier !== 'premium') return ''
    return model.provider === 'gemini' ? vault.gemini : vault.openai
  }

  const pickModel = (id) => {
    const next = allModels.find((m) => m.id === id) || allModels[0]
    setModelId(next.id)
    localStorage.setItem(MODEL_KEY, next.id)
    setPickerOpen(false)
    if (next.tier === 'premium' && !premiumToken(next)) {
      setVaultTab(next.provider === 'gemini' ? 'gemini' : 'openai')
      setVaultOpen(true)
    }
  }

  const openChat = useCallback(() => {
    setRightOpen(true)
    setPane('chat')
    setTimeout(() => {
      chatInputRef.current?.focus()
    }, 100)
  }, [])

  const handleQuickChip = (promptText) => {
    setDraft((prev) => (prev ? `${prev} ${promptText}` : promptText))
    setRightOpen(true)
    setPane('chat')
    setTimeout(() => {
      chatInputRef.current?.focus()
    }, 80)
  }

  const send = async (explicitText) => {
    const text = (typeof explicitText === 'string' ? explicitText : draft).trim()
    if (!text || busy) return
    const token = premiumToken(selected)
    if (selected.tier === 'premium' && !token) {
      setVaultTab(selected.provider === 'gemini' ? 'gemini' : 'openai')
      setVaultOpen(true)
      return
    }
    setDraft('')
    setCenterDraft('')
    if (mode !== 'chat') {
      setRightOpen(true)
      setPane('chat')
    }
    const context = [
      settings.customInstructions ? `User Custom Instructions: ${settings.customInstructions}` : '',
      current ? `Active File: ${current.path}\n\n${current.content.slice(0, 8000)}` : ''
    ].filter(Boolean).join('\n\n')
    setMessages((m) => [...m, { role: 'user', text }])
    setBusy(true)
    try {
      await executeChat({
        message: text,
        mode,
        context,
        model: selected,
        token,
        dirHandle: webDirHandle,
        proxyUrl: vault.proxyUrl,
        onEvent: (event, data) => {
          if (event === 'tool') {
            setMessages((m) => [...m, {
              role: 'tool',
              name: data.name,
              status: data.status,
              args: data.args,
              output: data.output
            }])
          } else if (event === 'message') {
            setMessages((m) => [...m, { role: 'ai', text: data.text || '' }])
          } else if (event === 'error') {
            setMessages((m) => [...m, { role: 'error', text: data.error || 'Request failed' }])
          }
        }
      })
      if (webDirHandle) {
        const treeData = await buildTreeFromHandle(webDirHandle)
        setTree(treeData)
      } else {
        loadWorkspace()
      }
      if (current) openFile(current.path)
    } catch (err) {
      setMessages((m) => [...m, { role: 'error', text: err.message }])
    } finally {
      setBusy(false)
    }
  }

  const linked = selected.tier === 'free' || Boolean(premiumToken(selected))

  return (
    <div className={`app mode-${mode}`}>
      <header className="topbar">
        <div className="mark">
          <div className="mark-orb" />
          <div>
            <h1>Aether</h1>
            <span>AI Studio</span>
          </div>
        </div>
        <div className="modes">
          <button className={mode === 'agent' ? 'on' : ''} onClick={() => { setMode('agent'); setPane('editor'); }}>Agent</button>
          <button className={mode === 'chat' ? 'on' : ''} onClick={() => { setMode('chat'); setPane('editor'); }}>Chat</button>
          <button className={mode === 'editor' ? 'on' : ''} onClick={() => { setMode('editor'); setPane('editor'); }}>Editor</button>
        </div>
        <div className="top-actions">
          <div className="picker-wrap">
            <button className="model-btn" onClick={() => setPickerOpen((v) => !v)}>
              <span className={`dot ${selected.tier}`} />
              <span className="model-name">{selected.label}</span>
              <em>{selected.tier}</em>
            </button>
            {pickerOpen && (
              <>
                <div className="picker-overlay" onClick={() => setPickerOpen(false)} />
                <div className="picker" onClick={(e) => e.stopPropagation()}>
                  <div className="picker-label">Free (No Token Required)</div>
                  {catalog.free.map((m) => (
                    <button key={m.id} className={m.id === selected.id ? 'on' : ''} onClick={() => pickModel(m.id)}>
                      <strong>{m.label}</strong>
                      <span>{m.blurb}</span>
                    </button>
                  ))}
                  <div className="picker-section-head">
                    <span className="picker-label">Google Gemini</span>
                    <button
                      type="button"
                      className="picker-info-tag"
                      title="How to get free Gemini API key"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPickerOpen(false)
                        openTokenHelper('gemini')
                      }}
                    >
                      <span className="info-i">ℹ</span>
                      <span>How to get key</span>
                    </button>
                  </div>
                  {catalog.premium.filter((m) => m.provider === 'gemini').map((m) => (
                    <div key={m.id} className={`picker-row ${m.id === selected.id ? 'on' : ''}`}>
                      <button
                        type="button"
                        className="picker-model-btn"
                        onClick={() => pickModel(m.id)}
                      >
                        <strong>{m.label}</strong>
                        <span>{m.blurb}{vault.gemini ? ' · ready' : ' · token required'}</span>
                      </button>
                      <button
                        type="button"
                        className="picker-row-info-btn"
                        title="View step-by-step instructions to get Gemini token"
                        onClick={(e) => {
                          e.stopPropagation()
                          setPickerOpen(false)
                          openTokenHelper('gemini')
                        }}
                      >
                        ℹ
                      </button>
                    </div>
                  ))}

                  <div className="picker-section-head">
                    <span className="picker-label">ChatGPT / OpenAI</span>
                    <button
                      type="button"
                      className="picker-info-tag"
                      title="How to get OpenAI API key"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPickerOpen(false)
                        openTokenHelper('openai')
                      }}
                    >
                      <span className="info-i">ℹ</span>
                      <span>How to get key</span>
                    </button>
                  </div>
                  {catalog.premium.filter((m) => m.provider === 'openai').map((m) => (
                    <div key={m.id} className={`picker-row ${m.id === selected.id ? 'on' : ''}`}>
                      <button
                        type="button"
                        className="picker-model-btn"
                        onClick={() => pickModel(m.id)}
                      >
                        <strong>{m.label}</strong>
                        <span>{m.blurb}{vault.openai ? ' · ready' : ' · token required'}</span>
                      </button>
                      <button
                        type="button"
                        className="picker-row-info-btn"
                        title="View step-by-step instructions to get OpenAI token"
                        onClick={(e) => {
                          e.stopPropagation()
                          setPickerOpen(false)
                          openTokenHelper('openai')
                        }}
                      >
                        ℹ
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <span className="chip">{linked ? 'ready' : 'needs token'}</span>
          <button
            className={`${leftOpen ? 'ghost' : 'primary'} panel-toggle-btn ${leftOpen ? 'on' : ''}`}
            onClick={() => setLeftOpen((v) => !v)}
            title={leftOpen ? "Hide File Tree (Ctrl+B)" : "Open File Tree (Ctrl+B)"}
          >
            <span className="panel-ico">{leftOpen ? '◧' : '📂'}</span>
            <span className="panel-btn-label">{leftOpen ? 'Files' : 'Open Files'}</span>
          </button>
          <button
            className={`${rightOpen ? 'ghost' : 'primary'} panel-toggle-btn ${rightOpen ? 'on' : ''}`}
            onClick={() => setRightOpen((v) => !v)}
            title={rightOpen ? "Hide AI Chat (Ctrl+J)" : "Open AI Chat (Ctrl+J)"}
          >
            <span className="panel-ico">{rightOpen ? '◨' : '💬'}</span>
            <span className="panel-btn-label">{rightOpen ? 'Chat' : 'Open Chat'}</span>
          </button>
          <button className="ghost pane-btn" onClick={() => setPane(pane === 'chat' ? 'editor' : 'chat')}>
            {pane === 'chat' ? 'Work' : 'Chat'}
          </button>
          <button
            className="ghost user-pill"
            onClick={() => { setNameDraft(userName); setWelcomeModalOpen(true) }}
            title="Personalize your name"
          >
            <span className="user-pill-sparkle">✦</span>
            <span>{userName ? `Hi, ${userName}` : 'Set Name'}</span>
          </button>
          <button className="ghost tokens-btn" onClick={() => setVaultOpen(true)}>Tokens</button>
          <button
            className="ghost settings-btn"
            onClick={() => setSettingsOpen(true)}
            title="Studio Settings (Ctrl+,)"
          >
            ⚙️ Settings
          </button>
          <button
            className={`ghost history-btn ${historyOpen ? 'on' : ''}`}
            onClick={() => setHistoryOpen(true)}
            title="Task History & Past Sessions"
          >
            <span className="history-btn-icon">📜</span>
            <span className="history-btn-text">History</span>
            {taskHistory.length > 0 && <span className="history-badge-count">{taskHistory.length}</span>}
          </button>
          <button className="ghost app-btn" onClick={() => setAppModalOpen(true)} title="Use as app on Windows, Mac & Phone">
            <span className="app-dot" />
            {installed ? 'App Active' : 'Get App'}
          </button>
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(true)}
            title="Menu & Settings"
            aria-label="Open Menu"
          >
            ☰
          </button>
        </div>
      </header>

      <input
        type="file"
        ref={fileInputRef}
        webkitdirectory="true"
        directory="true"
        style={{ display: 'none' }}
        onChange={handleVirtualInput}
      />

      <div
        className={`shell pane-${pane} mode-${mode} ${leftOpen ? '' : 'hide-left'} ${rightOpen ? '' : 'hide-right'} ${isResizing ? 'resizing' : ''}`}
        style={{
          '--left-w': `${leftWidth}px`,
          '--right-w': `${rightWidth}px`
        }}
      >
        {!leftOpen && (
          <button
            className="edge-reopen-tab left"
            onClick={() => setLeftOpen(true)}
            title="Open Files Sidebar (Ctrl+B)"
          >
            <span>▶ 📂 Files</span>
          </button>
        )}
        {!rightOpen && (
          <button
            className="edge-reopen-tab right"
            onClick={openChat}
            title="Open AI Chat (Ctrl+J)"
          >
            <span>💬 Chat ◀</span>
          </button>
        )}
        <aside className="side">
          <div className="side-head">
            {workspace.root ? (
              <>
                <span title={workspace.root}>{workspace.name}</span>
                <div className="side-head-actions">
                  <button className="ghost tiny" onClick={openLocalFolder} title="Change folder">Open</button>
                  <button className="ghost tiny" onClick={closeProject} title="Close project">✕</button>
                  <button className="ghost tiny" onClick={() => setLeftOpen(false)} title="Hide Sidebar (Ctrl+B)">◀</button>
                </div>
              </>
            ) : (
              <>
                <span>No Project</span>
                <div className="side-head-actions">
                  <button className="primary tiny" onClick={openLocalFolder}>Open</button>
                  <button className="ghost tiny" onClick={() => setLeftOpen(false)} title="Hide Sidebar (Ctrl+B)">◀</button>
                </div>
              </>
            )}
          </div>
          <div className="search-box">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={workspace.root ? "Search files..." : "Open project to search"}
              disabled={!workspace.root}
            />
          </div>
          {search.trim().length >= 2 ? (
            <div className="hits">
              {hits.map((h, i) => (
                <div key={`${h.path}:${h.line}:${i}`} className="hit" onClick={() => openFile(h.path)}>
                  <div className="p">{h.path}:{h.line}</div>
                  <div className="l">{h.preview}</div>
                </div>
              ))}
              {!hits.length && <div className="empty"><p>No matches</p></div>}
            </div>
          ) : (
            <div className="tree">
              {workspace.root && tree ? (
                <TreeNode
                  node={tree}
                  depth={0}
                  active={active}
                  onOpen={openFile}
                  openDirs={openDirs}
                  toggleDir={toggleDir}
                />
              ) : !workspace.root ? (
                <div className="no-project-box">
                  <p>No project folder opened.<br/>Open your local project to work on it.</p>
                  <button className="primary" onClick={openLocalFolder}>📂 Open Local Folder</button>
                  <button className="ghost tiny" onClick={openFolderPicker}>Server Browser</button>
                </div>
              ) : (
                <div className="empty"><p>Loading tree</p></div>
              )}
            </div>
          )}
          {leftOpen && (
            <div
              className={`resizer-handle left ${isResizing === 'left' ? 'active' : ''}`}
              onMouseDown={startResizeLeft}
              onTouchStart={handleTouchLeft}
              onDoubleClick={() => {
                setLeftWidth(260)
                try { localStorage.setItem('aether.left_width', '260') } catch {}
              }}
              title="Drag to resize file tree (Double-click to reset)"
            />
          )}
        </aside>

        <main className="stage">
          {mode === 'chat' ? (
            <div className="chat-mode-shell">
              <div className="gemini-aura-container" aria-hidden="true">
                <div className="aura-glow aura-glow-outer" />
                <div className="aura-glow aura-glow-core" />
                <div className="aura-sparkle sparkle-1">✦</div>
                <div className="aura-sparkle sparkle-2">✦</div>
              </div>

              <div className="chat-mode-topbar">
                <div className="chat-mode-title-info">
                  <button
                    type="button"
                    className="chat-new-btn"
                    onClick={() => startNewChat(false)}
                    title="Start fresh conversation"
                  >
                    <span>+</span>
                    <span className="chat-btn-text">New Chat</span>
                  </button>

                  <button
                    type="button"
                    className={`temp-chat-toggle-btn ${isTempChat ? 'active' : ''}`}
                    onClick={toggleTempChat}
                    title={isTempChat ? "Temporary chat is ON (Messages are not saved to history)" : "Start a temporary chat (Won't be saved in history)"}
                  >
                    <span>{isTempChat ? '🕶️' : '🔒'}</span>
                    <span className="temp-btn-text">{isTempChat ? 'Temp Chat ON' : 'Temporary Chat'}</span>
                    {isTempChat && <span className="temp-dot" />}
                  </button>

                  <div className="chat-active-model-chip">
                    <span className={`dot ${selected.tier}`} />
                    <span>{selected.label}</span>
                  </div>
                </div>

                <div className="chat-mode-actions">
                  <button
                    type="button"
                    className="ghost tiny cm-action-btn cm-history-btn"
                    onClick={() => setHistoryOpen(true)}
                    title="Open Task & Chat History"
                  >
                    <span>📜</span>
                    <span className="cm-btn-text">History</span>
                  </button>
                  <button
                    type="button"
                    className="ghost tiny cm-action-btn cm-export-btn"
                    onClick={() => exportChatSession('markdown')}
                    title="Export conversation as Markdown"
                    disabled={!messages.length}
                  >
                    <span>📥</span>
                    <span className="cm-btn-text">.md</span>
                  </button>
                  <button
                    type="button"
                    className="ghost tiny cm-action-btn cm-export-json-btn"
                    onClick={() => exportChatSession('json')}
                    title="Export conversation as JSON"
                    disabled={!messages.length}
                  >
                    <span>📥</span>
                    <span className="cm-btn-text">.json</span>
                  </button>
                  <button
                    type="button"
                    className="ghost tiny cm-action-btn cm-settings-btn"
                    onClick={() => setSettingsOpen(true)}
                    title="Chat & Model Settings"
                  >
                    <span>⚙️</span>
                    <span className="cm-btn-text">Settings</span>
                  </button>
                </div>
              </div>

              <div className="chat-mode-feed-wrap" ref={feedRef}>
                {isTempChat && (
                  <div className="temp-chat-banner">
                    <div className="temp-banner-info">
                      <span>🕶️</span>
                      <div>
                        <strong>Temporary Chat</strong> — Messages in this session will not be saved to task history.
                      </div>
                    </div>
                    <div className="temp-banner-actions">
                      <button
                        type="button"
                        className="temp-exit-btn"
                        onClick={() => setIsTempChat(false)}
                        title="Turn off Temporary Chat"
                      >
                        Save Future Chats
                      </button>
                    </div>
                  </div>
                )}
                {!messages.length ? (
                  <div className="chat-mode-greeting">
                    <div className="chat-greeting-sparkle">✨</div>
                    <h1 className="chat-greeting-h1">
                      {userName ? `Hello, ${userName}` : 'Hello, Creator'}
                    </h1>
                    <p className="chat-greeting-sub">How can Aether help you today?</p>

                    <div className="chat-starter-grid">
                      <button
                        type="button"
                        className="chat-starter-card"
                        onClick={() => send("Brainstorm modern product ideas and architecture patterns for a high-performance web app")}
                      >
                        <div className="chat-card-top">
                          <span>💡</span>
                          <span>Brainstorm Ideas</span>
                        </div>
                        <span className="chat-card-sub">Generate novel concepts, features &amp; architectural plans</span>
                      </button>

                      <button
                        type="button"
                        className="chat-starter-card"
                        onClick={() => send("Write a modern, responsive React component with smooth CSS animations and clean state management")}
                      >
                        <div className="chat-card-top">
                          <span>💻</span>
                          <span>Write Clean Code</span>
                        </div>
                        <span className="chat-card-sub">Generate production-ready components, styles &amp; algorithms</span>
                      </button>

                      <button
                        type="button"
                        className="chat-starter-card"
                        onClick={() => send("Find potential bugs, edge cases, and performance bottlenecks in code")}
                      >
                        <div className="chat-card-top">
                          <span>🔍</span>
                          <span>Debug &amp; Optimize</span>
                        </div>
                        <span className="chat-card-sub">Detect edge cases, memory leaks &amp; security vulnerabilities</span>
                      </button>

                      <button
                        type="button"
                        className="chat-starter-card"
                        onClick={() => send("Explain how modern web frameworks handle state hydration and reactivity")}
                      >
                        <div className="chat-card-top">
                          <span>⚡</span>
                          <span>Explain Concepts</span>
                        </div>
                        <span className="chat-card-sub">Break down complex technologies with clear illustrations</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="chat-mode-thread">
                    {messages.map((m, i) => {
                      if (m.role === 'tool') {
                        return (
                          <div className="tool" key={i}>
                            <b>{m.name}</b> {m.status}
                            {m.output ? `\n${String(m.output).slice(0, 500)}` : ''}
                          </div>
                        )
                      }

                      if (m.role === 'error') {
                        return (
                          <div className="bubble err" key={i}>
                            <div className="err-title">
                              <span>⚠️</span>
                              <span>AI Service Notice</span>
                            </div>
                            <div className="err-msg">{m.text}</div>
                            <div className="err-actions">
                              <button
                                type="button"
                                className="err-btn primary-err"
                                onClick={() => {
                                  const lastUser = [...messages.slice(0, i + 1)].reverse().find((msg) => msg.role === 'user')
                                  if (lastUser?.text) {
                                    send(lastUser.text)
                                  } else {
                                    send(draft || 'Hello')
                                  }
                                }}
                              >
                                🔄 Retry Prompt
                              </button>
                              <button
                                type="button"
                                className="err-btn"
                                onClick={() => {
                                  const errSnippet = `[Aether AI Error]\nModel: ${selected.label}\nDetails: ${m.text}`
                                  navigator.clipboard.writeText(errSnippet).catch(() => {})
                                  setCopiedMsgIdx(i)
                                  setTimeout(() => setCopiedMsgIdx(null), 2000)
                                }}
                              >
                                {copiedMsgIdx === i ? '✓ Copied' : '📋 Copy Error'}
                              </button>
                              <button
                                type="button"
                                className="err-btn"
                                onClick={() => exportErrorLog(m.text, i, 'markdown')}
                              >
                                💾 Export .md
                              </button>
                              <button
                                type="button"
                                className="err-btn"
                                onClick={() => exportErrorLog(m.text, i, 'json')}
                              >
                                📄 Export .json
                              </button>
                              {selected.tier !== 'free' && (
                                <button
                                  type="button"
                                  className="err-btn"
                                  onClick={() => {
                                    pickModel('aether-spark')
                                    const lastUser = [...messages.slice(0, i + 1)].reverse().find((msg) => msg.role === 'user')
                                    if (lastUser?.text) {
                                      setTimeout(() => send(lastUser.text), 100)
                                    }
                                  }}
                                >
                                  ⚡ Use Free Model
                                </button>
                              )}
                              <button
                                type="button"
                                className="err-btn"
                                onClick={() => setSettingsOpen(true)}
                              >
                                ⚙️ Settings
                              </button>
                            </div>
                          </div>
                        )
                      }

                      if (m.role === 'user') {
                        return (
                          <div className="cm-row-user" key={i}>
                            <div className="cm-user-bubble">
                              {m.text}
                            </div>
                          </div>
                        )
                      }

                      return (
                        <div className="cm-row-ai" key={i}>
                          <div className="cm-ai-avatar">✨</div>
                          <div className="cm-ai-body">
                            <div className="cm-ai-model-tag">{selected.label}</div>
                            <div className="cm-ai-content">
                              <MarkdownViewer content={m.text} />
                            </div>
                            {!busy && (
                              <div className="gemini-resp-toolbar" style={{ marginTop: 10 }}>
                                <button
                                  type="button"
                                  className={`resp-icon-btn ${msgFeedback[i] === 'up' ? 'active' : ''}`}
                                  title="Good response"
                                  onClick={() => setMsgFeedback((prev) => ({ ...prev, [i]: prev[i] === 'up' ? null : 'up' }))}
                                >
                                  👍
                                </button>
                                <button
                                  type="button"
                                  className={`resp-icon-btn ${msgFeedback[i] === 'down' ? 'active' : ''}`}
                                  title="Bad response"
                                  onClick={() => setMsgFeedback((prev) => ({ ...prev, [i]: prev[i] === 'down' ? null : 'down' }))}
                                >
                                  👎
                                </button>
                                <button
                                  type="button"
                                  className="resp-icon-btn"
                                  title="Regenerate response"
                                  onClick={() => {
                                    const prevUser = [...messages.slice(0, i)].reverse().find((msg) => msg.role === 'user')
                                    if (prevUser?.text) {
                                      setMessages((prev) => prev.slice(0, i))
                                      send(prevUser.text)
                                    }
                                  }}
                                >
                                  🔄
                                </button>
                                <button
                                  type="button"
                                  className="resp-icon-btn"
                                  title={copiedMsgIdx === i ? 'Copied!' : 'Copy response'}
                                  onClick={() => {
                                    navigator.clipboard.writeText(m.text).catch(() => {})
                                    setCopiedMsgIdx(i)
                                    setTimeout(() => setCopiedMsgIdx(null), 2000)
                                  }}
                                >
                                  {copiedMsgIdx === i ? '✓' : '📋'}
                                </button>
                                <button
                                  type="button"
                                  className="resp-icon-btn"
                                  title="Export this response as Markdown"
                                  onClick={() => {
                                    const blob = new Blob([m.text], { type: 'text/markdown' })
                                    const url = URL.createObjectURL(blob)
                                    const a = document.createElement('a')
                                    a.href = url
                                    a.download = `response-${i + 1}.md`
                                    document.body.appendChild(a)
                                    a.click()
                                    document.body.removeChild(a)
                                    URL.revokeObjectURL(url)
                                  }}
                                >
                                  💾
                                </button>
                                <button
                                  type="button"
                                  className="resp-icon-btn"
                                  title="Read aloud"
                                  onClick={() => handleListen(m.text, i)}
                                >
                                  {speakingIdx === i ? '⏹️' : '🔊'}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Chat Mode Bottom Input Capsule */}
              <div className="chat-mode-bottom-bar">
                <form
                  className="chat-mode-input-capsule"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (draft.trim() && !busy) {
                      send(draft.trim())
                    }
                  }}
                >
                  <textarea
                    ref={chatInputRef}
                    className="cm-textarea"
                    rows={1}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        if (draft.trim() && !busy) {
                          send(draft.trim())
                        }
                      }
                    }}
                    placeholder={busy ? "AI is generating..." : "Message Gemini or GPT..."}
                    disabled={busy}
                  />

                  <div className="cm-actions-right">
                    <button
                      type="button"
                      className={`resp-icon-btn ${listening ? 'listening' : ''}`}
                      onClick={() => toggleListening('draft')}
                      title={listening ? "Listening... click to stop" : "Voice input"}
                    >
                      🎙️
                    </button>

                    <div className="capsule-model-wrap">
                      <button
                        type="button"
                        className="capsule-model-pill"
                        onClick={() => setPickerOpen((v) => !v)}
                        title="Select AI Model"
                      >
                        <span className="pill-name">{modelShortName}</span>
                        <span className="pill-arrow">⌵</span>
                      </button>
                    </div>

                    <button
                      type="submit"
                      className="cm-send-btn"
                      disabled={!draft.trim() || busy}
                      title="Send prompt (Enter)"
                    >
                      {busy ? '⏳' : '↑'}
                    </button>
                  </div>
                </form>
                <div className="chat-mode-disclaimer">
                  Aether AI can make mistakes. Verify important code and data.
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="stage-head">
                {!leftOpen && (
                  <button
                    className="primary tiny restore-panel-btn"
                    onClick={() => setLeftOpen(true)}
                    title="Show Files Sidebar (Ctrl+B)"
                  >
                    📂 Open Files (Ctrl+B)
                  </button>
                )}
                <div className="tabs">
                  {tabs.map((t) => (
                    <button
                      key={t.path}
                      className={`tab ${t.path === active ? 'on' : ''}`}
                      onClick={() => setActive(t.path)}
                    >
                      {t.path.split('/').pop()}{dirty[t.path] ? ' *' : ''}
                    </button>
                  ))}
                </div>
                {current && (current.path.toLowerCase().endsWith('.md') || current.path.toLowerCase().endsWith('.markdown')) && (
                  <div className="md-view-mode-pill">
                    <button
                      type="button"
                      className={`view-pill-btn ${mdMode === 'edit' ? 'active' : ''}`}
                      onClick={() => setMdMode('edit')}
                      title="Edit Markdown source"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      type="button"
                      className={`view-pill-btn ${mdMode === 'reader' ? 'active' : ''}`}
                      onClick={() => setMdMode('reader')}
                      title="Rendered Markdown Reader"
                    >
                      📖 Reader
                    </button>
                    <button
                      type="button"
                      className={`view-pill-btn ${mdMode === 'split' ? 'active' : ''}`}
                      onClick={() => setMdMode('split')}
                      title="Side-by-side Split View"
                    >
                      ◫ Split
                    </button>
                  </div>
                )}
                {!rightOpen && (
                  <button
                    className="primary tiny restore-panel-btn"
                    onClick={openChat}
                    title="Show AI Chat (Ctrl+J)"
                  >
                    💬 Open Chat (Ctrl+J)
                  </button>
                )}
                {current && (
                  <button
                    className="ghost tiny close-tab"
                    onClick={() => {
                      const closing = current.path
                      setTabs((prev) => {
                        const rest = prev.filter((t) => t.path !== closing)
                        setActive(rest[rest.length - 1]?.path || '')
                        return rest
                      })
                    }}
                  >Close</button>
                )}
              </div>
              {current ? (
                <div className="editor-wrap">
                  {(current.path.toLowerCase().endsWith('.md') || current.path.toLowerCase().endsWith('.markdown')) && mdMode === 'reader' ? (
                    <div className="editor-md-reader">
                      <MarkdownViewer content={current.content} />
                    </div>
                  ) : (current.path.toLowerCase().endsWith('.md') || current.path.toLowerCase().endsWith('.markdown')) && mdMode === 'split' ? (
                    <div className="editor-split-wrap">
                      <textarea
                        className="editor editor-split-left"
                        style={{
                          fontSize: `${settings.editorFontSize || 13}px`,
                          whiteSpace: settings.editorWordWrap ? 'pre-wrap' : 'pre'
                        }}
                        value={current.content}
                        onChange={(e) => updateContent(e.target.value)}
                        spellCheck={false}
                      />
                      <div className="editor-split-divider" />
                      <div className="editor-md-reader editor-split-right">
                        <MarkdownViewer content={current.content} />
                      </div>
                    </div>
                  ) : (
                    <textarea
                      className="editor"
                      style={{
                        fontSize: `${settings.editorFontSize || 13}px`,
                        whiteSpace: settings.editorWordWrap ? 'pre-wrap' : 'pre'
                      }}
                      value={current.content}
                      onChange={(e) => updateContent(e.target.value)}
                      spellCheck={false}
                    />
                  )}
                  <div className="editor-bar">
                    <span className="path">{current.path}</span>
                    <div className="editor-bar-actions">
                      <button
                        className="ghost tiny ask-ai-file-btn"
                        onClick={() => {
                          setDraft(`Analyze and explain ${current.path}: `)
                          openChat()
                        }}
                        title="Ask AI about this file"
                      >
                        💬 Ask AI
                      </button>
                      <button className="primary" onClick={saveFile}>Save</button>
                    </div>
                  </div>
                </div>
              ) : mode === 'editor' ? (
                <div className="editor-workspace-empty">
                  <div className="editor-empty-badge">
                    <span>✦</span>
                    <span>Editor Workspace</span>
                  </div>
                  <MiniRobot mode="editor" />
                  <h2 className="editor-empty-title">Code &amp; Markdown Studio</h2>
                  <p className="editor-empty-desc">
                    Open a file from the explorer, select a local project folder, or create a fresh markdown document to start writing.
                  </p>
                  <div className="editor-empty-actions">
                    <button
                      type="button"
                      className="editor-action-card primary-action"
                      onClick={() => createNewFile('notes.md')}
                    >
                      <span>📄</span>
                      <strong>New Markdown File</strong>
                    </button>
                    <button
                      type="button"
                      className="editor-action-card"
                      onClick={openLocalFolder}
                    >
                      <span>📂</span>
                      <strong>Open Local Project</strong>
                    </button>
                    <button
                      type="button"
                      className="editor-action-card"
                      onClick={() => setMode('chat')}
                    >
                      <span>💬</span>
                      <strong>Open AI Chat Mode</strong>
                    </button>
                  </div>
                  <div className="editor-shortcuts-guide">
                    <span className="shortcut-hint"><kbd>Ctrl</kbd>+<kbd>B</kbd> Toggle Files</span>
                    <span className="shortcut-hint"><kbd>Ctrl</kbd>+<kbd>J</kbd> Toggle Chat</span>
                    <span className="shortcut-hint"><kbd>Ctrl</kbd>+<kbd>,</kbd> Settings</span>
                  </div>
                </div>
              ) : (
                <div className="gemini-landing">
              {/* Cosmic Blue Atmospheric Aura Background */}
              <div className="gemini-aura-container" aria-hidden="true">
                <div className="aura-glow aura-glow-outer" />
                <div className="aura-glow aura-glow-core" />
                <div className="aura-glow aura-glow-beam" />
                <div className="aura-glow aura-glow-cyan" />
                <div className="aura-sparkle sparkle-1">✦</div>
                <div className="aura-sparkle sparkle-2">✦</div>
                <div className="aura-sparkle sparkle-3">✦</div>
              </div>

              <div className="gemini-landing-content">
                <div className="gemini-badge-row">
                  <span className="gemini-ai-pill">
                    <span className="sparkle-icon">✨</span>
                    <span>Aether AI Studio</span>
                  </span>
                </div>

                <MiniRobot mode={mode} />

                <h2 className="gemini-heading">
                  {workspace.root
                    ? `What can I help with in ${workspace.name}?`
                    : formattedName
                    ? `What can I help with, ${formattedName}?`
                    : 'What can I help with today?'}
                </h2>

                {/* Gemini-style Center Prompt Pill Capsule */}
                <form
                  className="gemini-capsule"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (centerDraft.trim()) {
                      send(centerDraft.trim())
                    }
                  }}
                >
                  <div className="capsule-plus-wrap">
                    <button
                      type="button"
                      className="capsule-plus-btn"
                      onClick={() => setPlusMenuOpen((v) => !v)}
                      title="Attach or open project folder"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>
                    {plusMenuOpen && (
                      <>
                        <div className="picker-overlay" onClick={() => setPlusMenuOpen(false)} />
                        <div className="capsule-menu" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => {
                              setPlusMenuOpen(false)
                              openLocalFolder()
                            }}
                          >
                            <span className="menu-icon">📂</span>
                            <div className="menu-text">
                              <strong>Open Local Project</strong>
                              <small>Direct browser file access (Web FS)</small>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPlusMenuOpen(false)
                              openFolderPicker()
                            }}
                          >
                            <span className="menu-icon">🌐</span>
                            <div className="menu-text">
                              <strong>Browse Server Workspace</strong>
                              <small>Pick folder on host server</small>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPlusMenuOpen(false)
                              setNameDraft(userName)
                              setWelcomeModalOpen(true)
                            }}
                          >
                            <span className="menu-icon">👤</span>
                            <div className="menu-text">
                              <strong>Personalize Name</strong>
                              <small>{userName ? `Current: ${userName}` : 'Set your name'}</small>
                            </div>
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  <input
                    type="text"
                    className="capsule-input"
                    value={centerDraft}
                    onChange={(e) => setCenterDraft(e.target.value)}
                    placeholder={
                      workspace.root
                        ? `Ask about ${workspace.name} or describe what to build...`
                        : "Ask Aether or describe what you want to build..."
                    }
                    autoComplete="off"
                    spellCheck="false"
                  />

                  <div className="capsule-model-wrap">
                    <button
                      type="button"
                      className="capsule-model-pill"
                      onClick={() => setCapsulePickerOpen((v) => !v)}
                      title="Select AI Model"
                    >
                      <span className="pill-name">{modelShortName}</span>
                      <span className="pill-arrow">⌵</span>
                    </button>

                    {capsulePickerOpen && (
                      <>
                        <div className="picker-overlay" onClick={() => setCapsulePickerOpen(false)} />
                        <div className="capsule-picker-dropdown" onClick={(e) => e.stopPropagation()}>
                          <div className="picker-section-title">⚡ Free AI Models</div>
                          {catalog.free.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              className={`capsule-picker-item ${m.id === selected.id ? 'active' : ''}`}
                              onClick={() => {
                                pickModel(m.id)
                                setCapsulePickerOpen(false)
                              }}
                            >
                              <div className="picker-item-main">
                                <span className="item-label">{m.label}</span>
                                <span className="item-badge free">FREE</span>
                              </div>
                              <span className="item-blurb">{m.blurb}</span>
                            </button>
                          ))}

                          <div className="picker-section-title-row">
                            <span className="picker-section-title">✨ Google Gemini</span>
                            <button
                              type="button"
                              className="capsule-info-header-btn"
                              onClick={() => {
                                setCapsulePickerOpen(false)
                                openTokenHelper('gemini')
                              }}
                              title="How to get free Gemini key"
                            >
                              ℹ Get Key
                            </button>
                          </div>
                          {catalog.premium.filter((m) => m.provider === 'gemini').map((m) => (
                            <div key={m.id} className={`capsule-picker-row ${m.id === selected.id ? 'active' : ''}`}>
                              <button
                                type="button"
                                className="capsule-picker-item"
                                onClick={() => {
                                  pickModel(m.id)
                                  setCapsulePickerOpen(false)
                                }}
                              >
                                <div className="picker-item-main">
                                  <span className="item-label">{m.label}</span>
                                  <span className={`item-badge ${vault.gemini ? 'ready' : 'token'}`}>
                                    {vault.gemini ? 'READY' : 'KEY REQ'}
                                  </span>
                                </div>
                                <span className="item-blurb">{m.blurb}</span>
                              </button>
                              <button
                                type="button"
                                className="capsule-row-info-btn"
                                title="View step-by-step instructions to get Gemini token"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setCapsulePickerOpen(false)
                                  openTokenHelper('gemini')
                                }}
                              >
                                ℹ
                              </button>
                            </div>
                          ))}

                          <div className="picker-section-title-row">
                            <span className="picker-section-title">🧠 ChatGPT / OpenAI</span>
                            <button
                              type="button"
                              className="capsule-info-header-btn"
                              onClick={() => {
                                setCapsulePickerOpen(false)
                                openTokenHelper('openai')
                              }}
                              title="How to get OpenAI key"
                            >
                              ℹ Get Key
                            </button>
                          </div>
                          {catalog.premium.filter((m) => m.provider === 'openai').map((m) => (
                            <div key={m.id} className={`capsule-picker-row ${m.id === selected.id ? 'active' : ''}`}>
                              <button
                                type="button"
                                className="capsule-picker-item"
                                onClick={() => {
                                  pickModel(m.id)
                                  setCapsulePickerOpen(false)
                                }}
                              >
                                <div className="picker-item-main">
                                  <span className="item-label">{m.label}</span>
                                  <span className={`item-badge ${vault.openai ? 'ready' : 'token'}`}>
                                    {vault.openai ? 'READY' : 'KEY REQ'}
                                  </span>
                                </div>
                                <span className="item-blurb">{m.blurb}</span>
                              </button>
                              <button
                                type="button"
                                className="capsule-row-info-btn"
                                title="View step-by-step instructions to get OpenAI token"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setCapsulePickerOpen(false)
                                  openTokenHelper('openai')
                                }}
                              >
                                ℹ
                              </button>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {centerDraft.trim() ? (
                    <button
                      type="submit"
                      className="capsule-send-btn"
                      title="Send message (Enter)"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="19" x2="12" y2="5" />
                        <polyline points="5 12 12 5 19 12" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={`capsule-mic-btn ${listening ? 'listening' : ''}`}
                      onClick={toggleListening}
                      title={listening ? "Listening... click to stop" : "Voice input"}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="22" />
                      </svg>
                    </button>
                  )}
                </form>

                {/* Modern Landing Controls: Bookmarks & System Info */}
                <div className="gemini-modern-controls">
                  {/* Bookmarks Popover Trigger */}
                  <div className="landing-popover-anchor">
                    <button
                      type="button"
                      className={`gemini-control-btn ${bookmarksOpen ? 'active' : ''}`}
                      onClick={() => {
                        setBookmarksOpen((v) => !v)
                        setInfoOpen(false)
                      }}
                      title="Quick Workspace Actions & Starter Prompts"
                    >
                      <span className="control-btn-icon">🔖</span>
                      <span className="control-btn-label">Bookmarks</span>
                      <span className="control-btn-badge">6</span>
                      <span className="control-btn-arrow">{bookmarksOpen ? '▲' : '▼'}</span>
                    </button>

                    {bookmarksOpen && (
                      <>
                        <div className="picker-overlay" onClick={() => setBookmarksOpen(false)} />
                        <div className="gemini-modern-popover bookmarks-popover" onClick={(e) => e.stopPropagation()}>
                          <div className="popover-top">
                            <div className="popover-title-row">
                              <span className="popover-icon">🔖</span>
                              <div>
                                <strong>Bookmarks &amp; Quick Actions</strong>
                                <p>Workspace tools and one-tap starter prompts</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="popover-x-btn"
                              onClick={() => setBookmarksOpen(false)}
                            >
                              ✕
                            </button>
                          </div>

                          <div className="popover-body">
                            <div className="popover-group-label">📂 Workspace Shortcuts</div>
                            <div className="popover-chips-row">
                              <button
                                type="button"
                                className="gemini-shortcut-chip main-action"
                                onClick={() => {
                                  setBookmarksOpen(false)
                                  openLocalFolder()
                                }}
                              >
                                <span className="chip-ico">📂</span>
                                <span>Open Local Project</span>
                              </button>
                              <button
                                type="button"
                                className="gemini-shortcut-chip main-action"
                                onClick={() => {
                                  setBookmarksOpen(false)
                                  openFolderPicker()
                                }}
                              >
                                <span className="chip-ico">🌐</span>
                                <span>Browse Workspace</span>
                              </button>
                            </div>

                            <div className="popover-group-label" style={{ marginTop: 14 }}>✨ Starter Prompts</div>
                            <div className="popover-chips-grid">
                              <button
                                type="button"
                                className="gemini-shortcut-chip prompt-chip"
                                onClick={() => {
                                  setBookmarksOpen(false)
                                  send("Build a modern, responsive web application with animated blue cosmic styling and interactive components")
                                }}
                              >
                                <span className="chip-ico">✨</span>
                                <span>Build modern web app</span>
                              </button>
                              <button
                                type="button"
                                className="gemini-shortcut-chip prompt-chip"
                                onClick={() => {
                                  setBookmarksOpen(false)
                                  send("Analyze and explain the architecture of this project")
                                }}
                              >
                                <span className="chip-ico">💡</span>
                                <span>Explain architecture</span>
                              </button>
                              <button
                                type="button"
                                className="gemini-shortcut-chip prompt-chip"
                                onClick={() => {
                                  setBookmarksOpen(false)
                                  send("Find potential bugs, edge cases, and performance bottlenecks")
                                }}
                              >
                                <span className="chip-ico">🐛</span>
                                <span>Find bugs</span>
                              </button>
                              <button
                                type="button"
                                className="gemini-shortcut-chip prompt-chip"
                                onClick={() => {
                                  setBookmarksOpen(false)
                                  send("Create a reusable React UI component with clean state and styles")
                                }}
                              >
                                <span className="chip-ico">⚡</span>
                                <span>Generate component</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Info Popover Trigger */}
                  <div className="landing-popover-anchor">
                    <button
                      type="button"
                      className={`gemini-control-btn ${infoOpen ? 'active' : ''}`}
                      onClick={() => {
                        setInfoOpen((v) => !v)
                        setBookmarksOpen(false)
                      }}
                      title="System Status & Engine Information"
                    >
                      <span className="control-btn-icon">ℹ️</span>
                      <span className="control-btn-label">Info</span>
                      <span className="control-live-dot" />
                      <span className="control-btn-arrow">{infoOpen ? '▲' : '▼'}</span>
                    </button>

                    {infoOpen && (
                      <>
                        <div className="picker-overlay" onClick={() => setInfoOpen(false)} />
                        <div className="gemini-modern-popover info-popover" onClick={(e) => e.stopPropagation()}>
                          <div className="popover-top">
                            <div className="popover-title-row">
                              <span className="popover-icon">ℹ️</span>
                              <div>
                                <strong>System &amp; Runtime Info</strong>
                                <p>Real-time environment &amp; workspace status</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="popover-x-btn"
                              onClick={() => setInfoOpen(false)}
                            >
                              ✕
                            </button>
                          </div>

                          <div className="popover-body">
                            <div className="info-pills-grid">
                              <div className="info-item">
                                <span className="info-item-label">Network Port</span>
                                <span className="g-pill info-pill">Port {networkInfo.port || window.location.port || '4576'}</span>
                              </div>
                              <div className="info-item">
                                <span className="info-item-label">File Storage</span>
                                <span className="g-pill info-pill">Direct Web File System</span>
                              </div>
                              <div className="info-item">
                                <span className="info-item-label">Intelligence</span>
                                <span className="g-pill info-pill">Multi-Model AI</span>
                              </div>
                              <div className="info-item">
                                <span className="info-item-label">Dependencies</span>
                                <span className="g-pill info-pill">Zero Local Dependencies</span>
                              </div>
                              <div className="info-item full-width">
                                <span className="info-item-label">User Profile</span>
                                <button
                                  type="button"
                                  className="g-pill user-link info-user-pill"
                                  onClick={() => {
                                    setInfoOpen(false)
                                    setNameDraft(userName)
                                    setWelcomeModalOpen(true)
                                  }}
                                  title="Click to customize your display name"
                                >
                                  👤 {userName ? `Hi, ${userName}` : 'Set Name'}
                                  <span className="pill-edit-hint">✎ Edit</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </main>

        <section className="chat">
          {rightOpen && (
            <div
              className={`resizer-handle right ${isResizing === 'right' ? 'active' : ''}`}
              onMouseDown={startResizeRight}
              onTouchStart={handleTouchRight}
              onDoubleClick={() => {
                setRightWidth(360)
                try { localStorage.setItem('aether.right_width', '360') } catch {}
              }}
              title="Drag to resize AI chat (Double-click to reset)"
            />
          )}
          <div className="chat-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{mode} thread</span>
              {isTempChat && <span className="history-mode-tag" style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#d8b4fe', padding: '1px 5px', fontSize: 10 }}>🕶️ Temp</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                type="button"
                className="ghost tiny"
                onClick={() => startNewChat(false)}
                title="Start a new chat thread"
                style={{ fontSize: 11, padding: '2px 7px' }}
              >
                + New
              </button>
              <button
                type="button"
                className={`ghost tiny ${isTempChat ? 'active' : ''}`}
                onClick={toggleTempChat}
                title={isTempChat ? "Temporary chat is ON (Not saved)" : "Start temporary chat (Not saved in history)"}
                style={{ fontSize: 11, padding: '2px 7px' }}
              >
                {isTempChat ? '🕶️ Temp' : '🔒 Temp'}
              </button>
              <button
                type="button"
                className="ghost tiny"
                onClick={() => setHistoryOpen(true)}
                title="Task History & Past Sessions"
                style={{ fontSize: 11, padding: '2px 7px' }}
              >
                📜
              </button>
              <button
                className="ghost tiny"
                onClick={() => setRightOpen(false)}
                title="Hide AI Chat (Ctrl+J)"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="feed" ref={feedRef}>
            {isTempChat && (
              <div className="temp-chat-banner" style={{ margin: '8px 12px 12px 12px', padding: '6px 10px', fontSize: 11 }}>
                <div className="temp-banner-info">
                  <span>🕶️</span>
                  <span><strong>Temp Chat:</strong> Not saved in history</span>
                </div>
                <button
                  type="button"
                  className="temp-exit-btn"
                  onClick={() => setIsTempChat(false)}
                  style={{ fontSize: 10, padding: '2px 6px' }}
                >
                  Save
                </button>
              </div>
            )}
            {!messages.length && (
              <div className="empty chat-empty-guide">
                <div className="chat-empty-icon">✨</div>
                <h4>How can Aether help?</h4>
                <p>Free AI is ready. Select a starter prompt below or ask anything about code.</p>
                <div className="chat-empty-presets">
                  <button
                    type="button"
                    className="chat-preset-btn"
                    onClick={() => {
                      setDraft('Can you explain what this project is and how it works?')
                      setTimeout(() => chatInputRef.current?.focus(), 50)
                    }}
                  >
                    📖 "Explain how this project works"
                  </button>
                  <button
                    type="button"
                    className="chat-preset-btn"
                    onClick={() => {
                      setDraft('Write a modern responsive HTML/CSS component with clean styling.')
                      setTimeout(() => chatInputRef.current?.focus(), 50)
                    }}
                  >
                    🎨 "Write a modern UI component"
                  </button>
                  <button
                    type="button"
                    className="chat-preset-btn"
                    onClick={() => {
                      setDraft('Write a robust JavaScript utility function with full error handling.')
                      setTimeout(() => chatInputRef.current?.focus(), 50)
                    }}
                  >
                    ⚡ "Write a clean JavaScript function"
                  </button>
                </div>
              </div>
            )}
            {messages.map((m, i) => {
              if (m.role === 'tool') {
                return (
                  <div className="tool" key={i}>
                    <b>{m.name}</b> {m.status}
                    {m.output ? `\n${String(m.output).slice(0, 500)}` : ''}
                  </div>
                )
              }
              if (m.role === 'error') {
                return (
                  <div className="bubble err" key={i}>
                    <div className="err-title">
                      <span>⚠️</span>
                      <span>AI Service Notice</span>
                    </div>
                    <div className="err-msg">{m.text}</div>
                    <div className="err-actions">
                      <button
                        type="button"
                        className="err-btn primary-err"
                        onClick={() => {
                          const lastUser = [...messages.slice(0, i + 1)].reverse().find((msg) => msg.role === 'user')
                          if (lastUser?.text) {
                            send(lastUser.text)
                          } else {
                            send(draft || 'Hello')
                          }
                        }}
                        title="Retry sending this prompt"
                      >
                        🔄 Retry
                      </button>
                      <button
                        type="button"
                        className="err-btn"
                        onClick={() => {
                          const errSnippet = `[Aether AI Error]\nModel: ${selected.label}\nDetails: ${m.text}`
                          navigator.clipboard.writeText(errSnippet).catch(() => {})
                          setCopiedMsgIdx(i)
                          setTimeout(() => setCopiedMsgIdx(null), 2000)
                        }}
                        title="Copy error details to clipboard"
                      >
                        {copiedMsgIdx === i ? '✓ Copied' : '📋 Copy Error'}
                      </button>
                      <button
                        type="button"
                        className="err-btn"
                        onClick={() => exportErrorLog(m.text, i, 'markdown')}
                        title="Export error diagnostic report as Markdown"
                      >
                        💾 Export .md
                      </button>
                      <button
                        type="button"
                        className="err-btn"
                        onClick={() => exportErrorLog(m.text, i, 'json')}
                        title="Export error log as JSON"
                      >
                        📄 Export .json
                      </button>
                      {selected.tier !== 'free' && (
                        <>
                          <button
                            type="button"
                            className="err-btn primary-err"
                            onClick={() => {
                              setVaultTab(selected.provider === 'gemini' ? 'gemini' : 'openai')
                              setVaultOpen(true)
                            }}
                            title={`Configure ${selected.provider === 'gemini' ? 'Gemini' : 'OpenAI'} API token`}
                          >
                            🔑 Configure {selected.provider === 'gemini' ? 'Gemini' : 'OpenAI'}
                          </button>
                          <button
                            type="button"
                            className="err-btn"
                            onClick={() => {
                              pickModel('aether-spark')
                              const lastUser = [...messages.slice(0, i + 1)].reverse().find((msg) => msg.role === 'user')
                              if (lastUser?.text) {
                                setTimeout(() => send(lastUser.text), 100)
                              }
                            }}
                            title="Switch to free Aether Spark model"
                          >
                            ⚡ Use Free Model
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="err-btn"
                        onClick={() => setSettingsOpen(true)}
                        title="Open Studio Settings"
                      >
                        ⚙️ Settings
                      </button>
                    </div>
                  </div>
                )
              }
              if (m.role === 'user') {
                return (
                  <div className="user-msg-row" key={i}>
                    <div className="bubble user">
                      <span className="user-msg-content">{m.text}</span>
                      {!busy && (
                        <button
                          type="button"
                          className="user-edit-btn"
                          title="Edit prompt"
                          onClick={() => {
                            setDraft(m.text)
                            setMessages((prev) => prev.slice(0, i))
                            setTimeout(() => chatInputRef.current?.focus(), 50)
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                )
              }

              return (
                <div className="ai-msg-block" key={i}>
                  <div className="bubble ai">
                    <MarkdownViewer content={m.text} />
                  </div>
                  {!busy && (
                    <div className="gemini-resp-toolbar">
                      <button
                        type="button"
                        className={`resp-icon-btn ${msgFeedback[i] === 'up' ? 'active' : ''}`}
                        title="Good response"
                        onClick={() => setMsgFeedback((prev) => ({ ...prev, [i]: prev[i] === 'up' ? null : 'up' }))}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={`resp-icon-btn ${msgFeedback[i] === 'down' ? 'active' : ''}`}
                        title="Bad response"
                        onClick={() => setMsgFeedback((prev) => ({ ...prev, [i]: prev[i] === 'down' ? null : 'down' }))}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="resp-icon-btn"
                        title="Regenerate response"
                        onClick={() => {
                          const prevUser = [...messages.slice(0, i)].reverse().find((msg) => msg.role === 'user')
                          if (prevUser?.text) {
                            setMessages((prev) => prev.slice(0, i))
                            send(prevUser.text)
                          }
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="23 4 23 10 17 10" />
                          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="resp-icon-btn"
                        title={copiedMsgIdx === i ? 'Copied!' : 'Copy response'}
                        onClick={() => {
                          navigator.clipboard.writeText(m.text).catch(() => {})
                          setCopiedMsgIdx(i)
                          setTimeout(() => setCopiedMsgIdx(null), 2000)
                        }}
                      >
                        {copiedMsgIdx === i ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        )}
                      </button>
                      <div className="resp-menu-wrap">
                        <button
                          type="button"
                          className={`resp-icon-btn ${msgMenuIdx === i ? 'active' : ''}`}
                          title="More options"
                          onClick={(e) => {
                            e.stopPropagation()
                            setMsgMenuIdx(msgMenuIdx === i ? null : i)
                          }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="12" r="2" />
                            <circle cx="19" cy="12" r="2" />
                            <circle cx="5" cy="12" r="2" />
                          </svg>
                        </button>
                        {msgMenuIdx === i && (
                          <div className="gemini-more-menu" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="gemini-menu-item"
                              onClick={() => {
                                // Branch in new chat from this reply!
                                setMessages((prev) => prev.slice(0, i + 1))
                                setDraft('')
                                setMsgMenuIdx(null)
                                setTimeout(() => chatInputRef.current?.focus(), 50)
                              }}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="6" y1="3" x2="6" y2="15" />
                                <circle cx="18" cy="6" r="3" />
                                <circle cx="6" cy="18" r="3" />
                                <path d="M18 9a9 9 0 0 1-9 9" />
                              </svg>
                              <span>Branch in new chat</span>
                            </button>

                            <button
                              type="button"
                              className="gemini-menu-item"
                              onClick={() => {
                                setMessages([])
                                setDraft('')
                                setMsgMenuIdx(null)
                                setTimeout(() => chatInputRef.current?.focus(), 50)
                              }}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                              </svg>
                              <span>Start fresh chat</span>
                            </button>

                            <button
                              type="button"
                              className="gemini-menu-item"
                              onClick={() => {
                                handleListen(m.text, i)
                                setMsgMenuIdx(null)
                              }}
                            >
                              {speakingIdx === i ? (
                                <>
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="6" y="6" width="12" height="12" />
                                  </svg>
                                  <span>Stop listening</span>
                                </>
                              ) : (
                                <>
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                                  </svg>
                                  <span>Listen</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              className="gemini-menu-item"
                              onClick={() => {
                                const blob = new Blob([m.text], { type: 'text/markdown' })
                                const url = URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.href = url
                                a.download = `response-${Date.now()}.md`
                                a.click()
                                URL.revokeObjectURL(url)
                                setMsgMenuIdx(null)
                              }}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                              </svg>
                              <span>Export to Markdown</span>
                            </button>

                            <button
                              type="button"
                              className="gemini-menu-item"
                              onClick={() => {
                                alert(`Model: ${selected.label} (${selected.id})\nCharacters: ${m.text.length}\nWords: ${m.text.trim().split(/\s+/).length}`)
                                setMsgMenuIdx(null)
                              }}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="16" x2="12" y2="12" />
                                <line x1="12" y1="8" x2="12.01" y2="8" />
                              </svg>
                              <span>See response details</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {busy && <div className="tool">thinking...</div>}
          </div>
          <div className="composer">
            <div className="quick-chips">
              <button type="button" className="quick-chip" onClick={() => handleQuickChip('Explain what this code does in detail')}>💡 Explain</button>
              <button type="button" className="quick-chip" onClick={() => handleQuickChip('Find any bugs or potential issues in this code')}>🐛 Find bugs</button>
              <button type="button" className="quick-chip" onClick={() => handleQuickChip('Optimize performance and readability')}>⚡ Optimize</button>
              <button type="button" className="quick-chip" onClick={() => handleQuickChip('Write comprehensive unit tests for this')}>🧪 Tests</button>
            </div>
            <textarea
              ref={chatInputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={mode === 'agent' ? 'Give Aether a workspace task...' : 'Ask about code, debug, or learn anything...'}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (e.metaKey || e.ctrlKey) {
                    e.preventDefault()
                    send()
                  } else if (!e.shiftKey && window.innerWidth > 860) {
                    e.preventDefault()
                    send()
                  }
                }
              }}
            />
            <div className="composer-row">
              <span className="hint">Enter to send (Shift+Enter for newline)</span>
              <button className="primary send-btn" onClick={send} disabled={busy || !draft.trim()}>
                {busy ? 'Thinking...' : 'Send ➔'}
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Mobile Bottom Navigation Dock */}
      <nav className="dock" aria-label="Mobile Navigation">
        <button
          className={`dock-btn ${pane === 'files' && mode !== 'chat' ? 'on' : ''}`}
          onClick={() => {
            if (mode === 'chat') setMode('editor')
            setPane('files')
          }}
          aria-label="Files"
        >
          <span className="dock-ico">📂</span>
          <span className="dock-lbl">Files</span>
          {workspace.root && <span className="dock-dot" />}
        </button>
        <button
          className={`dock-btn ${pane === 'editor' && mode !== 'chat' ? 'on' : ''}`}
          onClick={() => {
            if (mode === 'chat') setMode('editor')
            setPane('editor')
          }}
          aria-label="Editor"
        >
          <span className="dock-ico">📝</span>
          <span className="dock-lbl">Editor</span>
          {tabs.length > 0 && <span className="dock-badge">{tabs.length}</span>}
        </button>
        <button
          className={`dock-btn ${mode === 'chat' || pane === 'chat' ? 'on' : ''}`}
          onClick={() => {
            if (mode === 'chat') {
              setPane('editor')
            } else {
              setMode('chat')
              setPane('editor')
            }
          }}
          aria-label="AI Chat"
        >
          <span className="dock-ico">✨</span>
          <span className="dock-lbl">AI Chat</span>
          {busy && <span className="dock-pulse" />}
        </button>
      </nav>

      {vaultOpen && (
        <div className="modal-back" onClick={() => setVaultOpen(false)}>
          <div className="modal vault" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="settings-close-btn vault-close-btn"
              onClick={() => setVaultOpen(false)}
              title="Close"
              style={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }}
            >
              ✕
            </button>
            <div className="sheet-handle" />
            <div className="vault-hero">
              <div className="vault-orb" />
              <div>
                <h3>Premium tokens</h3>
                <p>Free models need nothing. Drop a ChatGPT or Gemini key only if you pick a premium model.</p>
              </div>
            </div>
            <div className="seg">
              <button className={vaultTab === 'openai' ? 'on' : ''} onClick={() => setVaultTab('openai')}>
                OpenAI / ChatGPT {vault.openai ? '✓' : ''}
              </button>
              <button className={vaultTab === 'gemini' ? 'on' : ''} onClick={() => setVaultTab('gemini')}>
                Google Gemini {vault.gemini ? '✓' : ''}
              </button>
            </div>
            {vaultTab === 'openai' ? (
              <div className="field">
                <div className="field-label-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label>OpenAI API Key</label>
                    <span className={`vault-status-pill ${vault.openai ? 'configured' : 'empty'}`}>
                      {vault.openai ? 'Configured ✓' : 'Not configured'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="vault-helper-btn"
                    onClick={() => openTokenHelper('openai')}
                    title="View step-by-step instructions to get an OpenAI key"
                  >
                    <span className="info-i">ℹ</span>
                    <span>How to get key</span>
                  </button>
                </div>
                <input
                  type="password"
                  value={vault.openai}
                  onChange={(e) => persistVault({ ...vault, openai: e.target.value })}
                  placeholder="sk-proj-..."
                  autoComplete="off"
                  spellCheck="false"
                />
                <span className="hint">{vault.openai ? 'OpenAI key configured securely · unlocks GPT-4o mini, GPT-4o, and o3-mini' : 'Never logged or exposed · unlocks GPT-4o and o3-mini'}</span>
              </div>
            ) : (
              <div className="field">
                <div className="field-label-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label>Gemini API Key</label>
                    <span className={`vault-status-pill ${vault.gemini ? 'configured' : 'empty'}`}>
                      {vault.gemini ? 'Configured ✓' : 'Not configured'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="vault-helper-btn"
                    onClick={() => openTokenHelper('gemini')}
                    title="View step-by-step instructions to get a Gemini key"
                  >
                    <span className="info-i">ℹ</span>
                    <span>How to get key</span>
                  </button>
                </div>
                <input
                  type="password"
                  value={vault.gemini}
                  onChange={(e) => persistVault({ ...vault, gemini: e.target.value })}
                  placeholder="AIzaSy..."
                  autoComplete="off"
                  spellCheck="false"
                />
                <span className="hint">{vault.gemini ? 'Gemini key configured securely · unlocks Gemini 3.5, 3.6 Flash, and 3.1 Pro' : '100% free with no credit card required · unlocks Gemini Flash and Pro'}</span>
              </div>
            )}

            {/* Quick Helper Banner */}
            <div className="vault-quick-helper">
              <div className="quick-helper-text">
                <span className="helper-badge">{vaultTab === 'gemini' ? '100% FREE' : 'DIRECT KEY'}</span>
                <span>
                  {vaultTab === 'gemini'
                    ? 'Get your free key with 0 setup cost from Google AI Studio.'
                    : 'Create your developer API secret key in OpenAI platform.'}
                </span>
              </div>
              <div className="quick-helper-btns">
                <a
                  href={vaultTab === 'gemini' ? 'https://aistudio.google.com/apikey' : 'https://platform.openai.com/api-keys'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="quick-ext-link"
                >
                  <span>{vaultTab === 'gemini' ? 'Open Google AI Studio' : 'Open OpenAI Platform'}</span>
                  <span>↗</span>
                </a>
                <button
                  type="button"
                  className="quick-steps-btn"
                  onClick={() => openTokenHelper(vaultTab)}
                >
                  ℹ View Steps
                </button>
              </div>
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label>Web / CORS Proxy URL (Optional)</label>
              <input
                type="text"
                value={vault.proxyUrl || ''}
                onChange={(e) => persistVault({ ...vault, proxyUrl: e.target.value })}
                placeholder="e.g. https://corsproxy.io/? or leave blank for direct"
              />
              <span className="hint">Allows web browser mode to proxy external AI requests if direct connection is blocked</span>
            </div>
            <div className="vault-actions">
              <button className="ghost" onClick={() => persistVault({ openai: '', gemini: '', proxyUrl: '' })}>Clear</button>
              <button className="primary" onClick={() => setVaultOpen(false)}>Save settings</button>
            </div>
          </div>
        </div>
      )}

      {folderOpen && (
        <div className="modal-back" onClick={() => setFolderOpen(false)}>
          <div className="modal vault" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="vault-hero">
              <div className="vault-orb" />
              <div>
                <h3>Open local folder</h3>
                <p>Browse the machine and set Aether's workspace. Agent tools follow this folder.</p>
              </div>
            </div>
            <div className="crumb">
              {browse?.parent && (
                <button className="ghost tiny" onClick={() => loadBrowse(browse.parent)}>Up</button>
              )}
              <input
                className="path-input"
                value={browse?.path || ''}
                onChange={(e) => setBrowse((b) => ({ ...(b || { entries: [] }), path: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') loadBrowse(e.target.value)
                }}
                placeholder="/absolute/folder"
              />
            </div>
            <div className="folder-list">
              {(browse?.entries || []).map((e) => (
                <button key={e.path} className="folder-row" onClick={() => loadBrowse(e.path)}>
                  <span className="ico">/</span>
                  {e.name}
                </button>
              ))}
              {browse && !browse.entries.length && <div className="empty"><p>No subfolders</p></div>}
            </div>
            {browseErr && <div className="bubble err">{browseErr}</div>}
            <div className="vault-actions">
              <button className="ghost" onClick={() => setFolderOpen(false)}>Cancel</button>
              <button className="primary" onClick={selectFolder} disabled={!browse?.path}>Use this folder</button>
            </div>
          </div>
        </div>
      )}

      {appModalOpen && (
        <div className="modal-back" onClick={() => setAppModalOpen(false)}>
          <div className="modal app-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="vault-hero">
              <div className="vault-orb" />
              <div>
                <h3>Use on Windows, Mac &amp; Phone</h3>
                <p>Run Aether Studio as a native app on all your devices with instant sync.</p>
              </div>
            </div>

            {installPrompt && !installed && (
              <div className="install-banner">
                <span>Direct install available on this device</span>
                <button className="primary" onClick={triggerInstall}>Install Now</button>
              </div>
            )}

            <div className="guide-tabs">
              <button
                className={guideTab === 'phone' ? 'on' : ''}
                onClick={() => setGuideTab('phone')}
              >
                📱 Phone (iOS / Android)
              </button>
              <button
                className={guideTab === 'desktop' ? 'on' : ''}
                onClick={() => setGuideTab('desktop')}
              >
                💻 Windows &amp; Mac
              </button>
              <button
                className={guideTab === 'git' ? 'on' : ''}
                onClick={() => setGuideTab('git')}
              >
                🐙 Via Git
              </button>
            </div>

            {guideTab === 'phone' && (
              <div>
                {isMobileClient ? (
                  <div className="mobile-download-hub">
                    <div className="mobile-device-badge">
                      <span>{isIOSClient ? '🍎 iOS Device' : isAndroidClient ? '🤖 Android Device' : '📱 Mobile Device'}</span>
                      <span className="badge-highlight">Direct Download &amp; Install Hub</span>
                    </div>

                    {installPrompt && !installed ? (
                      <div className="mobile-direct-install-box">
                        <button className="primary mobile-install-big-btn" onClick={triggerInstall}>
                          ⬇️ Install Aether Studio App
                        </button>
                        <span className="hint">Direct 1-tap installation to your home screen</span>
                      </div>
                    ) : (
                      <div className="mobile-pwa-guide-box">
                        <h4>📱 Add Aether to Home Screen</h4>
                        <p className="hint">Run full-screen without browser address bars, with offline AI code editor!</p>
                      </div>
                    )}

                    <div className="step-item">
                      <div className="step-num">1</div>
                      <div>
                        <strong>{isIOSClient ? 'Safari Share Menu' : 'Browser Menu'}</strong>
                        <div className="hint">
                          {isIOSClient ? (
                            <>Tap the <b>Share button ⎋</b> (square with arrow up) at the bottom of Safari.</>
                          ) : (
                            <>Tap the <b>three dots menu ⋮</b> in the top right of Chrome.</>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="step-item">
                      <div className="step-num">2</div>
                      <div>
                        <strong>{isIOSClient ? 'Add to Home Screen' : 'Install App'}</strong>
                        <div className="hint">
                          {isIOSClient ? (
                            <>Scroll down and tap <b>Add to Home Screen ⊞</b>, then tap <b>Add</b> in the top right.</>
                          ) : (
                            <>Tap <b>Install app</b> or <b>Add to Home screen</b> and confirm <b>Install</b>.</>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="step-item">
                      <div className="step-num">3</div>
                      <div>
                        <strong>Instant Fullscreen Launch</strong>
                        <div className="hint">
                          Aether icon is now on your home screen! Tap it anytime for full-screen coding with touch editor and AI assistant.
                        </div>
                      </div>
                    </div>

                    <div className="mobile-actions-row">
                      <button className="primary" onClick={() => setAppModalOpen(false)}>
                        🚀 Launch Web Studio Now
                      </button>
                      <button className="ghost small" onClick={handleDownloadShortcut}>
                        ⬇️ Download Web Shortcut
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? (
                      <div className="qr-source-toggle">
                        <button
                          className={qrMode !== 'cloud' ? 'on' : ''}
                          onClick={() => setQrMode('local')}
                        >
                          📱 Local Wi-Fi (LAN)
                        </button>
                        <button
                          className={qrMode === 'cloud' ? 'on' : ''}
                          onClick={() => setQrMode('cloud')}
                        >
                          🌐 Cloud Web App
                        </button>
                      </div>
                    ) : null}

                    <div className="qr-container">
                      <QRCodeSVG text={targetQrUrl} size={170} />
                      <div className="url-pill">
                        <span title={targetQrUrl}>{targetQrUrl}</span>
                        <button
                          className="ghost tiny"
                          onClick={() => {
                            navigator.clipboard?.writeText(targetQrUrl)
                            setCopied(true)
                            setTimeout(() => setCopied(false), 2000)
                          }}
                        >
                          {copied ? 'Copied!' : 'Copy'}
                        </button>
                      </div>

                      <div className="qr-actions-row">
                        <button className="ghost tiny" onClick={handleDownloadQR}>
                          {qrDownloaded ? '✓ QR Saved!' : '⬇️ Download QR (PNG)'}
                        </button>
                        <button className="ghost tiny" onClick={handleDownloadShortcut}>
                          ⬇️ Download Shortcut
                        </button>
                        <button className="ghost tiny" onClick={() => window.open(targetQrUrl, '_blank')}>
                          🔗 Open Mobile Link
                        </button>
                      </div>

                      <span className="hint">
                        {window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
                          ? 'Scan with any phone camera (works anywhere worldwide on 4G/5G/Wi-Fi — opens instant download options)'
                          : qrMode === 'cloud'
                          ? 'Scan to open the public cloud app on any phone'
                          : 'Make sure phone and computer are on the same Wi-Fi'}
                      </span>
                    </div>

                    <div className="step-item">
                      <div className="step-num">1</div>
                      <div>
                        <strong>Scan QR or open download link</strong>
                        <div className="hint">Use your phone camera to scan the QR code above or open the link in mobile Safari/Chrome.</div>
                      </div>
                    </div>

                    <div className="step-item">
                      <div className="step-num">2</div>
                      <div>
                        <strong>Choose Download &amp; Add to Home Screen</strong>
                        <div className="hint">
                          • <b>iPhone (Safari)</b>: Tap Share button ⎋ → <b>Add to Home Screen</b>.<br />
                          • <b>Android (Chrome)</b>: Tap ⋮ menu → <b>Install app</b> or <b>Add to Home screen</b>.
                        </div>
                      </div>
                    </div>

                    <div className="step-item">
                      <div className="step-num">3</div>
                      <div>
                        <strong>Full Native Mobile Studio</strong>
                        <div className="hint">Aether launches full-screen without browser address bars, complete with mobile file drawer, touch code editor, and AI chat!</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {guideTab === 'desktop' && (
              <div>
                <div className="step-item" style={{ marginTop: 12 }}>
                  <div className="step-num">1</div>
                  <div>
                    <strong>Windows (Edge / Chrome / Brave)</strong>
                    <div className="hint">Click the <b>Install App</b> icon located on the right side of your browser address bar, or click "Install Now" above. It creates a desktop icon and taskbar app!</div>
                  </div>
                </div>

                <div className="step-item">
                  <div className="step-num">2</div>
                  <div>
                    <strong>macOS (Chrome / Edge / Safari)</strong>
                    <div className="hint">
                      • In Chrome/Edge: Click the <b>Install Aether</b> icon in the address bar.<br />
                      • In Safari (macOS Sonoma+): Choose <b>File → Add to Dock</b>. It turns Aether into a standalone Mac dock application!
                    </div>
                  </div>
                </div>

                <div className="step-item">
                  <div className="step-num">3</div>
                  <div>
                    <strong>Double-click Desktop Launcher</strong>
                    <div className="hint">You can also launch anytime by running <code>start.bat</code> on Windows or <code>./start.sh</code> on Mac/Linux.</div>
                  </div>
                </div>
              </div>
            )}

            {guideTab === 'git' && (
              <div>
                <div className="step-item" style={{ marginTop: 12 }}>
                  <div className="step-num">1</div>
                  <div>
                    <strong>Clone repository on any computer or server</strong>
                    <div className="hint" style={{ marginTop: 4 }}>
                      <pre style={{ background: '#0e141b', padding: '6px 8px', borderRadius: 6, fontFamily: 'var(--mono)', fontSize: 11, border: '1px solid var(--line)' }}>
                        git clone &lt;your-repo-url&gt;{'\n'}cd workspace{'\n'}node start.js
                      </pre>
                    </div>
                  </div>
                </div>

                <div className="step-item">
                  <div className="step-num">2</div>
                  <div>
                    <strong>Host Online / Deploy via Git</strong>
                    <div className="hint">Push your repository to GitHub, and deploy to services like Render, Railway, or any VPS for 24/7 access from any phone and PC worldwide.</div>
                  </div>
                </div>

                <div className="step-item">
                  <div className="step-num">3</div>
                  <div>
                    <strong>Automatic Dependency Resolution</strong>
                    <div className="hint">Running <code>node start.js</code> automatically checks and installs all dependencies if missing.</div>
                  </div>
                </div>
              </div>
            )}

            <div className="vault-actions" style={{ marginTop: 16 }}>
              <button className="primary" onClick={() => setAppModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {welcomeModalOpen && (
        <div className="modal-back apple-welcome-back" onClick={() => setWelcomeModalOpen(false)}>
          <div className="modal apple-welcome-card" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="settings-close-btn welcome-close-btn"
              onClick={() => setWelcomeModalOpen(false)}
              title="Close"
              style={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }}
            >
              ✕
            </button>
            <div className="sheet-handle" />
            <div className="apple-badge">
              <span className="apple-badge-sparkle">✦</span>
              <span>Aether AI Studio</span>
            </div>

            <div className="welcome-orb-wrap">
              <AppleAiOrb size={130} />
            </div>

            <div className="apple-welcome-content">
              <h3>{userName ? `Hi, ${userName}` : 'Welcome to Aether Studio'}</h3>
              <p>
                Experience next-generation intelligent coding. Tell us what to call you, or jump right in.
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const trimmed = nameDraft.trim()
                  setUserName(trimmed)
                  if (trimmed) localStorage.setItem(USER_KEY, trimmed)
                  localStorage.setItem(WELCOME_SEEN_KEY, '1')
                  setWelcomeModalOpen(false)
                }}
              >
                <div className="apple-input-wrap">
                  <span className="apple-input-icon">👤</span>
                  <input
                    type="text"
                    className="apple-name-input"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    placeholder="Enter your name (optional)"
                  />
                  {nameDraft && (
                    <button
                      type="button"
                      className="apple-input-clear"
                      onClick={() => setNameDraft('')}
                    >
                      ✕
                    </button>
                  )}
                </div>
                <span className="apple-input-hint">Optional · You can always change this anytime</span>

                <div className="apple-modal-actions">
                  <button
                    type="button"
                    className="ghost apple-skip-btn"
                    onClick={() => {
                      localStorage.setItem(WELCOME_SEEN_KEY, '1')
                      setWelcomeModalOpen(false)
                    }}
                  >
                    Skip
                  </button>
                  <button type="submit" className="primary apple-continue-btn">
                    {nameDraft.trim() ? `Continue as ${nameDraft.trim()}` : 'Get Started'} →
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {mobileMenuOpen && (
        <div className="modal-back mobile-menu-back" onClick={() => setMobileMenuOpen(false)}>
          <div className="modal mobile-menu-card" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="mobile-menu-head">
              <div className="mark">
                <div className="mark-orb" />
                <div>
                  <h1>Aether Studio</h1>
                  <span>Settings &amp; Tools</span>
                </div>
              </div>
              <button className="ghost tiny close-menu-btn" onClick={() => setMobileMenuOpen(false)}>✕</button>
            </div>

            <div className="mobile-menu-body">
              <div className="mobile-menu-section">
                <button
                  className="mobile-menu-item user-item"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    setNameDraft(userName)
                    setWelcomeModalOpen(true)
                  }}
                >
                  <div className="menu-item-icon">👤</div>
                  <div className="menu-item-text">
                    <strong>{userName ? `Hi, ${userName}` : 'Set Your Name'}</strong>
                    <span>Personalize your AI workspace</span>
                  </div>
                  <div className="menu-item-arrow">→</div>
                </button>
              </div>

              <div className="mobile-menu-section">
                <div className="menu-section-label">Studio Mode</div>
                <div className="mobile-modes-grid">
                  <button
                    className={`mobile-mode-btn ${mode === 'chat' ? 'on' : ''}`}
                    onClick={() => { setMode('chat'); setPane('editor'); setMobileMenuOpen(false) }}
                  >
                    <strong>💬 AI Chat</strong>
                    <span>Gemini / GPT Mode</span>
                  </button>
                  <button
                    className={`mobile-mode-btn ${mode === 'agent' ? 'on' : ''}`}
                    onClick={() => { setMode('agent'); setPane('editor'); setMobileMenuOpen(false) }}
                  >
                    <strong>🤖 AI Agent</strong>
                    <span>Multi-step task coding</span>
                  </button>
                  <button
                    className={`mobile-mode-btn ${mode === 'editor' ? 'on' : ''}`}
                    onClick={() => { setMode('editor'); setPane('editor'); setMobileMenuOpen(false) }}
                  >
                    <strong>📝 Editor</strong>
                    <span>Direct editing &amp; assist</span>
                  </button>
                </div>
              </div>

              <div className="mobile-menu-section">
                <div className="menu-section-label">Preferences &amp; Tools</div>
                <button
                  className="mobile-menu-item"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    setSettingsOpen(true)
                  }}
                >
                  <div className="menu-item-icon">⚙️</div>
                  <div className="menu-item-text">
                    <strong>Studio Settings</strong>
                    <span>Themes, AI models, editor &amp; exports</span>
                  </div>
                  <div className="menu-item-arrow">→</div>
                </button>

                <button
                  className="mobile-menu-item"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    setHistoryOpen(true)
                  }}
                >
                  <div className="menu-item-icon">📜</div>
                  <div className="menu-item-text">
                    <strong>Task &amp; Chat History</strong>
                    <span>{taskHistory.length} saved sessions</span>
                  </div>
                  <div className="menu-item-arrow">→</div>
                </button>

                <button
                  className="mobile-menu-item"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    openChat()
                  }}
                >
                  <div className="menu-item-icon">✨</div>
                  <div className="menu-item-text">
                    <strong>AI Coding Assistant</strong>
                    <span>Chat, explain, optimize &amp; write code</span>
                  </div>
                  <div className="menu-item-arrow">→</div>
                </button>

                <button
                  className="mobile-menu-item"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    setVaultOpen(true)
                  }}
                >
                  <div className="menu-item-icon">🔑</div>
                  <div className="menu-item-text">
                    <strong>API Tokens &amp; Vault</strong>
                    <span>{vault.openai || vault.gemini ? 'Keys linked' : 'ChatGPT & Gemini keys'}</span>
                  </div>
                  <div className="menu-item-arrow">→</div>
                </button>

                <button
                  className="mobile-menu-item"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    openTokenHelper('gemini')
                  }}
                >
                  <div className="menu-item-icon">ℹ️</div>
                  <div className="menu-item-text">
                    <strong>Get API Tokens Guide</strong>
                    <span>Step-by-step helper for Gemini &amp; ChatGPT</span>
                  </div>
                  <div className="menu-item-arrow">→</div>
                </button>

                <button
                  className="mobile-menu-item"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    setAppModalOpen(true)
                  }}
                >
                  <div className="menu-item-icon">📱</div>
                  <div className="menu-item-text">
                    <strong>Install App / Multi-Platform</strong>
                    <span>Add to Home Screen on Phone or PC</span>
                  </div>
                  <div className="menu-item-arrow">→</div>
                </button>

                <button
                  className="mobile-menu-item"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    openLocalFolder()
                  }}
                >
                  <div className="menu-item-icon">📂</div>
                  <div className="menu-item-text">
                    <strong>Open Local Project</strong>
                    <span>{workspace.name ? `Current: ${workspace.name}` : 'Open folder or files'}</span>
                  </div>
                  <div className="menu-item-arrow">→</div>
                </button>

                <button
                  className="mobile-menu-item"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    openFolderPicker()
                  }}
                >
                  <div className="menu-item-icon">🌐</div>
                  <div className="menu-item-text">
                    <strong>Server Workspace Browser</strong>
                    <span>Browse host workspace</span>
                  </div>
                  <div className="menu-item-arrow">→</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <SettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          allModels={allModels}
          settings={settings}
          onUpdateSettings={(newSettings) => {
            setSettings(newSettings)
            if (newSettings.userName) setUserName(newSettings.userName)
            if (newSettings.defaultModel && newSettings.defaultModel !== modelId) {
              pickModel(newSettings.defaultModel)
            }
          }}
          onExportAllChats={(fmt) => exportChatSession(fmt)}
          onClearAllChats={() => setMessages([])}
          vault={vault}
          onSaveVault={(v) => {
            const updated = { ...vault, ...v }
            persistVault(updated)
          }}
        />
      )}

      {historyOpen && (
        <TaskHistoryModal
          isOpen={historyOpen}
          onClose={() => setHistoryOpen(false)}
          history={taskHistory}
          currentSessionId={currentSessionId}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onClearHistory={handleClearAllHistory}
          onExportSession={handleExportSession}
        />
      )}

      {tokenGuideOpen && (
        <div className="modal-back token-guide-back" onClick={() => setTokenGuideOpen(false)}>
          <div className="modal token-guide-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="settings-close-btn guide-close-btn"
              onClick={() => setTokenGuideOpen(false)}
              title="Close guide"
              style={{ position: 'absolute', top: 14, right: 14, zIndex: 10 }}
            >
              ✕
            </button>
            <div className="sheet-handle" />

            <div className="token-guide-hero">
              <div className="token-guide-badge">
                <span className="guide-sparkle">✦</span>
                <span>API Token Generator Helper</span>
              </div>
              <h3>How to Generate API Tokens</h3>
              <p>Quick steps to get your token and unlock Google Gemini and ChatGPT models.</p>
            </div>

            <div className="token-guide-seg">
              <button
                type="button"
                className={`guide-seg-btn ${tokenGuideTab === 'gemini' ? 'on' : ''}`}
                onClick={() => setTokenGuideTab('gemini')}
              >
                <span className="seg-ico">✨</span>
                <span>Google Gemini</span>
                <span className="seg-tag free">100% Free</span>
              </button>
              <button
                type="button"
                className={`guide-seg-btn ${tokenGuideTab === 'openai' ? 'on' : ''}`}
                onClick={() => setTokenGuideTab('openai')}
              >
                <span className="seg-ico">⚡</span>
                <span>ChatGPT / OpenAI</span>
                <span className="seg-tag">Direct API</span>
              </button>
            </div>

            <div className="token-guide-body">
              {tokenGuideTab === 'gemini' ? (
                <div className="guide-flow">
                  <div className="guide-banner gemini">
                    <span className="banner-ico">🎁</span>
                    <div className="banner-text">
                      <strong>Zero Cost / 100% Free Tier:</strong> Google AI Studio provides high free rate limits for Gemini 2.0 Flash &amp; Pro without requiring a credit card or billing setup!
                    </div>
                  </div>

                  <div className="guide-steps">
                    <div className="guide-step">
                      <div className="step-badge">1</div>
                      <div className="step-content">
                        <strong>Open Google AI Studio</strong>
                        <p>Go to the official Google AI Studio API key generator.</p>
                        <a
                          href="https://aistudio.google.com/apikey"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="guide-link-btn"
                        >
                          <span>Open Google AI Studio</span>
                          <span className="arrow">↗</span>
                        </a>
                      </div>
                    </div>

                    <div className="guide-step">
                      <div className="step-badge">2</div>
                      <div className="step-content">
                        <strong>Sign In with your Google Account</strong>
                        <p>Log in with any standard Gmail or Google Workspace account.</p>
                      </div>
                    </div>

                    <div className="guide-step">
                      <div className="step-badge">3</div>
                      <div className="step-content">
                        <strong>Click "Create API key"</strong>
                        <p>Click the blue <strong>"Create API key"</strong> button, then select <em>"Create key in new project"</em> (or pick an existing project).</p>
                      </div>
                    </div>

                    <div className="guide-step">
                      <div className="step-badge">4</div>
                      <div className="step-content">
                        <strong>Copy Your Generated Key</strong>
                        <p>Click the copy button. Gemini API keys always start with <code>AIzaSy...</code></p>
                      </div>
                    </div>

                    <div className="guide-step">
                      <div className="step-badge">5</div>
                      <div className="step-content">
                        <strong>Paste into Aether Studio &amp; Save</strong>
                        <p>Paste the copied key into the Gemini field in the Token Vault.</p>
                      </div>
                    </div>
                  </div>

                  <div className="guide-modal-actions">
                    <button
                      type="button"
                      className="primary guide-action-btn gemini"
                      onClick={() => {
                        setTokenGuideOpen(false)
                        setVaultTab('gemini')
                        setVaultOpen(true)
                      }}
                    >
                      Paste Key in Token Vault →
                    </button>
                  </div>
                </div>
              ) : (
                <div className="guide-flow">
                  <div className="guide-banner openai">
                    <span className="banner-ico">⚡</span>
                    <div className="banner-text">
                      <strong>Direct OpenAI Developer API:</strong> Use your OpenAI developer account to unlock GPT-4o, GPT-4o mini, and o3-mini reasoning models.
                    </div>
                  </div>

                  <div className="guide-steps">
                    <div className="guide-step">
                      <div className="step-badge">1</div>
                      <div className="step-content">
                        <strong>Visit OpenAI API Keys Dashboard</strong>
                        <p>Open the official API Key management page on OpenAI Platform.</p>
                        <a
                          href="https://platform.openai.com/api-keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="guide-link-btn openai"
                        >
                          <span>Open OpenAI Platform</span>
                          <span className="arrow">↗</span>
                        </a>
                      </div>
                    </div>

                    <div className="guide-step">
                      <div className="step-badge">2</div>
                      <div className="step-content">
                        <strong>Sign In or Register</strong>
                        <p>Log into your OpenAI account (the same credentials used for ChatGPT).</p>
                      </div>
                    </div>

                    <div className="guide-step">
                      <div className="step-badge">3</div>
                      <div className="step-content">
                        <strong>Click "Create new secret key"</strong>
                        <p>Click <strong>"+ Create new secret key"</strong>. Give it a name like <code>Aether Studio</code> and choose default permissions.</p>
                      </div>
                    </div>

                    <div className="guide-step">
                      <div className="step-badge">4</div>
                      <div className="step-content">
                        <strong>Copy the Secret Key Immediately</strong>
                        <p>Copy the secret key string (starts with <code>sk-proj-...</code> or <code>sk-...</code>). <em>OpenAI will never show it again.</em></p>
                      </div>
                    </div>

                    <div className="guide-step">
                      <div className="step-badge">5</div>
                      <div className="step-content">
                        <strong>Paste into Aether Studio &amp; Save</strong>
                        <p>Paste the copied key into the ChatGPT field in the Token Vault.</p>
                      </div>
                    </div>
                  </div>

                  <div className="guide-modal-actions">
                    <button
                      type="button"
                      className="primary guide-action-btn openai"
                      onClick={() => {
                        setTokenGuideOpen(false)
                        setVaultTab('openai')
                        setVaultOpen(true)
                      }}
                    >
                      Paste Key in Token Vault →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
