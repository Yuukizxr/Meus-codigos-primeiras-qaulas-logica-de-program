// Módulo Rescisões: tela, cadastro rápido, cards e alertas.
import { chaveDoDia, ehDataValida } from '../../datas.js';
import { NIVEL, NOME_NIVEL } from '../../alertas.js';
import { novoId } from '../../dados.js';
import { esc, icone, confirmarDoisCliques } from '../../util.js';
import { selo, etapas, campoData, blocoPrazo, acoes, abas, cabecalho, maisUrgente, animarSaida, diaMes } from '../../componentes.js';
import { criarLista } from '../lista.js';
import {
  TIPOS, STATUS, NOME_STATUS, CAMPOS_EDITAVEIS,
  calcularRescisao, avaliarRescisao, novaRescisao, proximoStatus, statusAnterior,
} from './regras.js';

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
      lista.push({ nivel: p.nivel, faltam: p.faltam, titulo: r.nome, acao: p.acao, data: p.efetivo, texto: p.texto, alvo: { tela: 'rescisoes', id: r.id } });
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

const lista = criarLista({
  itens: (ctx) => ctx.dados.rescisoes.map((r) => analisar(r, ctx)),
  concluido: (x) => x.r.status === 'paga',
  ordenarAbertas: (a, b) =>
    (a.r.status === 'pendente' ? 0 : 1) - (b.r.status === 'pendente' ? 0 : 1)
    || b.aval.nivel - a.aval.nivel
    || (menorPrazo(a) < menorPrazo(b) ? -1 : menorPrazo(a) > menorPrazo(b) ? 1 : 0),
  ordenarConcluidas: (a, b) => (a.calc.desligamento < b.calc.desligamento ? 1 : -1),
  card,
  rotuloConcluidas: 'Pagas',
  vazio: { abertas: 'Nenhuma rescisão em aberto. Cadastre acima — nome, data da carta e Enter.', concluidas: 'Nenhuma rescisão paga ainda.' },
});

function renderizar(el, ctx) {
  const hoje = chaveDoDia(ctx.agora);
  el.innerHTML = `
    ${cabecalho('Desligamentos', 'Rescisões')}
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
      <button class="btn" type="submit">${icone('mais')} Cadastrar <kbd>Enter</kbd></button>
    </form>
    ${abas(0, 0, lista.aba, 'Pagas')}
    <div id="lista" class="lista"></div>`;

  const form = el.querySelector('#form-rescisao');
  form.onkeydown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); form.requestSubmit(); }
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    const nome = form.nome.value.trim();
    const dataCarta = form.dataCarta.value;
    if (!nome) { form.nome.focus(); return; }
    if (!ehDataValida(dataCarta)) { form.dataCarta.focus(); return; }
    const id = novoId();
    ctx.dados.rescisoes.push(novaRescisao({ nome, dataCarta, tipo: form.tipo.value }, id));
    lista.marcarNovo(id);
    form.nome.value = '';
    form.dataCarta.value = chaveDoDia(ctx.agora);
    ctx.salvar();
    form.nome.focus();
  };

  el.onclick = (e) => {
    if (lista.cliqueAba(e, el, ctx)) return;
    const btn = e.target.closest('button[data-acao]');
    const cardEl = e.target.closest('.card');
    if (!btn || !cardEl) return;
    const r = ctx.dados.rescisoes.find((x) => x.id === cardEl.dataset.id);
    if (!r) return;
    const acao = btn.dataset.acao;
    if (acao === 'avancar') {
      const prox = proximoStatus(r.status);
      if (!prox) return;
      if (prox === 'paga') { animarSaida(cardEl, () => { r.status = prox; ctx.salvar(); }); return; }
      r.status = prox;
      lista.marcarCarimbo(r.id);
    } else if (acao === 'voltar') {
      const ant = statusAnterior(r.status);
      if (!ant) return;
      if (r.status === 'paga') { animarSaida(cardEl, () => { r.status = ant; ctx.salvar(); }); return; }
      r.status = ant;
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
  // Configurações deste módulo (aparecem em Configurações > Rescisões).
  opcoes: {
    titulo: 'Rescisões',
    campos: [
      { campo: 'avisoDias', rotulo: 'Duração do aviso trabalhado', unidade: 'dias',
        dica: 'Quantos dias corridos o aviso trabalhado dura. O fim do aviso é a data de início mais esse número. Ex.: carta em 01/03 com 30 dias → fim do aviso em 31/03.' },
      { campo: 'linxAjusteDias', rotulo: 'Prazo para lançar no Linx', unidade: 'dias após o fim',
        dica: 'Quantos dias depois do fim do aviso (ou do desligamento, no indenizado) vence o lançamento da rescisão no Linx. 0 = no próprio dia. Use número negativo para antecipar: -2 = dois dias antes.' },
      { campo: 'pagamentoDias', rotulo: 'Prazo de pagamento', unidade: 'dias após o fim',
        dica: 'Dias corridos depois do fim do aviso (ou do desligamento, no indenizado) para pagar a rescisão. Se cair em fim de semana ou feriado, o card mostra também o dia útil anterior (escudo).' },
    ],
  },
};
