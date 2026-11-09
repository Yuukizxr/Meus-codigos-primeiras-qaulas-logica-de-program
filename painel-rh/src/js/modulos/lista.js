// Lista de cards reaproveitável por qualquer módulo (rescisões, férias, ...).
// Cuida de: abas Em aberto/Concluídas, ordenação, animações de entrada,
// e de NÃO redesenhar enquanto um campo está sendo editado (aplica quando o foco sai).

/**
 * @param {{
 *   itens:(ctx)=>any[], concluido:(x)=>boolean,
 *   ordenarAbertas:(a,b)=>number, ordenarConcluidas:(a,b)=>number,
 *   card:(x, marcas:{novo:string|null, carimbo:string|null})=>string,
 *   rotuloConcluidas:string, vazio:{abertas:string, concluidas:string}
 * }} def
 */
export function criarLista(def) {
  const estado = { aba: 'abertas', adiado: false, novo: null, carimbo: null, entrada: false };
  const ouvindo = new WeakSet();

  /** Seletor do controle focado, para devolver o foco depois de redesenhar. */
  function chaveFoco(node) {
    const c = node && node.closest && node.closest('.card');
    if (!c) return null;
    for (const a of ['data-manual', 'data-campo', 'data-acao']) {
      if (node.hasAttribute(a)) return `.card[data-id="${CSS.escape(c.dataset.id)}"] [${a}="${CSS.escape(node.getAttribute(a))}"]`;
    }
    return null;
  }

  function desenhar(el, ctx, focarDepois) {
    const listaEl = el.querySelector('#lista');
    if (!listaEl) return;
    const todos = def.itens(ctx);
    const abertas = todos.filter((x) => !def.concluido(x));
    const concluidas = todos.filter((x) => def.concluido(x));
    for (const b of el.querySelectorAll('[data-aba]')) {
      b.setAttribute('aria-selected', String(b.dataset.aba === estado.aba));
      const n = b.querySelector('.contagem');
      if (n) n.textContent = b.dataset.aba === 'abertas' ? abertas.length : concluidas.length;
    }
    const itens = estado.aba === 'concluidas' ? concluidas.sort(def.ordenarConcluidas) : abertas.sort(def.ordenarAbertas);
    // A animação de entrada só acontece ao abrir a tela/trocar de aba, nunca no recálculo do minuto.
    listaEl.classList.toggle('entrando', estado.entrada);
    estado.entrada = false;
    listaEl.innerHTML = itens.length
      ? itens.map((x) => def.card(x, estado)).join('')
      : `<p class="vazio">${def.vazio[estado.aba]}</p>`;
    estado.novo = null;
    estado.carimbo = null;
    const sel = chaveFoco(focarDepois);
    if (sel) listaEl.querySelector(sel)?.focus();
  }

  return {
    get aba() { return estado.aba; },
    marcarNovo(id) { estado.novo = id; estado.aba = 'abertas'; },
    marcarCarimbo(id) { estado.carimbo = id; },

    /** Trata clique nas abas; devolve true se o clique era numa aba. */
    cliqueAba(e, el, ctx) {
      const b = e.target.closest('[data-aba]');
      if (!b) return false;
      if (b.dataset.aba !== estado.aba) {
        estado.aba = b.dataset.aba;
        estado.entrada = true;
        desenhar(el, ctx);
      }
      return true;
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
      }
      estado.adiado = false;
      estado.entrada = true;
      desenhar(el, ctx);
      if (ctx.destaqueId) {
        const alvo = el.querySelector(`.card[data-id="${CSS.escape(ctx.destaqueId)}"]`);
        if (alvo) { alvo.classList.add('destaque'); alvo.scrollIntoView({ block: 'center' }); }
      }
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
