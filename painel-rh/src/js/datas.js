// Funções de data puras.
// Regra: toda data é guardada como texto "AAAA-MM-DD" e todo cálculo usa
// componentes de horário LOCAL (nunca toISOString / UTC), para não haver
// deslocamento de um dia por causa de fuso horário.

const RE_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const DIAS_SEMANA_LONGO = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

const doisDig = (n) => String(n).padStart(2, '0');

/** "AAAA-MM-DD" válido (inclusive dia existente no mês)? */
export function ehDataValida(s) {
  if (typeof s !== 'string') return false;
  const m = RE_DATA.exec(s);
  if (!m) return false;
  const a = +m[1], mes = +m[2], d = +m[3];
  if (mes < 1 || mes > 12 || d < 1) return false;
  return d <= new Date(a, mes, 0).getDate();
}

function partes(s) {
  if (!ehDataValida(s)) throw new Error(`Data inválida: ${s}`);
  return [+s.slice(0, 4), +s.slice(5, 7), +s.slice(8, 10)];
}

/** Monta "AAAA-MM-DD" a partir de ano, mês (1-12) e dia. */
export function montar(a, m, d) {
  return `${String(a).padStart(4, '0')}-${doisDig(m)}-${doisDig(d)}`;
}

/** Data local de um objeto Date, como "AAAA-MM-DD". */
export function chaveDoDia(date) {
  return montar(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** Date local ao meio-dia (meio-dia evita qualquer problema de horário de verão). */
function paraDate(s) {
  const [a, m, d] = partes(s);
  return new Date(a, m - 1, d, 12, 0, 0, 0);
}

/** Soma n dias corridos (n pode ser negativo). */
export function somarDias(s, n) {
  const [a, m, d] = partes(s);
  return chaveDoDia(new Date(a, m - 1, d + n, 12, 0, 0, 0));
}

/** Dias corridos de `de` até `ate` (positivo se `ate` é depois). */
export function diasEntre(de, ate) {
  const [a1, m1, d1] = partes(de);
  const [a2, m2, d2] = partes(ate);
  // Date.UTC aqui é só aritmética de calendário (sem fuso envolvido).
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
}

/** 0 = domingo ... 6 = sábado */
export function diaDaSemana(s) {
  return paraDate(s).getDay();
}

export function nomeDiaSemana(s, longo = false) {
  return (longo ? DIAS_SEMANA_LONGO : DIAS_SEMANA)[diaDaSemana(s)];
}

/** "AAAA-MM-DD" -> "DD/MM/AAAA" */
export function formatar(s) {
  if (!ehDataValida(s)) return '—';
  return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
}

/** "HH:MM" -> minutos desde 00:00 (null se inválido). */
export function minutosDoHorario(h) {
  const m = /^(\d{2}):(\d{2})$/.exec(h || '');
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  return +m[1] * 60 + +m[2];
}

/** Minutos decorridos desde a meia-noite local de `date`. */
export function minutosDoDia(date) {
  return date.getHours() * 60 + date.getMinutes();
}

/** 135 -> "2h15min", 40 -> "40min" */
export function formatarDuracao(min) {
  const h = Math.floor(min / 60), m = min % 60;
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h${doisDig(m)}min`;
}
