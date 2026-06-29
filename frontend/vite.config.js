import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'child_process'
import fs from 'fs'

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'))
const baseVersion = packageJson.version || '1.0.0'

// Get git commit hash for dynamic revision increments
let revision = ''
try {
  revision = execSync('git rev-parse --short HEAD').toString().trim()
} catch (e) {
  // Fallback to build date if git is not available
  const now = new Date()
  revision = `build.${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`
}

const fullVersion = `${baseVersion}-${revision}`

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react()
  ],
  define: {
    __APP_VERSION__: JSON.stringify(fullVersion),
  }
})
