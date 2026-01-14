import { defineConfig, devices } from '@playwright/test'
import { config } from 'dotenv'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Cargar variables de entorno de .env.test con path absoluto
config({ path: resolve(__dirname, '.env.test') })

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'https://app-delta-gules.vercel.app',
    trace: 'on',
    screenshot: 'on',
    video: 'on',
    // Limpiar cookies entre tests para evitar estado compartido
    storageState: { cookies: [], origins: [] },
    acceptDownloads: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Sin webServer porque usamos el deploy en producción
})
