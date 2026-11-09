// Relógio do painel: UM único timer (setTimeout reagendado para o início de cada minuto).
// Dispara o recálculo: ao abrir, a cada minuto, na virada do dia e ao voltar da
// suspensão/minimização. Sem polling extra, sem loops.
import { chaveDoDia } from './datas.js';

/** Acima disso entre dois ticks, consideramos que o PC estava suspenso. */
export const SALTO_SUSPENSAO_MS = 90_000;

/**
 * Classifica um tick (função pura, testável).
 * @param {{ultimoMs:number|null, ultimoDia:string|null}} estado
 * @param {Date} agora
 */
export function classificarTick(estado, agora) {
  const dia = chaveDoDia(agora);
  const ms = agora.getTime();
  return {
    dia,
    ms,
    viradaDia: estado.ultimoDia !== null && dia !== estado.ultimoDia,
    voltouSuspensao: estado.ultimoMs !== null && ms - estado.ultimoMs > SALTO_SUSPENSAO_MS,
  };
}

/** Milissegundos até o início do próximo minuto. */
export function msAteProximoMinuto(agora) {
  return 60_000 - (agora.getSeconds() * 1000 + agora.getMilliseconds());
}

/**
 * Inicia o relógio. `aoTick({agora, viradaDia, voltouSuspensao, motivo})`.
 */
export function iniciarRelogio(aoTick) {
  let timer = null;
  const estado = { ultimoMs: null, ultimoDia: null };

  function tick(motivo) {
    clearTimeout(timer); // garante que existe só um timer agendado
    const agora = new Date();
    const t = classificarTick(estado, agora);
    estado.ultimoMs = t.ms;
    estado.ultimoDia = t.dia;
    try {
      aoTick({ agora, viradaDia: t.viradaDia, voltouSuspensao: t.voltouSuspensao, motivo });
    } finally {
      timer = setTimeout(() => tick('minuto'), msAteProximoMinuto(new Date()) + 50);
    }
  }

  // Ao voltar a ficar visível (restaurar janela, voltar da suspensão), recalcula na hora.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tick('visivel');
  });

  tick('abertura');
  return { agora: () => tick('manual') };
}
