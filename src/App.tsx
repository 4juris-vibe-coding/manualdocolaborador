import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ToastHost } from '@/components/toast'
import { ErroPagina } from '@/components/ErroPagina'
import Login from '@/pages/Login'

// Páginas carregadas sob demanda (reduz o tamanho do carregamento inicial).
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Experiencia = lazy(() => import('@/pages/Experiencia'))
const Perfil = lazy(() => import('@/pages/Perfil'))
const Disponibilidade = lazy(() => import('@/pages/Disponibilidade'))
const Reembolsos = lazy(() => import('@/pages/Reembolsos'))
const Notas = lazy(() => import('@/pages/Notas'))
const Comunicados = lazy(() => import('@/pages/Comunicados'))
const Eventos = lazy(() => import('@/pages/Eventos'))
const Aniversarios = lazy(() => import('@/pages/Aniversarios'))
const Gamificacao = lazy(() => import('@/pages/Gamificacao'))
const Pesquisas = lazy(() => import('@/pages/Pesquisas'))
const Onboarding = lazy(() => import('@/pages/Onboarding'))
const Conteudos = lazy(() => import('@/pages/Conteudos'))
const Manual = lazy(() => import('@/pages/Manual'))
const CentralDuvidas = lazy(() => import('@/pages/CentralDuvidas'))
const Assistente = lazy(() => import('@/pages/Assistente'))
const Beneficios = lazy(() => import('@/pages/Beneficios'))
const Notificacoes = lazy(() => import('@/pages/Notificacoes'))
const Lideranca = lazy(() => import('@/pages/Lideranca'))
const RH = lazy(() => import('@/pages/rh/Indicadores'))
const RHPessoas = lazy(() => import('@/pages/rh/Pessoas'))
const RHPessoa = lazy(() => import('@/pages/rh/PessoaDetalhe'))
const RHJornadas = lazy(() => import('@/pages/rh/Jornadas'))
const RHDocumentos = lazy(() => import('@/pages/rh/Documentos'))
const RHDisponibilidade = lazy(() => import('@/pages/rh/AgendaDisponibilidade'))
const RHGamificacao = lazy(() => import('@/pages/rh/GestaoGamificacao'))
const RHPesquisas = lazy(() => import('@/pages/rh/GestaoPesquisas'))
const RHEstrutura = lazy(() => import('@/pages/rh/Estrutura'))
const RHFuncoes = lazy(() => import('@/pages/rh/Funcoes'))
const RHRegistros = lazy(() => import('@/pages/rh/Registros'))
const RHFeedbacks = lazy(() => import('@/pages/rh/Feedbacks'))
const RHExigencias = lazy(() => import('@/pages/rh/Exigencias'))
const RHCompetencias = lazy(() => import('@/pages/rh/Competencias'))
const RHAvaliacoes = lazy(() => import('@/pages/rh/Avaliacoes'))
const RHInicio = lazy(() => import('@/pages/rh/InicioParceria'))
const RHMetas = lazy(() => import('@/pages/rh/Metas'))
const RHAnalise = lazy(() => import('@/pages/rh/AnaliseGrupos'))
const RHBusca = lazy(() => import('@/pages/rh/BuscaPerfil'))
const RHBeneficios = lazy(() => import('@/pages/rh/Beneficios'))
const RHCultura = lazy(() => import('@/pages/rh/Cultura'))
const RHMetricas = lazy(() => import('@/pages/rh/Metricas'))
const RHRotatividade = lazy(() => import('@/pages/rh/Rotatividade'))
const RHEncerramentos = lazy(() => import('@/pages/rh/Encerramentos'))
const RHFaturamento = lazy(() => import('@/pages/rh/Faturamento'))
const AdminConfig = lazy(() => import('@/pages/admin/Configuracoes'))
const MinhasAvaliacoes = lazy(() => import('@/pages/Avaliacoes'))
const Cultura = lazy(() => import('@/pages/Cultura'))
const Sugestoes = lazy(() => import('@/pages/Sugestoes'))
const Apresentacoes = lazy(() => import('@/pages/Apresentacoes'))
const ApresentacaoEditor = lazy(() => import('@/pages/ApresentacaoEditor'))
const Admin = lazy(() => import('@/pages/Admin'))
const Seguranca = lazy(() => import('@/pages/Seguranca'))

/** Página atual com carregamento sob demanda e rede de segurança (o erro de uma página não derruba o app; trocar de rota limpa o erro). */
function PaginaSegura() {
  const { pathname } = useLocation()
  return <ErroPagina key={pathname}><Suspense fallback={<Carregando />}><Outlet /></Suspense></ErroPagina>
}

/** Links antigos (/apresentacoes/:id) apontam para o 4juris Canva. */
function RedirecionarCanva() {
  const { id = '' } = useParams()
  return <Navigate to={`/canva/${id}`} replace />
}

function Carregando() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando página">
      <div className="h-8 w-64 rounded-xl bg-winter animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 rounded-2xl bg-winter/70 animate-pulse" />)}
      </div>
      <div className="h-64 rounded-2xl bg-winter/60 animate-pulse" />
    </div>
  )
}

export function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<AppLayout />}>
          <Route element={<PaginaSegura />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/experiencia" element={<Experiencia />} />
            <Route path="/perfil" element={<Perfil />} />
            <Route path="/disponibilidade" element={<Disponibilidade />} />
            <Route path="/reembolsos" element={<Reembolsos />} />
            <Route path="/notas" element={<Notas />} />
            <Route path="/comunicados" element={<Comunicados />} />
            <Route path="/eventos" element={<Eventos />} />
            <Route path="/aniversarios" element={<Aniversarios />} />
            <Route path="/gamificacao" element={<Gamificacao />} />
            <Route path="/pesquisas" element={<Pesquisas />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/conteudos" element={<Conteudos />} />
            <Route path="/manual" element={<Manual />} />
            <Route path="/faq" element={<CentralDuvidas />} />
            <Route path="/assistente" element={<Assistente />} />
            <Route path="/beneficios" element={<Beneficios />} />
            <Route path="/notificacoes" element={<Notificacoes />} />
            <Route path="/lideranca" element={<Lideranca />} />
            <Route path="/rh" element={<RH />} />
            <Route path="/rh/pessoas" element={<RHPessoas />} />
            <Route path="/rh/pessoas/:id" element={<RHPessoa />} />
            <Route path="/rh/jornadas" element={<RHJornadas />} />
            <Route path="/rh/documentos" element={<RHDocumentos />} />
            <Route path="/rh/disponibilidade" element={<RHDisponibilidade />} />
            <Route path="/rh/gamificacao" element={<RHGamificacao />} />
            <Route path="/rh/pesquisas" element={<RHPesquisas />} />
            <Route path="/rh/estrutura" element={<RHEstrutura />} />
            <Route path="/rh/funcoes" element={<RHFuncoes />} />
            <Route path="/rh/registros" element={<RHRegistros />} />
            <Route path="/rh/feedbacks" element={<RHFeedbacks />} />
            <Route path="/rh/exigencias" element={<RHExigencias />} />
            <Route path="/rh/competencias" element={<RHCompetencias />} />
            <Route path="/rh/avaliacoes" element={<RHAvaliacoes />} />
            <Route path="/rh/inicio-parceria" element={<RHInicio />} />
            <Route path="/rh/metas" element={<RHMetas />} />
            <Route path="/rh/analise-grupos" element={<RHAnalise />} />
            <Route path="/rh/busca-perfil" element={<RHBusca />} />
            <Route path="/rh/beneficios" element={<RHBeneficios />} />
            <Route path="/rh/cultura" element={<RHCultura />} />
            <Route path="/rh/metricas" element={<RHMetricas />} />
            <Route path="/rh/rotatividade" element={<RHRotatividade />} />
            <Route path="/rh/encerramentos" element={<RHEncerramentos />} />
            <Route path="/rh/faturamento" element={<RHFaturamento />} />
            <Route path="/avaliacoes" element={<MinhasAvaliacoes />} />
            <Route path="/sugestoes" element={<Sugestoes />} />
            <Route path="/canva" element={<Apresentacoes />} />
            <Route path="/apresentacoes" element={<Navigate to="/canva" replace />} />
            <Route path="/canva/:id" element={<ApresentacaoEditor />} />
            <Route path="/apresentacoes/:id" element={<RedirecionarCanva />} />
            <Route path="/cultura" element={<Cultura />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/configuracoes" element={<AdminConfig />} />
            <Route path="/seguranca" element={<Seguranca />} />
            {/* Rotas antigas → novos módulos */}
            <Route path="/recesso" element={<Navigate to="/disponibilidade" replace />} />
            <Route path="/folgas" element={<Navigate to="/disponibilidade" replace />} />
            <Route path="/gestor" element={<Navigate to="/lideranca" replace />} />
            <Route path="/treinamentos" element={<Navigate to="/conteudos" replace />} />
            <Route path="/feedback" element={<Navigate to="/pesquisas" replace />} />
            <Route path="/offboarding" element={<Navigate to="/rh/jornadas" replace />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastHost />
    </BrowserRouter>
  )
}
