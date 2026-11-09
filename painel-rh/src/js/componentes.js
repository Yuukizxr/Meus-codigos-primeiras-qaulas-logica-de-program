// Peças de interface compartilhadas pelos módulos (rescisões, férias e os próximos).
import { NIVEL, NOME_NIVEL } from './alertas.js';
import { esc, icone, dataCurta } from './util.js';
import { nomeDiaSemana, ehDataValida, formatar } from './datas.js';

/** "sex 27/11" (sem o ano), para textos curtos. */
export function diaMes(s) {
  return ehDataValida(s) ? `${nomeDiaSemana(s)} ${formatar(s).slice(0, 5)}` : '—';
}

/**
 * Selo grande com a contagem do prazo: "D-3", "HOJE", "+5" (dias de atraso).
 * Sem avaliação (nada pendente), mostra um ✓ discreto.
 */
export function selo(avaliacao) {
  if (!avaliacao) return `<div class="selo selo-ok" aria-hidden="true">${icone('check')}</div>`;
  const nivel = NOME_NIVEL[avaliacao.nivel];
  const f = avaliacao.faltam;
  const [numero, legenda] = f > 0 ? [`D-${f}`, f === 1 ? 'amanhã' : 'dias'] : f === 0 ? ['HOJE', avaliacao.nivel === NIVEL.vermelho ? 'venceu' : 'até o limite'] : [`+${-f}`, -f === 1 ? 'dia de atraso' : 'dias de atraso'];
  return `<div class="selo nivel-${nivel}" title="${esc(avaliacao.texto)}"><span class="selo-num">${numero}</span><span class="selo-leg">${legenda}</span></div>`;
}

/** Trilha de etapas do status (ex.: Pendente → Solicitada → Paga). */
export function etapas(lista, nomes, atual, carimbar) {
  const i = lista.indexOf(atual);
  return `<ol class="etapas" aria-label="Status: ${esc(nomes[atual])}">${lista.map((s, k) => `
    <li class="${k < i ? 'feita' : k === i ? 'atual' : ''}${k === i && carimbar ? ' carimbo' : ''}">
      <span class="marca">${k < i ? icone('check') : ''}</span><span class="rotulo">${esc(nomes[s])}</span>
    </li>`).join('')}</ol>`;
}

/** Campo de data editável que sobrescreve o calculado (com "↺" para voltar ao calculado). */
export function campoData(rotulo, campo, calc) {
  const editado = calc.manual[campo];
  return `
    <div class="campo">
      <span class="rotulo-campo">${esc(rotulo)}${editado ? ' <span class="editado">editado</span>' : ''}</span>
      <span class="linha">
        <input type="date" data-manual="${campo}" value="${esc(calc[campo])}">
        <span class="dia">${esc(nomeDiaSemana(calc[campo]))}</span>
        ${editado ? botaoRestaurar(campo, calc) : ''}
      </span>
    </div>`;
}

function botaoRestaurar(campo, calc) {
  return `<button type="button" class="btn-icone" data-acao="restaurar" data-campo="${campo}" title="Voltar ao calculado (${esc(dataCurta(calc.calculado[campo]))})">${icone('desfazer')}</button>`;
}

/**
 * Bloco de um prazo: data editável, dia da semana, situação e "data segura" compacta.
 * @param {string} titulo
 * @param {string} campo        campo editável (ex.: 'prazoPagamento')
 * @param {object} calc         resultado do cálculo do módulo
 * @param {string|null} segura  dia útil anterior quando o prazo cai em dia não útil
 * @param {string|null} motivo  por que o prazo não é dia útil (sábado, feriado...)
 * @param {object|undefined} av avaliação do alerta (ausente quando o status já não exige ação)
 */
export function blocoPrazo(titulo, campo, calc, segura, motivo, av) {
  const editado = calc.manual[campo];
  const nivel = av ? NOME_NIVEL[av.nivel] : 'normal';
  return `
    <div class="prazo nivel-${nivel}${av ? '' : ' resolvido'}">
      <div class="prazo-topo">
        <span class="rotulo-campo">${esc(titulo)}${editado ? ' <span class="editado">editado</span>' : ''}</span>
        ${av ? `<span class="chip nivel-${nivel}">${av.nivel >= NIVEL.laranja ? icone(av.nivel === NIVEL.laranja ? 'relogio' : 'alerta') : ''}${esc(av.texto)}</span>` : `<span class="chip chip-ok">${icone('check')} resolvido</span>`}
      </div>
      <div class="linha">
        <input type="date" data-manual="${campo}" value="${esc(calc[campo])}">
        <span class="dia">${esc(nomeDiaSemana(calc[campo]))}</span>
        ${editado ? botaoRestaurar(campo, calc) : ''}
        ${segura ? `<span class="segura" title="O prazo cai em ${esc(motivo)}: faça até o dia útil anterior">${icone('escudo')} até ${esc(diaMes(segura))}</span>` : ''}
      </div>
    </div>`;
}

/** Barra de ações do card: avançar (grande), voltar e excluir. */
export function acoes(prox, ant, nomes, rotuloAvancar) {
  return `
    <div class="card-acoes">
      ${prox ? `<button type="button" class="btn btn-grande" data-acao="avancar">${icone(prox === 'paga' || prox === 'pago' ? 'check' : 'seta')} ${esc(rotuloAvancar || `Marcar como ${nomes[prox]}`)}</button>` : ''}
      ${ant ? `<button type="button" class="btn-link" data-acao="voltar">${icone('desfazer')} Voltar para ${esc(nomes[ant])}</button>` : ''}
      <span class="espaco"></span>
      <button type="button" class="btn-link perigo" data-acao="excluir">${icone('lixo')} Excluir</button>
    </div>`;
}

/** Abas "Em aberto" / "Concluídas". */
export function abas(abertas, concluidas, atual, rotuloConcluidas) {
  return `
    <div class="abas" role="tablist">
      <button type="button" role="tab" data-aba="abertas" aria-selected="${atual === 'abertas'}">Em aberto <span class="contagem">${abertas}</span></button>
      <button type="button" role="tab" data-aba="concluidas" aria-selected="${atual === 'concluidas'}">${esc(rotuloConcluidas)} <span class="contagem">${concluidas}</span></button>
    </div>`;
}

/** Cabeçalho de tela: sobretítulo pequeno + título grande. */
export function cabecalho(sobretitulo, titulo, extra = '') {
  return `<header class="cabecalho"><p class="sobretitulo">${esc(sobretitulo)}</p><h1>${esc(titulo)}</h1>${extra}</header>`;
}

/** Avaliação mais urgente de uma lista de prazos avaliados (ou undefined). */
export function maisUrgente(prazos) {
  return prazos.reduce((m, p) => (!m || p.nivel > m.nivel || (p.nivel === m.nivel && p.faltam < m.faltam) ? p : m), undefined);
}

/**
 * Animação de saída de um elemento, depois executa `feito`.
 * Se as animações estiverem desligadas, executa na hora.
 */
export function animarSaida(el, feito) {
  let pronto = false;
  const uma = () => { if (!pronto) { pronto = true; feito(); } };
  el.classList.add('saindo');
  const nome = getComputedStyle(el).animationName;
  if (!nome || nome === 'none' || !nome.includes('sair')) { uma(); return; }
  el.addEventListener('animationend', (e) => { if (e.animationName === 'sair') uma(); });
  setTimeout(uma, 600); // garantia: mesmo que o navegador não avise o fim da animação
}
