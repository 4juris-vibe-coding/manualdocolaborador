import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './index.css'
import './lib/tema'
import { iniciarSessao } from './data/sync'

import { toast } from './components/toast'

// Erros inesperados fora da renderização (eventos, promessas) viram aviso em vez de falha silenciosa.
window.addEventListener('unhandledrejection', (e) => { console.error(e.reason); toast('Algo deu errado. Tente novamente.', 'danger') })
window.addEventListener('error', (e) => { if (e.message && !/ResizeObserver/.test(e.message)) toast('Ocorreu um erro inesperado.', 'danger') })

void iniciarSessao()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
