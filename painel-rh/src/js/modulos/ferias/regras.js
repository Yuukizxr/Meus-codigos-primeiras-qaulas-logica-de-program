// Regras de férias (puras, sem DOM). Nenhum número fixo: tudo vem de `cfg`.
import { somarDias, ehDataValida, diaDaSemana, chaveDoDia, montar } from '../../datas.js';
import { avaliarPrazo, NIVEL } from '../../alertas.js';

export const STATUS = ['pendente', 'avisado', 'solicitado', 'pago'];
export const NOME_STATUS = { pendente: 'Pendente', avisado: 'Avisado', solicitado: 'Solicitado', pago: 'Pago' };
/** Texto do botão grande para sair de cada status. */
export const ROTULO_AVANCAR = { pendente: 'Aviso entregue', avisado: 'Pagamento solicitado', solicitado: 'Marcar como pago' };
export const CAMPOS_EDITAVEIS = ['dataAviso', 'dataPagamento'];

export function proximoStatus(s) {
  const i = STATUS.indexOf(s);
  return i >= 0 && i < STATUS.length - 1 ? STATUS[i + 1] : null;
}
export function statusAnterior(s) {
  const i = STATUS.indexOf(s);
  return i > 0 ? STATUS[i - 1] : null;
}

/** Quantidade de dias válida (1 a 30) ou o padrão das Configurações. */
export function diasDasFerias(f, cfg) {
  return Number.isInteger(f.dias) && f.dias >= 1 && f.dias <= 30 ? f.dias : cfg.feriasDiasPadrao;
}

/**
 * CLT art. 134 §3º: as férias não podem começar nos N dias que antecedem feriado
 * ou dia de repouso semanal remunerado (domingo; sábado se configurado).
 * Devolve o primeiro impedimento encontrado ou null.
 */
export function impedimentoInicio(inicio, cfg, cal) {
  if (!ehDataValida(inicio)) return null;
  for (let k = 1; k <= cfg.feriasBloqueioDias; k++) {
    const d = somarDias(inicio, k);
    const f = cal.feriado(d);
    const dw = diaDaSemana(d);
    const motivo = f ? f.nome : dw === 0 ? 'domingo' : dw === 6 && cfg.feriasSabadoFolga ? 'sábado' : null;
    if (motivo) return { data: d, motivo, dias: k };
  }
  return null;
}

function manual(f, campo) {
  const v = f.manual && f.manual[campo];
  return ehDataValida(v) ? v : undefined;
}

/** Calcula as datas das férias. Datas editadas à mão (f.manual) têm prioridade. */
export function calcularFerias(f, cfg, cal) {
  const c = { calculado: {}, manual: {} };
  const definir = (campo, valorCalculado) => {
    const m = manual(f, campo);
    c.calculado[campo] = valorCalculado;
    c.manual[campo] = m !== undefined;
    c[campo] = m ?? valorCalculado;
  };
  c.dias = diasDasFerias(f, cfg);
  c.fim = somarDias(f.inicio, c.dias - 1);
  c.retorno = somarDias(c.fim, 1);
  definir('dataAviso', somarDias(f.inicio, -cfg.feriasAvisoDias));
  definir('dataPagamento', somarDias(f.inicio, -cfg.feriasPagamentoDias));
  // Se cair em fim de semana/feriado, recua para o dia útil anterior.
  c.seguraAviso = cal.dataSegura(c.dataAviso);
  c.seguraPagamento = cal.dataSegura(c.dataPagamento);
  c.motivoAviso = cal.motivoNaoUtil(c.dataAviso);
  c.motivoPagamento = cal.motivoNaoUtil(c.dataPagamento);
  c.efetivoAviso = c.seguraAviso || c.dataAviso;
  c.efetivoPagamento = c.seguraPagamento || c.dataPagamento;
  c.impedimento = impedimentoInicio(f.inicio, cfg, cal);
  return c;
}

/** Prazos que geram alerta: aviso enquanto Pendente; pagamento até ser solicitado. */
export function prazosDasFerias(f, calc) {
  const p = [];
  if (f.status === 'pendente') p.push({ chave: 'aviso', acao: 'Entregar aviso de férias', prazo: calc.dataAviso, efetivo: calc.efetivoAviso });
  if (f.status === 'pendente' || f.status === 'avisado') p.push({ chave: 'pagamento', acao: 'Solicitar pagamento das férias', prazo: calc.dataPagamento, efetivo: calc.efetivoPagamento });
  return p;
}

export function avaliarFerias(f, calc, agora, cfg) {
  const prazos = prazosDasFerias(f, calc).map((p) => ({ ...p, ...avaliarPrazo(p.efetivo, agora, cfg) }));
  const nivel = prazos.reduce((n, p) => Math.max(n, p.nivel), NIVEL.normal);
  return { nivel, prazos };
}

/**
 * Na última semana do mês (últimos N dias, configurável), lista os avisos e
 * pagamentos que caem no mês seguinte. Fora desse período devolve null.
 * @param {Array<{f:object, calc:object}>} itens
 */
export function previaProximoMes(itens, agora, cfg) {
  if (cfg.feriasPreviaDias <= 0) return null;
  const hoje = chaveDoDia(agora);
  const ano = +hoje.slice(0, 4), mes = +hoje.slice(5, 7), dia = +hoje.slice(8, 10);
  const ultimo = new Date(ano, mes, 0).getDate();
  if (dia <= ultimo - cfg.feriasPreviaDias) return null;
  const [pa, pm] = mes === 12 ? [ano + 1, 1] : [ano, mes + 1];
  const prefixo = montar(pa, pm, 1).slice(0, 8); // "AAAA-MM-"
  const abertos = itens.filter((x) => x.f.status !== 'pago');
  const porData = (a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : a.nome.localeCompare(b.nome, 'pt-BR'));
  return {
    ano: pa,
    mes: pm,
    avisos: abertos.filter((x) => x.calc.efetivoAviso.startsWith(prefixo))
      .map((x) => ({ id: x.f.id, nome: x.f.nome, data: x.calc.efetivoAviso, feito: x.f.status !== 'pendente' })).sort(porData),
    pagamentos: abertos.filter((x) => x.calc.efetivoPagamento.startsWith(prefixo))
      .map((x) => ({ id: x.f.id, nome: x.f.nome, data: x.calc.efetivoPagamento, feito: x.f.status === 'solicitado' })).sort(porData),
  };
}

export function novasFerias({ nome, inicio, dias }, id) {
  return { id, nome: nome.trim(), inicio, dias, status: 'pendente', manual: {} };
}
