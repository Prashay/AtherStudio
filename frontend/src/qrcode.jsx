// Minimal QR Code generator for URLs (Byte mode, Error Correction Level L)
// Supports Version 1-5 (up to ~106 alphanumeric/URL chars)

function getQRCodeModules(text) {
  // Simple Reed-Solomon GF(256) polynomials & table
  const GF256 = new Uint8Array(512)
  const LOG = new Uint8Array(256)
  let x = 1
  for (let i = 0; i < 255; i++) {
    GF256[i] = x
    GF256[i + 255] = x
    LOG[x] = i
    x = (x << 1) ^ (x >= 128 ? 0x11d : 0)
  }

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0
    return GF256[LOG[a] + LOG[b]]
  }

  // Version 3 (29x29) handles up to 44 bytes, Version 4 (33x33) handles 64 bytes, Version 5 (37x37) handles 86 bytes
  const bytes = new TextEncoder().encode(text)
  let version = 3
  if (bytes.length > 44) version = 4
  if (bytes.length > 64) version = 5
  if (bytes.length > 86) version = 6

  const totalDataBytes = [0, 19, 34, 55, 80, 108, 136][version]
  const ecBytes = [0, 7, 10, 15, 20, 26, 36][version]
  const size = 17 + version * 4

  // Bit buffer: 4-bit mode indicator (0100 for byte) + 8-bit length + data + 4-bit terminator
  const bits = []
  function pushBits(val, len) {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1)
  }
  pushBits(4, 4) // 8-bit byte mode
  pushBits(bytes.length, 8)
  for (const b of bytes) pushBits(b, 8)
  pushBits(0, 4) // terminator
  while (bits.length % 8 !== 0) bits.push(0)

  // Pad bytes
  const padBytes = [0xec, 0x11]
  let padIdx = 0
  while (bits.length / 8 < totalDataBytes) {
    pushBits(padBytes[padIdx % 2], 8)
    padIdx++
  }

  // Convert bits to data codewords
  const data = new Uint8Array(totalDataBytes)
  for (let i = 0; i < totalDataBytes; i++) {
    let byteVal = 0
    for (let b = 0; b < 8; b++) {
      byteVal = (byteVal << 1) | bits[i * 8 + b]
    }
    data[i] = byteVal
  }

  // Generate Error Correction Codewords using Reed-Solomon
  const genPoly = [1]
  for (let i = 0; i < ecBytes; i++) {
    const next = new Array(genPoly.length + 1).fill(0)
    for (let j = 0; j < genPoly.length; j++) {
      next[j] ^= gfMul(genPoly[j], GF256[i])
      next[j + 1] ^= genPoly[j]
    }
    genPoly.length = next.length
    for (let j = 0; j < next.length; j++) genPoly[j] = next[j]
  }

  const ec = new Uint8Array(ecBytes)
  for (let i = 0; i < totalDataBytes; i++) {
    const factor = data[i] ^ ec[0]
    for (let j = 0; j < ecBytes - 1; j++) {
      ec[j] = ec[j + 1] ^ gfMul(genPoly[j + 1], factor)
    }
    ec[ecBytes - 1] = gfMul(genPoly[ecBytes], factor)
  }

  // Matrix setup
  const matrix = Array.from({ length: size }, () => new Array(size).fill(null))

  function fillRect(r, c, w, h, val) {
    for (let i = 0; i < h; i++) {
      for (let j = 0; j < w; j++) {
        if (r + i < size && c + j < size) matrix[r + i][c + j] = val
      }
    }
  }

  // Finder patterns
  function addFinder(r, c) {
    fillRect(r, c, 7, 7, true)
    fillRect(r + 1, c + 1, 5, 5, false)
    fillRect(r + 2, c + 2, 3, 3, true)
    // Separators
    for (let i = -1; i <= 7; i++) {
      if (r + i >= 0 && r + i < size) {
        if (c - 1 >= 0) matrix[r + i][c - 1] = false
        if (c + 7 < size) matrix[r + i][c + 7] = false
      }
      if (c + i >= 0 && c + i < size) {
        if (r - 1 >= 0) matrix[r - 1][c + i] = false
        if (r + 7 < size) matrix[r + 7][c + i] = false
      }
    }
  }

  addFinder(0, 0)
  addFinder(0, size - 7)
  addFinder(size - 7, 0)

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (matrix[6][i] === null) matrix[6][i] = i % 2 === 0
    if (matrix[i][6] === null) matrix[i][6] = i % 2 === 0
  }

  // Dark module
  matrix[4 * version + 9][8] = true

  // Alignment patterns for version >= 2
  const alignPos = [
    [],
    [],
    [6, 18],
    [6, 22],
    [6, 26],
    [6, 30],
    [6, 34]
  ][version] || []

  for (const r of alignPos) {
    for (const c of alignPos) {
      if (matrix[r][c] !== null) continue
      fillRect(r - 2, c - 2, 5, 5, true)
      fillRect(r - 1, c - 1, 3, 3, false)
      matrix[r][c] = true
    }
  }

  // Format reserve
  for (let i = 0; i < 9; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false
    if (matrix[i][8] === null) matrix[i][8] = false
  }
  for (let i = 0; i < 8; i++) {
    if (matrix[8][size - 1 - i] === null) matrix[8][size - 1 - i] = false
    if (matrix[size - 1 - i][8] === null) matrix[size - 1 - i][8] = false
  }

  // Interleave data and ec bits
  const allCodewords = [...data, ...ec]
  const dataBits = []
  for (const cw of allCodewords) {
    for (let b = 7; b >= 0; b--) {
      dataBits.push((cw >> b) & 1)
    }
  }

  // Place data bits with standard mask 0 ((row + col) % 2 === 0)
  let bitIdx = 0
  let right = size - 1
  let upward = true

  while (right > 0) {
    if (right === 6) right--
    for (let vert = 0; vert < size; vert++) {
      const row = upward ? size - 1 - vert : vert
      for (let colOffset = 0; colOffset < 2; colOffset++) {
        const col = right - colOffset
        if (matrix[row][col] === null) {
          let bit = bitIdx < dataBits.length ? dataBits[bitIdx++] : 0
          // Apply mask 0: (row + col) % 2 === 0
          if ((row + col) % 2 === 0) bit ^= 1
          matrix[row][col] = bit === 1
        }
      }
    }
    upward = !upward
    right -= 2
  }

  // Format bits for L level + mask 0 (0x77c4 with BCH code)
  const formatBits = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0]
  for (let i = 0; i < 6; i++) matrix[8][i] = formatBits[i] === 1
  matrix[8][7] = formatBits[6] === 1
  matrix[8][8] = formatBits[7] === 1
  matrix[7][8] = formatBits[8] === 1
  for (let i = 0; i < 6; i++) matrix[5 - i][8] = formatBits[9 + i] === 1

  for (let i = 0; i < 8; i++) matrix[size - 1 - i][8] = formatBits[i] === 1
  for (let i = 0; i < 7; i++) matrix[8][size - 7 + i] = formatBits[8 + i] === 1

  return matrix
}

export { getQRCodeModules }

export function downloadQRCodePNG(text, filename = 'aether-studio-qr.png') {
  if (typeof document === 'undefined' || !text) return false
  try {
    const modules = getQRCodeModules(text)
    if (!modules || !modules.length) return false
    const count = modules.length
    const canvas = document.createElement('canvas')
    const width = 560
    const height = 640
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return false

    // Sleek dark gradient background
    const bgGrad = ctx.createLinearGradient(0, 0, width, height)
    bgGrad.addColorStop(0, '#0c1016')
    bgGrad.addColorStop(0.5, '#0f1722')
    bgGrad.addColorStop(1, '#090d13')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, width, height)

    // Glowing cyber neon border
    const borderGrad = ctx.createLinearGradient(0, 0, width, height)
    borderGrad.addColorStop(0, '#38bdf8')
    borderGrad.addColorStop(0.5, '#818cf8')
    borderGrad.addColorStop(1, '#c084fc')
    ctx.strokeStyle = borderGrad
    ctx.lineWidth = 4
    ctx.strokeRect(18, 18, width - 36, height - 36)

    // Title & Subtitle header
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('AETHER AI STUDIO', width / 2, 58)

    ctx.fillStyle = '#94a3b8'
    ctx.font = '13px system-ui, -apple-system, sans-serif'
    ctx.fillText('Scan with Phone Camera to Install / Open', width / 2, 82)

    // QR Code Box background
    const qrBoxSize = 400
    const qrX = (width - qrBoxSize) / 2
    const qrY = 108
    ctx.fillStyle = '#131920'
    ctx.fillRect(qrX, qrY, qrBoxSize, qrBoxSize)
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.lineWidth = 1.5
    ctx.strokeRect(qrX, qrY, qrBoxSize, qrBoxSize)

    // QR Modules
    const padding = 24
    const drawSize = qrBoxSize - padding * 2
    const cellSize = drawSize / count
    ctx.fillStyle = '#f3ead8'
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (modules[r][c]) {
          ctx.fillRect(
            qrX + padding + c * cellSize,
            qrY + padding + r * cellSize,
            cellSize + 0.5,
            cellSize + 0.5
          )
        }
      }
    }

    // Footer URL display
    ctx.fillStyle = '#38bdf8'
    ctx.font = '500 12px "Courier New", monospace'
    const shortUrl = text.length > 55 ? text.slice(0, 52) + '...' : text
    ctx.fillText(shortUrl, width / 2, 545)

    ctx.fillStyle = '#64748b'
    ctx.font = '11px system-ui, -apple-system, sans-serif'
    ctx.fillText('Instant Mobile Web App • iOS & Android', width / 2, 575)

    // Trigger download
    const link = document.createElement('a')
    link.download = filename
    link.href = canvas.toDataURL('image/png')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    return true
  } catch (err) {
    console.error('downloadQRCodePNG failed:', err)
    return false
  }
}

export function QRCodeSVG({ text, size = 180, color = '#f3ead8', bg = '#131920' }) {
  if (!text) return null
  let modules
  try {
    modules = getQRCodeModules(text)
  } catch {
    return null
  }
  const count = modules.length
  const cellSize = size / (count + 4)

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ borderRadius: 12, overflow: 'hidden', background: bg, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}
    >
      <rect width={size} height={size} fill={bg} />
      {modules.map((row, r) =>
        row.map((cell, c) => {
          if (!cell) return null
          return (
            <rect
              key={`${r}-${c}`}
              x={(c + 2) * cellSize}
              y={(r + 2) * cellSize}
              width={cellSize + 0.5}
              height={cellSize + 0.5}
              fill={color}
            />
          )
        })
      )}
    </svg>
  )
}
