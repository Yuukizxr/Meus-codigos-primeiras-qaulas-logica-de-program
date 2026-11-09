// Lista reaproveitável por qualquer módulo (rescisões, férias, ...).
// Três visões dos mesmos dados:
//   - Cards  (a visão completa, com edição)
//   - Quadro (colunas por status; arraste o card para mudar o status)
//   - Tabela (todas as datas lado a lado; clique no título da coluna para ordenar)
// Mais: busca por nome, filtros rápidos, resumo com números, e
// NÃO redesenha enquanto um campo está sendo editado (aplica quando o foco sai).
import { NIVEL, NOME_NIVEL } from '../alertas.js';
import { esc, icone } from '../util.js';

const VISOES = [['cards', 'Cards', 'cards'], ['quadro', 'Quadro', 'quadro'], ['tabela', 'Tabela', 'tabela']];
const FILTROS = [
  ['todos', 'Todos', () => true],
  ['atrasados', 'Atrasados', (x) => x.aval.nivel === NIVEL.vermelho],
  ['semana', 'Próximos 7 dias', (x) => x.aval.prazos.some((p) => p.faltam >= 0 && p.faltam <= 7)],
  ['mes', 'Próximos 30 dias', (x) => x.aval.prazos.some((p) => p.faltam >= 0 && p.faltam <= 30)],
];

/** Texto sem acentos e em minúsculas, para a busca. */
export const semAcento = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function lembrar(chave, valor) {
  try {
    if (valor === undefined) return localStorage.getItem(chave);
    localStorage.setItem(chave, valor);
  } catch { /* navegador sem armazenamento: só não lembra a escolha */ }
  return null;
}

/**
 * @param {{
 *   id:string, itens:(ctx)=>Array<{aval:object}>, concluido:(x)=>boolean, nome:(x)=>string, idDe:(x)=>string,
 *   ordenarAbertas:(a,b)=>number, ordenarConcluidas:(a,b)=>number,
 *   card:(x, marcas)=>string, rotuloConcluidas:string, vazio:{abertas:string, concluidas:string},
 *   status:{ lista:string[], nomes:object, de:(x)=>string, mudar:(ctx, id, status)=>void },
 *   resumo:(x)=>string,
 *   tabela:Array<{ titulo:string, html:(x)=>string, chave:(x)=>string|number }>,
 * }} def
 */
export function criarLista(def) {
  const estado = {
    aba: 'abertas', adiado: false, novo: null, carimbo: null, entrada: false,
    visao: lembrar(`painel-rh:${def.id}:visao`) || 'cards', filtro: 'todos', busca: '', ordem: { col: -1, asc: true },
  };
  if (!VISOES.some(([v]) => v === estado.visao)) estado.visao = 'cards';
  const ouvindo = new WeakSet();

  function chaveFoco(node) {
    const c = node && node.closest && node.closest('.card');
    if (!c) return null;
    for (const a of ['data-manual', 'data-campo', 'data-acao']) {
      if (node.hasAttribute(a)) return `.card[data-id="${CSS.escape(c.dataset.id)}"] [${a}="${CSS.escape(node.getAttribute(a))}"]`;
    }
    return null;
  }

  function passaBusca(x) {
    return !estado.busca || semAcento(def.nome(x)).includes(semAcento(estado.busca));
  }

  /* ---------- visões ---------- */

  function htmlCards(itens) {
    return itens.map((x) => def.card(x, estado)).join('');
  }

  function miniCard(x) {
    const urg = x.aval.prazos.reduce((m, p) => (!m || p.nivel > m.nivel || (p.nivel === m.nivel && p.faltam < m.faltam) ? p : m), undefined);
    const nivel = NOME_NIVEL[x.aval.nivel];
    return `
      <div class="mini nivel-${nivel}${estado.carimbo === def.idDe(x) ? ' carimbo' : ''}" draggable="true" tabindex="0" data-id="${esc(def.idDe(x))}" title="Arraste para outra coluna para mudar o status. Clique para abrir.">
        <div class="mini-topo"><strong>${esc(def.nome(x))}</strong>${urg ? `<span class="chip nivel-${NOME_NIVEL[urg.nivel]}">${esc(urg.texto)}</span>` : ''}</div>
        <div class="mini-sub">${def.resumo(x)}</div>
      </div>`;
  }

  function htmlQuadro(todos) {
    return def.status.lista.map((s) => {
      const doStatus = todos.filter((x) => def.status.de(x) === s);
      const ordenados = doStatus.length ? doStatus.sort(def.concluido(doStatus[0]) ? def.ordenarConcluidas : def.ordenarAbertas) : doStatus;
      return `
        <section class="coluna" data-status="${s}">
          <h3>${esc(def.status.nomes[s])} <span class="contagem">${doStatus.length}</span></h3>
          <div class="coluna-cards">${ordenados.map(miniCard).join('') || '<p class="coluna-vazia">Arraste um card para cá</p>'}</div>
        </section>`;
    }).join('');
  }

  function htmlTabela(itens) {
    const { col, asc } = estado.ordem;
    if (col >= 0) {
      const k = def.tabela[col].chave;
      itens.sort((a, b) => { const x = k(a), y = k(b); return (x < y ? -1 : x > y ? 1 : 0) * (asc ? 1 : -1); });
    }
    return `
      <div class="tabela-rolagem"><table class="tabela">
        <thead><tr>${def.tabela.map((c, i) => `<th><button type="button" data-ordem="${i}" class="${i === col ? (asc ? 'asc' : 'desc') : ''}">${esc(c.titulo)}</button></th>`).join('')}</tr></thead>
        <tbody>${itens.map((x) => `<tr class="nivel-${NOME_NIVEL[x.aval.nivel]}" tabindex="0" data-id="${esc(def.idDe(x))}">${def.tabela.map((c) => `<td>${c.html(x)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>`;
  }

  /* ---------- desenho ---------- */

  function desenhar(el, ctx, focarDepois) {
    const listaEl = el.querySelector('#lista');
    if (!listaEl) return;
    const todos = def.itens(ctx);
    const abertosTodos = todos.filter((x) => !def.concluido(x));
    const filtro = FILTROS.find(([f]) => f === estado.filtro) || FILTROS[0];
    const visiveis = todos.filter((x) => passaBusca(x) && (filtro[2](x) || (estado.visao === 'quadro' && def.concluido(x) && estado.filtro === 'todos')));
    const abertas = visiveis.filter((x) => !def.concluido(x));
    const concluidas = visiveis.filter((x) => def.concluido(x));

    // Resumo do módulo (números no topo).
    const resumo = el.querySelector('.resumo-modulo');
    if (resumo) {
      const atrasados = abertosTodos.filter(FILTROS[1][2]).length;
      const semana = abertosTodos.filter(FILTROS[2][2]).length;
      resumo.innerHTML = `<span><b>${abertosTodos.length}</b> em aberto</span><span class="${atrasados ? 'tem-atraso' : ''}"><b>${atrasados}</b> atrasados</span><span><b>${semana}</b> nos próximos 7 dias</span>`;
    }
    // Barra: visão, filtros e abas.
    const barra = el.querySelector('.barra');
    if (barra) barra.dataset.visao = estado.visao;
    for (const b of el.querySelectorAll('[data-visao-btn]')) b.setAttribute('aria-pressed', String(b.dataset.visaoBtn === estado.visao));
    for (const b of el.querySelectorAll('[data-filtro]')) {
      b.setAttribute('aria-pressed', String(b.dataset.filtro === estado.filtro));
      const n = b.querySelector('.contagem');
      const f = FILTROS.find(([id]) => id === b.dataset.filtro);
      if (n && f) n.textContent = abertosTodos.filter((x) => passaBusca(x) && f[2](x)).length;
    }
    for (const b of el.querySelectorAll('[data-aba]')) {
      b.setAttribute('aria-selected', String(b.dataset.aba === estado.aba));
      const n = b.querySelector('.contagem');
      if (n) n.textContent = b.dataset.aba === 'abertas' ? abertas.length : concluidas.length;
    }

    // A animação de entrada só acontece ao abrir a tela/trocar de visão ou aba, nunca no recálculo do minuto.
    listaEl.classList.toggle('entrando', estado.entrada);
    estado.entrada = false;
    listaEl.className = `${estado.visao === 'quadro' ? 'quadro' : estado.visao === 'tabela' ? 'lista lista-tabela' : 'lista'}${listaEl.classList.contains('entrando') ? ' entrando' : ''}`;

    const daAba = estado.aba === 'concluidas' ? concluidas.sort(def.ordenarConcluidas) : abertas.sort(def.ordenarAbertas);
    const vazio = `<p class="vazio">${estado.busca || estado.filtro !== 'todos' ? 'Nada encontrado com essa busca/filtro.' : def.vazio[estado.aba]}</p>`;
    if (estado.visao === 'quadro') listaEl.innerHTML = htmlQuadro(visiveis);
    else if (estado.visao === 'tabela') listaEl.innerHTML = daAba.length ? htmlTabela(daAba) : vazio;
    else listaEl.innerHTML = daAba.length ? htmlCards(daAba) : vazio;

    estado.novo = null;
    estado.carimbo = null;
    const sel = chaveFoco(focarDepois);
    if (sel) listaEl.querySelector(sel)?.focus();
  }

  /** Abre um item na visão Cards, destacado. */
  function abrir(el, ctx, id) {
    estado.visao = 'cards';
    lembrar(`painel-rh:${def.id}:visao`, 'cards');
    const x = def.itens(ctx).find((i) => def.idDe(i) === id);
    estado.aba = x && def.concluido(x) ? 'concluidas' : 'abertas';
    estado.filtro = 'todos';
    estado.busca = '';
    const busca = el.querySelector('.busca input');
    if (busca) busca.value = '';
    ctx.irPara(def.id, id);
  }

  return {
    get aba() { return estado.aba; },
    marcarNovo(id) { estado.novo = id; estado.aba = 'abertas'; },
    marcarCarimbo(id) { estado.carimbo = id; },

    /** HTML da barra: resumo, visões, busca, filtros, importar e abas. */
    barra(rotuloConcluidas) {
      return `
        <div class="barra" data-visao="${estado.visao}">
          <div class="barra-linha">
            <div class="segmentos" role="group" aria-label="Visão">
              ${VISOES.map(([v, t, ic]) => `<button type="button" data-visao-btn="${v}" aria-pressed="${estado.visao === v}">${icone(ic)}<span>${t}</span></button>`).join('')}
            </div>
            <label class="busca">${icone('lupa')}<input type="search" placeholder="Buscar nome…" value="${esc(estado.busca)}" aria-label="Buscar por nome"></label>
            <span class="espaco"></span>
            <button type="button" class="btn-link" data-acao-lista="importar">${icone('importar')} Importar do Excel</button>
          </div>
          <div class="barra-linha">
            <div class="filtros" role="group" aria-label="Filtros rápidos">
              ${FILTROS.map(([f, t]) => `<button type="button" data-filtro="${f}" aria-pressed="${estado.filtro === f}">${t}${f === 'todos' ? '' : ' <span class="contagem">0</span>'}</button>`).join('')}
            </div>
            <span class="espaco"></span>
            <div class="abas" role="tablist">
              <button type="button" role="tab" data-aba="abertas" aria-selected="${estado.aba === 'abertas'}">Em aberto <span class="contagem">0</span></button>
              <button type="button" role="tab" data-aba="concluidas" aria-selected="${estado.aba === 'concluidas'}">${esc(rotuloConcluidas)} <span class="contagem">0</span></button>
            </div>
          </div>
        </div>
        <div id="importar"></div>`;
    },

    /** Trata cliques da barra e das visões Quadro/Tabela. Devolve true se tratou. */
    clique(e, el, ctx) {
      const t = e.target;
      const aba = t.closest('[data-aba]');
      if (aba) {
        if (aba.dataset.aba !== estado.aba) { estado.aba = aba.dataset.aba; estado.entrada = true; desenhar(el, ctx); }
        return true;
      }
      const v = t.closest('[data-visao-btn]');
      if (v) {
        if (v.dataset.visaoBtn !== estado.visao) {
          estado.visao = v.dataset.visaoBtn;
          lembrar(`painel-rh:${def.id}:visao`, estado.visao);
          estado.entrada = true;
          desenhar(el, ctx);
        }
        return true;
      }
      const f = t.closest('[data-filtro]');
      if (f) { estado.filtro = f.dataset.filtro; estado.entrada = true; desenhar(el, ctx); return true; }
      const o = t.closest('[data-ordem]');
      if (o) {
        const col = +o.dataset.ordem;
        estado.ordem = { col, asc: estado.ordem.col === col ? !estado.ordem.asc : true };
        desenhar(el, ctx);
        return true;
      }
      const item = t.closest('.mini[data-id], .tabela tr[data-id]');
      if (item) { abrir(el, ctx, item.dataset.id); return true; }
      return false;
    },

    /** Primeira montagem da tela. */
    montar(el, ctx) {
      if (!ouvindo.has(el)) {
        ouvindo.add(el);
        el.addEventListener('focusout', (e) => {
          if (!estado.adiado || !e.target.closest('#lista')) return;
          estado.adiado = false;
          desenhar(el, ctx, e.relatedTarget);
        });
        el.addEventListener('input', (e) => {
          if (!e.target.closest('.busca')) return;
          estado.busca = e.target.value;
          desenhar(el, ctx);
        });
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && e.target.matches('.mini[data-id], .tabela tr[data-id]')) abrir(el, ctx, e.target.dataset.id);
        });
        // Arrastar no Quadro (muda o status).
        el.addEventListener('dragstart', (e) => {
          const m = e.target.closest('.mini[data-id]');
          if (!m) return;
          e.dataTransfer.setData('text/plain', m.dataset.id);
          e.dataTransfer.effectAllowed = 'move';
          m.classList.add('arrastando');
        });
        el.addEventListener('dragend', (e) => {
          e.target.closest?.('.mini')?.classList.remove('arrastando');
          for (const c of el.querySelectorAll('.coluna.alvo')) c.classList.remove('alvo');
        });
        el.addEventListener('dragover', (e) => {
          const c = e.target.closest('.coluna');
          if (!c) return;
          e.preventDefault();
          for (const o of el.querySelectorAll('.coluna.alvo')) if (o !== c) o.classList.remove('alvo');
          c.classList.add('alvo');
        });
        el.addEventListener('drop', (e) => {
          const c = e.target.closest('.coluna');
          if (!c) return;
          e.preventDefault();
          c.classList.remove('alvo');
          const id = e.dataTransfer.getData('text/plain');
          if (id) { estado.carimbo = id; def.status.mudar(ctx, id, c.dataset.status); }
        });
      }
      estado.adiado = false;
      estado.entrada = true;
      desenhar(el, ctx);
      if (ctx.destaqueId) {
        const alvo = el.querySelector(`.card[data-id="${CSS.escape(ctx.destaqueId)}"]`);
        if (alvo) { alvo.classList.add('destaque'); alvo.scrollIntoView({ block: 'center' }); }
      }
    },

    /** Abre um item a partir de fora (alerta da faixa "Hoje"). Garante a visão Cards. */
    prepararAbertura(id, ctx) {
      estado.visao = 'cards';
      estado.filtro = 'todos';
      estado.busca = '';
      const x = def.itens(ctx).find((i) => def.idDe(i) === id);
      estado.aba = x && def.concluido(x) ? 'concluidas' : 'abertas';
    },

    /** A cada minuto e após cada alteração. Adia se um campo do card está em edição. */
    atualizar(el, ctx) {
      const listaEl = el.querySelector('#lista');
      if (!listaEl) return;
      const ativo = document.activeElement;
      if (listaEl.contains(ativo) && ativo.matches('input, select')) { estado.adiado = true; return; }
      estado.adiado = false;
      desenhar(el, ctx);
    },
  };
}
