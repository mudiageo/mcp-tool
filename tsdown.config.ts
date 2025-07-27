import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: 'src/index.ts',
  outDir: 'dist',
  target: 'node18',
  format: 'cjs',
  dts: true,
  sourcemap: true,
  clean: true,
  bin: {
    'mcp-generate': 'src/cli.ts'
  }
});