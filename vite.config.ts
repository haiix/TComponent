import { defineConfig } from 'vitest/config';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  build: {
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'TComponent',
      fileName: 'index',
      formats: ['es'],
    },
    rollupOptions: { external: [] },
  },
  plugins: [dts({ exclude: ['tests/**'], rollupTypes: true })],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
    },
  },
});
