// Sem janela de console no Windows (versão final).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod armazenamento;

use std::path::PathBuf;
use tauri::{Manager, State};

/// Pasta dos dados: %APPDATA%\painel-rh no Windows.
struct Pasta(PathBuf);

#[tauri::command]
fn ler_dados(pasta: State<Pasta>) -> Result<Option<String>, String> {
    armazenamento::ler(&pasta.0)
}

/// Antes de gravar, garante o backup do dia (estado do início do dia).
#[tauri::command]
fn salvar_dados(pasta: State<Pasta>, conteudo: String, hoje: String) -> Result<(), String> {
    armazenamento::backup_diario(&pasta.0, &hoje)?;
    armazenamento::salvar(&pasta.0, &conteudo)
}

#[tauri::command]
fn backup_diario(pasta: State<Pasta>, hoje: String) -> Result<(), String> {
    armazenamento::backup_diario(&pasta.0, &hoje).map(|_| ())
}

#[tauri::command]
fn pasta_dados(pasta: State<Pasta>) -> String {
    pasta.0.display().to_string()
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let pasta = app.path().data_dir()?.join("painel-rh");
            std::fs::create_dir_all(pasta.join(armazenamento::PASTA_BACKUPS))?;
            app.manage(Pasta(pasta));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![ler_dados, salvar_dados, backup_diario, pasta_dados])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Painel RH");
}
