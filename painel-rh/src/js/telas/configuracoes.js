// Configurações: todas as regras de prazo ficam aqui (nada fixo no código).
import { CONFIG_PADRAO, TEMAS } from '../dados.js';
import { minutosDoHorario } from '../datas.js';
import { esc } from '../util.js';
import { pastaDados } from '../store.js';

const NOME_TEMA = { claro: 'Claro', escuro: 'Escuro', aurora: 'Aurora' };

const NUMERICOS = [
  { campo: 'avisoDias', rotulo: 'Duração do aviso trabalhado', ajuda: 'Fim do aviso = início + N dias corridos.', unidade: 'dias', min: 0 },
  { campo: 'linxAjusteDias', rotulo: 'Ajuste do prazo para lançar no Linx', ajuda: 'Prazo Linx = fim do aviso (ou desligamento, se indenizado) + N dias corridos. Use número negativo para antecipar.', unidade: 'dias' },
  { campo: 'pagamentoDias', rotulo: 'Prazo de pagamento', ajuda: 'Prazo = fim do aviso (ou desligamento, se indenizado) + N dias corridos.', unidade: 'dias', min: 0 },
  { campo: 'alertaAmareloDias', rotulo: 'Alerta amarelo', ajuda: 'Fica amarelo quando faltam até N dias para o prazo.', unidade: 'dias', min: 0 },
];

function desenhar(el, ctx) {
  const c = ctx.cfg;
  el.innerHTML = `
    <h1>Configurações</h1>
    <div class="painel">
      <h2>Regras de prazo</h2>
      ${NUMERICOS.map((n) => `
      <div class="config-item">
        <span class="rotulo">${esc(n.rotulo)}</span>
        <span class="ajuda">${esc(n.ajuda)} Padrão: ${CONFIG_PADRAO[n.campo]}.</span>
        <span class="controle">
          <input type="number" step="1" ${n.min !== undefined ? `min="${n.min}"` : ''} data-cfg="${n.campo}" value="${c[n.campo]}"> ${n.unidade}
          <span class="msg-campo" data-msg="${n.campo}"></span>
        </span>
      </div>`).join('')}
      <div class="config-item">
        <span class="rotulo">Horário limite no dia do prazo</span>
        <span class="ajuda">No dia do prazo, a contagem regressiva vai até este horário; depois dele fica vermelho. Padrão: ${CONFIG_PADRAO.horarioLimite}.</span>
        <span class="controle"><input type="time" data-cfg="horarioLimite" value="${esc(c.horarioLimite)}"><span class="msg-campo" data-msg="horarioLimite"></span></span>
      </div>
      <div class="config-item">
        <span class="rotulo">Sábado é dia útil</span>
        <span class="ajuda">Usado para decidir se o prazo precisa de "data segura". Padrão: não.</span>
        <span class="controle"><label class="check"><input type="checkbox" data-cfg="sabadoUtil" ${c.sabadoUtil ? 'checked' : ''}> Sim</label></span>
      </div>
      <p class="suave pequeno">Mudar uma regra recalcula as rescisões já cadastradas, exceto as datas editadas à mão no card.</p>
    </div>

    <div class="painel">
      <h2>Aparência</h2>
      <div class="config-item">
        <span class="rotulo">Tema</span>
        <span class="ajuda">Claro, escuro ou Aurora (degradê). Os degradês são estáticos: não pesam no vídeo.</span>
        <span class="controle">
          ${Object.entries(NOME_TEMA).map(([v, t]) => `<label class="check"><input type="radio" name="tema" data-cfg="tema" value="${v}" ${c.tema === v ? 'checked' : ''}> ${t}</label>`).join('')}
        </span>
      </div>
    </div>

    <div class="painel">
      <h2>Dados</h2>
      <p>Os dados ficam só neste computador, em:</p>
      <p class="caminho" id="pasta-dados">…</p>
      <p class="suave pequeno">Backup automático uma vez por dia na subpasta <span class="caminho">backups</span> (ficam os 14 mais recentes).</p>
    </div>`;

  pastaDados().then((p) => { const x = el.querySelector('#pasta-dados'); if (x) x.textContent = p; }).catch(() => {});

  el.onchange = (e) => {
    const inp = e.target;
    const campo = inp.dataset.cfg;
    if (!campo) return;
    const msg = el.querySelector(`[data-msg="${campo}"]`);
    if (msg) msg.textContent = '';
    if (campo === 'sabadoUtil') c.sabadoUtil = inp.checked;
    else if (campo === 'tema') c.tema = TEMAS.includes(inp.value) ? inp.value : CONFIG_PADRAO.tema;
    else if (campo === 'horarioLimite') {
      if (minutosDoHorario(inp.value) === null) { inp.value = c.horarioLimite; if (msg) msg.textContent = 'Horário inválido'; return; }
      c.horarioLimite = inp.value;
    } else {
      const def = NUMERICOS.find((n) => n.campo === campo);
      const v = Number(inp.value);
      if (!def || !Number.isInteger(v) || (def.min !== undefined && v < def.min)) {
        inp.value = c[campo];
        if (msg) msg.textContent = 'Use um número inteiro' + (def && def.min !== undefined ? ` (mínimo ${def.min})` : '');
        return;
      }
      c[campo] = v;
    }
    ctx.salvar();
  };
}

export default {
  id: 'configuracoes',
  titulo: 'Configurações',
  icone: 'config',
  renderizar: desenhar,
  atualizar: () => {}, // a tela não depende do relógio; os campos já mostram o valor salvo
};
