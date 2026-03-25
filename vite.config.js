import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default {
  root: resolve(__dirname), // корень проекта, а не папка src
  build: {
    outDir: 'dist', // dist в корне
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'), // указываем entry point
      },
    },
  },
  server: {
    port: 8080,
    open: true, // автоматически открывать браузер
  },
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: [
          'import',
          'mixed-decls',
          'color-functions',
          'global-builtin',
        ],
      },
    },
  },
}
