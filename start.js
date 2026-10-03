const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

const ROOT = __dirname
const BACKEND_DIR = path.join(ROOT, 'backend')
const FRONTEND_DIR = path.join(ROOT, 'frontend')

const isWin = process.platform === 'win32'
const npmCmd = isWin ? 'npm.cmd' : 'npm'

function runCommandSync(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    console.log(`[setup] Running ${cmd} ${args.join(' ')} in ${path.relative(ROOT, cwd) || '.'}...`)
    const child = spawn(cmd, args, { cwd, stdio: 'inherit', shell: isWin })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Command ${cmd} exited with code ${code}`))
    })
  })
}

async function ensureInstalled() {
  const backendModules = path.join(BACKEND_DIR, 'node_modules')
  const frontendModules = path.join(FRONTEND_DIR, 'node_modules')

  if (!fs.existsSync(backendModules)) {
    console.log('[setup] Installing backend dependencies...')
    await runCommandSync(npmCmd, ['install'], BACKEND_DIR)
  }

  if (!fs.existsSync(frontendModules)) {
    console.log('[setup] Installing frontend dependencies...')
    await runCommandSync(npmCmd, ['install'], FRONTEND_DIR)
  }
}

async function main() {
  await ensureInstalled()

  console.log('\n==================================================')
  console.log('  🚀 Starting Aether Studio...')
  console.log('  • App (Web): http://localhost:4576')
  console.log('  • Backend  : http://localhost:3090')
  console.log('==================================================\n')

  const backend = spawn('node', ['server.js'], {
    cwd: BACKEND_DIR,
    stdio: 'inherit',
    env: { ...process.env }
  })

  const frontend = spawn(npmCmd, ['run', 'dev'], {
    cwd: FRONTEND_DIR,
    stdio: 'inherit',
    shell: isWin
  })

  function cleanup() {
    console.log('\n[studio] Shutting down servers...')
    try {
      if (backend && !backend.killed) {
        if (isWin && backend.pid) {
          spawn('taskkill', ['/pid', String(backend.pid), '/T', '/F'])
        } else {
          backend.kill()
        }
      }
    } catch {}

    try {
      if (frontend && !frontend.killed) {
        if (isWin && frontend.pid) {
          spawn('taskkill', ['/pid', String(frontend.pid), '/T', '/F'])
        } else {
          frontend.kill()
        }
      }
    } catch {}

    process.exit(0)
  }

  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  backend.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[backend] exited with code ${code}`)
    }
  })

  frontend.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[frontend] exited with code ${code}`)
    }
  })
}

main().catch((err) => {
  console.error('[error]', err)
  process.exit(1)
})
