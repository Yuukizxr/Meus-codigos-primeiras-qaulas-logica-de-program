// Estrutura do arquivo dados.json e valores padrão das Configurações.
// `versao` permite migrar o arquivo nas próximas etapas (férias, lembretes).

export const VERSAO_DADOS = 1;

export const CONFIG_PADRAO = Object.freeze({
  avisoDias: 30, // fim do aviso = início + N dias
  linxAjusteDias: 0, // prazo Linx = fim do aviso (ou desligamento) + N dias (pode ser negativo)
  pagamentoDias: 10, // prazo de pagamento = fim do aviso (ou desligamento) + N dias corridos
  horarioLimite: '12:00', // no dia do prazo, a solicitação precisa sair antes deste horário
  alertaAmareloDias: 3, // amarelo quando faltam até N dias
  sabadoUtil: false,
  tema: 'claro',
});

export function dadosVazios() {
  return { versao: VERSAO_DADOS, config: { ...CONFIG_PADRAO }, feriadosLocais: [], rescisoes: [], ferias: [] };
}

const inteiro = (v, padrao, min) => (Number.isInteger(v) && (min === undefined || v >= min) ? v : padrao);

/** Completa campos ausentes e corrige valores inválidos (não perde dados desconhecidos). */
export function normalizar(bruto) {
  const d = { ...dadosVazios(), ...(bruto && typeof bruto === 'object' ? bruto : {}) };
  const c = { ...CONFIG_PADRAO, ...(d.config || {}) };
  c.avisoDias = inteiro(c.avisoDias, CONFIG_PADRAO.avisoDias, 0);
  c.linxAjusteDias = inteiro(c.linxAjusteDias, CONFIG_PADRAO.linxAjusteDias);
  c.pagamentoDias = inteiro(c.pagamentoDias, CONFIG_PADRAO.pagamentoDias, 0);
  c.alertaAmareloDias = inteiro(c.alertaAmareloDias, CONFIG_PADRAO.alertaAmareloDias, 0);
  if (!/^\d{2}:\d{2}$/.test(c.horarioLimite)) c.horarioLimite = CONFIG_PADRAO.horarioLimite;
  c.sabadoUtil = c.sabadoUtil === true;
  c.tema = c.tema === 'escuro' ? 'escuro' : 'claro';
  d.config = c;
  for (const k of ['feriadosLocais', 'rescisoes', 'ferias']) if (!Array.isArray(d[k])) d[k] = [];
  for (const r of d.rescisoes) if (!r.manual || typeof r.manual !== 'object') r.manual = {};
  d.versao = VERSAO_DADOS;
  return d;
}

/** Identificador simples e único o bastante para uso local. */
export function novoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
