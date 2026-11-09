// Painel RH — inicialização, navegação, folhinha, faixa "Hoje" e relógio.
import { chaveDoDia, nomeDiaSemana } from './datas.js';
import { criarCalendario } from './calendario.js';
import { ordenarAlertas, NIVEL, NOME_NIVEL } from './alertas.js';
import { normalizar } from './dados.js';
import * as store from './store.js';
import { iniciarRelogio } from './relogio.js';
import { MODULOS } from './modulos/index.js';
import feriados from './telas/feriados.js';
import configuracoes from './telas/configuracoes.js';
import { esc, icone } from './util.js';
import { diaMes } from './componentes.js';

const TELAS = [...MODULOS, feriados, configuracoes];
const MESES_CURTOS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const $ = (id) => document.getElementById(id);

/** Contexto único compartilhado com as telas (sempre o mesmo objeto, atualizado no lugar). */
const ctx = {
  dados: null, cfg: null, cal: null, agora: new Date(), destaqueId: null,
  salvar, irPara, conectarPasta, modulos: MODULOS,
};
let telaAtual = TELAS[0];
let bloqueado = false; // arquivo de dados ilegível: não gravar nada para não sobrescrever
let erroAoSalvar = false;
let vermelhosAntes = null;

function mostrarErro(msg) {
  const e = $('erro');
  e.textContent = msg;
  e.hidden = !msg;
}

/** Repete uma animação CSS de classe única (tremer, virar...). */
function animarUmaVez(el, classe) {
  if (!el) return;
  el.classList.remove(classe);
  void el.offsetWidth; // reinicia a animação
  el.classList.add(classe);
  el.addEventListener('animationend', () => el.classList.remove(classe), { once: true });
}

/** Aplica configurações e feriados (ao abrir e após qualquer alteração). */
function recalcular() {
  ctx.cfg = ctx.dados.config;
  ctx.cal = criarCalendario(ctx.cfg, ctx.dados.feriadosLocais);
  const raiz = document.documentElement;
  raiz.dataset.tema = ctx.cfg.tema;
  raiz.dataset.animacoes = ctx.cfg.animacoes ? 'on' : 'off';
  document.title = ctx.cfg.nomeApp;
  $('nome-app').textContent = ctx.cfg.nomeApp;
}

/** Grava os dados e redesenha o que depende deles. */
function salvar() {
  recalcular();
  desenharAlertas();
  $('tela').classList.remove('entrando');
  telaAtual.atualizar?.($('tela'), ctx, 'salvo');
  if (bloqueado) return;
  store.salvar(ctx.dados, chaveDoDia(new Date())).then(
    () => { if (erroAoSalvar) { erroAoSalvar = false; mostrarErro(''); } },
    (e) => { erroAoSalvar = true; mostrarErro(`Erro ao salvar os dados: ${e}`); },
  );
}

/* ---------------- Pasta de dados (versão HTML) ---------------- */

/** Indicador discreto na barra lateral (substitui a faixa do topo). */
function desenharAvisoPasta() {
  const el = $('status-pasta');
  const estado = store.estadoPasta();
  const nome = esc(store.nomePasta() || '');
  const conteudo = {
    conectada: `<span class="sp-linha" title="Os dados e os backups diários estão sendo gravados nesta pasta">${icone('pasta')}<span>Salvando em <b>${nome}</b></span><span class="ponto ok"></span></span>`,
    'nao-escolhida': `<button type="button" data-acao="conectar" title="Por enquanto os dados ficam só dentro do navegador">${icone('pasta')}<span>Escolher pasta de dados</span></button><span class="sp-nota">Dados só no navegador</span>`,
    'precisa-permissao': `<button type="button" class="atencao" data-acao="conectar" title="O navegador pede um clique para liberar a pasta">${icone('pasta')}<span>Autorizar pasta <b>${nome}</b></span><span class="ponto"></span></button>`,
    'sem-suporte': `<span class="sp-linha">${icone('pasta')}<span>Dados só no navegador</span></span>`,
  }[estado];
  el.hidden = !conteudo;
  el.innerHTML = conteudo || '';
}

async function conectarPasta(trocar = false) {
  try {
    if (!(await store.conectarPasta(trocar))) { desenharAvisoPasta(); return; }
    const dados = await store.carregar(chaveDoDia(new Date())); // usa o mais recente: navegador ou pasta
    if (dados) ctx.dados = normalizar(dados);
    bloqueado = false;
    mostrarErro('');
    salvar(); // sincroniza: grava na pasta o que está valendo
    desenharAvisoPasta();
    irPara(telaAtual.id);
  } catch (e) {
    if (e && e.name === 'AbortError') return; // fechou o seletor sem escolher
    bloqueado = e instanceof SyntaxError;
    mostrarErro(bloqueado
      ? `O dados.json da pasta escolhida está ilegível (${e.message}). Nada será gravado até você restaurar um backup da subpasta "backups".`
      : `Não foi possível usar a pasta: ${e.message || e}`);
  }
}

/* ---------------- Folhinha e faixa "Hoje" ---------------- */

function desenharFolhinha() {
  const hoje = chaveDoDia(ctx.agora);
  const f = $('folhinha');
  f.innerHTML = `
    <span class="mes">${MESES_CURTOS[+hoje.slice(5, 7) - 1]} ${hoje.slice(0, 4)}</span>
    <span class="dia">${hoje.slice(8, 10)}</span>
    <span class="semana">${esc(nomeDiaSemana(hoje, true))}</span>`;
}

function seloCurto(a) {
  const f = a.faltam;
  return f > 0 ? `D-${f}` : f === 0 ? 'HOJE' : `+${-f}`;
}

function itemAlerta(a) {
  const nivel = NOME_NIVEL[a.nivel];
  return `
    <li class="nivel-${nivel}" tabindex="0" data-alvo-tela="${esc(a.alvo.tela)}" data-alvo-id="${esc(a.alvo.id)}">
      <span class="mini-selo">${seloCurto(a)}</span>
      <span class="quem"><strong>${esc(a.titulo)}</strong><span>${esc(a.acao)} · ${esc(a.quando || 'até')} ${esc(diaMes(a.data))}</span></span>
      <span class="chip nivel-${nivel}">${a.nivel === NIVEL.laranja ? icone('relogio') : ''}${esc(a.texto)}</span>
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
    ? `<h2>${icone('alerta')} Prazos vencidos <span class="contagem">${vermelhos.length}</span></h2><ul class="alertas">${vermelhos.map(itemAlerta).join('')}</ul>`
    : '';
  if (vermelhosAntes !== null && vermelhos.length > vermelhosAntes) animarUmaVez(fv, 'tremer');
  vermelhosAntes = vermelhos.length;

  const hora = `${String(ctx.agora.getHours()).padStart(2, '0')}:${String(ctx.agora.getMinutes()).padStart(2, '0')}`;
  $('faixa-hoje').innerHTML = `
    <h2>Hoje <span class="hora">${hora}</span></h2>
    ${outros.length
      ? `<ul class="alertas">${outros.map(itemAlerta).join('')}</ul>`
      : `<p class="vazio">${icone('check')} ${vermelhos.length ? 'Nada além dos vencidos acima.' : 'Tudo em dia. Nada exige ação agora.'}</p>`}`;
}

function aoClicarAlerta(e) {
  if (e.type === 'keydown' && e.key !== 'Enter') return;
  const li = e.target.closest('li[data-alvo-tela]');
  if (li) irPara(li.dataset.alvoTela, li.dataset.alvoId);
}

/* ---------------- Navegação ---------------- */

function montarMenu() {
  const menu = $('menu');
  menu.innerHTML = TELAS.map((t) => `<button type="button" data-tela="${t.id}">${icone(t.icone)}<span>${esc(t.titulo)}</span></button>`).join('');
  menu.onclick = (e) => {
    const b = e.target.closest('[data-tela]');
    if (b) irPara(b.dataset.tela);
  };
}

function irPara(id, destaqueId = null) {
  telaAtual = TELAS.find((t) => t.id === id) || TELAS[0];
  ctx.destaqueId = destaqueId;
  if (destaqueId) telaAtual.prepararAbertura?.(destaqueId, ctx); // abre na visão Cards, sem filtros
  for (const b of $('menu').querySelectorAll('[data-tela]')) {
    if (b.dataset.tela === telaAtual.id) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  }
  if (!destaqueId) $('conteudo').scrollTop = 0;
  const tela = $('tela');
  tela.classList.remove('entrando');
  void tela.offsetWidth;
  tela.classList.add('entrando');
  telaAtual.renderizar(tela, ctx);
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
Restaure o backup mais recente da subpasta "backups" (${pasta}) copiando-o por cima de dados.json, e abra o painel de novo.`);
  }
  recalcular();
  montarMenu();
  desenharFolhinha();
  desenharAvisoPasta();
  $('status-pasta').onclick = (e) => { if (e.target.closest('[data-acao="conectar"]')) conectarPasta(false); };
  $('faixa-vermelha').onclick = $('faixa-hoje').onclick = aoClicarAlerta;
  $('faixa-vermelha').onkeydown = $('faixa-hoje').onkeydown = aoClicarAlerta;
  irPara(TELAS[0].id);
  desenharAlertas();

  // Um único timer: recalcula a cada minuto, na virada do dia e ao voltar da suspensão.
  iniciarRelogio(({ agora, viradaDia, motivo }) => {
    ctx.agora = agora;
    if (motivo === 'abertura') return; // já desenhado acima
    if (viradaDia) {
      desenharFolhinha();
      animarUmaVez($('folhinha'), 'virar');
      if (!bloqueado) store.backupDiario(chaveDoDia(agora)).catch((e) => mostrarErro(`Erro no backup diário: ${e}`));
    }
    desenharAlertas();
    telaAtual.atualizar?.($('tela'), ctx, 'relogio');
  });
}

window.addEventListener('error', (e) => mostrarErro(`Erro inesperado: ${e.message}`));
window.addEventListener('unhandledrejection', (e) => mostrarErro(`Erro inesperado: ${e.reason}`));

iniciar();
