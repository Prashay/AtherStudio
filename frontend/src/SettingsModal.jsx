import React, { useState, useEffect } from 'react'

export const SETTINGS_KEY = 'aether.settings.v1'

export const DEFAULT_SETTINGS = {
  userName: '',
  theme: 'cosmic',
  uiDensity: 'comfortable',
  defaultModel: 'aether-spark',
  customInstructions: '',
  temperature: 0.7,
  streamResponse: true,
  autoScrollChat: true,
  editorFontSize: 13,
  editorFontFamily: 'JetBrains Mono, Fira Code, monospace',
  editorTabSize: 2,
  editorWordWrap: true,
  mdDefaultMode: 'reader', // 'reader' | 'split' | 'edit'
  geminiToken: '',
  openaiToken: ''
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch (e) {
    console.error('Failed to save settings:', e)
  }
}

export function SettingsModal({
  isOpen,
  onClose,
  allModels = [],
  settings,
  onUpdateSettings,
  onExportAllChats,
  onClearAllChats,
  vault,
  onSaveVault
}) {
  const [activeTab, setActiveTab] = useState('general') // general | ai | editor | keys | data
  const [localSettings, setLocalSettings] = useState(settings || DEFAULT_SETTINGS)
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [showOpenaiKey, setShowOpenaiKey] = useState(false)
  const [testStatus, setTestStatus] = useState(null) // null | testing | success | error
  const [testMessage, setTestMessage] = useState('')
  const [saveToast, setSaveToast] = useState(false)

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings)
    }
  }, [settings, isOpen])

  if (!isOpen) return null

  const update = (key, val) => {
    setLocalSettings((prev) => {
      const next = { ...prev, [key]: val }
      return next
    })
  }

  const handleSave = () => {
    saveSettings(localSettings)
    if (onUpdateSettings) {
      onUpdateSettings(localSettings)
    }
    // Sync vault tokens as well
    if (onSaveVault) {
      onSaveVault({
        gemini: localSettings.geminiToken || '',
        openai: localSettings.openaiToken || ''
      })
    }
    setSaveToast(true)
    setTimeout(() => {
      setSaveToast(false)
      onClose()
    }, 600)
  }

  const handleTestToken = async (provider) => {
    setTestStatus('testing')
    setTestMessage(`Validating ${provider} credentials...`)

    try {
      if (provider === 'gemini') {
        const key = localSettings.geminiToken?.trim()
        if (!key) throw new Error('Please enter a Gemini API Key first')
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`)
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error?.message || `HTTP ${res.status}: Invalid API Key`)
        }
        setTestStatus('success')
        setTestMessage('✓ Gemini API Key verified successfully!')
      } else if (provider === 'openai') {
        const key = localSettings.openaiToken?.trim()
        if (!key) throw new Error('Please enter an OpenAI API Key first')
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${key}` }
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error?.message || `HTTP ${res.status}: Invalid API Key`)
        }
        setTestStatus('success')
        setTestMessage('✓ OpenAI API Key verified successfully!')
      }
    } catch (err) {
      setTestStatus('error')
      setTestMessage(`✕ ${err.message}`)
    }
  }

  return (
    <div className="modal-back settings-back" onClick={onClose}>
      <div className="settings-panel-card" onClick={(e) => e.stopPropagation()}>
        {/* Settings Header */}
        <div className="settings-head">
          <div className="settings-title-row">
            <span className="settings-icon">⚙️</span>
            <div>
              <h3>Studio Settings</h3>
              <p>Configure preferences, AI intelligence, editor, and API integrations</p>
            </div>
          </div>
          <button className="settings-close-btn" onClick={onClose} title="Close settings">
            ✕
          </button>
        </div>

        {/* Settings Body with Sidebar Tabs */}
        <div className="settings-layout">
          <aside className="settings-nav">
            <button
              className={`settings-nav-item ${activeTab === 'general' ? 'active' : ''}`}
              onClick={() => setActiveTab('general')}
            >
              <span className="nav-ico">🎨</span>
              <span>General &amp; Theme</span>
            </button>
            <button
              className={`settings-nav-item ${activeTab === 'ai' ? 'active' : ''}`}
              onClick={() => setActiveTab('ai')}
            >
              <span className="nav-ico">🧠</span>
              <span>AI &amp; Chat Mode</span>
            </button>
            <button
              className={`settings-nav-item ${activeTab === 'editor' ? 'active' : ''}`}
              onClick={() => setActiveTab('editor')}
            >
              <span className="nav-ico">💻</span>
              <span>Editor &amp; Markdown</span>
            </button>
            <button
              className={`settings-nav-item ${activeTab === 'keys' ? 'active' : ''}`}
              onClick={() => setActiveTab('keys')}
            >
              <span className="nav-ico">🔑</span>
              <span>API Keys &amp; Vault</span>
            </button>
            <button
              className={`settings-nav-item ${activeTab === 'data' ? 'active' : ''}`}
              onClick={() => setActiveTab('data')}
            >
              <span className="nav-ico">📦</span>
              <span>Data &amp; Export</span>
            </button>
          </aside>

          <main className="settings-content">
            {/* TAB 1: GENERAL & THEME */}
            {activeTab === 'general' && (
              <div className="settings-section">
                <div className="settings-field">
                  <label>Your Display Name</label>
                  <p className="field-desc">Used for personalized greetings and conversational contexts.</p>
                  <input
                    type="text"
                    className="settings-input"
                    value={localSettings.userName || ''}
                    onChange={(e) => update('userName', e.target.value)}
                    placeholder="e.g. Alex or Prashant"
                  />
                </div>

                <div className="settings-field">
                  <label>Color Accent &amp; Aura Theme</label>
                  <p className="field-desc">Personalize the studio atmospheric lighting and highlights.</p>
                  <div className="theme-grid">
                    {[
                      { id: 'cosmic', label: 'Cosmic Blue', color: '#3b82f6', bg: '#060913' },
                      { id: 'copper', label: 'Amber Copper', color: '#d97706', bg: '#100c08' },
                      { id: 'emerald', label: 'Neon Emerald', color: '#10b981', bg: '#04130d' },
                      { id: 'cyberpunk', label: 'Cyberpunk Violet', color: '#a855f7', bg: '#0f0817' },
                      { id: 'midnight', label: 'OLED Midnight', color: '#94a3b8', bg: '#020202' }
                    ].map((th) => (
                      <button
                        key={th.id}
                        type="button"
                        className={`theme-chip ${(localSettings.theme || 'cosmic') === th.id ? 'active' : ''}`}
                        onClick={() => update('theme', th.id)}
                        style={{ '--chip-accent': th.color }}
                      >
                        <span className="theme-swatch" style={{ background: th.color }} />
                        <span className="theme-name">{th.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="settings-field">
                  <label>Interface Density</label>
                  <p className="field-desc">Control padding and spacing of buttons and sidebars.</p>
                  <div className="density-toggle">
                    <button
                      type="button"
                      className={`toggle-option ${localSettings.uiDensity === 'comfortable' ? 'active' : ''}`}
                      onClick={() => update('uiDensity', 'comfortable')}
                    >
                      Comfortable
                    </button>
                    <button
                      type="button"
                      className={`toggle-option ${localSettings.uiDensity === 'compact' ? 'active' : ''}`}
                      onClick={() => update('uiDensity', 'compact')}
                    >
                      Compact
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: AI & CHAT MODE */}
            {activeTab === 'ai' && (
              <div className="settings-section">
                <div className="settings-field">
                  <label>Default AI Model</label>
                  <p className="field-desc">The primary model selected when starting fresh chats.</p>
                  <select
                    className="settings-select"
                    value={localSettings.defaultModel || 'aether-spark'}
                    onChange={(e) => update('defaultModel', e.target.value)}
                  >
                    {allModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label} ({m.tier.toUpperCase()}) - {m.blurb}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="settings-field">
                  <label>Custom System Instructions</label>
                  <p className="field-desc">
                    Tell the AI how you want it to act, your preferred languages, frameworks, or tone.
                  </p>
                  <textarea
                    className="settings-textarea"
                    rows={4}
                    value={localSettings.customInstructions || ''}
                    onChange={(e) => update('customInstructions', e.target.value)}
                    placeholder="e.g. Always write production-ready, clean TypeScript or React code. Keep explanations concise and emphasize practical examples."
                  />
                </div>

                <div className="settings-field">
                  <div className="field-header-row">
                    <label>Creativity / Temperature: {localSettings.temperature}</label>
                  </div>
                  <p className="field-desc">Lower is more precise and factual; higher is more creative and exploratory.</p>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    className="settings-slider"
                    value={localSettings.temperature}
                    onChange={(e) => update('temperature', parseFloat(e.target.value))}
                  />
                </div>

                <div className="settings-field">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={localSettings.streamResponse}
                      onChange={(e) => update('streamResponse', e.target.checked)}
                    />
                    <span>Stream responses in real-time</span>
                  </label>
                  <p className="field-desc">Displays AI text as it is generated for lower perceived latency.</p>
                </div>

                <div className="settings-field">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={localSettings.autoScrollChat}
                      onChange={(e) => update('autoScrollChat', e.target.checked)}
                    />
                    <span>Auto-scroll to latest message</span>
                  </label>
                </div>
              </div>
            )}

            {/* TAB 3: EDITOR & MARKDOWN */}
            {activeTab === 'editor' && (
              <div className="settings-section">
                <div className="settings-field">
                  <label>Default Markdown (.md) View Mode</label>
                  <p className="field-desc">How Markdown files (.md, .markdown) should render when opened.</p>
                  <div className="density-toggle">
                    <button
                      type="button"
                      className={`toggle-option ${localSettings.mdDefaultMode === 'reader' ? 'active' : ''}`}
                      onClick={() => update('mdDefaultMode', 'reader')}
                    >
                      📖 Reader (Rendered)
                    </button>
                    <button
                      type="button"
                      className={`toggle-option ${localSettings.mdDefaultMode === 'split' ? 'active' : ''}`}
                      onClick={() => update('mdDefaultMode', 'split')}
                    >
                      ◫ Split View
                    </button>
                    <button
                      type="button"
                      className={`toggle-option ${localSettings.mdDefaultMode === 'edit' ? 'active' : ''}`}
                      onClick={() => update('mdDefaultMode', 'edit')}
                    >
                      ✏️ Code Editor
                    </button>
                  </div>
                </div>

                <div className="settings-field">
                  <label>Editor Font Size: {localSettings.editorFontSize}px</label>
                  <input
                    type="range"
                    min="11"
                    max="22"
                    step="1"
                    className="settings-slider"
                    value={localSettings.editorFontSize}
                    onChange={(e) => update('editorFontSize', parseInt(e.target.value, 10))}
                  />
                </div>

                <div className="settings-field">
                  <label>Tab Indentation Size</label>
                  <select
                    className="settings-select"
                    value={localSettings.editorTabSize}
                    onChange={(e) => update('editorTabSize', parseInt(e.target.value, 10))}
                  >
                    <option value={2}>2 Spaces (Modern Web Standard)</option>
                    <option value={4}>4 Spaces</option>
                  </select>
                </div>

                <div className="settings-field">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={localSettings.editorWordWrap}
                      onChange={(e) => update('editorWordWrap', e.target.checked)}
                    />
                    <span>Enable Word Wrap</span>
                  </label>
                  <p className="field-desc">Wrap long code and prose lines automatically instead of horizontal scroll.</p>
                </div>
              </div>
            )}

            {/* TAB 4: API KEYS & VAULT */}
            {activeTab === 'keys' && (
              <div className="settings-section">
                <div className="settings-field">
                  <div className="field-header-row">
                    <label>Google Gemini API Key</label>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="field-link"
                    >
                      Get Free Key from Google AI Studio ↗
                    </a>
                  </div>
                  <div className="key-input-wrap">
                    <input
                      type={showGeminiKey ? 'text' : 'password'}
                      className="settings-input"
                      value={localSettings.geminiToken || ''}
                      onChange={(e) => update('geminiToken', e.target.value)}
                      placeholder="AIzaSy..."
                    />
                    <button
                      type="button"
                      className="key-peek-btn"
                      onClick={() => setShowGeminiKey((v) => !v)}
                      title={showGeminiKey ? 'Hide key' : 'Show key'}
                    >
                      {showGeminiKey ? '🙈' : '👁️'}
                    </button>
                    <button
                      type="button"
                      className="key-test-btn"
                      onClick={() => handleTestToken('gemini')}
                      title="Validate Gemini Key"
                    >
                      Test
                    </button>
                  </div>
                  <span className="field-hint">Enables Gemini 2.5 Flash, Gemini 1.5 Pro, and advanced models.</span>
                </div>

                <div className="settings-field">
                  <div className="field-header-row">
                    <label>OpenAI / ChatGPT API Key</label>
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="field-link"
                    >
                      Get OpenAI API Key ↗
                    </a>
                  </div>
                  <div className="key-input-wrap">
                    <input
                      type={showOpenaiKey ? 'text' : 'password'}
                      className="settings-input"
                      value={localSettings.openaiToken || ''}
                      onChange={(e) => update('openaiToken', e.target.value)}
                      placeholder="sk-proj-..."
                    />
                    <button
                      type="button"
                      className="key-peek-btn"
                      onClick={() => setShowOpenaiKey((v) => !v)}
                      title={showOpenaiKey ? 'Hide key' : 'Show key'}
                    >
                      {showOpenaiKey ? '🙈' : '👁️'}
                    </button>
                    <button
                      type="button"
                      className="key-test-btn"
                      onClick={() => handleTestToken('openai')}
                      title="Validate OpenAI Key"
                    >
                      Test
                    </button>
                  </div>
                  <span className="field-hint">Enables GPT-4o, GPT-4o mini, and o3-mini models.</span>
                </div>

                {testMessage && (
                  <div className={`token-test-alert ${testStatus}`}>
                    {testMessage}
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: DATA & EXPORT */}
            {activeTab === 'data' && (
              <div className="settings-section">
                <div className="settings-field">
                  <label>Export Conversation History</label>
                  <p className="field-desc">Download complete conversation transcript with all prompts and responses.</p>
                  <div className="export-btn-group">
                    <button
                      type="button"
                      className="ghost settings-action-btn"
                      onClick={() => onExportAllChats && onExportAllChats('markdown')}
                    >
                      📥 Export as Markdown (.md)
                    </button>
                    <button
                      type="button"
                      className="ghost settings-action-btn"
                      onClick={() => onExportAllChats && onExportAllChats('json')}
                    >
                      📥 Export as JSON (.json)
                    </button>
                  </div>
                </div>

                <div className="settings-field danger-zone">
                  <label>Clear Chat Conversation</label>
                  <p className="field-desc">Deletes all messages in the active thread.</p>
                  <button
                    type="button"
                    className="danger-btn"
                    onClick={() => {
                      if (window.confirm('Are you sure you want to clear this entire conversation?')) {
                        onClearAllChats && onClearAllChats()
                        onClose()
                      }
                    }}
                  >
                    🗑️ Clear Active Thread
                  </button>
                </div>

                <div className="settings-field">
                  <label>Reset Settings to Defaults</label>
                  <p className="field-desc">Restores all studio visual and AI options to default values.</p>
                  <button
                    type="button"
                    className="ghost tiny"
                    onClick={() => {
                      if (window.confirm('Reset all settings to default configuration?')) {
                        setLocalSettings(DEFAULT_SETTINGS)
                      }
                    }}
                  >
                    Reset All Preferences
                  </button>
                </div>

                <div className="system-info-box">
                  <strong>Aether Studio v1.0.0</strong>
                  <span>Engine: WebFS + Dual Local/Direct AI Client</span>
                  <span>Port: 4576</span>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Footer with Save / Cancel */}
        <div className="settings-foot">
          {saveToast && <span className="save-toast-tag">✓ Preferences Saved!</span>}
          <div className="foot-actions">
            <button type="button" className="ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="primary save-settings-btn" onClick={handleSave}>
              Save Preferences
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsModal
