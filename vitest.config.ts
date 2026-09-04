import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

// 純粋関数（time / commandBuilder）の単体テスト用設定。
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  test: {
    include: ['src/**/*.test.ts']
  }
})
