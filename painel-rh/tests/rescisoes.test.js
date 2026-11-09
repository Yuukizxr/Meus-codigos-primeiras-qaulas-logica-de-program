import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarCalendario } from '../src/js/calendario.js';
import { CONFIG_PADRAO, normalizar } from '../src/js/dados.js';
import { avaliarPrazo, NIVEL, ordenarAlertas } from '../src/js/alertas.js';
import {
  calcularRescisao, avaliarRescisao, novaRescisao, proximoStatus, statusAnterior,
} from '../src/js/modulos/rescisoes/regras.js';

const cfg = { ...CONFIG_PADRAO };
const cal = criarCalendario(cfg);
const r = (o) => ({ ...novaRescisao({ nome: 'Fulano', dataCarta: '2026-11-09', tipo: 'trabalhado' }, 'x'), ...o });

test('aviso trabalhado: início = carta, fim = +30, Linx = fim, pagamento = fim + 10', () => {
  const c = calcularRescisao(r(), cfg, cal);
  assert.equal(c.inicioAviso, '2026-11-09');
  assert.equal(c.fimAviso, '2026-12-09');
  assert.equal(c.desligamento, '2026-12-09');
  assert.equal(c.prazoLinx, '2026-12-09');
  assert.equal(c.seguraLinx, null);
  assert.equal(c.prazoPagamento, '2026-12-19'); // sábado
  assert.equal(c.seguraPagamento, '2026-12-18'); // sexta
});

test('aviso indenizado: sem aviso, desligamento na carta', () => {
  const c = calcularRescisao(r({ tipo: 'indenizado', dataCarta: '2026-11-10' }), cfg, cal);
  assert.equal(c.inicioAviso, null);
  assert.equal(c.fimAviso, null);
  assert.equal(c.desligamento, '2026-11-10');
  assert.equal(c.prazoPagamento, '2026-11-20'); // feriado (Consciência Negra)
  assert.equal(c.seguraPagamento, '2026-11-19');
});

test('regras vêm das Configurações', () => {
  const c2 = { ...cfg, avisoDias: 29, linxAjusteDias: -2, pagamentoDias: 9 };
  const c = calcularRescisao(r(), c2, cal);
  assert.equal(c.fimAviso, '2026-12-08');
  assert.equal(c.prazoLinx, '2026-12-06'); // domingo
  assert.equal(c.seguraLinx, '2026-12-04');
  assert.equal(c.prazoPagamento, '2026-12-17');
});

test('edição manual em cascata: início editado recalcula fim e prazos', () => {
  const c = calcularRescisao(r({ manual: { inicioAviso: '2026-11-10' } }), cfg, cal);
  assert.equal(c.manual.inicioAviso, true);
  assert.equal(c.fimAviso, '2026-12-10');
  assert.equal(c.prazoPagamento, '2026-12-20');
});

test('edição manual: campo editado à mão não é recalculado', () => {
  const c = calcularRescisao(r({ manual: { inicioAviso: '2026-11-10', fimAviso: '2026-12-01' } }), cfg, cal);
  assert.equal(c.fimAviso, '2026-12-01');
  assert.equal(c.calculado.fimAviso, '2026-12-10');
  assert.equal(c.prazoLinx, '2026-12-01');
  const p = calcularRescisao(r({ manual: { prazoPagamento: '2026-12-15' } }), cfg, cal);
  assert.equal(p.prazoPagamento, '2026-12-15');
  assert.equal(p.calculado.prazoPagamento, '2026-12-19');
});

test('dias de aviso por pessoa (ex.: vai cumprir 15 dias)', () => {
  const c = calcularRescisao(r({ diasAviso: 15 }), cfg, cal);
  assert.equal(c.diasAviso, 15);
  assert.equal(c.fimAviso, '2026-11-24');
  assert.equal(c.prazoPagamento, '2026-12-04');
  assert.equal(calcularRescisao(r({ diasAviso: 'x' }), cfg, cal).diasAviso, 30); // inválido → padrão
  assert.equal(novaRescisao({ nome: 'A', dataCarta: '2026-11-09', tipo: 'trabalhado', diasAviso: 20 }, 'z').diasAviso, 20);
  assert.equal('diasAviso' in novaRescisao({ nome: 'A', dataCarta: '2026-11-09', tipo: 'trabalhado' }, 'z'), false);
});

test('status: Pendente → Solicitada → Paga', () => {
  assert.equal(proximoStatus('pendente'), 'solicitada');
  assert.equal(proximoStatus('solicitada'), 'paga');
  assert.equal(proximoStatus('paga'), null);
  assert.equal(statusAnterior('paga'), 'solicitada');
  assert.equal(statusAnterior('pendente'), null);
});

test('alerta: normal, amarelo (até 3 dias), laranja (hoje antes das 12h), vermelho', () => {
  const ag = (d, h = 9, m = 0) => new Date(2026, 10, d, h, m);
  assert.equal(avaliarPrazo('2026-11-13', ag(9), cfg).nivel, NIVEL.normal); // 4 dias
  assert.equal(avaliarPrazo('2026-11-12', ag(9), cfg).nivel, NIVEL.amarelo); // 3 dias
  assert.equal(avaliarPrazo('2026-11-10', ag(9), cfg).texto, 'Vence amanhã');
  const hoje = avaliarPrazo('2026-11-09', ag(9, 9, 45), cfg);
  assert.equal(hoje.nivel, NIVEL.laranja);
  assert.equal(hoje.minutosRestantes, 135);
  assert.match(hoje.texto, /faltam 2h15min/);
  assert.equal(avaliarPrazo('2026-11-09', ag(9, 11, 59), cfg).nivel, NIVEL.laranja);
  assert.equal(avaliarPrazo('2026-11-09', ag(9, 12, 0), cfg).nivel, NIVEL.vermelho);
  assert.equal(avaliarPrazo('2026-11-08', ag(9, 8), cfg).nivel, NIVEL.vermelho);
  assert.equal(avaliarPrazo('2026-11-07', ag(9), cfg).texto, 'Atrasado há 2 dias');
});

test('alerta: horário limite configurável', () => {
  const c = { ...cfg, horarioLimite: '15:30' };
  assert.equal(avaliarPrazo('2026-11-09', new Date(2026, 10, 9, 14, 0), c).nivel, NIVEL.laranja);
  assert.equal(avaliarPrazo('2026-11-09', new Date(2026, 10, 9, 15, 30), c).nivel, NIVEL.vermelho);
});

test('alerta usa a data segura quando o prazo cai em fim de semana/feriado', () => {
  // Pagamento em 19/12 (sábado) -> data segura 18/12: em 18/12 às 10h já é laranja.
  const a = avaliarRescisao(r(), calcularRescisao(r(), cfg, cal), new Date(2026, 11, 18, 10, 0), cfg);
  const pg = a.prazos.find((p) => p.chave === 'pagamento');
  assert.equal(pg.efetivo, '2026-12-18');
  assert.equal(pg.nivel, NIVEL.laranja);
  // No sábado (prazo original), já está vermelho.
  const b = avaliarRescisao(r(), calcularRescisao(r(), cfg, cal), new Date(2026, 11, 19, 8, 0), cfg);
  assert.equal(b.nivel, NIVEL.vermelho);
});

test('alertas param quando o status é Solicitada ou Paga', () => {
  const agora = new Date(2027, 0, 30, 10, 0); // tudo vencido
  for (const status of ['solicitada', 'paga']) {
    const x = r({ status });
    const a = avaliarRescisao(x, calcularRescisao(x, cfg, cal), agora, cfg);
    assert.equal(a.prazos.length, 0);
    assert.equal(a.nivel, NIVEL.normal);
  }
  const p = r();
  assert.equal(avaliarRescisao(p, calcularRescisao(p, cfg, cal), agora, cfg).nivel, NIVEL.vermelho);
});

test('ordenação: urgentes primeiro, depois prazo mais antigo', () => {
  const l = ordenarAlertas([
    { nivel: 1, data: '2026-11-11', titulo: 'b' },
    { nivel: 3, data: '2026-11-05', titulo: 'c' },
    { nivel: 3, data: '2026-11-01', titulo: 'a' },
    { nivel: 2, data: '2026-11-09', titulo: 'd' },
  ]);
  assert.deepEqual(l.map((x) => x.titulo), ['a', 'c', 'd', 'b']);
});

test('normalizar dados: preenche padrão e corrige inválidos', () => {
  const d = normalizar({ config: { pagamentoDias: 'x', horarioLimite: '1200', sabadoUtil: 'sim' }, rescisoes: [{ id: 1 }] });
  assert.equal(d.config.pagamentoDias, 10);
  assert.equal(d.config.horarioLimite, '12:00');
  assert.equal(d.config.sabadoUtil, false);
  assert.deepEqual(d.rescisoes[0].manual, {});
  assert.deepEqual(d.ferias, []);
  assert.equal(normalizar(null).config.avisoDias, 30);
  assert.equal(normalizar({ config: { tema: 'aurora' } }).config.tema, 'aurora');
  assert.equal(normalizar({ config: { tema: 'neon' } }).config.tema, 'claro');
});

test('configurações: nome do painel, tema Eclipse e limites do esquema', async () => {
  const { valorValido } = await import('../src/js/dados.js');
  assert.equal(normalizar({ config: { nomeApp: '  RH Loja Centro ' } }).config.nomeApp, 'RH Loja Centro');
  assert.equal(normalizar({ config: { nomeApp: '' } }).config.nomeApp, 'Painel RH');
  assert.equal(normalizar({ config: { tema: 'eclipse' } }).config.tema, 'eclipse');
  assert.equal(normalizar({ config: { animacoes: 'sim' } }).config.animacoes, true);
  assert.equal(valorValido('linxAjusteDias', -2), true);
  assert.equal(valorValido('feriasDiasPadrao', 31), false);
  assert.equal(valorValido('horarioLimite', '24:00'), false);
  assert.deepEqual(normalizar({ ferias: [{ id: 1 }] }).ferias[0].manual, {});
});
