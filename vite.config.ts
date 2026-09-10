/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath, URL } from 'node:url';

/*
 * Build modes:
 *   (default)      Normal split build → dist/ (relative paths, local assets).
 *                  For webview/kiosk packaging that serves the folder locally.
 *   SINGLEFILE=1   One self-contained index.html for the HOSTED claude.ai
 *                  preview. Heavy export libs are stubbed (the artifact host
 *                  rejects their embedded binary; downloads are sandboxed).
 *   OFFLINE_APP=1  One self-contained VERO.html to run LOCALLY on the device
 *                  with NO network at all (open via file:// or a local
 *                  webview). Everything inlined INCLUDING the real PDF/Excel
 *                  libraries — nothing is stubbed, nothing is fetched.
 */
const singleFile = process.env.SINGLEFILE === '1';
const offlineApp = process.env.OFFLINE_APP === '1';
const inlineAll = singleFile || offlineApp;

// Vite + Vitest configuration.
export default defineConfig({
  plugins: [react(), ...(inlineAll ? [viteSingleFile()] : [])],
  base: './',
  build: {
    // When producing a single self-contained file, inline every asset
    // (incl. self-hosted fonts) as data: URIs so the whole app is one offline
    // HTML. Normal device builds keep assets as separate local files.
    assetsInlineLimit: inlineAll ? 100_000_000 : 4096,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // ONLY the hosted preview stubs the heavy export libraries. The offline
      // device app (OFFLINE_APP) keeps the real jspdf/exceljs/html2canvas so
      // PDF/Excel work fully offline.
      ...(singleFile && !offlineApp
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
