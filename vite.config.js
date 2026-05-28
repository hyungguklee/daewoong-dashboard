import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  server: {
    port: 5173,
    strictPort: true, // 5173이 사용 중이면 다른 포트 대신 에러 → 항상 같은 주소 유지
  },
})