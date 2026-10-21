/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_SOURCE?: string
  readonly VITE_API_URL?: string
  readonly VITE_NOME_EMPRESA?: string
  readonly VITE_EMAIL_RH?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
