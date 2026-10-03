import React, { useCallback, useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from './qrcode.jsx'
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
    { id: 'aether-spark', label: 'Aether Spark', blurb: 'Fast replies', tier: 'free', provider: 'pollinations' },
    { id: 'aether-loom', label: 'Aether Loom', blurb: 'Balanced chat', tier: 'free', provider: 'pollinations' },
    { id: 'aether-forge', label: 'Aether Forge', blurb: 'Code-focused', tier: 'free', provider: 'pollinations' }
  ],
  premium: [
    // --- Google Gemini ---
    { id: 'gemini-3.5-flash-lite', label: '3.5 Flash-Lite', blurb: 'Fastest answers', tier: 'premium', provider: 'gemini', remote: 'gemini-2.0-flash-lite' },
    { id: 'gemini-3.6-flash', label: '3.6 Flash', blurb: 'All-around help', tier: 'premium', provider: 'gemini', remote: 'gemini-2.0-flash' },
    { id: 'gemini-3.1-pro', label: '3.1 Pro', blurb: 'Advanced reasoning', tier: 'premium', provider: 'gemini', remote: 'gemini-1.5-pro' },
    { id: 'gemini-thinking', label: 'Extended thinking', blurb: 'Complex problem solving', tier: 'premium', provider: 'gemini', remote: 'gemini-2.0-flash-thinking-exp-01-21' },

    // --- OpenAI / ChatGPT ---
    { id: 'gpt-4o-mini', label: 'GPT-4o mini', blurb: 'ChatGPT speed', tier: 'premium', provider: 'openai', remote: 'gpt-4o-mini' },
    { id: 'gpt-4o', label: 'GPT-4o', blurb: 'ChatGPT flagship', tier: 'premium', provider: 'openai', remote: 'gpt-4o' },
    { id: 'gpt-think', label: 'Think (o3-mini)', blurb: 'Think: Get a smarter answer', tier: 'premium', provider: 'openai', remote: 'o3-mini' }
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
  const [mode, setMode] = useState('agent')
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
  const [installPrompt, setInstallPrompt] = useState(null)
  const [installed, setInstalled] = useState(false)
  const [appModalOpen, setAppModalOpen] = useState(false)
  const [guideTab, setGuideTab] = useState('phone')
  const [networkInfo, setNetworkInfo] = useState({ addresses: [], port: 4576 })
  const [copied, setCopied] = useState(false)
  const feedRef = useRef(null)
  const [userName, setUserName] = useState(() => localStorage.getItem(USER_KEY) || '')
  const [welcomeModalOpen, setWelcomeModalOpen] = useState(() => !localStorage.getItem(WELCOME_SEEN_KEY))
  const [nameDraft, setNameDraft] = useState(() => localStorage.getItem(USER_KEY) || '')
  const allModels = [...catalog.free, ...catalog.premium]
  const selected = allModels.find((m) => m.id === modelId) || allModels[0]

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

  const send = async () => {
    const text = draft.trim()
    if (!text || busy) return
    const token = premiumToken(selected)
    if (selected.tier === 'premium' && !token) {
      setVaultTab(selected.provider === 'gemini' ? 'gemini' : 'openai')
      setVaultOpen(true)
      return
    }
    setDraft('')
    setPane('chat')
    const context = current
      ? `File: ${current.path}\n\n${current.content.slice(0, 8000)}`
      : ''
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
    <div className="app">
      <header className="topbar">
        <div className="mark">
          <div className="mark-orb" />
          <div>
            <h1>Aether</h1>
            <span>Local studio</span>
          </div>
        </div>
        <div className="modes">
          <button className={mode === 'agent' ? 'on' : ''} onClick={() => setMode('agent')}>Agent</button>
          <button className={mode === 'editor' ? 'on' : ''} onClick={() => setMode('editor')}>Editor</button>
        </div>
        <div className="top-actions">
          <div className="picker-wrap">
            <button className="model-btn" onClick={() => setPickerOpen((v) => !v)}>
              <span className={`dot ${selected.tier}`} />
              <span className="model-name">{selected.label}</span>
              <em>{selected.tier}</em>
            </button>
            {pickerOpen && (
              <div className="picker">
                <div className="picker-label">Free (No Token Required)</div>
                {catalog.free.map((m) => (
                  <button key={m.id} className={m.id === selected.id ? 'on' : ''} onClick={() => pickModel(m.id)}>
                    <strong>{m.label}</strong>
                    <span>{m.blurb}</span>
                  </button>
                ))}
                <div className="picker-label">Google Gemini</div>
                {catalog.premium.filter((m) => m.provider === 'gemini').map((m) => (
                  <button key={m.id} className={m.id === selected.id ? 'on' : ''} onClick={() => pickModel(m.id)}>
                    <strong>{m.label}</strong>
                    <span>{m.blurb}{vault.gemini ? ' · ready' : ' · token required'}</span>
                  </button>
                ))}
                <div className="picker-label">ChatGPT / OpenAI</div>
                {catalog.premium.filter((m) => m.provider === 'openai').map((m) => (
                  <button key={m.id} className={m.id === selected.id ? 'on' : ''} onClick={() => pickModel(m.id)}>
                    <strong>{m.label}</strong>
                    <span>{m.blurb}{vault.openai ? ' · ready' : ' · token required'}</span>
                  </button>
                ))}
              </div>
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
          <button className="ghost" onClick={() => setVaultOpen(true)}>Tokens</button>
          <button className="ghost app-btn" onClick={() => setAppModalOpen(true)} title="Use as app on Windows, Mac & Phone">
            <span className="app-dot" />
            {installed ? 'App Active' : 'Get App'}
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

      <div className={`shell pane-${pane} ${leftOpen ? '' : 'hide-left'} ${rightOpen ? '' : 'hide-right'}`}>
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
            onClick={() => setRightOpen(true)}
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
        </aside>

        <main className="stage">
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
            {!rightOpen && (
              <button
                className="primary tiny restore-panel-btn"
                onClick={() => setRightOpen(true)}
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
              <textarea
                className="editor"
                value={current.content}
                onChange={(e) => updateContent(e.target.value)}
                spellCheck={false}
              />
              <div className="editor-bar">
                <span className="path">{current.path}</span>
                <button className="primary" onClick={saveFile}>Save</button>
              </div>
            </div>
          ) : !workspace.root ? (
            <div className="empty landing">
              <MiniRobot mode={mode} />
              <div>
                <h2>{userName ? `Hi ${userName}, Welcome to Arther Studio` : 'Welcome to Arther Studio'}</h2>
                <p>Open your local project folder to inspect code, edit files, and build with AI directly in your browser.</p>
                <div className="landing-actions">
                  <button className="primary" onClick={openLocalFolder}>📂 Open Local Project</button>
                  <button className="ghost" onClick={openFolderPicker}>Browse Server Workspace</button>
                  {!leftOpen && (
                    <button className="primary" onClick={() => setLeftOpen(true)}>📂 Open Files Sidebar</button>
                  )}
                  <button
                    className="ghost tiny"
                    onClick={() => { setNameDraft(userName); setWelcomeModalOpen(true) }}
                    title="Change your name"
                  >
                    👤 {userName ? `Hi, ${userName}` : 'Set Name'}
                  </button>
                </div>
                <div className="landing-pills">
                  <span className="landing-pill">Port 4576</span>
                  <span className="landing-pill">Zero Local Dependencies</span>
                  <span className="landing-pill">Direct Web File System</span>
                  <span className="landing-pill">Multi-Model AI</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty landing">
              <MiniRobot mode={mode} />
              <div>
                <h2>{workspace.name}</h2>
                <p>
                  {mode === 'agent'
                    ? 'Describe a task in the chat. Aether can inspect, search, and edit files in this project.'
                    : 'Select a file from the sidebar to start editing, or ask the AI assistant.'}
                </p>
              </div>
            </div>
          )}
        </main>

        <section className="chat">
          <div className="chat-head">
            <span>{mode} thread</span>
            <button
              className="ghost tiny"
              onClick={() => setRightOpen(false)}
              title="Hide AI Chat (Ctrl+J)"
            >
              ✕
            </button>
          </div>
          <div className="feed" ref={feedRef}>
            {!messages.length && (
              <div className="empty">
                <p>Free models are ready now. Premium ChatGPT or Gemini opens the token screen.</p>
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
              const cls = m.role === 'user' ? 'bubble user' : m.role === 'error' ? 'bubble err' : 'bubble ai'
              return <div className={cls} key={i}>{m.text}</div>
            })}
            {busy && <div className="tool">thinking...</div>}
          </div>
          <div className="composer">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={mode === 'agent' ? 'Give Aether a workspace task...' : 'Ask about the open file...'}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send()
              }}
            />
            <div className="composer-row">
              <span className="hint">Ctrl/Cmd + Enter</span>
              <button className="primary" onClick={send} disabled={busy}>Send</button>
            </div>
          </div>
        </section>
      </div>

      {vaultOpen && (
        <div className="modal-back" onClick={() => setVaultOpen(false)}>
          <div className="modal vault" onClick={(e) => e.stopPropagation()}>
            <div className="vault-hero">
              <div className="vault-orb" />
              <div>
                <h3>Premium tokens</h3>
                <p>Free models need nothing. Drop a ChatGPT or Gemini key only if you pick a premium model.</p>
              </div>
            </div>
            <div className="seg">
              <button className={vaultTab === 'openai' ? 'on' : ''} onClick={() => setVaultTab('openai')}>ChatGPT</button>
              <button className={vaultTab === 'gemini' ? 'on' : ''} onClick={() => setVaultTab('gemini')}>Gemini</button>
            </div>
            {vaultTab === 'openai' ? (
              <div className="field">
                <label>OpenAI API token</label>
                <input
                  type="password"
                  value={vault.openai}
                  onChange={(e) => persistVault({ ...vault, openai: e.target.value })}
                  placeholder="sk-..."
                />
                <span className="hint">{vault.openai ? 'ChatGPT linked' : 'Unlocks GPT-4o mini and GPT-4o'}</span>
              </div>
            ) : (
              <div className="field">
                <label>Gemini API token</label>
                <input
                  type="password"
                  value={vault.gemini}
                  onChange={(e) => persistVault({ ...vault, gemini: e.target.value })}
                  placeholder="AIza..."
                />
                <span className="hint">{vault.gemini ? 'Gemini linked' : 'Unlocks Gemini Flash and Pro'}</span>
              </div>
            )}
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

      <nav className="dock">
        <button className={pane === 'files' ? 'on' : ''} onClick={() => setPane('files')}>Files</button>
        <button className={pane === 'editor' ? 'on' : ''} onClick={() => setPane('editor')}>Work</button>
        <button className={pane === 'chat' ? 'on' : ''} onClick={() => setPane('chat')}>Chat</button>
      </nav>

      {folderOpen && (
        <div className="modal-back" onClick={() => setFolderOpen(false)}>
          <div className="modal vault" onClick={(e) => e.stopPropagation()}>
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
                <div className="qr-container">
                  <QRCodeSVG
                    text={
                      window.location.protocol +
                      '//' +
                      (networkInfo.addresses?.[0]?.ip || window.location.hostname) +
                      ':' +
                      (networkInfo.port || window.location.port || '4576')
                    }
                    size={160}
                  />
                  <div className="url-pill">
                    <span>
                      {window.location.protocol}//
                      {networkInfo.addresses?.[0]?.ip || window.location.hostname}:
                      {networkInfo.port || window.location.port || '4576'}
                    </span>
                    <button
                      className="ghost tiny"
                      onClick={() => {
                        const url = `${window.location.protocol}//${
                          networkInfo.addresses?.[0]?.ip || window.location.hostname
                        }:${networkInfo.port || window.location.port || '4576'}`
                        navigator.clipboard?.writeText(url)
                        setCopied(true)
                        setTimeout(() => setCopied(false), 2000)
                      }}
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <span className="hint">Make sure phone and computer are on the same Wi-Fi</span>
                </div>

                <div className="step-item">
                  <div className="step-num">1</div>
                  <div>
                    <strong>Scan QR or open link</strong>
                    <div className="hint">Use your phone camera to scan the QR code above or enter the link in Safari/Chrome.</div>
                  </div>
                </div>

                <div className="step-item">
                  <div className="step-num">2</div>
                  <div>
                    <strong>Add to Home Screen (Instant App)</strong>
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
            <div className="apple-badge">
              <span className="apple-badge-sparkle">✦</span>
              <span>Arther Intelligence &amp; Studio</span>
            </div>

            <AppleAiOrb size={145} />

            <div className="apple-welcome-content">
              <h3>{userName ? `Hi ${userName}` : 'Welcome to Arther Studio'}</h3>
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
                    autoFocus
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
    </div>
  )
}
