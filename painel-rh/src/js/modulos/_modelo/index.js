// ESQUELETO DE MÓDULO — copie esta pasta para criar um assunto novo (ex.: lembretes mensais).
// Não está registrado; nada aqui roda até ser importado em modulos/index.js.
//
// Contrato de um módulo:
//   id          identificador curto (também usado em data-tela)
//   titulo      nome no menu
//   icone       id de um <symbol> em index.html (i-<icone>)
//   alertas(ctx)        -> [{ nivel, faltam, titulo, acao, data, texto, alvo:{tela,id} }]
//                          (use avaliarPrazo de alertas.js para nivel/faltam/texto)
//   renderizar(el, ctx) -> desenha a tela (use cabecalho, criarLista, selo, blocoPrazo...)
//   atualizar(el, ctx)  -> chamado a cada minuto e após salvar
//   opcoes              -> { titulo, campos:[{ campo, rotulo, dica, unidade? }] }
//                          (cada campo também precisa existir em ESQUEMA/CONFIG_PADRAO, dados.js)
//
// ctx: { dados, cfg, cal, agora, salvar(), irPara(tela, id), destaqueId, modulos }
//   - guarde os registros em ctx.dados.<lista> (crie a lista em dadosVazios/normalizar);
//   - depois de alterar, chame ctx.salvar() (grava e redesenha).
import { cabecalho } from '../../componentes.js';

export default {
  id: 'modelo',
  titulo: 'Modelo',
  icone: 'rescisao',
  alertas: () => [],
  renderizar(el) {
    el.innerHTML = `${cabecalho('Novo módulo', 'Modelo')}<p class="vazio">Em construção.</p>`;
  },
  atualizar() {},
  opcoes: null,
};
