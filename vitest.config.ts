import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 120_000,
    env: { VITE_DATA_SOURCE: 'demo' },
    include: ['src/**/*.test.ts', 'api/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
  },
}))
