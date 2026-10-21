import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'node',
    env: { VITE_DATA_SOURCE: 'demo' },
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
  },
}))
