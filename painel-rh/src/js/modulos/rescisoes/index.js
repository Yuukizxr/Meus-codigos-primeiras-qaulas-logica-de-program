// Módulo Rescisões: tela, cadastro rápido, cards/quadro/tabela, importação e alertas.
import { chaveDoDia, ehDataValida } from '../../datas.js';
import { NIVEL, NOME_NIVEL } from '../../alertas.js';
import { novoId } from '../../dados.js';
import { esc, icone, confirmarDoisCliques } from '../../util.js';
import { selo, etapas, campoData, blocoPrazo, acoes, cabecalho, maisUrgente, animarSaida, diaMes } from '../../componentes.js';
import { criarLista } from '../lista.js';
import { painelImportacao, normalizar, lerData, lerInteiro, lerStatus } from '../../importar.js';
import {
  TIPOS, STATUS, NOME_STATUS, CAMPOS_EDITAVEIS,
  calcularRescisao, avaliarRescisao, novaRescisao, proximoStatus, statusAnterior,
} from './regras.js';

const TIPO_CURTO = { trabalhado: 'Trabalhado', indenizado: 'Indenizado' };

function analisar(r, ctx) {
  const calc = calcularRescisao(r, ctx.cfg, ctx.cal);
  const aval = avaliarRescisao(r, calc, ctx.agora, ctx.cfg);
  return { r, calc, aval };
}

function alertas(ctx) {
  const lista = [];
  for (const r of ctx.dados.rescisoes) {
    const { aval } = analisar(r, ctx);
    for (const p of aval.prazos) {
      if (p.nivel < NIVEL.amarelo) continue;
      lista.push({ nivel: p.nivel, faltam: p.faltam, titulo: r.nome, acao: p.acao, quando: p.quando, data: p.efetivo, texto: p.texto, alvo: { tela: 'rescisoes', id: r.id } });
    }
  }
  return lista;
}

/* ---------------- Desenho ---------------- */

function card({ r, calc, aval }, marcas) {
  const urg = maisUrgente(aval.prazos);
  const nivel = NOME_NIVEL[aval.nivel];
  const av = Object.fromEntries(aval.prazos.map((p) => [p.chave, p]));
  const datas = r.tipo === 'trabalhado'
    ? campoData('Início do aviso', 'inicioAviso', calc) + campoData('Fim do aviso', 'fimAviso', calc)
    : `<div class="campo"><span class="rotulo-campo">Desligamento</span><span class="valor">${esc(diaMes(calc.desligamento))}<span class="suave">· sem aviso</span></span></div>`;

  return `
  <article class="card nivel-${nivel}${marcas.novo === r.id ? ' novo' : ''}" data-id="${esc(r.id)}">
    <div class="card-cabeca">
      ${selo(urg)}
      <div class="card-titulo">
        <input class="card-nome" type="text" data-campo="nome" value="${esc(r.nome)}" aria-label="Nome">
        <div class="card-sub">
          <select data-campo="tipo" aria-label="Tipo de aviso">
            ${Object.entries(TIPOS).map(([v, t]) => `<option value="${v}"${r.tipo === v ? ' selected' : ''}>${t}</option>`).join('')}
          </select>
          <label class="inline">carta <input type="date" data-campo="dataCarta" value="${esc(r.dataCarta)}"></label>
          ${r.tipo === 'trabalhado' ? `<label class="inline"><input type="number" class="num-curto" min="0" max="120" step="1" data-campo="diasAviso" value="${calc.diasAviso}"> dias de aviso</label>` : ''}
        </div>
      </div>
      ${etapas(STATUS, NOME_STATUS, r.status, marcas.carimbo === r.id)}
    </div>
    <div class="grade">${datas}</div>
    <div class="prazos">
      ${blocoPrazo('Lançar no Linx até', 'prazoLinx', calc, calc.seguraLinx, calc.motivoLinx, av.linx)}
      ${blocoPrazo('Pagamento até', 'prazoPagamento', calc, calc.seguraPagamento, calc.motivoPagamento, av.pagamento)}
    </div>
    ${acoes(proximoStatus(r.status), statusAnterior(r.status), NOME_STATUS)}
  </article>`;
}

function menorPrazo(a) {
  return a.aval.prazos.reduce((m, p) => (p.efetivo < m ? p.efetivo : m), a.calc.prazoPagamento);
}

/** Célula de tabela com a data efetiva do prazo e a situação. */
function celulaPrazo(x, chave, prazo, segura) {
  const p = x.aval.prazos.find((q) => q.chave === chave);
  const data = segura || prazo;
  return `${esc(diaMes(data))}${segura ? ` ${icone('escudo')}` : ''}${p && p.nivel >= NIVEL.amarelo ? ` <span class="chip nivel-${NOME_NIVEL[p.nivel]}">${esc(p.texto)}</span>` : ''}`;
}

const lista = criarLista({
  id: 'rescisoes',
  itens: (ctx) => ctx.dados.rescisoes.map((r) => analisar(r, ctx)),
  idDe: (x) => x.r.id,
  nome: (x) => x.r.nome,
  concluido: (x) => x.r.status === 'paga',
  ordenarAbertas: (a, b) =>
    (a.r.status === 'pendente' ? 0 : 1) - (b.r.status === 'pendente' ? 0 : 1)
    || b.aval.nivel - a.aval.nivel
    || (menorPrazo(a) < menorPrazo(b) ? -1 : menorPrazo(a) > menorPrazo(b) ? 1 : 0),
  ordenarConcluidas: (a, b) => (a.calc.desligamento < b.calc.desligamento ? 1 : -1),
  card,
  vazio: { abertas: 'Nenhuma rescisão em aberto. Cadastre acima — nome, data da carta e Enter.', concluidas: 'Nenhuma rescisão paga ainda.' },
  status: {
    lista: STATUS,
    nomes: NOME_STATUS,
    de: (x) => x.r.status,
    mudar: (ctx, id, s) => { const r = ctx.dados.rescisoes.find((x) => x.id === id); if (r && STATUS.includes(s) && r.status !== s) { r.status = s; ctx.salvar(); } },
  },
  resumo: (x) => `${TIPO_CURTO[x.r.tipo]}${x.r.tipo === 'trabalhado' ? ` · ${x.calc.diasAviso} dias` : ''} · pagamento ${esc(diaMes(x.calc.seguraPagamento || x.calc.prazoPagamento))}`,
  tabela: [
    { titulo: 'Nome', html: (x) => `<strong>${esc(x.r.nome)}</strong>`, chave: (x) => normalizar(x.r.nome) },
    { titulo: 'Tipo', html: (x) => `${TIPO_CURTO[x.r.tipo]}${x.r.tipo === 'trabalhado' ? ` <span class="suave">${x.calc.diasAviso}d</span>` : ''}`, chave: (x) => x.r.tipo },
    { titulo: 'Carta', html: (x) => esc(diaMes(x.r.dataCarta)), chave: (x) => x.r.dataCarta },
    { titulo: 'Desligamento', html: (x) => esc(diaMes(x.calc.desligamento)), chave: (x) => x.calc.desligamento },
    { titulo: 'Linx até', html: (x) => celulaPrazo(x, 'linx', x.calc.prazoLinx, x.calc.seguraLinx), chave: (x) => x.calc.seguraLinx || x.calc.prazoLinx },
    { titulo: 'Pagamento até', html: (x) => celulaPrazo(x, 'pagamento', x.calc.prazoPagamento, x.calc.seguraPagamento), chave: (x) => x.calc.seguraPagamento || x.calc.prazoPagamento },
    { titulo: 'Status', html: (x) => `<span class="status-txt status-${x.r.status}">${NOME_STATUS[x.r.status]}</span>`, chave: (x) => STATUS.indexOf(x.r.status) },
  ],
});

/* ---------------- Importação ---------------- */

const IMPORTACAO = {
  titulo: 'Rescisões',
  exemplo: 'Nome\tData da carta\tTipo\tDias de aviso\nMaria Silva\t01/12/2026\ttrabalhado\t30\nJoão Souza\t03/12/2026\tindenizado',
  colunas: [
    { campo: 'nome', titulo: 'Nome', obrigatorio: true, nomes: ['nome', 'funcionario', 'colaborador', 'empregado', 'nome do funcionario'] },
    { campo: 'dataCarta', titulo: 'Data da carta', obrigatorio: true, nomes: ['data da carta', 'carta', 'data', 'data carta', 'data do aviso', 'data aviso', 'comunicacao'] },
    { campo: 'tipo', titulo: 'Tipo', nomes: ['tipo', 'aviso', 'tipo de aviso', 'tipo aviso', 'modalidade'] },
    { campo: 'diasAviso', titulo: 'Dias de aviso', nomes: ['dias de aviso', 'dias aviso', 'dias', 'prazo do aviso'] },
    { campo: 'status', titulo: 'Status', nomes: ['status', 'situacao'] },
  ],
  converter(v) {
    const dataCarta = lerData(v.dataCarta);
    if (!dataCarta) return { erro: `Data inválida: "${v.dataCarta}"` };
    const t = normalizar(v.tipo);
    if (t && !t.startsWith('indeniz') && !t.startsWith('trabalh') && t !== 'i' && t !== 't') return { erro: `Tipo desconhecido: "${v.tipo}" (use trabalhado ou indenizado)` };
    const tipo = t.startsWith('indeniz') || t === 'i' ? 'indenizado' : 'trabalhado';
    const dias = lerInteiro(v.diasAviso, 0, 120);
    if (dias.erro) return { erro: dias.erro };
    const st = lerStatus(v.status, { pendente: ['pendente', 'aberto', 'em aberto'], solicitada: ['solicitada', 'solicitado', 'pagamento solicitado'], paga: ['paga', 'pago', 'concluida', 'concluido'] });
    if (st.erro) return { erro: st.erro };
    return { registro: novaRescisao({ nome: v.nome, dataCarta, tipo, diasAviso: tipo === 'trabalhado' ? dias.valor : undefined, status: st.status }, novoId()) };
  },
  chave: (r) => `${normalizar(r.nome)}|${r.dataCarta}`,
  existentes: (ctx) => ctx.dados.rescisoes,
  resumoImportacao: (r, ctx) => {
    const c = calcularRescisao(r, ctx.cfg, ctx.cal);
    return `${TIPO_CURTO[r.tipo]}${r.tipo === 'trabalhado' ? ` · ${c.diasAviso} dias` : ''} · pagamento até ${esc(diaMes(c.seguraPagamento || c.prazoPagamento))} · ${NOME_STATUS[r.status]}`;
  },
};

/* ---------------- Tela ---------------- */

function renderizar(el, ctx) {
  const hoje = chaveDoDia(ctx.agora);
  el.innerHTML = `
    ${cabecalho('Desligamentos', 'Rescisões', '<p class="resumo-modulo"></p>')}
    <form id="form-rescisao" class="cadastro" autocomplete="off">
      <label class="campo nome">Nome
        <input type="text" name="nome" placeholder="Nome do funcionário" required>
      </label>
      <label class="campo">Data da carta
        <input type="date" name="dataCarta" value="${hoje}" required>
      </label>
      <label class="campo">Tipo
        <select name="tipo">
          ${Object.entries(TIPOS).map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}
        </select>
      </label>
      <label class="campo" id="campo-dias-aviso">Dias de aviso
        <input type="number" name="diasAviso" class="num-curto" min="0" max="120" step="1" value="${ctx.cfg.avisoDias}">
      </label>
      <button class="btn" type="submit">${icone('mais')} Cadastrar <kbd>Enter</kbd></button>
    </form>
    ${lista.barra('Pagas')}
    <div id="lista" class="lista"></div>`;

  const form = el.querySelector('#form-rescisao');
  const campoDias = el.querySelector('#campo-dias-aviso');
  form.tipo.onchange = () => { campoDias.hidden = form.tipo.value !== 'trabalhado'; };
  form.onkeydown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); form.requestSubmit(); }
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    const nome = form.nome.value.trim();
    const dataCarta = form.dataCarta.value;
    const dias = Number(form.diasAviso.value);
    if (!nome) { form.nome.focus(); return; }
    if (!ehDataValida(dataCarta)) { form.dataCarta.focus(); return; }
    const tipo = form.tipo.value;
    if (tipo === 'trabalhado' && (!Number.isInteger(dias) || dias < 0 || dias > 120)) { form.diasAviso.focus(); return; }
    const id = novoId();
    // Só guarda os dias se forem diferentes do padrão (assim segue as Configurações).
    ctx.dados.rescisoes.push(novaRescisao({ nome, dataCarta, tipo, diasAviso: tipo === 'trabalhado' && dias !== ctx.cfg.avisoDias ? dias : undefined }, id));
    lista.marcarNovo(id);
    form.nome.value = '';
    form.dataCarta.value = chaveDoDia(ctx.agora);
    form.diasAviso.value = ctx.cfg.avisoDias;
    ctx.salvar();
    form.nome.focus();
  };

  el.onclick = (e) => {
    if (e.target.closest('[data-acao-lista="importar"]')) {
      painelImportacao(el.querySelector('#importar'), IMPORTACAO, ctx, (registros) => {
        ctx.dados.rescisoes.push(...registros);
        ctx.salvar();
        el.querySelector('#importar').innerHTML = `<p class="importado">${icone('check')} ${registros.length} ${registros.length === 1 ? 'rescisão importada' : 'rescisões importadas'}.</p>`;
      });
      return;
    }
    if (lista.clique(e, el, ctx)) return;
    const btn = e.target.closest('button[data-acao]');
    const cardEl = e.target.closest('.card');
    if (!btn || !cardEl) return;
    const r = ctx.dados.rescisoes.find((x) => x.id === cardEl.dataset.id);
    if (!r) return;
    const acao = btn.dataset.acao;
    if (acao === 'avancar' || acao === 'voltar') {
      const novo = acao === 'avancar' ? proximoStatus(r.status) : statusAnterior(r.status);
      if (!novo) return;
      if (novo === 'paga' || r.status === 'paga') { animarSaida(cardEl, () => { r.status = novo; ctx.salvar(); }); return; }
      r.status = novo;
      lista.marcarCarimbo(r.id);
    } else if (acao === 'restaurar') delete r.manual[btn.dataset.campo];
    else if (acao === 'excluir') {
      if (!confirmarDoisCliques(btn)) return;
      animarSaida(cardEl, () => { ctx.dados.rescisoes = ctx.dados.rescisoes.filter((x) => x !== r); ctx.salvar(); });
      return;
    } else return;
    ctx.salvar();
  };

  el.onchange = (e) => {
    const alvo = e.target;
    const cardEl = alvo.closest('.card');
    if (!cardEl) return;
    const r = ctx.dados.rescisoes.find((x) => x.id === cardEl.dataset.id);
    if (!r) return;
    const v = alvo.value;
    if (alvo.dataset.manual) {
      const campo = alvo.dataset.manual;
      if (!CAMPOS_EDITAVEIS.includes(campo)) return;
      if (ehDataValida(v)) r.manual[campo] = v; else delete r.manual[campo]; // apagado = volta ao calculado
    } else if (alvo.dataset.campo === 'nome') {
      if (v.trim()) r.nome = v.trim(); else { alvo.value = r.nome; return; }
    } else if (alvo.dataset.campo === 'dataCarta') {
      if (ehDataValida(v)) r.dataCarta = v; else { alvo.value = r.dataCarta; return; }
    } else if (alvo.dataset.campo === 'tipo') {
      if (TIPOS[v]) r.tipo = v;
    } else if (alvo.dataset.campo === 'diasAviso') {
      const n = Number(v);
      if (Number.isInteger(n) && n >= 0 && n <= 120) r.diasAviso = n; else { alvo.value = calcularRescisao(r, ctx.cfg, ctx.cal).diasAviso; return; }
    } else return;
    ctx.salvar();
  };

  lista.montar(el, ctx);
}

export default {
  id: 'rescisoes',
  titulo: 'Rescisões',
  icone: 'rescisao',
  alertas,
  renderizar,
  atualizar: (el, ctx) => lista.atualizar(el, ctx),
  prepararAbertura: (id, ctx) => lista.prepararAbertura(id, ctx),
  importacao: IMPORTACAO,
  // Configurações deste módulo (aparecem em Configurações > Rescisões).
  opcoes: {
    titulo: 'Rescisões',
    campos: [
      { campo: 'avisoDias', rotulo: 'Duração padrão do aviso trabalhado', unidade: 'dias',
        dica: 'Quantos dias corridos o aviso trabalhado dura quando nada for dito. O fim do aviso é a data de início mais esse número. Ex.: carta em 01/03 com 30 dias → fim em 31/03. Se a pessoa for cumprir menos (ex.: 15 dias), mude só no cadastro ou no card dela.' },
      { campo: 'linxAjusteDias', rotulo: 'Prazo para lançar no Linx', unidade: 'dias após o fim',
        dica: 'Quantos dias depois do fim do aviso (ou do desligamento, no indenizado) vence o lançamento da rescisão no Linx. 0 = no próprio dia. Use número negativo para antecipar: -2 = dois dias antes.' },
      { campo: 'pagamentoDias', rotulo: 'Prazo de pagamento', unidade: 'dias após o fim',
        dica: 'Dias corridos depois do fim do aviso (ou do desligamento, no indenizado) para pagar a rescisão. Se cair em fim de semana ou feriado, o card mostra também o dia útil anterior (escudo).' },
    ],
  },
};
