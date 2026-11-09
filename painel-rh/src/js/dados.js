// Estrutura do arquivo dados.json e das Configurações.
// `versao` permite migrar o arquivo nas próximas etapas.
//
// ESQUELETO — para criar uma configuração nova:
//   1. acrescente o campo em ESQUEMA (tipo + limites) e o padrão em CONFIG_PADRAO;
//   2. descreva o campo (rótulo + dica) na lista `opcoes` do módulo ou em telas/configuracoes.js.
//   A validação e a tela de Configurações usam o ESQUEMA automaticamente.

export const VERSAO_DADOS = 1;

/** Temas disponíveis. Para criar um tema: acrescente aqui e um bloco [data-tema="..."] em css/temas.css. */
export const TEMAS = { claro: 'Claro', escuro: 'Escuro', aurora: 'Aurora', eclipse: 'Eclipse' };

export const CONFIG_PADRAO = Object.freeze({
  // Geral
  nomeApp: 'Painel RH',
  tema: 'claro',
  animacoes: true,
  // Calendário
  sabadoUtil: false,
  // Alertas (todos os módulos)
  horarioLimite: '12:00',
  alertaAmareloDias: 3,
  // Rescisões
  avisoDias: 30,
  linxAjusteDias: 0,
  pagamentoDias: 10,
  // Férias
  feriasDiasPadrao: 30,
  feriasAvisoDias: 30,
  feriasPagamentoDias: 2,
  feriasBloqueioDias: 2,
  feriasSabadoFolga: false,
  feriasPreviaDias: 7,
});

/** Tipo e limites de cada configuração (usado para validar o arquivo e a tela). */
export const ESQUEMA = Object.freeze({
  nomeApp: { tipo: 'texto', max: 40 },
  tema: { tipo: 'lista', valores: Object.keys(TEMAS) },
  animacoes: { tipo: 'booleano' },
  sabadoUtil: { tipo: 'booleano' },
  horarioLimite: { tipo: 'horario' },
  alertaAmareloDias: { tipo: 'inteiro', min: 0, max: 60 },
  avisoDias: { tipo: 'inteiro', min: 0, max: 120 },
  linxAjusteDias: { tipo: 'inteiro', min: -60, max: 60 },
  pagamentoDias: { tipo: 'inteiro', min: 0, max: 60 },
  feriasDiasPadrao: { tipo: 'inteiro', min: 1, max: 30 },
  feriasAvisoDias: { tipo: 'inteiro', min: 0, max: 120 },
  feriasPagamentoDias: { tipo: 'inteiro', min: 0, max: 30 },
  feriasBloqueioDias: { tipo: 'inteiro', min: 0, max: 7 },
  feriasSabadoFolga: { tipo: 'booleano' },
  feriasPreviaDias: { tipo: 'inteiro', min: 0, max: 31 },
});

/** O valor é aceitável para o campo? */
export function valorValido(campo, v) {
  const e = ESQUEMA[campo];
  if (!e) return false;
  switch (e.tipo) {
    case 'inteiro': return Number.isInteger(v) && (e.min === undefined || v >= e.min) && (e.max === undefined || v <= e.max);
    case 'booleano': return typeof v === 'boolean';
    case 'texto': return typeof v === 'string' && v.trim().length > 0 && v.length <= e.max;
    case 'lista': return e.valores.includes(v);
    case 'horario': {
      const m = /^(\d{2}):(\d{2})$/.exec(v || '');
      return Boolean(m) && +m[1] <= 23 && +m[2] <= 59;
    }
    default: return false;
  }
}

export function dadosVazios() {
  return { versao: VERSAO_DADOS, config: { ...CONFIG_PADRAO }, feriadosLocais: [], rescisoes: [], ferias: [] };
}

/** Completa campos ausentes e corrige valores inválidos (não perde dados desconhecidos). */
export function normalizar(bruto) {
  const d = { ...dadosVazios(), ...(bruto && typeof bruto === 'object' ? bruto : {}) };
  const c = { ...CONFIG_PADRAO, ...(d.config && typeof d.config === 'object' ? d.config : {}) };
  for (const campo of Object.keys(ESQUEMA)) {
    if (!valorValido(campo, c[campo])) c[campo] = CONFIG_PADRAO[campo];
  }
  c.nomeApp = c.nomeApp.trim();
  d.config = c;
  for (const k of ['feriadosLocais', 'rescisoes', 'ferias']) if (!Array.isArray(d[k])) d[k] = [];
  for (const lista of [d.rescisoes, d.ferias]) {
    for (const r of lista) if (!r.manual || typeof r.manual !== 'object') r.manual = {};
  }
  d.versao = VERSAO_DADOS;
  return d;
}

/** Identificador simples e único o bastante para uso local. */
export function novoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Carimbo de data/hora LOCAL ("AAAA-MM-DDTHH:MM:SS"), comparável como texto. */
export function carimbo(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}
