// Níveis de alerta, compartilhados por todos os módulos.
import { chaveDoDia, diasEntre, minutosDoDia, minutosDoHorario, formatarDuracao } from './datas.js';

export const NIVEL = { normal: 0, amarelo: 1, laranja: 2, vermelho: 3 };
export const NOME_NIVEL = ['normal', 'amarelo', 'laranja', 'vermelho'];

/**
 * Avalia um prazo (data limite efetiva, já considerando a data segura).
 * - vermelho: o prazo passou, ou é hoje e já passou do horário limite;
 * - laranja: o prazo é hoje e ainda não chegou o horário limite (contagem regressiva);
 * - amarelo: faltam até `alertaAmareloDias` dias;
 * - normal: o resto.
 * @param {string} prazo "AAAA-MM-DD"
 * @param {Date} agora
 * @param {{horarioLimite:string, alertaAmareloDias:number}} cfg
 */
export function avaliarPrazo(prazo, agora, cfg) {
  const hoje = chaveDoDia(agora);
  const faltam = diasEntre(hoje, prazo);
  const limite = minutosDoHorario(cfg.horarioLimite) ?? 12 * 60;
  const hhmm = cfg.horarioLimite;

  if (faltam < 0) {
    const atraso = -faltam;
    return { nivel: NIVEL.vermelho, faltam, texto: `Atrasado há ${atraso} dia${atraso > 1 ? 's' : ''}` };
  }
  if (faltam === 0) {
    const restam = limite - minutosDoDia(agora);
    if (restam <= 0) return { nivel: NIVEL.vermelho, faltam, texto: `Venceu hoje às ${hhmm}` };
    return { nivel: NIVEL.laranja, faltam, minutosRestantes: restam, texto: `Hoje até ${hhmm} — faltam ${formatarDuracao(restam)}` };
  }
  if (faltam <= cfg.alertaAmareloDias) {
    return { nivel: NIVEL.amarelo, faltam, texto: faltam === 1 ? 'Vence amanhã' : `Faltam ${faltam} dias` };
  }
  return { nivel: NIVEL.normal, faltam, texto: `Faltam ${faltam} dias` };
}

/** Ordena alertas: mais urgente primeiro; no mesmo nível, o prazo mais antigo primeiro. */
export function ordenarAlertas(lista) {
  return lista.sort((a, b) => b.nivel - a.nivel || (a.data < b.data ? -1 : a.data > b.data ? 1 : 0) || a.titulo.localeCompare(b.titulo, 'pt-BR'));
}
