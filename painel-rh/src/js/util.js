// Pequenos utilitários de interface.
import { formatar, nomeDiaSemana, ehDataValida } from './datas.js';

const MAPA = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => MAPA[c]);

export const icone = (nome) => `<svg class="ic" aria-hidden="true"><use href="#i-${nome}"></use></svg>`;

/** "sex 18/12/2026" */
export const dataCurta = (s) => (ehDataValida(s) ? `${nomeDiaSemana(s)} ${formatar(s)}` : '—');

/**
 * Botão de exclusão em dois cliques: o primeiro pede confirmação, o segundo confirma.
 * Devolve true quando deve excluir.
 */
export function confirmarDoisCliques(btn) {
  if (btn.dataset.confirmar) return true;
  btn.dataset.confirmar = '1';
  const original = btn.innerHTML;
  btn.innerHTML = `${icone('lixo')} Clique de novo para excluir`;
  btn.addEventListener('blur', () => { delete btn.dataset.confirmar; btn.innerHTML = original; }, { once: true });
  return false;
}
