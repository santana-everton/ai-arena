import { rmSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import pkg from './package.json'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const projectRoot = __dirname
  const distElectronRoot = path.join(projectRoot, 'dist-electron')
  rmSync(distElectronRoot, { recursive: true, force: true })
  const rendererRoot = path.join(projectRoot, 'renderer')
  const rendererSrc = path.join(rendererRoot, 'src')
  const electronMainEntry = path.join(projectRoot, 'electron', 'main.ts')
  const electronPreloadEntry = path.join(projectRoot, 'electron', 'preload.ts')

  const isServe = command === 'serve'
  const isBuild = command === 'build'
  const sourcemap = isServe || !!process.env.VSCODE_DEBUG

  return {
    root: rendererRoot,
    base: './',
    publicDir: path.join(__dirname, 'public'),
    resolve: {
      alias: {
        '@': rendererSrc,
      },
    },
    build: {
      outDir: path.join(__dirname, 'dist'),
      emptyOutDir: true,
    },
    plugins: [
      react(),
      electron({
        main: {
          entry: electronMainEntry,
          onstart(args) {
            if (process.env.VSCODE_DEBUG) {
              console.log(
                /* For `.vscode/.debug.script.mjs` */ '[startup] Electron App',
              )
            } else {
              args.startup()
            }
          },
          vite: {
            build: {
              sourcemap,
              minify: isBuild,
              outDir: path.join(distElectronRoot, 'main'),
              rollupOptions: {
                external: Object.keys('dependencies' in pkg ? pkg.dependencies : {}),
                output: {
                  entryFileNames: 'index.js',
                },
              },
            },
          },
        },
        preload: {
          input: electronPreloadEntry,
          vite: {
            build: {
              sourcemap: sourcemap ? 'inline' : undefined,
              minify: isBuild,
              outDir: path.join(distElectronRoot, 'preload'),
              rollupOptions: {
                external: Object.keys('dependencies' in pkg ? pkg.dependencies : {}),
                output: {
                  entryFileNames: 'preload.mjs',
                },
              },
            },
          },
        },
        renderer: {},
      }),
    ],
    server:
      process.env.VSCODE_DEBUG &&
      (() => {
        const url = new URL(pkg.debug.env.VITE_DEV_SERVER_URL)
        return {
          host: url.hostname,
          port: +url.port,
        }
      })(),
    clearScreen: false,
  }
})
