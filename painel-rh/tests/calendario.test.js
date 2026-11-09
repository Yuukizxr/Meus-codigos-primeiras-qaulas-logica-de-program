import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pascoa, feriadosNacionais, criarCalendario } from '../src/js/calendario.js';

test('Páscoa', () => {
  assert.equal(pascoa(2024), '2024-03-31');
  assert.equal(pascoa(2025), '2025-04-20');
  assert.equal(pascoa(2026), '2026-04-05');
  assert.equal(pascoa(2027), '2027-03-28');
});

test('feriados móveis 2026', () => {
  const datas = feriadosNacionais(2026).map((f) => f.data);
  for (const d of ['2026-02-16', '2026-02-17', '2026-04-03', '2026-06-04']) assert.ok(datas.includes(d), d);
});

test('feriados móveis 2027', () => {
  const datas = feriadosNacionais(2027).map((f) => f.data);
  for (const d of ['2027-02-08', '2027-02-09', '2027-03-26', '2027-05-27']) assert.ok(datas.includes(d), d);
});

test('feriados fixos incluem 20/11 e são 13 por ano, em ordem', () => {
  for (const ano of [2026, 2027]) {
    const lista = feriadosNacionais(ano);
    assert.equal(lista.length, 13);
    assert.ok(lista.some((f) => f.data === `${ano}-11-20`));
    const datas = lista.map((f) => f.data);
    assert.deepEqual(datas, [...datas].sort());
  }
});

const cal = criarCalendario({ sabadoUtil: false });

test('fim de semana não é dia útil (padrão)', () => {
  assert.equal(cal.ehDiaUtil('2026-11-21'), false); // sábado
  assert.equal(cal.ehDiaUtil('2026-11-22'), false); // domingo
  assert.equal(cal.ehDiaUtil('2026-11-23'), true); // segunda
  assert.equal(cal.motivoNaoUtil('2026-11-21'), 'sábado');
});

test('sábado útil quando configurado', () => {
  const c = criarCalendario({ sabadoUtil: true });
  assert.equal(c.ehDiaUtil('2026-11-21'), true);
  assert.equal(c.ehDiaUtil('2026-11-22'), false);
  assert.equal(c.dataSegura('2026-11-21'), null);
  assert.equal(c.dataSegura('2026-11-22'), '2026-11-21');
});

test('dia útil anterior pula fim de semana + feriado (20/11 sexta)', () => {
  assert.equal(cal.diaUtilAnterior('2026-11-23'), '2026-11-19'); // seg -> dom, sáb, 20/11 -> qui
  assert.equal(cal.dataSegura('2026-11-21'), '2026-11-19');
  assert.equal(cal.dataSegura('2026-11-20'), '2026-11-19');
});

test('dia útil anterior: Natal, Ano-Novo, Carnaval, Sexta-feira Santa', () => {
  assert.equal(cal.dataSegura('2026-12-27'), '2026-12-24'); // dom -> sáb, 25 (sex, Natal) -> 24
  assert.equal(cal.dataSegura('2027-01-02'), '2026-12-31'); // sáb -> 01/01 (sex) -> 31/12
  assert.equal(cal.dataSegura('2026-02-17'), '2026-02-13'); // terça de Carnaval -> sexta
  assert.equal(cal.dataSegura('2026-04-03'), '2026-04-02'); // Sexta-feira Santa -> quinta
  assert.equal(cal.dataSegura('2027-03-26'), '2027-03-25');
});

test('dia útil não tem data segura', () => {
  assert.equal(cal.dataSegura('2026-11-19'), null);
});

test('feriado municipal e ponto facultativo', () => {
  const c = criarCalendario({ sabadoUtil: false }, [
    { data: '2026-11-19', nome: 'Aniversário da cidade', tipo: 'municipal' },
    { data: '2026-11-18', nome: 'Ponto facultativo A', tipo: 'facultativo', naoUtil: true },
    { data: '2026-11-17', nome: 'Ponto facultativo B', tipo: 'facultativo', naoUtil: false },
  ]);
  assert.equal(c.ehDiaUtil('2026-11-19'), false);
  assert.equal(c.ehDiaUtil('2026-11-18'), false);
  assert.equal(c.ehDiaUtil('2026-11-17'), true); // facultativo que não conta
  assert.equal(c.dataSegura('2026-11-21'), '2026-11-17');
  assert.equal(c.motivoNaoUtil('2026-11-19'), 'Aniversário da cidade');
});
