import React, { useState } from 'react'

/**
 * High-performance, zero-dependency Markdown Parser and Renderer
 * Supports:
 * - Headings (h1 - h6)
 * - Code blocks with language tags and copy button
 * - Inline code
 * - Tables with headers and alignment
 * - Blockquotes
 * - Unordered lists, ordered lists, and task lists [ ] / [x]
 * - Bold, italic, strikethrough
 * - Links and images
 * - Horizontal rules
 */

function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="md-code-block">
      <div className="md-code-header">
        <span className="md-code-lang">{language || 'text'}</span>
        <button
          type="button"
          className="md-code-copy-btn"
          onClick={handleCopy}
          title="Copy code"
        >
          {copied ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Copied!</span>
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="md-code-pre">
        <code>{code}</code>
      </pre>
    </div>
  )
}

function renderInline(text) {
  if (!text) return ''

  // Tokenize inline markdown
  const tokens = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // 1. Inline code: `code`
    const codeMatch = remaining.match(/^`([^`]+)`/)
    if (codeMatch) {
      tokens.push(<code key={key++} className="md-inline-code">{codeMatch[1]}</code>)
      remaining = remaining.slice(codeMatch[0].length)
      continue
    }

    // 2. Bold + Italic: ***text*** or ___text___
    const boldItalicMatch = remaining.match(/^(\*\*\*|___)(.+?)\1/)
    if (boldItalicMatch) {
      tokens.push(<strong key={key++}><em>{renderInline(boldItalicMatch[2])}</em></strong>)
      remaining = remaining.slice(boldItalicMatch[0].length)
      continue
    }

    // 3. Bold: **text** or __text__
    const boldMatch = remaining.match(/^(\*\*|__)(.+?)\1/)
    if (boldMatch) {
      tokens.push(<strong key={key++}>{renderInline(boldMatch[2])}</strong>)
      remaining = remaining.slice(boldMatch[0].length)
      continue
    }

    // 4. Italic: *text* or _text_
    const italicMatch = remaining.match(/^(\*|_)(.+?)\1/)
    if (italicMatch) {
      tokens.push(<em key={key++}>{renderInline(italicMatch[2])}</em>)
      remaining = remaining.slice(italicMatch[0].length)
      continue
    }

    // 5. Strikethrough: ~~text~~
    const strikeMatch = remaining.match(/^~~(.+?)~~/)
    if (strikeMatch) {
      tokens.push(<del key={key++}>{renderInline(strikeMatch[1])}</del>)
      remaining = remaining.slice(strikeMatch[0].length)
      continue
    }

    // 6. Image: ![alt](url)
    const imgMatch = remaining.match(/^!\[([^\]]*)\]\(([^)]+)\)/)
    if (imgMatch) {
      tokens.push(
        <img
          key={key++}
          src={imgMatch[2]}
          alt={imgMatch[1] || 'image'}
          className="md-rendered-img"
          loading="lazy"
        />
      )
      remaining = remaining.slice(imgMatch[0].length)
      continue
    }

    // 7. Link: [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/)
    if (linkMatch) {
      tokens.push(
        <a
          key={key++}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="md-link"
        >
          {renderInline(linkMatch[1])}
        </a>
      )
      remaining = remaining.slice(linkMatch[0].length)
      continue
    }

    // 8. Plain text slice up to next token indicator
    const nextSpecial = remaining.search(/[`*_~![\]]/)
    if (nextSpecial === -1) {
      tokens.push(remaining)
      break
    } else if (nextSpecial === 0) {
      // Special char wasn't part of valid match, consume 1 character
      tokens.push(remaining[0])
      remaining = remaining.slice(1)
    } else {
      tokens.push(remaining.slice(0, nextSpecial))
      remaining = remaining.slice(nextSpecial)
    }
  }

  return tokens
}

export function MarkdownViewer({ content = '', className = '' }) {
  if (!content) {
    return <div className={`md-empty-view ${className}`}><em>Empty markdown document</em></div>
  }

  const lines = content.split('\n')
  const elements = []
  let i = 0
  let elemKey = 0

  while (i < lines.length) {
    const line = lines[i]

    // 1. Fenced Code Block
    if (line.trim().startsWith('```')) {
      const language = line.trim().slice(3).trim()
      const codeLines = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // Skip closing ```
      elements.push(
        <CodeBlock
          key={elemKey++}
          language={language}
          code={codeLines.join('\n')}
        />
      )
      continue
    }

    // 2. Horizontal Rule (---, ***, ___)
    if (/^(\s*[-*_]\s*){3,}$/.test(line)) {
      elements.push(<hr key={elemKey++} className="md-hr" />)
      i++
      continue
    }

    // 3. Headings (# H1 to ###### H6)
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const title = headingMatch[2]
      const Tag = `h${level}`
      elements.push(
        <Tag key={elemKey++} className={`md-heading md-h${level}`}>
          {renderInline(title)}
        </Tag>
      )
      i++
      continue
    }

    // 4. Blockquotes (> quote)
    if (line.trim().startsWith('>')) {
      const quoteLines = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ''))
        i++
      }
      elements.push(
        <blockquote key={elemKey++} className="md-blockquote">
          {quoteLines.map((ql, qIdx) => (
            <p key={qIdx}>{renderInline(ql)}</p>
          ))}
        </blockquote>
      )
      continue
    }

    // 5. Tables (| col 1 | col 2 |)
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines = []
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i])
        i++
      }

      if (tableLines.length >= 2) {
        const headerCells = tableLines[0]
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim())
        
        // Second line is separator (|---|---|)
        const rows = tableLines.slice(2).map((r) =>
          r
            .split('|')
            .slice(1, -1)
            .map((c) => c.trim())
        )

        elements.push(
          <div key={elemKey++} className="md-table-wrap">
            <table className="md-table">
              <thead>
                <tr>
                  {headerCells.map((h, hIdx) => (
                    <th key={hIdx}>{renderInline(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx}>{renderInline(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
        continue
      }
    }

    // 6. Lists (Unordered, Ordered, Task Lists)
    const unorderedMatch = line.match(/^(\s*)([-*+])\s+(.*)$/)
    const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/)

    if (unorderedMatch || orderedMatch) {
      const isOrdered = !!orderedMatch
      const listItems = []

      while (i < lines.length) {
        const currentLine = lines[i]
        const uMatch = currentLine.match(/^(\s*)([-*+])\s+(.*)$/)
        const oMatch = currentLine.match(/^(\s*)(\d+)\.\s+(.*)$/)

        if (isOrdered && oMatch) {
          listItems.push(oMatch[3])
          i++
        } else if (!isOrdered && uMatch) {
          listItems.push(uMatch[3])
          i++
        } else {
          break
        }
      }

      const ListTag = isOrdered ? 'ol' : 'ul'
      elements.push(
        <ListTag key={elemKey++} className={`md-list ${isOrdered ? 'md-ol' : 'md-ul'}`}>
          {listItems.map((item, itemIdx) => {
            // Check if task list item [ ] or [x]
            const taskMatch = item.match(/^\[([ xX])\]\s+(.*)$/)
            if (taskMatch) {
              const checked = taskMatch[1].toLowerCase() === 'x'
              return (
                <li key={itemIdx} className="md-task-item">
                  <input
                    type="checkbox"
                    readOnly
                    checked={checked}
                    className="md-checkbox"
                  />
                  <span>{renderInline(taskMatch[2])}</span>
                </li>
              )
            }
            return <li key={itemIdx}>{renderInline(item)}</li>
          })}
        </ListTag>
      )
      continue
    }

    // 7. Regular paragraph / empty line
    if (!line.trim()) {
      i++
      continue
    }

    elements.push(
      <p key={elemKey++} className="md-p">
        {renderInline(line)}
      </p>
    )
    i++
  }

  return <div className={`markdown-body ${className}`}>{elements}</div>
}

export default MarkdownViewer
