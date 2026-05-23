/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENV: string
  /* readonly VITE_API_BASE: string
  readonly VITE_DEBUG_MODE: boolean
  readonly VITE_BASE_URL: string
  readonly VITE_API_BASE_URL: string */
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
