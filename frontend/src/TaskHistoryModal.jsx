import React, { useState, useMemo } from 'react'

export const TASK_HISTORY_KEY = 'aether.task_history.v1'

export function loadTaskHistory() {
  try {
    const raw = localStorage.getItem(TASK_HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveTaskHistory(history) {
  try {
    localStorage.setItem(TASK_HISTORY_KEY, JSON.stringify(history.slice(0, 80)))
  } catch (err) {
    console.error('Failed to save task history:', err)
  }
}

function formatRelativeTime(ts) {
  if (!ts) return 'Earlier'
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function TaskHistoryModal({
  isOpen,
  onClose,
  history = [],
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  onClearHistory,
  onExportSession
}) {
  const [search, setSearch] = useState('')
  const [filterMode, setFilterMode] = useState('all') // 'all' | 'agent' | 'chat' | 'editor'
  const [confirmClear, setConfirmClear] = useState(false)

  if (!isOpen) return null

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      if (filterMode !== 'all' && item.mode !== filterMode) return false
      if (search.trim()) {
        const query = search.toLowerCase()
        const titleMatch = (item.title || '').toLowerCase().includes(query)
        const msgMatch = (item.messages || []).some((m) =>
          (m.text || '').toLowerCase().includes(query)
        )
        return titleMatch || msgMatch
      }
      return true
    })
  }, [history, filterMode, search])

  return (
    <div className="modal-back history-modal-back" onClick={onClose}>
      <div className="modal history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />

        {/* Modal Header */}
        <div className="history-modal-header">
          <div className="history-header-title">
            <span className="history-header-icon">📜</span>
            <div>
              <h3>Task &amp; Chat History</h3>
              <p>Revisit past tasks, resume conversations, or export transcripts</p>
            </div>
          </div>
          <button
            type="button"
            className="ghost tiny close-btn"
            onClick={onClose}
            title="Close History (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="history-controls-row">
          <div className="history-search-wrap">
            <span className="history-search-icon">🔍</span>
            <input
              type="text"
              className="history-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search previous tasks, queries &amp; code..."
              autoFocus
            />
            {search && (
              <button
                type="button"
                className="history-search-clear"
                onClick={() => setSearch('')}
              >
                ✕
              </button>
            )}
          </div>

          <div className="history-filter-pills">
            <button
              type="button"
              className={`history-pill ${filterMode === 'all' ? 'active' : ''}`}
              onClick={() => setFilterMode('all')}
            >
              All ({history.length})
            </button>
            <button
              type="button"
              className={`history-pill ${filterMode === 'chat' ? 'active' : ''}`}
              onClick={() => setFilterMode('chat')}
            >
              💬 Chat
            </button>
            <button
              type="button"
              className={`history-pill ${filterMode === 'agent' ? 'active' : ''}`}
              onClick={() => setFilterMode('agent')}
            >
              🤖 Agent
            </button>
            <button
              type="button"
              className={`history-pill ${filterMode === 'editor' ? 'active' : ''}`}
              onClick={() => setFilterMode('editor')}
            >
              📝 Editor
            </button>
          </div>
        </div>

        {/* Sessions List */}
        <div className="history-list-wrap">
          {!filteredHistory.length ? (
            <div className="history-empty-state">
              <span className="empty-ico">📭</span>
              <h4>{search ? 'No matching tasks found' : 'No task history yet'}</h4>
              <p>
                {search
                  ? `No previous sessions match "${search}". Try a different keyword.`
                  : 'Past tasks and conversations are automatically saved here so you can review and resume them anytime.'}
              </p>
            </div>
          ) : (
            <div className="history-cards-grid">
              {filteredHistory.map((item) => {
                const isCurrent = item.id === currentSessionId
                const firstUser = (item.messages || []).find((m) => m.role === 'user')
                const snippet = firstUser?.text || 'Empty conversation'
                const msgCount = (item.messages || []).length

                return (
                  <div
                    key={item.id}
                    className={`history-card ${isCurrent ? 'active-current' : ''}`}
                  >
                    <div className="history-card-top">
                      <div className="history-card-badges">
                        <span className={`history-mode-tag mode-${item.mode || 'chat'}`}>
                          {item.mode === 'agent' ? '🤖 Agent' : item.mode === 'editor' ? '📝 Editor' : '💬 Chat'}
                        </span>
                        {item.modelLabel && (
                          <span className="history-model-tag">{item.modelLabel}</span>
                        )}
                        {isCurrent && (
                          <span className="history-current-pill">● Active</span>
                        )}
                      </div>
                      <span className="history-time-stamp">
                        {formatRelativeTime(item.updatedAt || item.createdAt)}
                      </span>
                    </div>

                    <h4 className="history-card-title" title={item.title}>
                      {item.title || snippet.slice(0, 48)}
                    </h4>

                    <p className="history-card-snippet">
                      {snippet.slice(0, 140)}
                      {snippet.length > 140 ? '...' : ''}
                    </p>

                    <div className="history-card-footer">
                      <span className="history-msg-count">
                        💬 {msgCount} {msgCount === 1 ? 'message' : 'messages'}
                      </span>

                      <div className="history-card-actions">
                        <button
                          type="button"
                          className="history-action-btn primary"
                          onClick={() => {
                            onSelectSession(item)
                            onClose()
                          }}
                          title="Open and resume this session"
                        >
                          ▶ Resume
                        </button>
                        <button
                          type="button"
                          className="history-action-btn"
                          onClick={() => onExportSession(item, 'markdown')}
                          title="Export conversation as Markdown"
                        >
                          📥 .md
                        </button>
                        <button
                          type="button"
                          className="history-action-btn"
                          onClick={() => onExportSession(item, 'json')}
                          title="Export session data as JSON"
                        >
                          📄 .json
                        </button>
                        <button
                          type="button"
                          className="history-action-btn delete-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteSession(item.id)
                          }}
                          title="Delete session from history"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="history-modal-footer">
          <div className="history-footer-left">
            <span>
              Total Saved Sessions: <strong>{history.length}</strong>
            </span>
            {history.length > 0 && !confirmClear && (
              <button
                type="button"
                className="ghost tiny danger-text"
                onClick={() => setConfirmClear(true)}
              >
                Clear All History
              </button>
            )}
            {confirmClear && (
              <div className="confirm-clear-row">
                <span className="danger-text">Delete all?</span>
                <button
                  type="button"
                  className="ghost tiny danger-btn"
                  onClick={() => {
                    onClearHistory()
                    setConfirmClear(false)
                  }}
                >
                  Yes, Clear All
                </button>
                <button
                  type="button"
                  className="ghost tiny"
                  onClick={() => setConfirmClear(false)}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <button type="button" className="primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
