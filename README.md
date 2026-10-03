# Aether Studio

Aether is a local AI coding studio with an integrated code editor, workspace file tree, code search, and multi-model AI assistant (supporting free models via Pollinations as well as OpenAI and Google Gemini).

---

## ⚡ Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or newer recommended, tested on v24.x)
- npm (v9 or newer)

---

### 1. Install & Run in One Step

You can start the entire application (both backend and frontend) directly using Node.js:

```bash
node start.js
```

Or using `npm`:

```bash
npm start
```

> **Note:** `start.js` automatically checks and installs any missing dependencies for both `backend` and `frontend` before launching.

#### On Windows:
- Double-click `start.bat` or run:
  ```cmd
  start.bat
  ```
- Or run in PowerShell:
  ```powershell
  node start.js
  ```

#### On Linux / macOS:
- Run:
  ```bash
  chmod +x start.sh
  ./start.sh
  ```
  or
  ```bash
  node start.js
  ```

---

## 🌐 Accessing the Application

Once started, open your web browser:

| Service | URL | Description |
| :--- | :--- | :--- |
| **Aether Studio (App)** | **[http://localhost:4576](http://localhost:4576)** | Local & Web IDE interface on port **4576** |
| **Backend API** | **[http://localhost:3090](http://localhost:3090)** | Express workspace & proxy API |

---

## 🚀 Clean Project Workflow (No Default Workspace)

When you first open Aether:
1. **Clean Slate**: It does **not** load Aether's internal workspace by default.
2. **Open Your Local Project**:
   - Click **"📂 Open Local Project"** to select any folder on your machine via the browser's native **Web File System Access API**.
   - Or click **"Browse Server Workspace"** to navigate directories on the host system.
3. **Switch or Close Projects**: Use the `Open` and `✕` buttons in the sidebar header to switch projects at any time.

---

## 🌐 Web App Mode: Zero Dependency on Local Server

Aether can run as a pure web app with **zero dependency on a local Node.js backend**:
- **Direct Local File Access**: Uses modern browser Web File System Access (`showDirectoryPicker`) to read, write, and search your local files directly on disk.
- **Direct AI & Web Proxy**: Calls free AI models (Pollinations) and API providers (Gemini / OpenAI) directly from the browser.
- **Optional Web Proxy**: Configure a custom CORS / Web Proxy URL in the **Tokens & Settings** modal for environments that restrict direct outbound calls.

---

## 📱 Use as an App on Windows, Mac & Phone (PWA)

Aether is configured as a standalone **Progressive Web App (PWA)**, meaning you can install it on any device:

### 📱 On Your Phone (iPhone & Android)
1. Ensure your phone is connected to the same Wi-Fi network as your computer.
2. Open Aether in your desktop browser and click the **"Get App"** button in the top bar.
3. Scan the **QR Code** displayed with your phone camera, or navigate to `http://<YOUR_LAN_IP>:4576`.
4. Install to home screen:
   - **iPhone (iOS Safari)**: Tap the **Share** button (box with upward arrow) ⎋ → **Add to Home Screen**.
   - **Android (Chrome)**: Tap the **⋮** menu → **Install app** or **Add to Home screen**.
5. Aether will launch full-screen with touch-optimized files drawer, editor, and AI chat.

### 💻 On Windows PC
1. Open `http://localhost:4576` in Google Chrome, Microsoft Edge, or Brave.
2. Click the **Install App** icon on the right side of the address bar (or click **"Get App" → "Install Now"** in the top bar).
3. Aether runs in a native window frame from your Start Menu and Taskbar.

### 🍏 On macOS
1. **Google Chrome / Edge**: Click the **Install Aether** icon in the URL bar.
2. **Safari (macOS Sonoma or later)**: Go to **File** → **Add to Dock**.
3. Aether runs as a standalone Mac application directly from your Dock!

---

## 🐙 Running & Syncing via Git

### Clone to Any Machine
```bash
git clone <your-git-repository-url>
cd workspace
node start.js
```

`node start.js` will automatically detect any missing dependencies, install them, and start both services.

### Running on Mobile with Termux (Android)
1. Install [Termux](https://termux.dev/) from F-Droid.
2. Run: `pkg install nodejs git`
3. Clone and run: `git clone <repo> && cd workspace && node start.js`
4. Open `http://localhost:4576` in your mobile browser.

---

## 📁 Manual Installation (Optional)

```bash
# Backend (port 3090)
cd backend
npm install
node server.js

# Frontend (port 4576)
cd frontend
npm install
npm run dev
```

---

## 🤖 AI Models Supported

Aether includes built-in model providers:

- **Free Tier (No API key required - 100% Free)**:
  - **Aether Spark** (`openai-fast`) — Fast responses
  - **Aether Loom** (`openai`) — Balanced reasoning
  - **Aether Forge** (`qwen-coder`) — Code-focused assistance
- **Google Gemini (BYO Gemini API Key in Vault)**:
  - **3.5 Flash-Lite** — Fastest answers
  - **3.6 Flash** — All-around help
  - **3.1 Pro** — Advanced reasoning
  - **Extended thinking** — Complex problem solving
- **OpenAI / ChatGPT (BYO OpenAI API Key in Vault)**:
  - **GPT-4o mini** — Fast & lightweight
  - **GPT-4o** — Flagship all-around
  - **Think (o3-mini)** — Think: Get a smarter answer & deep reasoning

---

## 🛠️ Project Structure

```text
├── backend/
│   ├── package.json
│   └── server.js         # Express server providing workspace file APIs and AI streaming
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js    # Vite dev server with proxy to backend port 3090
│   └── src/
│       ├── App.jsx       # Studio UI (Editor, File Tree, Chat, Vault)
│       ├── main.jsx
│       └── styles.css
├── package.json          # Root scripts for starting both services
├── start.js              # Universal cross-platform launcher with auto-installer
├── start.bat             # Windows launcher
├── start.ps1             # PowerShell launcher
├── start.sh              # Unix/macOS launcher
└── README.md
```

---

## 📦 Multi-Platform Packaging (Windows, Mac, Mobile & Web)

Arther Studio is engineered with a **Unified Cross-Platform Core** that can be built and deployed everywhere from the same codebase:

### 1. 🖥️ Desktop App (Windows & macOS) via Electron
Desktop installers are built with `electron-builder` and output directly to the **`dist_electron/`** folder:

```bash
# 1. Install packaging tools (first time)
npm install

# 2. Package for Windows (.exe installer + portable .exe)
npm run electron:build:win

# 3. Package for macOS (.dmg installer + .app bundle for Intel & Apple Silicon)
npm run electron:build:mac

# 4. Package both Windows & Mac
npm run electron:build:all
```
All binaries will be placed in `dist_electron/`.

To test the desktop app in live development mode:
```bash
npm run electron:dev
```

### 2. 📱 Mobile App (iOS & Android)
- **Instant PWA Installation**: Any mobile device (iPhone, iPad, Android phone/tablet) navigating to your deployed URL can tap **"Add to Home Screen"** or **"Install App"** to get a full-screen, native-feeling mobile app with custom app icon and offline caching.
- **Native App Stores (Google Play & Apple App Store)**: The codebase is fully compatible with **Capacitor** (`@capacitor/core` & `@capacitor/cli`). You can wrap `frontend/dist` into Xcode (`ios/`) and Android Studio (`android/`) projects without modifying any React code:
  ```bash
  npm i -D @capacitor/cli @capacitor/core
  npx cap init "Arther Studio" "com.arther.studio" --web-dir "frontend/dist"
  npx cap add android
  npx cap add ios
  ```

### 3. 🌐 Web App (GitHub Pages, Vercel, Netlify)
Deploy the `frontend/dist` folder to any static hosting provider. The app automatically runs in **Direct Web Mode** using modern Web File System Access (`showDirectoryPicker`) and direct AI APIs.

