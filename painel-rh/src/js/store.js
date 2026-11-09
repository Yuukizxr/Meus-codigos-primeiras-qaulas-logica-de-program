// Leitura e gravação do arquivo de dados.
// No app (Tauri), os dados ficam em %APPDATA%\painel-rh\dados.json, com backup diário.
// Fora do app (abrir index.html num navegador, só para desenvolvimento), usa o localStorage.
const core = globalThis.__TAURI__?.core;
const CHAVE_LOCAL = 'painel-rh-dados';

export const noApp = Boolean(core);

/**
 * Lê os dados. Lança erro se o arquivo existir mas estiver corrompido.
 * O backup do dia só é feito depois de confirmar que o arquivo é válido
 * (assim um arquivo estragado nunca substitui os backups bons).
 */
export async function carregar(hoje) {
  const texto = core ? await core.invoke('ler_dados') : globalThis.localStorage?.getItem(CHAVE_LOCAL) ?? null;
  if (texto == null || texto.trim() === '') return null;
  const dados = JSON.parse(texto);
  if (core) await core.invoke('backup_diario', { hoje });
  return dados;
}

let fila = Promise.resolve();

/** Grava os dados (as gravações saem em fila, uma de cada vez). */
export function salvar(dados, hoje) {
  const conteudo = JSON.stringify(dados, null, 2);
  const tarefa = fila.catch(() => {}).then(() => {
    if (core) return core.invoke('salvar_dados', { conteudo, hoje });
    globalThis.localStorage?.setItem(CHAVE_LOCAL, conteudo);
  });
  fila = tarefa;
  return tarefa;
}

export async function backupDiario(hoje) {
  if (core) await core.invoke('backup_diario', { hoje });
}

export async function pastaDados() {
  return core ? core.invoke('pasta_dados') : '(modo navegador: dados no localStorage)';
}
