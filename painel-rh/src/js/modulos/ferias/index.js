// Módulo Férias (etapa 2): aviso, pagamento, alerta da CLT e prévia do mês seguinte.
import { chaveDoDia, ehDataValida } from '../../datas.js';
import { NIVEL, NOME_NIVEL } from '../../alertas.js';
import { novoId } from '../../dados.js';
import { esc, icone, confirmarDoisCliques } from '../../util.js';
import { selo, etapas, blocoPrazo, acoes, abas, cabecalho, maisUrgente, animarSaida, diaMes } from '../../componentes.js';
import { criarLista } from '../lista.js';
import {
  STATUS, NOME_STATUS, ROTULO_AVANCAR, CAMPOS_EDITAVEIS,
  calcularFerias, avaliarFerias, impedimentoInicio, previaProximoMes, novasFerias, proximoStatus, statusAnterior,
} from './regras.js';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function analisar(f, ctx) {
  const calc = calcularFerias(f, ctx.cfg, ctx.cal);
  const aval = avaliarFerias(f, calc, ctx.agora, ctx.cfg);
  return { f, calc, aval };
}

function alertas(ctx) {
  const lista = [];
  for (const f of ctx.dados.ferias) {
    const { aval } = analisar(f, ctx);
    for (const p of aval.prazos) {
      if (p.nivel < NIVEL.amarelo) continue;
      lista.push({ nivel: p.nivel, faltam: p.faltam, titulo: f.nome, acao: p.acao, data: p.efetivo, texto: p.texto, alvo: { tela: 'ferias', id: f.id } });
    }
  }
  return lista;
}

function textoImpedimento(imp) {
  return `Início ${imp.dias === 1 ? 'na véspera' : `a ${imp.dias} dias`} de ${imp.motivo} (${diaMes(imp.data)}). A CLT (art. 134 §3º) proíbe começar férias nesse período.`;
}

/* ---------------- Desenho ---------------- */

function card({ f, calc, aval }, marcas) {
  const urg = maisUrgente(aval.prazos);
  const av = Object.fromEntries(aval.prazos.map((p) => [p.chave, p]));
  return `
  <article class="card nivel-${NOME_NIVEL[aval.nivel]}${marcas.novo === f.id ? ' novo' : ''}" data-id="${esc(f.id)}">
    <div class="card-cabeca">
      ${selo(urg)}
      <div class="card-titulo">
        <input class="card-nome" type="text" data-campo="nome" value="${esc(f.nome)}" aria-label="Nome">
        <div class="card-sub">
          <label class="inline">início <input type="date" data-campo="inicio" value="${esc(f.inicio)}"></label>
          <label class="inline"><input type="number" class="num-curto" min="1" max="30" step="1" data-campo="dias" value="${calc.dias}"> dias</label>
        </div>
      </div>
      ${etapas(STATUS, NOME_STATUS, f.status, marcas.carimbo === f.id)}
    </div>
    <div class="grade">
      <div class="campo"><span class="rotulo-campo">Último dia</span><span class="valor">${esc(diaMes(calc.fim))}</span></div>
      <div class="campo"><span class="rotulo-campo">Retorno</span><span class="valor">${esc(diaMes(calc.retorno))}</span></div>
    </div>
    ${calc.impedimento ? `<p class="faixa-aviso">${icone('alerta')} ${esc(textoImpedimento(calc.impedimento))}</p>` : ''}
    <div class="prazos">
      ${blocoPrazo('Entregar aviso até', 'dataAviso', calc, calc.seguraAviso, calc.motivoAviso, av.aviso)}
      ${blocoPrazo('Pagamento até', 'dataPagamento', calc, calc.seguraPagamento, calc.motivoPagamento, av.pagamento)}
    </div>
    ${acoes(proximoStatus(f.status), statusAnterior(f.status), NOME_STATUS, ROTULO_AVANCAR[f.status])}
  </article>`;
}

function previa(ctx) {
  const p = previaProximoMes(ctx.dados.ferias.map((f) => ({ f, calc: calcularFerias(f, ctx.cfg, ctx.cal) })), ctx.agora, ctx.cfg);
  if (!p) return '';
  const linha = (x) => `<li class="${x.feito ? 'feito' : ''}" data-alvo-id="${esc(x.id)}"><span class="data">${esc(diaMes(x.data))}</span><span>${esc(x.nome)}</span>${x.feito ? icone('check') : ''}</li>`;
  const coluna = (titulo, itens) => `
    <div><h3>${titulo} <span class="contagem">${itens.length}</span></h3>
    ${itens.length ? `<ul>${itens.map(linha).join('')}</ul>` : '<p class="suave">Nada no mês.</p>'}</div>`;
  return `
    <section class="previa">
      <p class="sobretitulo">Última semana do mês</p>
      <h2>Prévia de ${MESES[p.mes - 1]}${p.ano !== +chaveDoDia(ctx.agora).slice(0, 4) ? ` de ${p.ano}` : ''}</h2>
      <div class="previa-colunas">${coluna('Avisos a entregar', p.avisos)}${coluna('Pagamentos', p.pagamentos)}</div>
    </section>`;
}

function menorPrazo(a) {
  return a.aval.prazos.reduce((m, p) => (p.efetivo < m ? p.efetivo : m), a.f.inicio);
}

const lista = criarLista({
  itens: (ctx) => ctx.dados.ferias.map((f) => analisar(f, ctx)),
  concluido: (x) => x.f.status === 'pago',
  ordenarAbertas: (a, b) => b.aval.nivel - a.aval.nivel || (menorPrazo(a) < menorPrazo(b) ? -1 : menorPrazo(a) > menorPrazo(b) ? 1 : 0),
  ordenarConcluidas: (a, b) => (a.f.inicio < b.f.inicio ? 1 : -1),
  card,
  rotuloConcluidas: 'Pagas',
  vazio: { abertas: 'Nenhuma férias programada. Cadastre acima — nome, início e Enter.', concluidas: 'Nenhuma férias paga ainda.' },
});

function renderizar(el, ctx) {
  el.innerHTML = `
    ${cabecalho('Programação', 'Férias')}
    <div id="previa">${previa(ctx)}</div>
    <form id="form-ferias" class="cadastro" autocomplete="off">
      <label class="campo nome">Nome
        <input type="text" name="nome" placeholder="Nome do funcionário" required>
      </label>
      <label class="campo">Início das férias
        <input type="date" name="inicio" required>
      </label>
      <label class="campo">Dias
        <input type="number" name="dias" class="num-curto" min="1" max="30" step="1" value="${ctx.cfg.feriasDiasPadrao}" required>
      </label>
      <button class="btn" type="submit">${icone('mais')} Cadastrar <kbd>Enter</kbd></button>
      <p class="faixa-aviso cadastro-aviso" id="aviso-inicio" hidden></p>
    </form>
    ${abas(0, 0, lista.aba, 'Pagas')}
    <div id="lista" class="lista"></div>`;

  const form = el.querySelector('#form-ferias');
  const avisoInicio = el.querySelector('#aviso-inicio');
  // Aviso imediato da CLT ao escolher a data (não impede o cadastro).
  form.inicio.oninput = () => {
    const imp = impedimentoInicio(form.inicio.value, ctx.cfg, ctx.cal);
    avisoInicio.hidden = !imp;
    avisoInicio.innerHTML = imp ? `${icone('alerta')} ${esc(textoImpedimento(imp))}` : '';
  };
  form.onkeydown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); form.requestSubmit(); }
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    const nome = form.nome.value.trim();
    const inicio = form.inicio.value;
    const dias = Number(form.dias.value);
    if (!nome) { form.nome.focus(); return; }
    if (!ehDataValida(inicio)) { form.inicio.focus(); return; }
    if (!Number.isInteger(dias) || dias < 1 || dias > 30) { form.dias.focus(); return; }
    const id = novoId();
    ctx.dados.ferias.push(novasFerias({ nome, inicio, dias }, id));
    lista.marcarNovo(id);
    form.nome.value = '';
    form.inicio.value = '';
    form.dias.value = ctx.cfg.feriasDiasPadrao;
    avisoInicio.hidden = true;
    ctx.salvar();
    form.nome.focus();
  };

  el.onclick = (e) => {
    if (lista.cliqueAba(e, el, ctx)) return;
    const item = e.target.closest('.previa li[data-alvo-id]');
    if (item) { ctx.irPara('ferias', item.dataset.alvoId); return; }
    const btn = e.target.closest('button[data-acao]');
    const cardEl = e.target.closest('.card');
    if (!btn || !cardEl) return;
    const f = ctx.dados.ferias.find((x) => x.id === cardEl.dataset.id);
    if (!f) return;
    const acao = btn.dataset.acao;
    if (acao === 'avancar' || acao === 'voltar') {
      const novo = acao === 'avancar' ? proximoStatus(f.status) : statusAnterior(f.status);
      if (!novo) return;
      if (novo === 'pago' || f.status === 'pago') { animarSaida(cardEl, () => { f.status = novo; ctx.salvar(); }); return; }
      f.status = novo;
      lista.marcarCarimbo(f.id);
    } else if (acao === 'restaurar') delete f.manual[btn.dataset.campo];
    else if (acao === 'excluir') {
      if (!confirmarDoisCliques(btn)) return;
      animarSaida(cardEl, () => { ctx.dados.ferias = ctx.dados.ferias.filter((x) => x !== f); ctx.salvar(); });
      return;
    } else return;
    ctx.salvar();
  };

  el.onchange = (e) => {
    const alvo = e.target;
    const cardEl = alvo.closest('.card');
    if (!cardEl) return;
    const f = ctx.dados.ferias.find((x) => x.id === cardEl.dataset.id);
    if (!f) return;
    const v = alvo.value;
    if (alvo.dataset.manual) {
      const campo = alvo.dataset.manual;
      if (!CAMPOS_EDITAVEIS.includes(campo)) return;
      if (ehDataValida(v)) f.manual[campo] = v; else delete f.manual[campo];
    } else if (alvo.dataset.campo === 'nome') {
      if (v.trim()) f.nome = v.trim(); else { alvo.value = f.nome; return; }
    } else if (alvo.dataset.campo === 'inicio') {
      if (ehDataValida(v)) f.inicio = v; else { alvo.value = f.inicio; return; }
    } else if (alvo.dataset.campo === 'dias') {
      const n = Number(v);
      if (Number.isInteger(n) && n >= 1 && n <= 30) f.dias = n; else { alvo.value = f.dias; return; }
    } else return;
    ctx.salvar();
  };

  lista.montar(el, ctx);
}

function atualizar(el, ctx) {
  const p = el.querySelector('#previa');
  if (p) p.innerHTML = previa(ctx);
  lista.atualizar(el, ctx);
}

export default {
  id: 'ferias',
  titulo: 'Férias',
  icone: 'sol',
  alertas,
  renderizar,
  atualizar,
  opcoes: {
    titulo: 'Férias',
    campos: [
      { campo: 'feriasDiasPadrao', rotulo: 'Dias de férias (padrão do cadastro)', unidade: 'dias',
        dica: 'Quantidade de dias que já vem preenchida ao cadastrar férias. Você pode mudar em cada funcionário (de 1 a 30).' },
      { campo: 'feriasAvisoDias', rotulo: 'Antecedência do aviso', unidade: 'dias antes',
        dica: 'Com quantos dias de antecedência o aviso de férias precisa ser entregue (a CLT pede 30). Se a data cair em fim de semana ou feriado, o card mostra o dia útil anterior.' },
      { campo: 'feriasPagamentoDias', rotulo: 'Antecedência do pagamento', unidade: 'dias antes',
        dica: 'Quantos dias antes do início as férias precisam estar pagas (a CLT pede 2). Se cair em fim de semana ou feriado, recua para o dia útil anterior. Ex.: início terça 01/12 → pagamento sexta 27/11.' },
      { campo: 'feriasBloqueioDias', rotulo: 'Dias proibidos antes de folga', unidade: 'dias',
        dica: 'A CLT (art. 134 §3º) proíbe começar férias nos 2 dias antes de feriado ou do descanso semanal (domingo). O painel avisa quando o início cai nesse período. 0 desliga o aviso.' },
      { campo: 'feriasSabadoFolga', rotulo: 'Sábado conta como descanso nessa regra',
        dica: 'Marque se, na sua empresa, o sábado também é dia de descanso para a regra acima. Desmarcado: só domingos e feriados contam.' },
      { campo: 'feriasPreviaDias', rotulo: 'Prévia do mês seguinte', unidade: 'últimos dias do mês',
        dica: 'Nos últimos dias de cada mês, a tela de Férias mostra a lista de avisos e pagamentos do mês seguinte. 7 = última semana. 0 desliga a prévia.' },
    ],
  },
};
