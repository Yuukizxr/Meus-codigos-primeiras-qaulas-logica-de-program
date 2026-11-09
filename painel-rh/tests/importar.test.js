import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerTabela, lerData, interpretar, lerStatus, normalizar } from '../src/js/importar.js';

test('lê datas em vários formatos', () => {
  assert.equal(lerData('01/12/2026'), '2026-12-01');
  assert.equal(lerData('1/2/26'), '2026-02-01');
  assert.equal(lerData('05-01-2027'), '2027-01-05');
  assert.equal(lerData('05.01.2027'), '2027-01-05');
  assert.equal(lerData('2026-12-01'), '2026-12-01');
  assert.equal(lerData('31/02/2026'), null);
  assert.equal(lerData('amanhã'), null);
});

test('detecta separador: TAB (Excel), ponto e vírgula e vírgula', () => {
  assert.deepEqual(lerTabela('a\tb\n1\t2'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(lerTabela('a;b\r\n1;2\n\n'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(lerTabela('"a","b"\n1,2'), [['a', 'b'], ['1', '2']]);
});

test('status escrito livremente', () => {
  const mapa = { avisado: ['avisado', 'aviso entregue'], pago: ['pago'] };
  assert.deepEqual(lerStatus('Aviso Entregue', mapa), { status: 'avisado' });
  assert.deepEqual(lerStatus('', mapa), { status: undefined });
  assert.ok(lerStatus('talvez', mapa).erro);
});

const DEF = {
  colunas: [
    { campo: 'nome', titulo: 'Nome', obrigatorio: true, nomes: ['nome', 'funcionario'] },
    { campo: 'inicio', titulo: 'Início', obrigatorio: true, nomes: ['inicio', 'data inicio'] },
    { campo: 'dias', titulo: 'Dias', nomes: ['dias'] },
  ],
  converter: (v) => {
    const inicio = lerData(v.inicio);
    if (!inicio) return { erro: `Data inválida: "${v.inicio}"` };
    return { registro: { nome: v.nome.trim(), inicio, dias: v.dias ? +v.dias : 30 } };
  },
  chave: (r) => `${normalizar(r.nome)}|${r.inicio}`,
};

test('com cabeçalho em outra ordem e com acento', () => {
  const r = interpretar('Dias\tFuncionário\tData Início\n20\tMaria\t01/12/2026\n\tJoão\t11/01/2027', DEF);
  assert.equal(r.cabecalho, true);
  assert.deepEqual(r.linhas.map((l) => l.registro), [
    { nome: 'Maria', inicio: '2026-12-01', dias: 20 },
    { nome: 'João', inicio: '2027-01-11', dias: 30 },
  ]);
});

test('sem cabeçalho: usa a ordem das colunas', () => {
  const r = interpretar('Maria;01/12/2026;15', DEF);
  assert.equal(r.cabecalho, false);
  assert.deepEqual(r.linhas[0].registro, { nome: 'Maria', inicio: '2026-12-01', dias: 15 });
});

test('erros, repetidos na lista e já existentes no painel', () => {
  const existentes = new Set(['ana|2026-12-01']);
  const r = interpretar('Nome\tInício\nAna\t01/12/2026\nBia\t40/12/2026\nCaio\t02/12/2026\ncaio\t02/12/2026\n\t03/12/2026', DEF, existentes);
  assert.equal(r.linhas[0].repetido, 'Já está no painel');
  assert.match(r.linhas[1].erro, /Data inválida/);
  assert.equal(r.linhas[2].registro.nome, 'Caio');
  assert.equal(r.linhas[3].repetido, 'Repetido na lista');
  assert.match(r.linhas[4].erro, /Falta: Nome/);
});

test('definições reais dos módulos (rescisões e férias)', async () => {
  globalThis.CSS = globalThis.CSS || { escape: (s) => s };
  const { default: resc } = await import('../src/js/modulos/rescisoes/index.js');
  const { default: fer } = await import('../src/js/modulos/ferias/index.js');
  const r = interpretar('Nome;Data da carta;Tipo;Dias de aviso;Status\nMaria;01/12/2026;Indenizado;;\nJoão;02/12/2026;trabalhado;15;solicitada\nZé;03/12/2026;demitido;;', resc.importacao);
  assert.equal(r.linhas[0].registro.tipo, 'indenizado');
  assert.equal(r.linhas[1].registro.diasAviso, 15);
  assert.equal(r.linhas[1].registro.status, 'solicitada');
  assert.match(r.linhas[2].erro, /Tipo desconhecido/);
  const f = interpretar('Nome\tInício\tDias\tStatus\nJoana\t01/12/2026\t30\taviso entregue\nRui\t28/12/2026\t\t', fer.importacao);
  assert.equal(f.linhas[0].registro.status, 'avisado');
  assert.equal(f.linhas[1].registro.status, 'pendente');
  assert.equal(f.linhas[1].registro.dias, undefined); // segue o padrão das Configurações
});
