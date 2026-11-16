import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import legacy from '@vitejs/plugin-legacy'
// https://vite.dev/config/
// GitHub Pages 项目站路径: https://CZF1999.github.io/jat-LowCodeForm/
export default defineConfig({
  base: '/jat-LowCodeForm/',
  plugins: [vue(),
  legacy({
    targets: ['defaults', 'chrome >= 64'], // 根据你的Chrome版本调整，例如 'chrome >= 64'
  })
  ],
  build: {
    // 目标是让 Chrome 86 这类 2020 年的内核也能解析：
    // 默认(Vite 8 => baseline-widely-available)会保留 ES2022 的 class static block，
    // 而 Chrome 86 / V8 8.6 不认识 `static {}`，整个懒加载 chunk 直接 SyntaxError。
    target: ['chrome86', 'edge88', 'firefox78', 'safari14'],
  },
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
