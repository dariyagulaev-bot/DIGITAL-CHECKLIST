/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath, URL } from 'node:url';

// When SINGLEFILE=1, everything is inlined into one self-contained index.html
// (used to publish a hosted, click-to-open preview). Normal builds stay split.
const singleFile = process.env.SINGLEFILE === '1';

// Vite + Vitest configuration.
export default defineConfig({
  plugins: [react(), ...(singleFile ? [viteSingleFile()] : [])],
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // In the hosted single-file preview, replace heavy export libraries with a
      // stub (they embed binary the artifact host rejects, and downloads are
      // blocked in the sandbox anyway).
      ...(singleFile
        ? {
            jspdf: fileURLToPath(new URL('./src/exports/_previewStub.ts', import.meta.url)),
            html2canvas: fileURLToPath(new URL('./src/exports/_previewStub.ts', import.meta.url)),
            exceljs: fileURLToPath(new URL('./src/exports/_previewStub.ts', import.meta.url)),
          }
        : {}),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
