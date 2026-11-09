// Registro de módulos. Cada módulo fornece:
//   id, titulo, icone
//   alertas(ctx)          -> [{ nivel, titulo, acao, data, texto, alvo:{tela,id} }]
//   renderizar(el, ctx)   -> desenha a tela do módulo
//   atualizar(el, ctx)    -> chamado a cada minuto/virada do dia (opcional)
// Etapa 2: acrescentar o módulo de férias aqui (import ferias from './ferias/index.js').
import rescisoes from './rescisoes/index.js';

export const MODULOS = [rescisoes];
