import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ehDataValida, somarDias, diasEntre, diaDaSemana, chaveDoDia, formatar,
  minutosDoHorario, formatarDuracao,
} from '../src/js/datas.js';
import { classificarTick, msAteProximoMinuto, SALTO_SUSPENSAO_MS } from '../src/js/relogio.js';

test('valida datas AAAA-MM-DD', () => {
  assert.equal(ehDataValida('2026-11-09'), true);
  assert.equal(ehDataValida('2028-02-29'), true); // bissexto
  assert.equal(ehDataValida('2026-02-29'), false);
  assert.equal(ehDataValida('2026-13-01'), false);
  assert.equal(ehDataValida('09/11/2026'), false);
  assert.equal(ehDataValida(''), false);
  assert.equal(ehDataValida(undefined), false);
});

test('soma dias corridos atravessando mês, ano e bissexto', () => {
  assert.equal(somarDias('2026-11-09', 30), '2026-12-09');
  assert.equal(somarDias('2026-12-31', 1), '2027-01-01');
  assert.equal(somarDias('2027-01-01', -1), '2026-12-31');
  assert.equal(somarDias('2026-01-31', 30), '2026-03-02');
  assert.equal(somarDias('2028-02-28', 1), '2028-02-29');
  assert.equal(somarDias('2026-02-28', 1), '2026-03-01');
  assert.equal(somarDias('2026-11-09', 0), '2026-11-09');
});

test('dias entre datas', () => {
  assert.equal(diasEntre('2026-11-09', '2026-11-12'), 3);
  assert.equal(diasEntre('2026-11-12', '2026-11-09'), -3);
  assert.equal(diasEntre('2026-12-31', '2027-01-01'), 1);
  assert.equal(diasEntre('2026-01-01', '2027-01-01'), 365);
});

test('dia da semana e fim de semana', () => {
  assert.equal(diaDaSemana('2026-11-09'), 1); // segunda
  assert.equal(diaDaSemana('2026-11-21'), 6); // sábado
  assert.equal(diaDaSemana('2026-11-22'), 0); // domingo
});

test('chave do dia usa horário LOCAL (23:59 e 00:00)', () => {
  assert.equal(chaveDoDia(new Date(2026, 10, 9, 23, 59, 59)), '2026-11-09');
  assert.equal(chaveDoDia(new Date(2026, 10, 10, 0, 0, 0)), '2026-11-10');
  assert.equal(chaveDoDia(new Date(2026, 11, 31, 23, 59)), '2026-12-31');
  assert.equal(chaveDoDia(new Date(2027, 0, 1, 0, 0)), '2027-01-01');
});

test('formatação e horários', () => {
  assert.equal(formatar('2026-11-09'), '09/11/2026');
  assert.equal(minutosDoHorario('12:00'), 720);
  assert.equal(minutosDoHorario('25:00'), null);
  assert.equal(formatarDuracao(135), '2h15min');
  assert.equal(formatarDuracao(40), '40min');
  assert.equal(formatarDuracao(120), '2h');
});

test('relógio: virada do dia', () => {
  const antes = new Date(2026, 10, 9, 23, 59, 30);
  const depois = new Date(2026, 10, 10, 0, 0, 30);
  const t = classificarTick({ ultimoMs: antes.getTime(), ultimoDia: '2026-11-09' }, depois);
  assert.equal(t.dia, '2026-11-10');
  assert.equal(t.viradaDia, true);
  assert.equal(t.voltouSuspensao, false);
});

test('relógio: mesmo dia não é virada; primeiro tick não é virada nem suspensão', () => {
  const a = new Date(2026, 10, 9, 10, 0, 0);
  const b = new Date(2026, 10, 9, 10, 1, 0);
  const t = classificarTick({ ultimoMs: a.getTime(), ultimoDia: '2026-11-09' }, b);
  assert.equal(t.viradaDia, false);
  assert.equal(t.voltouSuspensao, false);
  const p = classificarTick({ ultimoMs: null, ultimoDia: null }, a);
  assert.equal(p.viradaDia, false);
  assert.equal(p.voltouSuspensao, false);
});

test('relógio: volta da suspensão (salto de tempo) inclusive passando a meia-noite', () => {
  const a = new Date(2026, 10, 9, 18, 0, 0);
  const b = new Date(a.getTime() + SALTO_SUSPENSAO_MS + 1000);
  assert.equal(classificarTick({ ultimoMs: a.getTime(), ultimoDia: '2026-11-09' }, b).voltouSuspensao, true);
  const manha = new Date(2026, 10, 10, 8, 0, 0);
  const t = classificarTick({ ultimoMs: a.getTime(), ultimoDia: '2026-11-09' }, manha);
  assert.equal(t.voltouSuspensao, true);
  assert.equal(t.viradaDia, true);
});

test('relógio: espera até o início do próximo minuto', () => {
  assert.equal(msAteProximoMinuto(new Date(2026, 10, 9, 10, 0, 0, 0)), 60000);
  assert.equal(msAteProximoMinuto(new Date(2026, 10, 9, 10, 0, 59, 500)), 500);
});
