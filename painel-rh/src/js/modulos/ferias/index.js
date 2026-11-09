// Módulo Férias (etapa 2): aviso, pagamento, alerta da CLT e prévia do mês seguinte.
import { chaveDoDia, ehDataValida } from '../../datas.js';
import { NIVEL, NOME_NIVEL } from '../../alertas.js';
import { novoId } from '../../dados.js';
import { esc, icone, confirmarDoisCliques } from '../../util.js';
import { selo, etapas, blocoPrazo, acoes, cabecalho, maisUrgente, animarSaida, diaMes } from '../../componentes.js';
import { criarLista } from '../lista.js';
import { painelImportacao, normalizar, lerData, lerInteiro, lerStatus } from '../../importar.js';
import {
  STATUS, NOME_STATUS, ROTULO_AVANCAR, CAMPOS_EDITAVEIS,
  calcularFerias, avaliarFerias, impedimentoInicio, previaProximoMes, novasFerias, proximoStatus, statusAnterior,
} from './regras.js';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function analisar(f, ctx) {
  const calc = calcularFerias(f, ctx.cfg, ctx.cal);
  const aval = avaliarFerias(f, calc, ctx.agora, ctx.cfg);
  return { f, calc, aval };
}

function alertas(ctx) {
  const lista = [];
  for (const f of ctx.dados.ferias) {
    const { aval } = analisar(f, ctx);
    for (const p of aval.prazos) {
      if (p.nivel < NIVEL.amarelo) continue;
      lista.push({ nivel: p.nivel, faltam: p.faltam, titulo: f.nome, acao: p.acao, quando: p.quando, data: p.efetivo, texto: p.texto, alvo: { tela: 'ferias', id: f.id } });
    }
  }
  return lista;
}

function textoImpedimento(imp) {
  return `Início ${imp.dias === 1 ? 'na véspera' : `a ${imp.dias} dias`} de ${imp.motivo} (${diaMes(imp.data)}). A CLT (art. 134 §3º) proíbe começar férias nesse período.`;
}

/* ---------------- Desenho ---------------- */

function card({ f, calc, aval }, marcas) {
  const urg = maisUrgente(aval.prazos);
  const av = Object.fromEntries(aval.prazos.map((p) => [p.chave, p]));
  return `
  <article class="card nivel-${NOME_NIVEL[aval.nivel]}${marcas.novo === f.id ? ' novo' : ''}" data-id="${esc(f.id)}">
    <div class="card-cabeca">
      ${selo(urg)}
      <div class="card-titulo">
        <input class="card-nome" type="text" data-campo="nome" value="${esc(f.nome)}" aria-label="Nome">
        <div class="card-sub">
          <label class="inline">início <input type="date" data-campo="inicio" value="${esc(f.inicio)}"></label>
          <label class="inline"><input type="number" class="num-curto" min="1" max="30" step="1" data-campo="dias" value="${calc.dias}"> dias</label>
        </div>
      </div>
      ${etapas(STATUS, NOME_STATUS, f.status, marcas.carimbo === f.id)}
    </div>
    <div class="grade">
      <div class="campo"><span class="rotulo-campo">Último dia</span><span class="valor">${esc(diaMes(calc.fim))}</span></div>
      <div class="campo"><span class="rotulo-campo">Retorno</span><span class="valor">${esc(diaMes(calc.retorno))}</span></div>
    </div>
    ${calc.impedimento ? `<p class="faixa-aviso">${icone('alerta')} ${esc(textoImpedimento(calc.impedimento))}</p>` : ''}
    <div class="prazos">
      ${blocoPrazo('Entregar aviso até', 'dataAviso', calc, calc.seguraAviso, calc.motivoAviso, av.aviso)}
      ${blocoPrazo('Pagar em', 'dataPagamento', calc, calc.seguraPagamento, calc.motivoPagamento, av.pagamento)}
    </div>
    ${acoes(proximoStatus(f.status), statusAnterior(f.status), NOME_STATUS, ROTULO_AVANCAR[f.status])}
  </article>`;
}

function previa(ctx) {
  const p = previaProximoMes(ctx.dados.ferias.map((f) => ({ f, calc: calcularFerias(f, ctx.cfg, ctx.cal) })), ctx.agora, ctx.cfg);
  if (!p) return '';
  const linha = (x) => `<li class="${x.feito ? 'feito' : ''}" data-alvo-id="${esc(x.id)}"><span class="data">${esc(diaMes(x.data))}</span><span>${esc(x.nome)}</span>${x.feito ? icone('check') : ''}</li>`;
  const coluna = (titulo, itens) => `
    <div><h3>${titulo} <span class="contagem">${itens.length}</span></h3>
    ${itens.length ? `<ul>${itens.map(linha).join('')}</ul>` : '<p class="suave">Nada no mês.</p>'}</div>`;
  return `
    <section class="previa">
      <p class="sobretitulo">Última semana do mês</p>
      <h2>Prévia de ${MESES[p.mes - 1]}${p.ano !== +chaveDoDia(ctx.agora).slice(0, 4) ? ` de ${p.ano}` : ''}</h2>
      <div class="previa-colunas">${coluna('Avisos a entregar', p.avisos)}${coluna('Pagamentos', p.pagamentos)}</div>
    </section>`;
}

function menorPrazo(a) {
  return a.aval.prazos.reduce((m, p) => (p.efetivo < m ? p.efetivo : m), a.f.inicio);
}

function celulaPrazo(x, chave, data) {
  const p = x.aval.prazos.find((q) => q.chave === chave);
  return `${esc(diaMes(data))}${p && p.nivel >= NIVEL.amarelo ? ` <span class="chip nivel-${NOME_NIVEL[p.nivel]}">${esc(p.texto)}</span>` : ''}`;
}

const lista = criarLista({
  id: 'ferias',
  itens: (ctx) => ctx.dados.ferias.map((f) => analisar(f, ctx)),
  idDe: (x) => x.f.id,
  nome: (x) => x.f.nome,
  concluido: (x) => x.f.status === 'pago',
  ordenarAbertas: (a, b) => b.aval.nivel - a.aval.nivel || (menorPrazo(a) < menorPrazo(b) ? -1 : menorPrazo(a) > menorPrazo(b) ? 1 : 0),
  ordenarConcluidas: (a, b) => (a.f.inicio < b.f.inicio ? 1 : -1),
  card,
  vazio: { abertas: 'Nenhuma férias programada. Cadastre acima — nome, início e Enter — ou importe do Excel.', concluidas: 'Nenhuma férias paga ainda.' },
  status: {
    lista: STATUS,
    nomes: NOME_STATUS,
    de: (x) => x.f.status,
    mudar: (ctx, id, s) => { const f = ctx.dados.ferias.find((x) => x.id === id); if (f && STATUS.includes(s) && f.status !== s) { f.status = s; ctx.salvar(); } },
  },
  resumo: (x) => `${esc(diaMes(x.f.inicio))} · ${x.calc.dias} dias · pagar ${esc(diaMes(x.calc.efetivoPagamento))}${x.calc.impedimento ? ` ${icone('alerta')}` : ''}`,
  tabela: [
    { titulo: 'Nome', html: (x) => `<strong>${esc(x.f.nome)}</strong>${x.calc.impedimento ? ` <span title="${esc(textoImpedimento(x.calc.impedimento))}">${icone('alerta')}</span>` : ''}`, chave: (x) => normalizar(x.f.nome) },
    { titulo: 'Início', html: (x) => esc(diaMes(x.f.inicio)), chave: (x) => x.f.inicio },
    { titulo: 'Dias', html: (x) => String(x.calc.dias), chave: (x) => x.calc.dias },
    { titulo: 'Retorno', html: (x) => esc(diaMes(x.calc.retorno)), chave: (x) => x.calc.retorno },
    { titulo: 'Aviso até', html: (x) => celulaPrazo(x, 'aviso', x.calc.efetivoAviso), chave: (x) => x.calc.efetivoAviso },
    { titulo: 'Pagar em', html: (x) => celulaPrazo(x, 'pagamento', x.calc.efetivoPagamento), chave: (x) => x.calc.efetivoPagamento },
    { titulo: 'Status', html: (x) => `<span class="status-txt status-${x.f.status}">${NOME_STATUS[x.f.status]}</span>`, chave: (x) => STATUS.indexOf(x.f.status) },
  ],
});

/* ---------------- Importação ---------------- */

const IMPORTACAO = {
  titulo: 'Férias',
  exemplo: 'Nome\tInício\tDias\tStatus\nMaria Silva\t01/12/2026\t30\tavisado\nJoão Souza\t11/01/2027\t20',
  colunas: [
    { campo: 'nome', titulo: 'Nome', obrigatorio: true, nomes: ['nome', 'funcionario', 'colaborador', 'empregado', 'nome do funcionario'] },
    { campo: 'inicio', titulo: 'Início', obrigatorio: true, nomes: ['inicio', 'data inicio', 'data de inicio', 'inicio ferias', 'inicio das ferias', 'data', 'saida', 'data saida', 'gozo inicio', 'inicio gozo'] },
    { campo: 'dias', titulo: 'Dias', nomes: ['dias', 'qtd dias', 'quantidade', 'dias de ferias', 'duracao', 'qtde dias'] },
    { campo: 'status', titulo: 'Status', nomes: ['status', 'situacao'] },
  ],
  converter(v) {
    const inicio = lerData(v.inicio);
    if (!inicio) return { erro: `Data inválida: "${v.inicio}"` };
    const dias = lerInteiro(v.dias, 1, 30);
    if (dias.erro) return { erro: dias.erro };
    const st = lerStatus(v.status, {
      pendente: ['pendente', 'programada', 'programado', 'aberto', 'em aberto'],
      avisado: ['avisado', 'avisada', 'aviso entregue', 'aviso', 'aviso dado'],
      solicitado: ['solicitado', 'solicitada', 'pagamento solicitado'],
      pago: ['pago', 'paga', 'concluido', 'concluida'],
    });
    if (st.erro) return { erro: st.erro };
    return { registro: novasFerias({ nome: v.nome, inicio, dias: dias.valor, status: st.status }, novoId()) };
  },
  chave: (f) => `${normalizar(f.nome)}|${f.inicio}`,
  existentes: (ctx) => ctx.dados.ferias,
  resumoImportacao: (f, ctx) => {
    const c = calcularFerias(f, ctx.cfg, ctx.cal);
    return `${c.dias} dias · aviso até ${esc(diaMes(c.efetivoAviso))} · pagar em ${esc(diaMes(c.efetivoPagamento))} · ${NOME_STATUS[f.status]}${c.impedimento ? ` · ${icone('alerta')} CLT` : ''}`;
  },
};

function renderizar(el, ctx) {
  el.innerHTML = `
    ${cabecalho('Programação', 'Férias', '<p class="resumo-modulo"></p>')}
    <div id="previa">${previa(ctx)}</div>
    <form id="form-ferias" class="cadastro" autocomplete="off">
      <label class="campo nome">Nome
        <input type="text" name="nome" placeholder="Nome do funcionário" required>
      </label>
      <label class="campo">Início das férias
        <input type="date" name="inicio" required>
      </label>
      <label class="campo">Dias
        <input type="number" name="dias" class="num-curto" min="1" max="30" step="1" value="${ctx.cfg.feriasDiasPadrao}" required>
      </label>
      <button class="btn" type="submit">${icone('mais')} Cadastrar <kbd>Enter</kbd></button>
      <p class="faixa-aviso cadastro-aviso" id="aviso-inicio" hidden></p>
    </form>
    ${lista.barra('Pagas')}
    <div id="lista" class="lista"></div>`;

  const form = el.querySelector('#form-ferias');
  const avisoInicio = el.querySelector('#aviso-inicio');
  // Aviso imediato da CLT ao escolher a data (não impede o cadastro).
  form.inicio.oninput = () => {
    const imp = impedimentoInicio(form.inicio.value, ctx.cfg, ctx.cal);
    avisoInicio.hidden = !imp;
    avisoInicio.innerHTML = imp ? `${icone('alerta')} ${esc(textoImpedimento(imp))}` : '';
  };
  form.onkeydown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); form.requestSubmit(); }
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    const nome = form.nome.value.trim();
    const inicio = form.inicio.value;
    const dias = Number(form.dias.value);
    if (!nome) { form.nome.focus(); return; }
    if (!ehDataValida(inicio)) { form.inicio.focus(); return; }
    if (!Number.isInteger(dias) || dias < 1 || dias > 30) { form.dias.focus(); return; }
    const id = novoId();
    ctx.dados.ferias.push(novasFerias({ nome, inicio, dias }, id));
    lista.marcarNovo(id);
    form.nome.value = '';
    form.inicio.value = '';
    form.dias.value = ctx.cfg.feriasDiasPadrao;
    avisoInicio.hidden = true;
    ctx.salvar();
    form.nome.focus();
  };

  el.onclick = (e) => {
    if (e.target.closest('[data-acao-lista="importar"]')) {
      painelImportacao(el.querySelector('#importar'), IMPORTACAO, ctx, (registros) => {
        ctx.dados.ferias.push(...registros);
        ctx.salvar();
        el.querySelector('#importar').innerHTML = `<p class="importado">${icone('check')} ${registros.length} ${registros.length === 1 ? 'férias importada' : 'férias importadas'}.</p>`;
      });
      return;
    }
    if (lista.clique(e, el, ctx)) return;
    const item = e.target.closest('.previa li[data-alvo-id]');
    if (item) { ctx.irPara('ferias', item.dataset.alvoId); return; }
    const btn = e.target.closest('button[data-acao]');
    const cardEl = e.target.closest('.card');
    if (!btn || !cardEl) return;
    const f = ctx.dados.ferias.find((x) => x.id === cardEl.dataset.id);
    if (!f) return;
    const acao = btn.dataset.acao;
    if (acao === 'avancar' || acao === 'voltar') {
      const novo = acao === 'avancar' ? proximoStatus(f.status) : statusAnterior(f.status);
      if (!novo) return;
      if (novo === 'pago' || f.status === 'pago') { animarSaida(cardEl, () => { f.status = novo; ctx.salvar(); }); return; }
      f.status = novo;
      lista.marcarCarimbo(f.id);
    } else if (acao === 'restaurar') delete f.manual[btn.dataset.campo];
    else if (acao === 'excluir') {
      if (!confirmarDoisCliques(btn)) return;
      animarSaida(cardEl, () => { ctx.dados.ferias = ctx.dados.ferias.filter((x) => x !== f); ctx.salvar(); });
      return;
    } else return;
    ctx.salvar();
  };

  el.onchange = (e) => {
    const alvo = e.target;
    const cardEl = alvo.closest('.card');
    if (!cardEl) return;
    const f = ctx.dados.ferias.find((x) => x.id === cardEl.dataset.id);
    if (!f) return;
    const v = alvo.value;
    if (alvo.dataset.manual) {
      const campo = alvo.dataset.manual;
      if (!CAMPOS_EDITAVEIS.includes(campo)) return;
      if (ehDataValida(v)) f.manual[campo] = v; else delete f.manual[campo];
    } else if (alvo.dataset.campo === 'nome') {
      if (v.trim()) f.nome = v.trim(); else { alvo.value = f.nome; return; }
    } else if (alvo.dataset.campo === 'inicio') {
      if (ehDataValida(v)) f.inicio = v; else { alvo.value = f.inicio; return; }
    } else if (alvo.dataset.campo === 'dias') {
      const n = Number(v);
      if (Number.isInteger(n) && n >= 1 && n <= 30) f.dias = n; else { alvo.value = f.dias; return; }
    } else return;
    ctx.salvar();
  };

  lista.montar(el, ctx);
}

function atualizar(el, ctx) {
  const p = el.querySelector('#previa');
  if (p) p.innerHTML = previa(ctx);
  lista.atualizar(el, ctx);
}

export default {
  id: 'ferias',
  titulo: 'Férias',
  icone: 'sol',
  alertas,
  renderizar,
  atualizar,
  prepararAbertura: (id, ctx) => lista.prepararAbertura(id, ctx),
  importacao: IMPORTACAO,
  opcoes: {
    titulo: 'Férias',
    campos: [
      { campo: 'feriasDiasPadrao', rotulo: 'Dias de férias (padrão do cadastro)', unidade: 'dias',
        dica: 'Quantidade de dias que já vem preenchida ao cadastrar férias. Você pode mudar em cada funcionário (de 1 a 30).' },
      { campo: 'feriasAvisoDias', rotulo: 'Antecedência do aviso', unidade: 'dias antes',
        dica: 'Com quantos dias de antecedência o aviso de férias precisa ser entregue (a CLT pede 30). Se a data cair em fim de semana ou feriado, o card mostra o dia útil anterior.' },
      { campo: 'feriasPagamentoDias', rotulo: 'Pagamento antes do início', unidade: 'dias',
        dica: 'Quantos dias antes do início as férias são pagas (a CLT pede 2). O card mostra uma data exata em "Pagar em", sempre num dia útil. Ex.: início terça 01/12 → pagar sexta 27/11.' },
      { campo: 'feriasPagamentoDiasUteis', rotulo: 'Contar o pagamento em dias úteis',
        dica: 'Ligado (padrão): sábado, domingo e feriados não contam na contagem. Ex.: início segunda 07/12 → pagar quinta 03/12. Desligado: conta dias corridos e, se cair em dia não útil, recua para o dia útil anterior (segunda 07/12 → sexta 04/12).' },
      { campo: 'feriasBloqueioDias', rotulo: 'Dias proibidos antes de folga', unidade: 'dias',
        dica: 'A CLT (art. 134 §3º) proíbe começar férias nos 2 dias antes de feriado ou do descanso semanal (domingo). O painel avisa quando o início cai nesse período. 0 desliga o aviso.' },
      { campo: 'feriasSabadoFolga', rotulo: 'Sábado conta como descanso nessa regra',
        dica: 'Marque se, na sua empresa, o sábado também é dia de descanso para a regra acima. Desmarcado: só domingos e feriados contam.' },
      { campo: 'feriasPreviaDias', rotulo: 'Prévia do mês seguinte', unidade: 'últimos dias do mês',
        dica: 'Nos últimos dias de cada mês, a tela de Férias mostra a lista de avisos e pagamentos do mês seguinte. 7 = última semana. 0 desliga a prévia.' },
    ],
  },
};
