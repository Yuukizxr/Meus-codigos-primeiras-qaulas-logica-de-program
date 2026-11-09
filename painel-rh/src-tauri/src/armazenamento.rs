//! Leitura, gravação segura e backup diário do arquivo de dados.
//! Tudo fica em uma pasta local; nada é enviado para a internet.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

pub const ARQUIVO: &str = "dados.json";
pub const PASTA_BACKUPS: &str = "backups";
pub const MANTER_BACKUPS: usize = 14;

/// Aceita só "AAAA-MM-DD" (a data vem do relógio local, calculada no JS).
pub fn data_valida(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 10
        && b[4] == b'-'
        && b[7] == b'-'
        && b.iter().enumerate().all(|(i, c)| i == 4 || i == 7 || c.is_ascii_digit())
}

pub fn ler(pasta: &Path) -> Result<Option<String>, String> {
    let caminho = pasta.join(ARQUIVO);
    match fs::read_to_string(&caminho) {
        Ok(s) => Ok(Some(s)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Não foi possível ler {}: {e}", caminho.display())),
    }
}

/// Grava em arquivo temporário e renomeia por cima (não corrompe se faltar energia no meio).
pub fn salvar(pasta: &Path, conteudo: &str) -> Result<(), String> {
    fs::create_dir_all(pasta).map_err(|e| e.to_string())?;
    let tmp = pasta.join(format!("{ARQUIVO}.tmp"));
    let destino = pasta.join(ARQUIVO);
    {
        let mut f = fs::File::create(&tmp).map_err(|e| format!("Erro ao gravar: {e}"))?;
        f.write_all(conteudo.as_bytes()).map_err(|e| format!("Erro ao gravar: {e}"))?;
        f.sync_all().map_err(|e| format!("Erro ao gravar: {e}"))?;
    }
    fs::rename(&tmp, &destino).map_err(|e| format!("Erro ao gravar: {e}"))
}

fn nome_backup(dia: &str) -> String {
    format!("dados-{dia}.json")
}

/// Se ainda não existe backup de hoje, copia o dados.json atual. Mantém só os 14 mais recentes.
pub fn backup_diario(pasta: &Path, hoje: &str) -> Result<Option<PathBuf>, String> {
    if !data_valida(hoje) {
        return Err(format!("Data inválida: {hoje}"));
    }
    let origem = pasta.join(ARQUIVO);
    if !origem.exists() {
        return Ok(None);
    }
    let dir = pasta.join(PASTA_BACKUPS);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let destino = dir.join(nome_backup(hoje));
    let mut criado = None;
    if !destino.exists() {
        fs::copy(&origem, &destino).map_err(|e| format!("Erro no backup: {e}"))?;
        criado = Some(destino);
    }
    podar(&dir)?;
    Ok(criado)
}

/// Remove os backups mais antigos, deixando MANTER_BACKUPS.
fn podar(dir: &Path) -> Result<(), String> {
    let mut nomes: Vec<String> = fs::read_dir(dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter_map(|e| e.file_name().into_string().ok())
        .filter(|n| {
            n.len() == "dados-AAAA-MM-DD.json".len()
                && n.starts_with("dados-")
                && n.ends_with(".json")
                && data_valida(&n[6..16])
        })
        .collect();
    nomes.sort(); // AAAA-MM-DD ordena cronologicamente
    if nomes.len() > MANTER_BACKUPS {
        for n in &nomes[..nomes.len() - MANTER_BACKUPS] {
            let _ = fs::remove_file(dir.join(n));
        }
    }
    Ok(())
}

#[cfg(test)]
mod testes {
    use super::*;

    fn pasta_temp(nome: &str) -> PathBuf {
        let p = std::env::temp_dir().join(format!("painel-rh-teste-{nome}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&p);
        fs::create_dir_all(&p).unwrap();
        p
    }

    #[test]
    fn valida_data() {
        assert!(data_valida("2026-11-09"));
        assert!(!data_valida("2026-1-09"));
        assert!(!data_valida("../../x/y"));
    }

    #[test]
    fn salva_e_le() {
        let p = pasta_temp("salva");
        assert_eq!(ler(&p).unwrap(), None);
        salvar(&p, "{\"a\":1}").unwrap();
        salvar(&p, "{\"a\":2}").unwrap();
        assert_eq!(ler(&p).unwrap().as_deref(), Some("{\"a\":2}"));
        assert!(!p.join("dados.json.tmp").exists());
    }

    #[test]
    fn backup_uma_vez_por_dia_e_mantem_14() {
        let p = pasta_temp("backup");
        assert_eq!(backup_diario(&p, "2026-11-01").unwrap(), None); // sem dados ainda
        salvar(&p, "v1").unwrap();
        assert!(backup_diario(&p, "2026-11-01").unwrap().is_some());
        salvar(&p, "v2").unwrap();
        assert!(backup_diario(&p, "2026-11-01").unwrap().is_none()); // já existe o de hoje
        let b = fs::read_to_string(p.join("backups/dados-2026-11-01.json")).unwrap();
        assert_eq!(b, "v1");
        for d in 2..=20 {
            backup_diario(&p, &format!("2026-11-{d:02}")).unwrap();
        }
        let mut nomes: Vec<_> = fs::read_dir(p.join("backups"))
            .unwrap()
            .map(|e| e.unwrap().file_name().into_string().unwrap())
            .collect();
        nomes.sort();
        assert_eq!(nomes.len(), 14);
        assert_eq!(nomes.first().unwrap(), "dados-2026-11-07.json");
        assert_eq!(nomes.last().unwrap(), "dados-2026-11-20.json");
    }
}
