// Tela de feriados: nacionais embutidos (só leitura) + municipais e pontos facultativos.
import { feriadosNacionais, ANOS_EMBUTIDOS } from '../calendario.js';
import { ehDataValida, chaveDoDia } from '../datas.js';
import { novoId } from '../dados.js';
import { esc, icone, dataCurta, confirmarDoisCliques } from '../util.js';

let anoSelecionado = null;

const NOME_TIPO = { municipal: 'Feriado municipal', facultativo: 'Ponto facultativo' };

function desenhar(el, ctx) {
  const anoAtual = +chaveDoDia(ctx.agora).slice(0, 4);
  if (!anoSelecionado) anoSelecionado = ANOS_EMBUTIDOS.includes(anoAtual) ? anoAtual : ANOS_EMBUTIDOS[0];
  const locais = [...ctx.dados.feriadosLocais].sort((a, b) => (a.data < b.data ? -1 : 1));

  el.innerHTML = `
    <h1>Feriados</h1>

    <div class="painel">
      <h2>Municipais e pontos facultativos</h2>
      <form id="form-feriado" class="form-linha" autocomplete="off">
        <label class="campo">Data <input type="date" name="data" required></label>
        <label class="campo">Nome <input type="text" name="nome" placeholder="Ex.: Aniversário da cidade" required></label>
        <label class="campo">Tipo
          <select name="tipo">
            <option value="municipal">Feriado municipal</option>
            <option value="facultativo">Ponto facultativo</option>
          </select>
        </label>
        <label class="check" id="lbl-nao-util"><input type="checkbox" name="naoUtil" checked disabled> Conta como dia não útil</label>
        <button class="btn" type="submit">${icone('mais')} Adicionar</button>
      </form>
      ${locais.length ? `
      <table>
        <thead><tr><th>Data</th><th>Nome</th><th>Tipo</th><th>Dia útil?</th><th></th></tr></thead>
        <tbody>
          ${locais.map((f) => `
          <tr data-id="${esc(f.id)}">
            <td>${esc(dataCurta(f.data))}</td>
            <td>${esc(f.nome)}</td>
            <td>${NOME_TIPO[f.tipo] || esc(f.tipo)}</td>
            <td>${f.tipo === 'municipal' || f.naoUtil !== false ? 'Não útil' : 'Útil (não conta)'}</td>
            <td class="acao"><button type="button" class="btn-link perigo" data-acao="excluir">${icone('lixo')} Excluir</button></td>
          </tr>`).join('')}
        </tbody>
      </table>` : '<p class="suave">Nenhum feriado municipal ou ponto facultativo cadastrado.</p>'}
    </div>

    <div class="painel">
      <h2>Nacionais (embutidos)</h2>
      <div class="abas" role="tablist">
        ${ANOS_EMBUTIDOS.map((a) => `<button type="button" role="tab" data-ano="${a}" aria-selected="${a === anoSelecionado}">${a}</button>`).join('')}
      </div>
      <table>
        <thead><tr><th>Data</th><th>Feriado</th></tr></thead>
        <tbody>
          ${feriadosNacionais(anoSelecionado).map((f) => `<tr><td>${esc(dataCurta(f.data))}</td><td>${esc(f.nome)}</td></tr>`).join('')}
        </tbody>
      </table>
      <p class="suave pequeno">Carnaval, Sexta-feira Santa e Corpus Christi são calculados a partir da Páscoa.</p>
    </div>`;

  const form = el.querySelector('#form-feriado');
  form.tipo.onchange = () => {
    // Municipal é sempre dia não útil; para ponto facultativo, você escolhe.
    const municipal = form.tipo.value === 'municipal';
    form.naoUtil.disabled = municipal;
    if (municipal) form.naoUtil.checked = true;
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    const data = form.data.value, nome = form.nome.value.trim(), tipo = form.tipo.value;
    if (!ehDataValida(data)) { form.data.focus(); return; }
    if (!nome) { form.nome.focus(); return; }
    ctx.dados.feriadosLocais.push({ id: novoId(), data, nome, tipo, naoUtil: tipo === 'municipal' ? true : form.naoUtil.checked });
    ctx.salvar();
    el.querySelector('#form-feriado [name="data"]')?.focus();
  };

  el.onclick = (e) => {
    const ano = e.target.closest('[data-ano]');
    if (ano) { anoSelecionado = +ano.dataset.ano; desenhar(el, ctx); return; }
    const btn = e.target.closest('button[data-acao="excluir"]');
    if (!btn) return;
    if (!confirmarDoisCliques(btn)) return;
    const id = btn.closest('tr').dataset.id;
    ctx.dados.feriadosLocais = ctx.dados.feriadosLocais.filter((f) => f.id !== id);
    ctx.salvar();
  };
}

export default {
  id: 'feriados',
  titulo: 'Feriados',
  icone: 'calendario',
  renderizar: desenhar,
  // Depois de salvar, redesenha (a lista mudou). No tick do minuto não há o que atualizar.
  atualizar: (el, ctx, motivo) => { if (motivo === 'salvo') desenhar(el, ctx); },
};
