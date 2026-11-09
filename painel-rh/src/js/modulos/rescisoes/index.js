// Módulo Rescisões: tela, cadastro rápido, cards e alertas.
import { chaveDoDia, ehDataValida } from '../../datas.js';
import { NIVEL, NOME_NIVEL } from '../../alertas.js';
import { novoId } from '../../dados.js';
import { esc, icone, dataCurta, confirmarDoisCliques } from '../../util.js';
import {
  TIPOS, NOME_STATUS, CAMPOS_EDITAVEIS,
  calcularRescisao, avaliarRescisao, novaRescisao, proximoStatus, statusAnterior,
} from './regras.js';

let aba = 'abertas'; // 'abertas' | 'pagas'
let adiado = false; // redesenho da lista adiado enquanto um campo está em edição
const ouvindoFoco = new WeakSet();

function analisar(r, ctx) {
  const calc = calcularRescisao(r, ctx.cfg, ctx.cal);
  const aval = avaliarRescisao(r, calc, ctx.agora, ctx.cfg);
  return { r, calc, aval };
}

function alertas(ctx) {
  const lista = [];
  for (const r of ctx.dados.rescisoes) {
    const { calc, aval } = analisar(r, ctx);
    for (const p of aval.prazos) {
      if (p.nivel < NIVEL.amarelo) continue;
      lista.push({
        nivel: p.nivel,
        titulo: r.nome,
        acao: p.acao,
        data: p.efetivo,
        dataOriginal: p.efetivo !== p.prazo ? p.prazo : null,
        texto: p.texto,
        alvo: { tela: 'rescisoes', id: r.id },
        calc,
      });
    }
  }
  return lista;
}

/* ---------------- Desenho ---------------- */

function campoData(rotulo, campo, calc) {
  const editado = calc.manual[campo];
  return `
    <div class="campo">
      <span>${esc(rotulo)} ${editado ? '<span class="editado">editado</span>' : ''}</span>
      <span class="linha">
        <input type="date" data-manual="${campo}" value="${esc(calc[campo])}">
        <span class="dia">${esc(dataCurta(calc[campo]).split(' ')[0])}</span>
        ${editado ? `<button type="button" class="btn-link" data-acao="restaurar" data-campo="${campo}" title="Voltar ao valor calculado (${esc(dataCurta(calc.calculado[campo]))})">${icone('desfazer')}</button>` : ''}
      </span>
    </div>`;
}

function blocoPrazo(titulo, campo, segura, motivo, avaliacao, calc) {
  const editado = calc.manual[campo];
  const nivel = avaliacao ? NOME_NIVEL[avaliacao.nivel] : 'normal';
  return `
    <div class="prazo nivel-${nivel}">
      <div class="titulo">${esc(titulo)} ${editado ? '<span class="editado">editado</span>' : ''}</div>
      <div class="linha">
        <input type="date" data-manual="${campo}" value="${esc(calc[campo])}">
        <span class="dia">${esc(dataCurta(calc[campo]).split(' ')[0])}</span>
        ${editado ? `<button type="button" class="btn-link" data-acao="restaurar" data-campo="${campo}" title="Voltar ao valor calculado (${esc(dataCurta(calc.calculado[campo]))})">${icone('desfazer')}</button>` : ''}
        ${avaliacao ? `<span class="chip nivel-${nivel}">${avaliacao.nivel >= NIVEL.laranja ? icone(avaliacao.nivel === NIVEL.laranja ? 'relogio' : 'alerta') : ''}${esc(avaliacao.texto)}</span>` : ''}
      </div>
      ${segura ? `<div class="segura">Cai em ${esc(motivo)}. Data segura: <strong>${esc(dataCurta(segura))}</strong></div>` : ''}
    </div>`;
}

function card({ r, calc, aval }, destaqueId) {
  const nivel = NOME_NIVEL[aval.nivel];
  const av = Object.fromEntries(aval.prazos.map((p) => [p.chave, p]));
  const prox = proximoStatus(r.status);
  const ant = statusAnterior(r.status);
  const datas = r.tipo === 'trabalhado'
    ? campoData('Início do aviso', 'inicioAviso', calc) + campoData('Fim do aviso', 'fimAviso', calc)
    : `<div class="campo"><span>Desligamento (sem aviso)</span><span class="valor">${esc(dataCurta(calc.desligamento))}</span></div>`;

  return `
  <article class="card nivel-${nivel}${destaqueId === r.id ? ' destaque' : ''}" data-id="${esc(r.id)}">
    <div class="card-topo">
      <input class="card-nome" type="text" data-campo="nome" value="${esc(r.nome)}" aria-label="Nome">
      <select data-campo="tipo" aria-label="Tipo de aviso">
        ${Object.entries(TIPOS).map(([v, t]) => `<option value="${v}"${r.tipo === v ? ' selected' : ''}>${t}</option>`).join('')}
      </select>
      <span class="status status-${r.status}">${NOME_STATUS[r.status]}</span>
    </div>
    <div class="grade">
      <div class="campo">
        <span>Data da carta</span>
        <span class="linha"><input type="date" data-campo="dataCarta" value="${esc(r.dataCarta)}"><span class="dia">${esc(dataCurta(r.dataCarta).split(' ')[0])}</span></span>
      </div>
      ${datas}
    </div>
    <div class="prazos">
      ${blocoPrazo('Lançar rescisão no Linx até', 'prazoLinx', calc.seguraLinx, calc.motivoLinx, av.linx, calc)}
      ${blocoPrazo('Prazo de pagamento', 'prazoPagamento', calc.seguraPagamento, calc.motivoPagamento, av.pagamento, calc)}
    </div>
    <div class="card-acoes">
      ${prox ? `<button type="button" class="btn btn-grande" data-acao="avancar">${icone(prox === 'paga' ? 'check' : 'seta')} Marcar como ${NOME_STATUS[prox]}</button>` : ''}
      ${ant ? `<button type="button" class="btn-link" data-acao="voltar">${icone('desfazer')} Voltar para ${NOME_STATUS[ant]}</button>` : ''}
      <span class="espaco"></span>
      <button type="button" class="btn-link perigo" data-acao="excluir">${icone('lixo')} Excluir</button>
    </div>
  </article>`;
}

function menorPrazo(a) {
  return a.aval.prazos.reduce((m, p) => (p.efetivo < m ? p.efetivo : m), a.calc.prazoPagamento);
}

function ordenar(itens) {
  if (aba === 'pagas') return itens.sort((a, b) => (a.calc.desligamento < b.calc.desligamento ? 1 : -1));
  return itens.sort((a, b) =>
    (a.r.status === 'pendente' ? 0 : 1) - (b.r.status === 'pendente' ? 0 : 1)
    || b.aval.nivel - a.aval.nivel
    || (menorPrazo(a) < menorPrazo(b) ? -1 : menorPrazo(a) > menorPrazo(b) ? 1 : 0));
}

/** Identifica um controle do card para devolver o foco a ele depois de redesenhar. */
function chaveFoco(node) {
  const c = node && node.closest && node.closest('.card');
  if (!c) return null;
  for (const a of ['data-manual', 'data-campo', 'data-acao']) {
    if (node.hasAttribute(a)) return `.card[data-id="${CSS.escape(c.dataset.id)}"] [${a}="${CSS.escape(node.getAttribute(a))}"]`;
  }
  return null;
}

function desenharLista(el, ctx, focarDepois) {
  const lista = el.querySelector('#lista-rescisoes');
  const todas = ctx.dados.rescisoes.map((r) => analisar(r, ctx));
  const abertas = todas.filter((x) => x.r.status !== 'paga');
  const pagas = todas.filter((x) => x.r.status === 'paga');
  el.querySelector('[data-aba="abertas"]').textContent = `Em aberto (${abertas.length})`;
  el.querySelector('[data-aba="pagas"]').textContent = `Pagas (${pagas.length})`;
  for (const b of el.querySelectorAll('[data-aba]')) b.setAttribute('aria-selected', String(b.dataset.aba === aba));
  const itens = ordenar(aba === 'pagas' ? pagas : abertas);
  lista.innerHTML = itens.length
    ? itens.map((x) => card(x, ctx.destaqueId)).join('')
    : `<p class="vazio">${aba === 'pagas' ? 'Nenhuma rescisão paga.' : 'Nenhuma rescisão em aberto.'}</p>`;
  const sel = chaveFoco(focarDepois);
  if (sel) lista.querySelector(sel)?.focus();
}

function renderizar(el, ctx) {
  const hoje = chaveDoDia(ctx.agora);
  el.innerHTML = `
    <h1>Rescisões</h1>
    <form id="form-rescisao" class="cadastro" autocomplete="off">
      <label class="nome">Nome
        <input type="text" name="nome" placeholder="Nome do funcionário" required>
      </label>
      <label>Data da carta
        <input type="date" name="dataCarta" value="${hoje}" required>
      </label>
      <label>Tipo
        <select name="tipo">
          ${Object.entries(TIPOS).map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}
        </select>
      </label>
      <button class="btn" type="submit">${icone('mais')} Salvar <span class="suave pequeno">(Enter)</span></button>
    </form>
    <div class="abas" role="tablist">
      <button type="button" role="tab" data-aba="abertas"></button>
      <button type="button" role="tab" data-aba="pagas"></button>
    </div>
    <div id="lista-rescisoes" class="lista"></div>`;

  const form = el.querySelector('#form-rescisao');
  // Enter salva em qualquer campo do cadastro (inclusive no seletor de tipo).
  form.onkeydown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); form.requestSubmit(); }
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    const nome = form.nome.value.trim();
    const dataCarta = form.dataCarta.value;
    if (!nome) { form.nome.focus(); return; }
    if (!ehDataValida(dataCarta)) { form.dataCarta.focus(); return; }
    ctx.dados.rescisoes.push(novaRescisao({ nome, dataCarta, tipo: form.tipo.value }, novoId()));
    aba = 'abertas';
    form.nome.value = '';
    form.dataCarta.value = chaveDoDia(ctx.agora);
    ctx.salvar();
    form.nome.focus();
  };

  el.onclick = (e) => {
    const btnAba = e.target.closest('[data-aba]');
    if (btnAba) { aba = btnAba.dataset.aba; desenharLista(el, ctx); return; }
    const btn = e.target.closest('button[data-acao]');
    const cardEl = e.target.closest('.card');
    if (!btn || !cardEl) return;
    const r = ctx.dados.rescisoes.find((x) => x.id === cardEl.dataset.id);
    if (!r) return;
    const acao = btn.dataset.acao;
    if (acao === 'avancar') r.status = proximoStatus(r.status) || r.status;
    else if (acao === 'voltar') r.status = statusAnterior(r.status) || r.status;
    else if (acao === 'restaurar') delete r.manual[btn.dataset.campo];
    else if (acao === 'excluir') {
      if (!confirmarDoisCliques(btn)) return;
      ctx.dados.rescisoes = ctx.dados.rescisoes.filter((x) => x !== r);
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
      if (ehDataValida(v)) r.manual[campo] = v; else delete r.manual[campo]; // campo apagado = volta ao calculado
    } else if (alvo.dataset.campo === 'nome') {
      if (v.trim()) r.nome = v.trim(); else { alvo.value = r.nome; return; }
    } else if (alvo.dataset.campo === 'dataCarta') {
      if (ehDataValida(v)) r.dataCarta = v; else { alvo.value = r.dataCarta; return; }
    } else if (alvo.dataset.campo === 'tipo') {
      if (TIPOS[v]) r.tipo = v;
    } else return;
    ctx.salvar();
  };

  // Quando o foco sai de um campo editado, aplica o redesenho que foi adiado.
  // (onfocusout não existe como propriedade; registra o ouvinte uma única vez.)
  if (!ouvindoFoco.has(el)) {
    ouvindoFoco.add(el);
    el.addEventListener('focusout', (e) => {
      if (!adiado || !e.target.closest('#lista-rescisoes')) return;
      adiado = false;
      desenharLista(el, ctx, e.relatedTarget);
    });
  }

  adiado = false;
  desenharLista(el, ctx);
  if (ctx.destaqueId) {
    el.querySelector(`.card[data-id="${CSS.escape(ctx.destaqueId)}"]`)?.scrollIntoView({ block: 'center' });
  }
}

/**
 * Chamado a cada minuto e após cada alteração. Nunca redesenha enquanto um campo
 * do card está em edição (perderia o que está sendo digitado): adia até o foco sair.
 */
function atualizar(el, ctx) {
  const lista = el.querySelector('#lista-rescisoes');
  if (!lista) return;
  const ativo = document.activeElement;
  if (lista.contains(ativo) && ativo.matches('input, select')) { adiado = true; return; }
  adiado = false;
  desenharLista(el, ctx);
}

export default {
  id: 'rescisoes',
  titulo: 'Rescisões',
  icone: 'rescisao',
  alertas,
  renderizar,
  atualizar,
};
