const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const ROOT = __dirname
const BUILD_DIR = path.join(ROOT, 'build')
const PUBLIC_DIR = path.join(ROOT, 'frontend', 'public')

if (!fs.existsSync(BUILD_DIR)) fs.mkdirSync(BUILD_DIR, { recursive: true })
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true })

// 1. Copy generated high-res AI icon if available
const SRC_ART = 'C:\\Users\\prashant jha\\.gemini\\antigravity-ide\\brain\\c1c53039-900b-46a4-9be3-2702fdc840c9\\ather_spark_core_1791091831953.jpg'
if (fs.existsSync(SRC_ART)) {
  fs.copyFileSync(SRC_ART, path.join(BUILD_DIR, 'icon-preview.jpg'))
  fs.copyFileSync(SRC_ART, path.join(PUBLIC_DIR, 'icon-preview.jpg'))
  fs.copyFileSync(SRC_ART, path.join(PUBLIC_DIR, 'favicon.png'))
  fs.copyFileSync(SRC_ART, path.join(PUBLIC_DIR, 'icon.png'))
  console.log('✓ Copied HD icon preview to build and public directories')
}

// 2. Pure Node.js high-resolution PNG generator (Zero external dependencies)
function createCRC32Table() {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[i] = c
  }
  return table
}

const crcTable = createCRC32Table()
function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function makeChunk(type, data) {
  const len = data.length
  const chunk = Buffer.alloc(12 + len)
  chunk.writeUInt32BE(len, 0)
  chunk.write(type, 4, 4, 'ascii')
  data.copy(chunk, 8)
  const toCrc = Buffer.alloc(4 + len)
  toCrc.write(type, 0, 4, 'ascii')
  data.copy(toCrc, 4)
  chunk.writeUInt32BE(crc32(toCrc), 8 + len)
  return chunk
}

function generatePngBuffer(size = 512) {
  const width = size
  const height = size
  const cx = width / 2
  const cy = height / 2

  // Raw RGBA scanlines: 1 filter byte (0x00) per row
  const raw = Buffer.alloc((width * 4 + 1) * height)

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (width * 4 + 1)
    raw[rowOffset] = 0 // Filter type: None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4
      const dx = x - cx
      const dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)

      // Squircle boundary (Apple iOS superellipse: (x/a)^4 + (y/b)^4 <= 1)
      const sqRadius = size * 0.45
      const sqDist = Math.pow(Math.abs(dx) / sqRadius, 4.2) + Math.pow(Math.abs(dy) / sqRadius, 4.2)

      if (sqDist > 1.05) {
        // Transparent outside squircle
        raw[pxOffset + 0] = 0
        raw[pxOffset + 1] = 0
        raw[pxOffset + 2] = 0
        raw[pxOffset + 3] = 0
        continue
      }

      // Base Obsidian dark gradient
      const normY = y / height
      let r = 18 - normY * 12
      let g = 10 - normY * 8
      let b = 38 - normY * 26
      let a = 255

      // Squircle anti-aliasing rim
      if (sqDist > 0.96) {
        const edgeAlpha = Math.max(0, Math.min(1, (1.05 - sqDist) / 0.09))
        a = Math.floor(255 * edgeAlpha)
        // Specular glass border rim
        r = Math.min(255, r + 45 * edgeAlpha)
        g = Math.min(255, g + 80 * edgeAlpha)
        b = Math.min(255, b + 120 * edgeAlpha)
      }

      // Ambient Aurora Glow (Cyan, Violet, Rose)
      const auraDist = dist / (size * 0.42)
      if (auraDist < 1.0) {
        const auraFade = Math.pow(1 - auraDist, 1.8)
        r = Math.min(255, r + 130 * auraFade)
        g = Math.min(255, g + 70 * auraFade)
        b = Math.min(255, b + 240 * auraFade)
      }

      // 3D Orbital Gyroscope Ring 1 (Tilted ellipse)
      const cos1 = Math.cos(-0.55), sin1 = Math.sin(-0.55)
      const rx1 = dx * cos1 - dy * sin1
      const ry1 = (dx * sin1 + dy * cos1) * 2.6
      const rDist1 = Math.abs(Math.sqrt(rx1 * rx1 + ry1 * ry1) - (size * 0.36))
      if (rDist1 < 6.0) {
        const ringAlpha = Math.max(0, 1 - rDist1 / 6.0)
        r = Math.min(255, r + 0 * ringAlpha)
        g = Math.min(255, g + 230 * ringAlpha)
        b = Math.min(255, b + 255 * ringAlpha)
      }

      // 3D Orbital Gyroscope Ring 2 (Counter-tilted)
      const cos2 = Math.cos(0.62), sin2 = Math.sin(0.62)
      const rx2 = dx * cos2 - dy * sin2
      const ry2 = (dx * sin2 + dy * cos2) * 2.5
      const rDist2 = Math.abs(Math.sqrt(rx2 * rx2 + ry2 * ry2) - (size * 0.34))
      if (rDist2 < 5.0) {
        const ringAlpha2 = Math.max(0, 1 - rDist2 / 5.0)
        r = Math.min(255, r + 245 * ringAlpha2)
        g = Math.min(255, g + 60 * ringAlpha2)
        b = Math.min(255, b + 140 * ringAlpha2)
      }

      // Core Siri Intelligence Sphere
      const sphereR = size * 0.22
      if (dist < sphereR) {
        const sphereNorm = dist / sphereR
        const coreGlow = Math.pow(1 - sphereNorm, 1.2)

        // Fluid multi-color plasma mixing inside sphere
        const angle = Math.atan2(dy, dx)
        const wave = Math.sin(angle * 3 + dist * 0.05) * 0.5 + 0.5

        r = Math.min(255, 30 + (220 * (1 - wave) + 255 * wave) * coreGlow)
        g = Math.min(255, 10 + (240 * (1 - wave) + 80 * wave) * coreGlow)
        b = Math.min(255, 60 + (255 * (1 - wave) + 220 * wave) * coreGlow)

        // Glass sphere specular highlight in top-left
        const specDist = Math.sqrt((dx + sphereR * 0.35) ** 2 + (dy + sphereR * 0.35) ** 2)
        if (specDist < sphereR * 0.55) {
          const specAlpha = Math.pow(1 - specDist / (sphereR * 0.55), 2.2)
          r = Math.min(255, r + 220 * specAlpha)
          g = Math.min(255, g + 240 * specAlpha)
          b = Math.min(255, b + 255 * specAlpha)
        }

        // Central white-hot singularity core
        if (dist < sphereR * 0.28) {
          const hotCore = Math.pow(1 - dist / (sphereR * 0.28), 1.5)
          r = Math.min(255, r + 255 * hotCore)
          g = Math.min(255, g + 255 * hotCore)
          b = Math.min(255, b + 255 * hotCore)
        }

        // Crisp sphere border
        if (dist > sphereR * 0.92) {
          const borderAlpha = (dist - sphereR * 0.92) / (sphereR * 0.08)
          r = Math.min(255, r + 150 * borderAlpha)
          g = Math.min(255, g + 200 * borderAlpha)
          b = Math.min(255, b + 255 * borderAlpha)
        }
      }

      // Starlight Satellites (Tiny bright photon nodes)
      const sat1Dist = Math.sqrt((dx - size * 0.28) ** 2 + (dy + size * 0.16) ** 2)
      if (sat1Dist < 6) {
        const satAlpha = 1 - sat1Dist / 6
        r = Math.min(255, r + 255 * satAlpha)
        g = Math.min(255, g + 255 * satAlpha)
        b = Math.min(255, b + 255 * satAlpha)
      }

      const sat2Dist = Math.sqrt((dx + size * 0.26) ** 2 + (dy - size * 0.17) ** 2)
      if (sat2Dist < 5) {
        const satAlpha2 = 1 - sat2Dist / 5
        r = Math.min(255, r + 255 * satAlpha2)
        g = Math.min(255, g + 100 * satAlpha2)
        b = Math.min(255, b + 180 * satAlpha2)
      }

      raw[pxOffset + 0] = Math.round(r)
      raw[pxOffset + 1] = Math.round(g)
      raw[pxOffset + 2] = Math.round(b)
      raw[pxOffset + 3] = Math.round(a)
    }
  }

  // PNG Assembly
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 6  // color type: RGBA
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  const idat = zlib.deflateSync(raw, { level: 9 })
  const iend = Buffer.alloc(0)

  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', iend)
  ])
}

// 3. Package 256x256 PNG inside Windows .ico structure
function generateIcoFromPng(pngBuf) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // Reserved
  header.writeUInt16LE(1, 2) // Type: ICO
  header.writeUInt16LE(1, 4) // 1 image

  const entry = Buffer.alloc(16)
  entry.writeUInt8(0, 0)       // Width: 256 (0 means 256)
  entry.writeUInt8(0, 1)       // Height: 256
  entry.writeUInt8(0, 2)       // Colors: No palette
  entry.writeUInt8(0, 3)       // Reserved
  entry.writeUInt16LE(1, 4)    // Planes
  entry.writeUInt16LE(32, 6)   // Bits per pixel
  entry.writeUInt32LE(pngBuf.length, 8)  // Size of image data
  entry.writeUInt32LE(22, 12)  // Offset of image data (6 header + 16 entry = 22)

  return Buffer.concat([header, entry, pngBuf])
}

console.log('Generating high-resolution 512x512 Arther Studio PNG icon...')
const png512 = generatePngBuffer(512)
fs.writeFileSync(path.join(BUILD_DIR, 'icon.png'), png512)
fs.writeFileSync(path.join(PUBLIC_DIR, 'icon.png'), png512)
console.log('✓ Generated build/icon.png and frontend/public/icon.png')

console.log('Generating 192x192 mobile phone PWA icon...')
const png192 = generatePngBuffer(192)
fs.writeFileSync(path.join(PUBLIC_DIR, 'icon-192.png'), png192)
console.log('✓ Generated frontend/public/icon-192.png for mobile')

console.log('Generating 256x256 Windows .ico file for Electron...')
const png256 = generatePngBuffer(256)
const icoBuf = generateIcoFromPng(png256)
fs.writeFileSync(path.join(BUILD_DIR, 'icon.ico'), icoBuf)
console.log('✓ Generated build/icon.ico for Windows .exe packaging')

console.log('\nAll stylish cross-platform icons generated successfully!')
