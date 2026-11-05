import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
// GitHub Pages 项目站路径: https://CZF1999.github.io/jat-LowCodeForm/
export default defineConfig({
  base: '/jat-LowCodeForm/',
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,ts}'],
  },
})
