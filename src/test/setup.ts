// Testes nunca falam com serviços reais. O plugin de desenvolvimento do vite.config carrega o .env.local
// (com a chave do Resend e o banco de produção) também no vitest: sem isto, os testes enviavam e-mails de verdade.
for (const k of ['RESEND_API_KEY', 'RESEND_FROM', 'DATABASE_URL', 'CRON_SECRET', 'PORTAL_URL']) delete process.env[k]

// localStorage em memória para o adaptador de demonstração (zustand/persist) rodar em Node.
const mem = new Map<string, string>()
const storage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: (i: number) => [...mem.keys()][i] ?? null,
  get length() { return mem.size },
}
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
