// Importação de dados que já existem (ex.: férias programadas numa planilha).
// Aceita: linhas copiadas do Excel (separadas por TAB), ou CSV com ";" ou ",".
// Datas: 01/12/2026, 1/12/26, 01-12-2026, 01.12.2026 ou 2026-12-01.
// A parte de leitura é pura (testável); a tela de prévia está em painelImportacao().
import { ehDataValida, montar } from './datas.js';
import { esc, icone } from './util.js';

/** Sem acento, minúsculo, sem espaços extras. */
export const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Traduz um status escrito livremente ("aviso entregue", "PAGO"...) usando o mapa do módulo. */
export function lerStatus(v, mapa) {
  const t = normalizar(v);
  if (!t) return { status: undefined };
  for (const [status, nomes] of Object.entries(mapa)) if (nomes.some((n) => t === normalizar(n))) return { status };
  return { erro: `Status desconhecido: "${v}"` };
}

/** Lê um número inteiro opcional dentro de limites. */
export function lerInteiro(v, min, max) {
  const t = String(v ?? '').trim();
  if (!t) return { valor: undefined };
  const n = Number(t);
  return Number.isInteger(n) && n >= min && n <= max ? { valor: n } : { erro: `Número inválido: "${v}" (use de ${min} a ${max})` };
}

/** Divide o texto em linhas e colunas, detectando o separador. */
export function lerTabela(texto) {
  const linhas = String(texto || '').split(/\r?\n/).filter((l) => l.trim() !== '');
  if (!linhas.length) return [];
  const amostra = linhas.slice(0, 5).join('\n');
  const sep = amostra.includes('\t') ? '\t' : amostra.includes(';') ? ';' : ',';
  return linhas.map((l) => l.split(sep).map((c) => c.trim().replace(/^"(.*)"$/, '$1').trim()));
}

/** Lê uma data em vários formatos; devolve "AAAA-MM-DD" ou null. */
export function lerData(v) {
  const t = String(v || '').trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) { const d = montar(+m[1], +m[2], +m[3]); return ehDataValida(d) ? d : null; }
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(t);
  if (!m) return null;
  const ano = m[3].length === 2 ? 2000 + +m[3] : +m[3];
  const d = montar(ano, +m[2], +m[1]);
  return ehDataValida(d) ? d : null;
}

/**
 * Converte o texto em registros, usando a definição do módulo.
 * @param {string} texto
 * @param {{ colunas: Array<{campo:string, nomes:string[], obrigatorio?:boolean}>, converter:(v:object)=>({registro}|{erro}), chave:(r)=>string }} def
 * @param {Set<string>} existentes  chaves dos registros que já estão no painel (para não duplicar)
 */
export function interpretar(texto, def, existentes = new Set()) {
  const tabela = lerTabela(texto);
  if (!tabela.length) return { linhas: [], cabecalho: false };
  // Cabeçalho: a primeira linha tem algum nome de coluna conhecido e nenhuma data.
  const primeira = tabela[0].map(normalizar);
  const conhecidos = new Set(def.colunas.flatMap((c) => c.nomes.map(normalizar)));
  const temCabecalho = primeira.some((c) => conhecidos.has(c)) && !tabela[0].some((c) => lerData(c));
  const posicao = {};
  if (temCabecalho) {
    def.colunas.forEach((c) => {
      const i = primeira.findIndex((h) => c.nomes.map(normalizar).includes(h));
      if (i >= 0) posicao[c.campo] = i;
    });
  } else {
    def.colunas.forEach((c, i) => { posicao[c.campo] = i; });
  }
  const vistos = new Set();
  const linhas = (temCabecalho ? tabela.slice(1) : tabela).map((cels, n) => {
    const valores = {};
    for (const c of def.colunas) valores[c.campo] = posicao[c.campo] !== undefined ? (cels[posicao[c.campo]] ?? '') : '';
    const faltando = def.colunas.filter((c) => c.obrigatorio && !valores[c.campo]).map((c) => c.titulo || c.campo);
    if (faltando.length) return { n: n + 1, valores, erro: `Falta: ${faltando.join(', ')}` };
    const r = def.converter(valores);
    if (r.erro) return { n: n + 1, valores, erro: r.erro };
    const chave = def.chave(r.registro);
    if (existentes.has(chave)) return { n: n + 1, valores, registro: r.registro, repetido: 'Já está no painel' };
    if (vistos.has(chave)) return { n: n + 1, valores, registro: r.registro, repetido: 'Repetido na lista' };
    vistos.add(chave);
    return { n: n + 1, valores, registro: r.registro };
  });
  return { linhas, cabecalho: temCabecalho };
}

/* ---------------- Tela de prévia (navegador) ---------------- */

/**
 * Abre o painel de importação dentro de `alvo`.
 * @param {HTMLElement} alvo
 * @param {object} def  definição do módulo (colunas, converter, chave, exemplo, resumo, titulo)
 * @param {object} ctx
 * @param {(registros:object[])=>void} importar
 */
export function painelImportacao(alvo, def, ctx, importar) {
  alvo.innerHTML = `
    <section class="importar painel">
      <div class="importar-topo">
        <div>
          <p class="sobretitulo">Importar</p>
          <h2>${esc(def.titulo)} que já existem</h2>
        </div>
        <button type="button" class="btn-icone" data-imp="fechar" title="Fechar">${icone('fechar')}</button>
      </div>
      <ol class="passos">
        <li>No Excel, selecione as linhas (pode incluir o cabeçalho) e copie (<kbd>Ctrl</kbd>+<kbd>C</kbd>).</li>
        <li>Clique na caixa abaixo e cole (<kbd>Ctrl</kbd>+<kbd>V</kbd>). Ou abra um arquivo <b>.csv</b>.</li>
        <li>Confira a prévia e clique em <b>Importar</b>.</li>
      </ol>
      <p class="suave pequeno">Colunas, nesta ordem (ou com estes nomes no cabeçalho): ${def.colunas.map((c) => `<b>${esc(c.titulo)}</b>${c.obrigatorio ? '' : ' (opcional)'}`).join(' · ')}</p>
      <textarea class="colar" rows="5" placeholder="${esc(def.exemplo)}"></textarea>
      <div class="importar-acoes">
        <label class="btn-link">${icone('pasta')} Abrir .csv<input type="file" accept=".csv,.txt,text/csv,text/plain" hidden></label>
        <span class="espaco"></span>
        <span class="importar-resumo suave"></span>
        <button type="button" class="btn" data-imp="confirmar" disabled>${icone('check')} Importar</button>
      </div>
      <div class="previa-importar"></div>
    </section>`;

  const area = alvo.querySelector('.colar');
  const previa = alvo.querySelector('.previa-importar');
  const botao = alvo.querySelector('[data-imp="confirmar"]');
  const resumo = alvo.querySelector('.importar-resumo');
  let resultado = { linhas: [] };

  function atualizar() {
    resultado = interpretar(area.value, def, new Set(def.existentes(ctx).map(def.chave)));
    const ok = resultado.linhas.filter((l) => l.registro && !l.repetido);
    const comErro = resultado.linhas.filter((l) => l.erro).length;
    const repetidos = resultado.linhas.filter((l) => l.repetido).length;
    botao.disabled = ok.length === 0;
    botao.innerHTML = `${icone('check')} Importar ${ok.length || ''}`;
    resumo.textContent = resultado.linhas.length
      ? `${ok.length} prontas${comErro ? ` · ${comErro} com erro` : ''}${repetidos ? ` · ${repetidos} repetidas (serão ignoradas)` : ''}`
      : '';
    previa.innerHTML = resultado.linhas.length ? `
      <table class="tabela">
        <thead><tr><th>#</th>${def.colunas.map((c) => `<th>${esc(c.titulo)}</th>`).join('')}<th>Resultado</th></tr></thead>
        <tbody>${resultado.linhas.map((l) => `
          <tr class="${l.erro ? 'imp-erro' : l.repetido ? 'imp-repetido' : 'imp-ok'}">
            <td>${l.n}</td>${def.colunas.map((c) => `<td>${esc(l.valores[c.campo])}</td>`).join('')}
            <td>${l.erro ? `${icone('alerta')} ${esc(l.erro)}` : l.repetido ? esc(l.repetido) : `${icone('check')} ${def.resumoImportacao(l.registro, ctx)}`}</td>
          </tr>`).join('')}</tbody>
      </table>` : '';
  }

  area.addEventListener('input', atualizar);
  alvo.querySelector('input[type=file]').addEventListener('change', async (e) => {
    const arq = e.target.files && e.target.files[0];
    if (!arq) return;
    area.value = await arq.text();
    atualizar();
  });
  alvo.querySelector('[data-imp="fechar"]').addEventListener('click', () => { alvo.innerHTML = ''; });
  botao.addEventListener('click', () => {
    const registros = resultado.linhas.filter((l) => l.registro && !l.repetido).map((l) => l.registro);
    if (!registros.length) return;
    alvo.innerHTML = '';
    importar(registros);
  });
  area.focus();
}

