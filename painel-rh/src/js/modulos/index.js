// Registro de módulos. A ordem aqui é a ordem na barra lateral.
// Para criar um módulo novo (ex.: lembretes mensais da etapa 3), copie modulos/_modelo/
// e acrescente o import abaixo. A faixa "Hoje", o menu e as Configurações se ajustam sozinhos.
import rescisoes from './rescisoes/index.js';
import ferias from './ferias/index.js';

export const MODULOS = [rescisoes, ferias];
