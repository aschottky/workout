import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub project pages need the repo path as base, e.g. VITE_BASE=/workout/
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  plugins: [react()],
  base,
})
