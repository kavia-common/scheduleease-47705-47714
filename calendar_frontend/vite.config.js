import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Ensure the dev server binds to all interfaces and uses port 3000
    host: true, // equivalent to '0.0.0.0'
    port: 3000,
    // Allow the preview host and localhost to access the dev server
    allowedHosts: [
      'vscode-internal-30059-qa.qa01.cloud.kavia.ai',
      'localhost'
    ],
  }
})
