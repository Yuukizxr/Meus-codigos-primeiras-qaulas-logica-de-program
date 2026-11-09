// Leitura e gravação dos dados.
//
// Dois modos, com o mesmo resto do código:
//  - APP (Tauri, .exe): %APPDATA%\painel-rh\dados.json + backups, gravados pelo Rust.
//  - NAVEGADOR (PainelRH.html aberto no Edge/Chrome):
//      * cópia sempre salva dentro do navegador (IndexedDB), para nada se perder;
//      * e, depois que você escolhe uma pasta, o dados.json + backups/ ficam nessa pasta.
//    O navegador pode pedir um clique para reautorizar a pasta ao abrir (regra de segurança dele).
import { carimbo } from './dados.js';

const core = globalThis.__TAURI__?.core;
export const modo = core ? 'app' : 'navegador';

const ARQUIVO = 'dados.json';
const PASTA_BACKUPS = 'backups';
const MANTER_BACKUPS = 14;
const RE_BACKUP = /^dados-\d{4}-\d{2}-\d{2}\.json$/;

/* ---------------- IndexedDB mínimo (chave/valor) ---------------- */

let bancoPromessa = null;
function banco() {
  if (!bancoPromessa) {
    bancoPromessa = new Promise((ok, erro) => {
      const req = indexedDB.open('painel-rh', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => ok(req.result);
      req.onerror = () => erro(req.error);
    });
  }
  return bancoPromessa;
}
async function kv(operacao, chave, valor) {
  const db = await banco();
  return new Promise((ok, erro) => {
    const tx = db.transaction('kv', operacao === 'get' ? 'readonly' : 'readwrite');
    const st = tx.objectStore('kv');
    const req = operacao === 'get' ? st.get(chave) : st.put(valor, chave);
    req.onsuccess = () => ok(req.result);
    req.onerror = () => erro(req.error);
  });
}

/* ---------------- Pasta escolhida (File System Access) ---------------- */

let pasta = null; // FileSystemDirectoryHandle
let pastaLiberada = false;

/** 'app' | 'sem-suporte' | 'nao-escolhida' | 'precisa-permissao' | 'conectada' */
export function estadoPasta() {
  if (modo === 'app') return 'app';
  if (typeof globalThis.showDirectoryPicker !== 'function') return 'sem-suporte';
  if (!pasta) return 'nao-escolhida';
  return pastaLiberada ? 'conectada' : 'precisa-permissao';
}

export function nomePasta() {
  return pasta ? pasta.name : null;
}

async function lerTexto(dir, nome) {
  try {
    const fh = await dir.getFileHandle(nome);
    return await (await fh.getFile()).text();
  } catch (e) {
    if (e && e.name === 'NotFoundError') return null;
    throw e;
  }
}

/** createWritable grava num arquivo temporário e só substitui ao fechar (não corrompe). */
async function escreverTexto(dir, nome, texto) {
  const fh = await dir.getFileHandle(nome, { create: true });
  const w = await fh.createWritable();
  await w.write(texto);
  await w.close();
}

/** Mesmo comportamento do app: um backup por dia (estado do início do dia), mantém 14. */
async function backupNaPasta(hoje) {
  const atual = await lerTexto(pasta, ARQUIVO);
  if (atual == null) return;
  const dir = await pasta.getDirectoryHandle(PASTA_BACKUPS, { create: true });
  const nome = `dados-${hoje}.json`;
  if ((await lerTexto(dir, nome)) == null) await escreverTexto(dir, nome, atual);
  const nomes = [];
  for await (const [n, h] of dir.entries()) if (h.kind === 'file' && RE_BACKUP.test(n)) nomes.push(n);
  nomes.sort();
  for (const n of nomes.slice(0, Math.max(0, nomes.length - MANTER_BACKUPS))) await dir.removeEntry(n);
}

async function verificarPermissao(pedir) {
  if (!pasta) return false;
  const opcoes = { mode: 'readwrite' };
  let estado = await pasta.queryPermission(opcoes);
  if (estado === 'prompt' && pedir) estado = await pasta.requestPermission(opcoes);
  pastaLiberada = estado === 'granted';
  return pastaLiberada;
}

/**
 * Escolhe (ou reautoriza) a pasta. Precisa ser chamado a partir de um clique.
 * @param {boolean} trocar  true = abrir o seletor mesmo se já houver pasta
 */
export async function conectarPasta(trocar = false) {
  if (trocar || !pasta) {
    pasta = await globalThis.showDirectoryPicker({ id: 'painel-rh', mode: 'readwrite', startIn: 'documents' });
    await kv('put', 'pasta', pasta);
  }
  return verificarPermissao(true);
}

/* ---------------- API usada pelo painel ---------------- */

const analisar = (texto) => (texto == null || texto.trim() === '' ? null : JSON.parse(texto));

/**
 * Lê os dados. Lança erro se o arquivo existir mas estiver corrompido.
 * No navegador, entre a cópia interna e o arquivo da pasta, usa o mais recente.
 */
export async function carregar(hoje) {
  if (core) {
    const dados = analisar(await core.invoke('ler_dados'));
    // backup só depois de confirmar que o arquivo é válido (um arquivo estragado nunca vira backup)
    if (dados) await core.invoke('backup_diario', { hoje });
    return dados;
  }
  try { await navigator.storage?.persist?.(); } catch { /* sem problema */ }
  const local = analisar(await kv('get', 'dados'));
  if (!pasta) {
    // Se o navegador não conseguir lembrar a pasta, só pede para escolher de novo (não trava).
    try { pasta = (await kv('get', 'pasta')) || null; } catch { pasta = null; }
  }
  if (!(await verificarPermissao(false).catch(() => false))) return local;
  const arquivo = analisar(await lerTexto(pasta, ARQUIVO));
  if (arquivo) await backupNaPasta(hoje);
  if (!arquivo) return local;
  if (!local) return arquivo;
  return (local.salvoEm || '') > (arquivo.salvoEm || '') ? local : arquivo;
}

let fila = Promise.resolve();

/** Grava os dados (as gravações saem em fila, uma de cada vez). */
export function salvar(dados, hoje) {
  dados.salvoEm = carimbo();
  const conteudo = JSON.stringify(dados, null, 2);
  const tarefa = fila.catch(() => {}).then(async () => {
    if (core) return core.invoke('salvar_dados', { conteudo, hoje });
    await kv('put', 'dados', conteudo);
    if (pasta && pastaLiberada) {
      await backupNaPasta(hoje);
      await escreverTexto(pasta, ARQUIVO, conteudo);
    }
  });
  fila = tarefa;
  return tarefa;
}

export async function backupDiario(hoje) {
  if (core) return core.invoke('backup_diario', { hoje });
  if (pasta && pastaLiberada) return backupNaPasta(hoje);
}

/** Texto para mostrar onde os dados estão. */
export async function pastaDados() {
  if (core) return core.invoke('pasta_dados');
  const estado = estadoPasta();
  if (estado === 'conectada') return `Pasta "${pasta.name}" (escolhida por você)`;
  if (estado === 'precisa-permissao') return `Pasta "${pasta.name}" — aguardando autorização`;
  if (estado === 'sem-suporte') return 'Só dentro do navegador (use o Microsoft Edge ou o Google Chrome para salvar em pasta)';
  return 'Só dentro do navegador (nenhuma pasta escolhida ainda)';
}
