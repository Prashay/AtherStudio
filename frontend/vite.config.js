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

    // 2. Generate 100% self-contained SVG favicon (no external sub-resources, works in all browsers)
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" width="512" height="512">
  <image href="${dataUri}" width="512" height="512" />
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

