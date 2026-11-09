// Feriados e dias úteis. Compartilhado por todos os módulos (rescisões, férias...).
import { montar, somarDias, diaDaSemana, ehDataValida } from './datas.js';

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
export function pascoa(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return montar(ano, mes, dia);
}

const FIXOS = [
  ['01-01', 'Confraternização Universal'],
  ['04-21', 'Tiradentes'],
  ['05-01', 'Dia do Trabalho'],
  ['09-07', 'Independência do Brasil'],
  ['10-12', 'Nossa Senhora Aparecida'],
  ['11-02', 'Finados'],
  ['11-15', 'Proclamação da República'],
  ['11-20', 'Dia Nacional de Zumbi e da Consciência Negra'],
  ['12-25', 'Natal'],
];

/** Anos exibidos na tela de feriados. O cálculo funciona para qualquer ano. */
export const ANOS_EMBUTIDOS = [2026, 2027];

/** Feriados nacionais do ano (fixos + móveis calculados pela Páscoa), em ordem. */
export function feriadosNacionais(ano) {
  const p = pascoa(ano);
  const lista = FIXOS.map(([md, nome]) => ({ data: `${ano}-${md}`, nome, tipo: 'nacional' }));
  lista.push(
    { data: somarDias(p, -48), nome: 'Carnaval (segunda-feira)', tipo: 'nacional' },
    { data: somarDias(p, -47), nome: 'Carnaval (terça-feira)', tipo: 'nacional' },
    { data: somarDias(p, -2), nome: 'Sexta-feira Santa', tipo: 'nacional' },
    { data: somarDias(p, 60), nome: 'Corpus Christi', tipo: 'nacional' },
  );
  return lista.sort((x, y) => (x.data < y.data ? -1 : 1));
}

/**
 * Cria o calendário de dias úteis.
 * @param {{sabadoUtil:boolean}} cfg
 * @param {Array<{data:string,nome:string,tipo:'municipal'|'facultativo',naoUtil?:boolean}>} locais
 */
export function criarCalendario(cfg, locais = []) {
  const cacheAno = new Map();
  const locaisPorData = new Map();
  for (const f of locais) {
    if (!ehDataValida(f.data)) continue;
    // Municipal é sempre dia não útil; ponto facultativo depende da marcação.
    if (f.tipo === 'municipal' || f.naoUtil !== false) locaisPorData.set(f.data, f);
  }

  function nacionaisDoAno(ano) {
    if (!cacheAno.has(ano)) {
      cacheAno.set(ano, new Map(feriadosNacionais(ano).map((f) => [f.data, f])));
    }
    return cacheAno.get(ano);
  }

  /** Feriado (nacional ou local que conta como não útil) na data, ou null. */
  function feriado(s) {
    return nacionaisDoAno(+s.slice(0, 4)).get(s) || locaisPorData.get(s) || null;
  }

  /** Motivo de a data não ser útil ("domingo", nome do feriado...) ou null se é útil. */
  function motivoNaoUtil(s) {
    const f = feriado(s);
    if (f) return f.nome;
    const dw = diaDaSemana(s);
    if (dw === 0) return 'domingo';
    if (dw === 6 && !cfg.sabadoUtil) return 'sábado';
    return null;
  }

  const ehDiaUtil = (s) => motivoNaoUtil(s) === null;

  /** Dia útil estritamente anterior à data. */
  function diaUtilAnterior(s) {
    let d = somarDias(s, -1);
    for (let i = 0; i < 366 && !ehDiaUtil(d); i++) d = somarDias(d, -1);
    return d;
  }

  /** Se a data não é útil, devolve o dia útil anterior ("data segura"); se é útil, null. */
  function dataSegura(s) {
    return ehDiaUtil(s) ? null : diaUtilAnterior(s);
  }

  /**
   * Volta N dias ÚTEIS (sábado conforme config, domingo e feriados não contam).
   * Ex.: 2 dias úteis antes de terça 01/12/2026 → sexta 27/11 (seg 30 = 1, sex 27 = 2).
   * Com N = 0, devolve a própria data se for útil, senão o dia útil anterior.
   */
  function voltarDiasUteis(s, n) {
    let d = n === 0 && !ehDiaUtil(s) ? diaUtilAnterior(s) : s;
    for (let i = 0; i < n; i++) d = diaUtilAnterior(d);
    return d;
  }

  return { feriado, motivoNaoUtil, ehDiaUtil, diaUtilAnterior, dataSegura, voltarDiasUteis };
}
