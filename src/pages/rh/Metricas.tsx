import { useMemo, useState } from 'react'
import { useStore } from '@/lib/store'
import { PageHeader, Card, CardHead, Tabs, Select, IndicadorCard, BarList, Callout } from '@/components/ui'
import { DonutChart } from '@/components/charts'
import { BotaoImprimir } from '@/components/inputs'
import { toast } from '@/components/toast'
import { Button } from '@/components/ui'
import { hojeISO } from '@/domain/datas'
import { metricasPessoas, MIN_GRUPO, type Fatia } from '@/domain/metricas'
import { gerarCSV, baixarArquivo } from '@/domain/csv'
import { MODO_DEMO } from '@/data/config'

const barras = (f: Fatia[]) => f.map((x) => ({ rotulo: x.rotulo, valor: x.valor, cor: x.cor }))

export default function Metricas() {
  const s = useStore()
  const hoje = hojeISO()
  const [aba, setAba] = useState('geral')
  const [unidade, setUnidade] = useState('')
  const [area, setArea] = useState('')
  const [funcao, setFuncao] = useState('')
  const [resp, setResp] = useState('')
  const pessoas = s.colaboradores.filter((c) => (!unidade || c.unidadeId === unidade) && (!area || c.setorId === area) && (!funcao || c.cargoId === funcao) && (!resp || c.responsavelId === resp))
  const m = useMemo(() => metricasPessoas(s, pessoas, hoje), [s, pessoas, hoje])
  const responsaveis = [...new Set(s.colaboradores.map((c) => c.responsavelId).filter(Boolean))] as string[]

  const exportar = () => {
    const linhas: { metrica: string; valor: string }[] = [
      { metrica: 'Parcerias ativas', valor: String(m.total) }, { metrica: 'Idade média', valor: m.idadeMedia != null ? `${m.idadeMedia} anos (${m.comNascimento} com data)` : '—' },
      ...m.porIdade.map((f) => ({ metrica: `Idade · ${f.rotulo}`, valor: String(f.valor) })), ...m.porTempo.map((f) => ({ metrica: `Tempo de parceria · ${f.rotulo}`, valor: String(f.valor) })),
      ...m.porEscolaridade.map((f) => ({ metrica: `Escolaridade · ${f.rotulo}`, valor: String(f.valor) })), ...m.porArea.map((f) => ({ metrica: `Área · ${f.rotulo}`, valor: String(f.valor) })),
      ...(m.diversidade.suprimido ? [{ metrica: 'Diversidade', valor: `suprimida (menos de ${MIN_GRUPO} pessoas com consentimento)` }] : [...m.diversidade.genero.map((f) => ({ metrica: `Gênero · ${f.rotulo}`, valor: String(f.valor) })), ...m.diversidade.raca.map((f) => ({ metrica: `Raça/etnia · ${f.rotulo}`, valor: String(f.valor) }))]),
    ]
    baixarArquivo(gerarCSV(linhas, [{ titulo: 'Métrica', valor: (l) => l.metrica }, { titulo: 'Valor', valor: (l) => l.valor }], [`Métricas de pessoas — ${new Date().toLocaleString('pt-BR')}`, ...(MODO_DEMO ? ['Dados fictícios de demonstração'] : [])]), `metricas-pessoas-${hoje}.csv`)
    toast('Métricas exportadas.')
  }

  return (
    <>
      <PageHeader title="Métricas de pessoas" subtitle="Perfil agregado da comunidade e da organização — parcerias ativas hoje."
        actions={<><BotaoImprimir /><Button variant="ghost" icon="Download" onClick={exportar}>Exportar</Button></>} />
      <Card className="p-4 mb-5 no-print">
        <div className="flex flex-wrap gap-3">
          <Select label="Unidade" value={unidade} onChange={setUnidade}><option value="">Todas as unidades</option>{s.unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</Select>
          <Select label="Área" value={area} onChange={setArea}><option value="">Todas as áreas</option>{s.setores.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</Select>
          <Select label="Função" value={funcao} onChange={setFuncao}><option value="">Todas as funções</option>{s.cargos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}</Select>
          <Select label="Responsável" value={resp} onChange={setResp}><option value="">Todos os responsáveis</option>{responsaveis.map((id) => <option key={id} value={id}>{s.nomeDe(id)}</option>)}</Select>
        </div>
      </Card>
      {MODO_DEMO && <Callout tone="warning" icon="FlaskConical" className="mb-5">Dados fictícios de demonstração.</Callout>}
      <Tabs tabs={[{ key: 'geral', label: 'Visão geral' }, { key: 'diversidade', label: 'Diversidade' }, { key: 'organizacao', label: 'Organização' }]} active={aba} onChange={setAba} />

      {aba === 'geral' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <IndicadorCard titulo="Parcerias ativas" valor={m.total} icon="Users" definicao="Pessoas com parceria ativa hoje, nos filtros." fonte="Cadastro de pessoas" />
            <IndicadorCard titulo="Idade média" valor={m.idadeMedia != null ? `${m.idadeMedia} anos` : '—'} detalhe={`${m.comNascimento} informaram nascimento`} icon="Cake" tone="ink" definicao="Média entre quem informou data de nascimento (opcional)." fonte="Cadastro de pessoas" />
            <IndicadorCard titulo="Com dependentes" valor={m.comDependentes[0].valor} icon="Baby" tone="success" definicao="Pessoas com ao menos um dependente cadastrado." fonte="Dependentes" />
            <IndicadorCard titulo="Ensino superior ou mais" valor={m.porEscolaridade.filter((f) => /Superior completo|Pós|Mestrado|Doutorado/.test(f.rotulo)).reduce((a, f) => a + f.valor, 0)} icon="GraduationCap" tone="warning" definicao="Superior completo, pós-graduação, mestrado ou doutorado (entre quem informou)." fonte="Cadastro de pessoas" />
          </div>
          <div className="grid lg:grid-cols-2 gap-6">
            <Card><CardHead title="Faixa etária" /><div className="p-5"><BarList itens={barras(m.porIdade)} /></div></Card>
            <Card><CardHead title="Tempo de parceria" /><div className="p-5"><BarList itens={barras(m.porTempo)} /></div></Card>
            <Card><CardHead title="Escolaridade" sub="Entre quem informou" /><div className="p-5"><BarList itens={barras(m.porEscolaridade)} /></div></Card>
            <Card><CardHead title="Forma de contratação" /><div className="p-5"><DonutChart titulo="Forma de contratação" dados={m.porRegime} /></div></Card>
            <Card><CardHead title="Senioridade da função" /><div className="p-5"><BarList itens={barras(m.porSenioridade)} /></div></Card>
            <Card><CardHead title="Dependentes" /><div className="p-5"><DonutChart titulo="Dependentes" dados={m.comDependentes} /></div></Card>
          </div>
        </>
      )}

      {aba === 'diversidade' && (
        <>
          <Callout tone="brand" icon="ShieldCheck" className="mb-5">
            Dados <b>autodeclarados</b>, opcionais e tratados com consentimento específico (dados sensíveis — LGPD art. 11). Só aparecem de forma agregada e apenas quando
            pelo menos {MIN_GRUPO} pessoas no recorte consentiram. Hoje: <b>{m.diversidade.consentidos}</b> pessoa(s).
          </Callout>
          {m.diversidade.suprimido ? <Card className="p-8 text-center text-[13.5px] text-muted">Recorte com menos de {MIN_GRUPO} pessoas com consentimento — resultados ocultos para proteger a privacidade.</Card> : (
            <div className="grid lg:grid-cols-2 gap-6">
              <Card><CardHead title="Gênero" /><div className="p-5"><DonutChart titulo="Gênero" dados={m.diversidade.genero} /></div></Card>
              <Card><CardHead title="Raça/etnia" /><div className="p-5"><DonutChart titulo="Raça/etnia" dados={m.diversidade.raca} /></div></Card>
              <Card><CardHead title="Pessoas com deficiência" /><div className="p-5"><DonutChart titulo="Pessoas com deficiência" dados={m.diversidade.pcd} /></div></Card>
              <Card><CardHead title="Estado civil" /><div className="p-5"><DonutChart titulo="Estado civil" dados={m.diversidade.estadoCivil} /></div></Card>
            </div>
          )}
        </>
      )}

      {aba === 'organizacao' && (
        <div className="grid lg:grid-cols-3 gap-6">
          <Card><CardHead title="Por área" /><div className="p-5"><BarList itens={barras(m.porArea)} /></div></Card>
          <Card><CardHead title="Por unidade" /><div className="p-5"><DonutChart titulo="Por unidade" dados={m.porUnidade} /></div></Card>
          <Card><CardHead title="Por responsável" sub="Top 8" /><div className="p-5"><BarList itens={barras(m.porResponsavel)} /></div></Card>
        </div>
      )}
    </>
  )
}
