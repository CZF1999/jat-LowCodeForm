import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
// GitHub Pages 项目站路径: https://CZF1999.github.io/jat-LowCodeForm/
export default defineConfig({
  base: '/jat-LowCodeForm/',
  plugins: [vue()],
  server: {
    // Windows 上默认可能只绑 [::1]，Chrome 走 127.0.0.1 会打不开
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,ts}'],
  },
})
