import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const NEW_ICON_SRC = 'C:/Users/prashant jha/.gemini/antigravity-ide/brain/c1c53039-900b-46a4-9be3-2702fdc840c9/.user_uploaded/media_1791092477824.jpg'

try {
  if (fs.existsSync(NEW_ICON_SRC)) {
    const pubDir = path.join(__dirname, 'public')
    const distDir = path.join(__dirname, 'dist')
    const buf = fs.readFileSync(NEW_ICON_SRC)
    const b64 = buf.toString('base64')
    const dataUri = `data:image/jpeg;base64,${b64}`

    // 1. Write direct binary JPEG assets
    const imgTargets = ['favicon.jpg', 'favicon.jpeg', 'logo.jpg', 'logo.png', 'icon.jpg', 'icon-preview.jpg']
    for (const t of imgTargets) {
      fs.copyFileSync(NEW_ICON_SRC, path.join(pubDir, t))
      if (fs.existsSync(distDir)) {
        fs.copyFileSync(NEW_ICON_SRC, path.join(distDir, t))
      }
    }

    // 2. Generate 100% self-contained SVG favicon with matching high-impact edge, specular glare, and neon aura
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <filter id="neonBlur" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" result="blur" />
    </filter>
    <linearGradient id="specularGlare" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.38" />
      <stop offset="35%" stop-color="#38bdf8" stop-opacity="0.22" />
      <stop offset="65%" stop-color="#a855f7" stop-opacity="0.08" />
      <stop offset="100%" stop-color="transparent" stop-opacity="0" />
    </linearGradient>
    <linearGradient id="rimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="50%" stop-color="#818cf8" />
      <stop offset="100%" stop-color="#c084fc" />
    </linearGradient>
    <clipPath id="sqClip">
      <rect x="18" y="18" width="476" height="476" rx="108" />
    </clipPath>
  </defs>

  <!-- Ambient Outer Neon Aura -->
  <rect x="22" y="22" width="468" height="468" rx="104" fill="none" stroke="#38bdf8" stroke-width="16" opacity="0.45" filter="url(#neonBlur)" />
  <rect x="22" y="22" width="468" height="468" rx="104" fill="none" stroke="#a855f7" stroke-width="12" opacity="0.35" filter="url(#neonBlur)" />

  <!-- Main Image with Squircle Clip -->
  <g clip-path="url(#sqClip)">
    <image href="${dataUri}" x="18" y="18" width="476" height="476" preserveAspectRatio="xMidYMid slice" />
    <!-- Diagonal Specular 3D Glass Sheen -->
    <rect x="18" y="18" width="476" height="476" fill="url(#specularGlare)" />
    <!-- Inner Neon Edge Glow -->
    <rect x="20" y="20" width="472" height="472" rx="106" fill="none" stroke="rgba(56, 189, 248, 0.35)" stroke-width="8" />
  </g>

  <!-- Double-Sheen High-Impact Edge Border Rings -->
  <rect x="18" y="18" width="476" height="476" rx="108" fill="none" stroke="url(#rimGrad)" stroke-width="6" />
  <rect x="22" y="22" width="468" height="468" rx="104" fill="none" stroke="rgba(255, 255, 255, 0.45)" stroke-width="2.5" />
</svg>`

    fs.writeFileSync(path.join(pubDir, 'favicon.svg'), svgContent, 'utf8')
    fs.writeFileSync(path.join(pubDir, 'icon.svg'), svgContent, 'utf8')
    if (fs.existsSync(distDir)) {
      fs.writeFileSync(path.join(distDir, 'favicon.svg'), svgContent, 'utf8')
      fs.writeFileSync(path.join(distDir, 'icon.svg'), svgContent, 'utf8')
    }
    console.log('[icon-sync] Successfully generated self-contained SVG and JPEG favicons')
  }
} catch (e) {
  console.error('Failed to sync icon:', e)
}

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 4576,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3090',
        changeOrigin: true
      }
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 4576,
    allowedHosts: true
  }
})

