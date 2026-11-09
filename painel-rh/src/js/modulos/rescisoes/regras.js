// Regras de rescisão (puras, sem DOM). Nenhum número fixo: tudo vem de `cfg`.
// O painel NÃO calcula valores; só datas, prazos e alertas.
import { somarDias, ehDataValida } from '../../datas.js';
import { avaliarPrazo, NIVEL } from '../../alertas.js';

export const TIPOS = { trabalhado: 'Aviso trabalhado', indenizado: 'Aviso indenizado' };
export const STATUS = ['pendente', 'solicitada', 'paga'];
export const NOME_STATUS = { pendente: 'Pendente', solicitada: 'Solicitada', paga: 'Paga' };

/** Campos de data que podem ser editados à mão no card (sobrescrevem o calculado). */
export const CAMPOS_EDITAVEIS = ['inicioAviso', 'fimAviso', 'prazoLinx', 'prazoPagamento'];

export function proximoStatus(s) {
  const i = STATUS.indexOf(s);
  return i >= 0 && i < STATUS.length - 1 ? STATUS[i + 1] : null;
}
export function statusAnterior(s) {
  const i = STATUS.indexOf(s);
  return i > 0 ? STATUS[i - 1] : null;
}

/** Valor manual válido para o campo, ou undefined. */
function manual(r, campo) {
  const v = r.manual && r.manual[campo];
  return ehDataValida(v) ? v : undefined;
}

/**
 * Calcula todas as datas da rescisão.
 * Campos editados à mão (r.manual) têm prioridade; os seguintes são recalculados
 * a partir deles (cascata), exceto os que também foram editados à mão.
 */
export function calcularRescisao(r, cfg, cal) {
  const c = { calculado: {}, manual: {} };
  const definir = (campo, valorCalculado) => {
    const m = manual(r, campo);
    c.calculado[campo] = valorCalculado;
    c.manual[campo] = m !== undefined;
    c[campo] = m ?? valorCalculado;
  };

  if (r.tipo === 'trabalhado') {
    definir('inicioAviso', r.dataCarta);
    definir('fimAviso', somarDias(c.inicioAviso, cfg.avisoDias));
    c.desligamento = c.fimAviso;
  } else {
    // Indenizado: sem período de aviso; o desligamento é na data da carta.
    c.inicioAviso = null;
    c.fimAviso = null;
    c.desligamento = r.dataCarta;
  }

  definir('prazoLinx', somarDias(c.desligamento, cfg.linxAjusteDias));
  definir('prazoPagamento', somarDias(c.desligamento, cfg.pagamentoDias));

  // Se o prazo cai em fim de semana/feriado, a "data segura" é o dia útil anterior.
  c.seguraLinx = cal.dataSegura(c.prazoLinx);
  c.seguraPagamento = cal.dataSegura(c.prazoPagamento);
  c.motivoLinx = cal.motivoNaoUtil(c.prazoLinx);
  c.motivoPagamento = cal.motivoNaoUtil(c.prazoPagamento);
  return c;
}

/**
 * Prazos que geram alerta. Só enquanto o status é "pendente":
 * ao virar "Solicitada" (ou "Paga") os alertas param.
 */
export function prazosDaRescisao(r, calc) {
  if (r.status !== 'pendente') return [];
  return [
    { chave: 'linx', acao: 'Lançar rescisão no Linx', prazo: calc.prazoLinx, efetivo: calc.seguraLinx || calc.prazoLinx },
    { chave: 'pagamento', acao: 'Solicitar pagamento', prazo: calc.prazoPagamento, efetivo: calc.seguraPagamento || calc.prazoPagamento },
  ];
}

/** Avalia os prazos da rescisão e devolve { nivel, prazos:[...com avaliação] }. */
export function avaliarRescisao(r, calc, agora, cfg) {
  const prazos = prazosDaRescisao(r, calc).map((p) => ({ ...p, ...avaliarPrazo(p.efetivo, agora, cfg) }));
  const nivel = prazos.reduce((n, p) => Math.max(n, p.nivel), NIVEL.normal);
  return { nivel, prazos };
}

/** Nova rescisão a partir do cadastro rápido. */
export function novaRescisao({ nome, dataCarta, tipo }, id) {
  return { id, nome: nome.trim(), dataCarta, tipo, status: 'pendente', manual: {} };
}
