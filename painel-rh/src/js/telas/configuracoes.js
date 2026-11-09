// Configurações: todas as regras ficam aqui (nada fixo no código).
// Cada módulo declara as suas em `opcoes` (veja modulos/rescisoes/index.js);
// esta tela só desenha. A validação vem do ESQUEMA em dados.js.
import { ESQUEMA, TEMAS, valorValido } from '../dados.js';
import { esc, icone } from '../util.js';
import { cabecalho } from '../componentes.js';
import * as store from '../store.js';

const GERAL = {
  titulo: 'Geral',
  campos: [
    { campo: 'nomeApp', rotulo: 'Nome do painel',
      dica: 'Aparece no alto da barra lateral e no título da janela. Ex.: "RH Loja Centro".' },
    { campo: 'tema', rotulo: 'Tema',
      dica: 'Claro e Escuro são os mais leves. Aurora e Eclipse usam degradês fixos (não se mexem), que também não pesam no computador.' },
    { campo: 'animacoes', rotulo: 'Animações',
      dica: 'Movimentos curtos ao abrir telas, cadastrar, mudar status e quando surge um prazo vencido. Nada fica se mexendo parado. Desligue se o computador estiver lento: o painel funciona igual.' },
  ],
};

const ALERTAS = {
  titulo: 'Alertas e calendário',
  campos: [
    { campo: 'alertaAmareloDias', rotulo: 'Aviso antecipado (amarelo)', unidade: 'dias antes',
      dica: 'Com quantos dias de antecedência um prazo aparece em amarelo na faixa "Hoje". Ex.: 3 = começa a avisar 3 dias antes.' },
    { campo: 'horarioLimite', rotulo: 'Horário limite no dia do prazo',
      dica: 'No dia do prazo, até que horas a solicitação precisa sair. Até esse horário o prazo fica laranja, com contagem regressiva; depois, vermelho.' },
    { campo: 'sabadoUtil', rotulo: 'Sábado é dia útil',
      dica: 'Marque se a empresa trabalha aos sábados. Muda o "dia útil anterior" que o painel indica quando um prazo cai em fim de semana ou feriado.' },
  ],
};

/** Botão "?" com o balão de explicação (aparece ao passar o mouse ou focar com Tab). */
function ajuda(texto) {
  return `<span class="ajuda"><button type="button" class="ajuda-btn" aria-label="O que é isto?">?</button><span class="ajuda-balao" role="tooltip">${esc(texto)}</span></span>`;
}

function controle(def, c) {
  const e = ESQUEMA[def.campo];
  const v = c[def.campo];
  if (def.campo === 'tema') {
    return `<div class="temas">${Object.entries(TEMAS).map(([id, nome]) => `
      <label class="tema-opcao"><input type="radio" name="tema" data-cfg="tema" value="${id}" ${v === id ? 'checked' : ''}>
        <span class="amostra amostra-${id}" aria-hidden="true"></span><span>${esc(nome)}</span></label>`).join('')}</div>`;
  }
  switch (e.tipo) {
    case 'booleano':
      return `<label class="chave"><input type="checkbox" data-cfg="${def.campo}" ${v ? 'checked' : ''}><span class="trilho" aria-hidden="true"></span><span class="chave-txt">${v ? 'Sim' : 'Não'}</span></label>`;
    case 'texto':
      return `<input type="text" data-cfg="${def.campo}" maxlength="${e.max}" value="${esc(v)}">`;
    case 'horario':
      return `<input type="time" data-cfg="${def.campo}" value="${esc(v)}">`;
    case 'inteiro':
      return `<input type="number" step="1" min="${e.min}" max="${e.max}" data-cfg="${def.campo}" value="${v}">${def.unidade ? `<span class="unidade">${esc(def.unidade)}</span>` : ''}`;
    default:
      return '';
  }
}

function secao(grupo, c) {
  return `
    <section class="painel">
      <h2>${esc(grupo.titulo)}</h2>
      ${grupo.campos.map((def) => `
      <div class="config-item">
        <span class="rotulo">${esc(def.rotulo)} ${ajuda(def.dica)}</span>
        <span class="controle">${controle(def, c)}<span class="msg-campo" data-msg="${def.campo}"></span></span>
      </div>`).join('')}
    </section>`;
}

function secaoDados() {
  const estado = store.estadoPasta();
  const botao = estado === 'app' || estado === 'sem-suporte' ? ''
    : `<button type="button" class="btn btn-pequeno" data-acao="pasta">${icone('pasta')} ${estado === 'nao-escolhida' ? 'Escolher pasta' : estado === 'precisa-permissao' ? 'Autorizar pasta' : 'Trocar pasta'}</button>`;
  return `
    <section class="painel">
      <h2>Dados</h2>
      <div class="config-item">
        <span class="rotulo">Onde ficam ${ajuda('Tudo fica só neste computador: um arquivo dados.json e a subpasta "backups", com uma cópia por dia (ficam as 14 mais recentes). Nada vai para a internet.')}</span>
        <span class="controle">${botao}</span>
      </div>
      <p class="caminho" id="pasta-dados">…</p>
    </section>`;
}

function desenhar(el, ctx) {
  const c = ctx.cfg;
  const grupos = [GERAL, ALERTAS, ...ctx.modulos.map((m) => m.opcoes).filter(Boolean)];
  el.innerHTML = `${cabecalho('Ajustes', 'Configurações')}${grupos.map((g) => secao(g, c)).join('')}${secaoDados()}`;

  store.pastaDados().then((p) => { const x = el.querySelector('#pasta-dados'); if (x) x.textContent = p; }).catch(() => {});

  el.onclick = (e) => {
    if (e.target.closest('[data-acao="pasta"]')) ctx.conectarPasta(store.estadoPasta() === 'conectada');
  };

  el.onchange = (e) => {
    const inp = e.target;
    const campo = inp.dataset.cfg;
    if (!campo || !ESQUEMA[campo]) return;
    const msg = el.querySelector(`[data-msg="${campo}"]`);
    if (msg) msg.textContent = '';
    const tipo = ESQUEMA[campo].tipo;
    const v = tipo === 'booleano' ? inp.checked : tipo === 'inteiro' ? Number(inp.value) : tipo === 'texto' ? inp.value.trim() : inp.value;
    if (!valorValido(campo, v)) {
      const lim = ESQUEMA[campo];
      if (msg) msg.textContent = tipo === 'inteiro' ? `Use um número inteiro de ${lim.min} a ${lim.max}` : tipo === 'texto' ? 'Não pode ficar vazio' : 'Valor inválido';
      if (tipo !== 'booleano') inp.value = c[campo];
      return;
    }
    c[campo] = v;
    if (tipo === 'booleano') { const t = inp.closest('.chave')?.querySelector('.chave-txt'); if (t) t.textContent = v ? 'Sim' : 'Não'; }
    ctx.salvar();
  };
}

export default {
  id: 'configuracoes',
  titulo: 'Configurações',
  icone: 'config',
  renderizar: desenhar,
  atualizar: () => {}, // não depende do relógio; os campos já mostram o valor salvo
};

