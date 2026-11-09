import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarCalendario } from '../src/js/calendario.js';
import { CONFIG_PADRAO } from '../src/js/dados.js';
import { NIVEL } from '../src/js/alertas.js';
import {
  calcularFerias, avaliarFerias, impedimentoInicio, previaProximoMes, novasFerias, proximoStatus,
} from '../src/js/modulos/ferias/regras.js';

const cfg = { ...CONFIG_PADRAO };
const cal = criarCalendario(cfg);
const f = (o = {}) => ({ ...novasFerias({ nome: 'Joana', inicio: '2026-12-01', dias: 30 }, 'f1'), ...o });

test('exemplo: início 01/12/2026 → pagamento sexta 27/11 (2 dias antes, recuando para dia útil)', () => {
  const c = calcularFerias(f(), cfg, cal);
  assert.equal(c.dataPagamento, '2026-11-29'); // domingo
  assert.equal(c.efetivoPagamento, '2026-11-27'); // sexta
});

test('aviso 30 dias antes, recuando para dia útil', () => {
  const c = calcularFerias(f(), cfg, cal);
  assert.equal(c.dataAviso, '2026-11-01'); // domingo
  assert.equal(c.efetivoAviso, '2026-10-30'); // sexta
});

test('fim e retorno', () => {
  const c = calcularFerias(f(), cfg, cal);
  assert.equal(c.fim, '2026-12-30');
  assert.equal(c.retorno, '2026-12-31');
  assert.equal(calcularFerias(f({ dias: 10 }), cfg, cal).fim, '2026-12-10');
  assert.equal(calcularFerias(f({ dias: 99 }), cfg, cal).dias, 30); // inválido → padrão
});

test('dias de antecedência vêm das Configurações', () => {
  const c = calcularFerias(f(), { ...cfg, feriasPagamentoDias: 3, feriasAvisoDias: 35 }, cal);
  assert.equal(c.dataPagamento, '2026-11-28'); // sábado → sexta 27
  assert.equal(c.efetivoPagamento, '2026-11-27');
  assert.equal(c.dataAviso, '2026-10-27');
});

test('CLT 134 §3: não iniciar nos 2 dias antes de feriado ou domingo', () => {
  assert.deepEqual(impedimentoInicio('2026-11-19', cfg, cal), { data: '2026-11-20', motivo: 'Dia Nacional de Zumbi e da Consciência Negra', dias: 1 });
  assert.equal(impedimentoInicio('2026-11-18', cfg, cal).dias, 2);
  assert.equal(impedimentoInicio('2026-12-04', cfg, cal).motivo, 'domingo'); // sexta → domingo em 2 dias
  assert.equal(impedimentoInicio('2026-12-05', cfg, cal).motivo, 'domingo'); // sábado → domingo em 1 dia
  assert.equal(impedimentoInicio('2026-12-02', cfg, cal), null); // quarta: qui e sex livres
  assert.equal(impedimentoInicio('2026-12-03', cfg, cal), null); // quinta: sábado não conta (padrão)
  assert.equal(impedimentoInicio('2026-12-03', { ...cfg, feriasSabadoFolga: true }, cal).motivo, 'sábado');
  assert.equal(impedimentoInicio('2026-12-04', { ...cfg, feriasBloqueioDias: 0 }, cal), null);
});

test('alertas: aviso só enquanto Pendente; pagamento até ser solicitado', () => {
  const agora = new Date(2026, 10, 25, 9, 0); // 25/11
  const p = f();
  const a = avaliarFerias(p, calcularFerias(p, cfg, cal), agora, cfg);
  assert.deepEqual(a.prazos.map((x) => x.chave), ['aviso', 'pagamento']);
  assert.equal(a.prazos[0].nivel, NIVEL.vermelho); // aviso vencido (30/10)
  assert.equal(a.prazos[1].nivel, NIVEL.amarelo); // pagamento 27/11: faltam 2 dias
  const av = f({ status: 'avisado' });
  assert.deepEqual(avaliarFerias(av, calcularFerias(av, cfg, cal), agora, cfg).prazos.map((x) => x.chave), ['pagamento']);
  const so = f({ status: 'solicitado' });
  assert.equal(avaliarFerias(so, calcularFerias(so, cfg, cal), agora, cfg).prazos.length, 0);
  assert.equal(proximoStatus('solicitado'), 'pago');
});

test('prévia do mês seguinte só na última semana', () => {
  const itens = [f(), f({ id: 'f2', nome: 'Ana', inicio: '2027-01-11' }), f({ id: 'f3', nome: 'Pago', inicio: '2026-12-10', status: 'pago' })]
    .map((x) => ({ f: x, calc: calcularFerias(x, cfg, cal) }));
  assert.equal(previaProximoMes(itens, new Date(2026, 10, 23, 9), cfg), null); // 23/11: fora
  const p = previaProximoMes(itens, new Date(2026, 10, 24, 9), cfg); // 24/11: últimos 7 dias
  assert.equal(p.mes, 12);
  assert.deepEqual(p.avisos.map((x) => x.nome), ['Ana']); // aviso da Ana: 12/12 (sáb) → 11/12
  assert.equal(p.avisos[0].data, '2026-12-11');
  assert.deepEqual(p.pagamentos.map((x) => x.nome), []); // pagamento da Joana é em novembro
  const dez = previaProximoMes(itens, new Date(2026, 11, 31, 9), cfg); // virada de ano
  assert.equal(dez.ano, 2027);
  assert.equal(dez.mes, 1);
  assert.deepEqual(dez.pagamentos.map((x) => x.nome), ['Ana']); // 09/01 sáb → 08/01
  assert.equal(previaProximoMes(itens, new Date(2026, 10, 30, 9), { ...cfg, feriasPreviaDias: 0 }), null);
});
