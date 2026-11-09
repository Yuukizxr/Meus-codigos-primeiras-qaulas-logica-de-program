// Painel RH — inicialização, navegação, faixa "Hoje" e relógio.
import { chaveDoDia, nomeDiaSemana, formatar } from './datas.js';
import { criarCalendario } from './calendario.js';
import { ordenarAlertas, NIVEL, NOME_NIVEL } from './alertas.js';
import { normalizar } from './dados.js';
import * as store from './store.js';
import { iniciarRelogio } from './relogio.js';
import { MODULOS } from './modulos/index.js';
import feriados from './telas/feriados.js';
import configuracoes from './telas/configuracoes.js';
import { esc, icone, dataCurta } from './util.js';

const TELAS = [...MODULOS, feriados, configuracoes];
const $ = (id) => document.getElementById(id);

/** Contexto único compartilhado com as telas (sempre o mesmo objeto, atualizado no lugar). */
const ctx = { dados: null, cfg: null, cal: null, agora: new Date(), destaqueId: null, salvar };
let telaAtual = TELAS[0];
let bloqueado = false; // arquivo de dados ilegível: não gravar nada para não sobrescrever
let erroAoSalvar = false;

function mostrarErro(msg) {
  const e = $('erro');
  e.textContent = msg;
  e.hidden = !msg;
}

/** Aplica configurações e feriados (chamado ao abrir e após qualquer alteração). */
function recalcular() {
  ctx.cfg = ctx.dados.config;
  ctx.cal = criarCalendario(ctx.cfg, ctx.dados.feriadosLocais);
  document.documentElement.dataset.tema = ctx.cfg.tema;
}

/** Grava os dados e redesenha o que depende deles. */
function salvar() {
  recalcular();
  desenharAlertas();
  telaAtual.atualizar?.($('tela'), ctx, 'salvo');
  if (bloqueado) return;
  store.salvar(ctx.dados, chaveDoDia(new Date())).then(
    () => { if (erroAoSalvar) { erroAoSalvar = false; mostrarErro(''); } },
    (e) => { erroAoSalvar = true; mostrarErro(`Erro ao salvar os dados: ${e}`); },
  );
}

/* ---------------- Faixa "Hoje" ---------------- */

function itemAlerta(a) {
  const nivel = NOME_NIVEL[a.nivel];
  const ic = a.nivel === NIVEL.laranja ? icone('relogio') : a.nivel === NIVEL.vermelho ? icone('alerta') : '';
  const original = a.dataOriginal ? ` <span class="pequeno">(prazo ${esc(dataCurta(a.dataOriginal))}; data segura)</span>` : '';
  return `
    <li class="nivel-${nivel}" tabindex="0" data-alvo-tela="${esc(a.alvo.tela)}" data-alvo-id="${esc(a.alvo.id)}">
      <span class="chip nivel-${nivel}">${ic}${esc(a.texto)}</span>
      <strong>${esc(a.titulo)}</strong>
      <span>${esc(a.acao)} até ${esc(dataCurta(a.data))}${original}</span>
    </li>`;
}

function desenharAlertas() {
  const todos = ordenarAlertas(MODULOS.flatMap((m) => m.alertas(ctx)));
  const vermelhos = todos.filter((a) => a.nivel === NIVEL.vermelho);
  const outros = todos.filter((a) => a.nivel < NIVEL.vermelho);

  // Vermelho: fixo no topo, sem botão de dispensar. Só some quando o status avança.
  const fv = $('faixa-vermelha');
  fv.hidden = vermelhos.length === 0;
  fv.innerHTML = vermelhos.length
    ? `<h2>${icone('alerta')} Prazo vencido — exige ação (${vermelhos.length})</h2><ul class="alertas">${vermelhos.map(itemAlerta).join('')}</ul>`
    : '';

  const hoje = chaveDoDia(ctx.agora);
  const hora = `${String(ctx.agora.getHours()).padStart(2, '0')}:${String(ctx.agora.getMinutes()).padStart(2, '0')}`;
  $('faixa-hoje').innerHTML = `
    <h2>Hoje <span class="suave pequeno">${esc(nomeDiaSemana(hoje, true))}, ${formatar(hoje)} · ${hora}</span></h2>
    ${outros.length
      ? `<ul class="alertas">${outros.map(itemAlerta).join('')}</ul>`
      : `<p class="vazio">${vermelhos.length ? 'Nada além dos vencidos acima.' : 'Nada exige ação agora.'}</p>`}`;
}

function aoClicarAlerta(e) {
  if (e.type === 'keydown' && e.key !== 'Enter') return;
  const li = e.target.closest('li[data-alvo-tela]');
  if (li) irPara(li.dataset.alvoTela, li.dataset.alvoId);
}

/* ---------------- Navegação ---------------- */

function montarMenu() {
  const menu = $('menu');
  menu.innerHTML = TELAS.map((t) => `<button type="button" data-tela="${t.id}">${icone(t.icone)} ${esc(t.titulo)}</button>`).join('');
  menu.onclick = (e) => {
    const b = e.target.closest('[data-tela]');
    if (b) irPara(b.dataset.tela);
  };
}

function irPara(id, destaqueId = null) {
  telaAtual = TELAS.find((t) => t.id === id) || TELAS[0];
  ctx.destaqueId = destaqueId;
  for (const b of $('menu').querySelectorAll('[data-tela]')) {
    if (b.dataset.tela === telaAtual.id) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  }
  if (!destaqueId) $('conteudo').scrollTop = 0;
  telaAtual.renderizar($('tela'), ctx);
}

/* ---------------- Início ---------------- */

async function iniciar() {
  const hoje = chaveDoDia(new Date());
  try {
    ctx.dados = normalizar(await store.carregar(hoje));
  } catch (e) {
    bloqueado = true;
    ctx.dados = normalizar(null);
    const pasta = await store.pastaDados().catch(() => '');
    mostrarErro(`O arquivo de dados não pôde ser lido (${e}).
Para não perder nada, o painel NÃO vai salvar alterações enquanto isso não for resolvido.
Restaure um backup da pasta ${pasta}\\backups (copie o mais recente por cima de dados.json) e abra o painel de novo.`);
  }
  recalcular();
  montarMenu();
  $('faixa-vermelha').onclick = $('faixa-hoje').onclick = aoClicarAlerta;
  $('faixa-vermelha').onkeydown = $('faixa-hoje').onkeydown = aoClicarAlerta;
  irPara(TELAS[0].id);
  desenharAlertas();

  // Um único timer: recalcula a cada minuto, na virada do dia e ao voltar da suspensão.
  iniciarRelogio(({ agora, viradaDia, motivo }) => {
    ctx.agora = agora;
    if (motivo === 'abertura') return; // já desenhado acima
    if (viradaDia && !bloqueado) {
      store.backupDiario(chaveDoDia(agora)).catch((e) => mostrarErro(`Erro no backup diário: ${e}`));
    }
    desenharAlertas();
    telaAtual.atualizar?.($('tela'), ctx, 'relogio');
  });
}

window.addEventListener('error', (e) => mostrarErro(`Erro inesperado: ${e.message}`));
window.addEventListener('unhandledrejection', (e) => mostrarErro(`Erro inesperado: ${e.reason}`));

iniciar();
