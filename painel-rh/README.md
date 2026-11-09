# Painel RH — Etapa 1: Rescisões

Painel desktop leve e **100% local** para controlar datas, prazos e alertas de rescisões.
Não calcula valores (isso fica no Linx People). Sem internet, sem telemetria, sem CDN, sem login.

## Como abrir

**Opção 1 — instalador (recomendado):** baixe `Painel RH_0.1.0_x64-setup.exe` em *Releases*
(ou em *Actions → Painel RH - Windows → artefato `painel-rh-windows`*) e execute.
Instala só para o seu usuário, sem pedir administrador. Depois abra "Painel RH" pelo menu Iniciar.

**Opção 2 — portátil:** baixe `PainelRH-portatil.exe` e dê dois cliques. Não precisa instalar.

Requisito: WebView2, que já vem no Windows 11 e no Windows 10 atualizado.

## Onde ficam os dados

- `%APPDATA%\painel-rh\dados.json` — um único arquivo JSON.
- `%APPDATA%\painel-rh\backups\dados-AAAA-MM-DD.json` — backup automático uma vez por dia; ficam os 14 mais recentes.
- A gravação é segura (arquivo temporário + renomear), então uma queda de energia não corrompe o arquivo.
- Se o arquivo estiver ilegível, o painel avisa e **não grava nada** até você restaurar um backup.

## Regras (todas em Configurações)

| Regra | Padrão |
|---|---|
| Início do aviso | data da carta (editável no card) |
| Fim do aviso | início + 30 dias (editável) |
| Indenizado | sem aviso; desligamento = data da carta |
| Prazo para lançar no Linx | fim do aviso/desligamento + 0 dias |
| Prazo de pagamento | fim do aviso/desligamento + 10 dias corridos |
| Data segura | se o prazo cai em fim de semana/feriado, mostra o dia útil anterior |
| Horário limite no dia do prazo | 12:00 |
| Alerta amarelo | faltam até 3 dias |
| Sábado é dia útil | não |

Alertas (enquanto o status é **Pendente**; param em Solicitada/Paga), calculados sobre a data segura:
amarelo = faltam até N dias · laranja = é hoje, com contagem regressiva até o horário limite ·
vermelho = passou (ou é hoje e passou do horário limite). Vermelho fica fixo no topo e não pode ser dispensado.

Datas editadas à mão no card ficam marcadas como "editado" e têm o botão ↺ para voltar ao calculado.
As datas seguintes são recalculadas a partir delas.

## Medir a RAM no seu PC

Com o app aberto e parado há ~30 s: botão direito em `scripts/medir-ram.ps1` → *Executar com o PowerShell*
(ou `powershell -ExecutionPolicy Bypass -File .\medir-ram.ps1`). O número "MEMÓRIA TOTAL" soma o app e
todos os processos do WebView2, como na coluna Memória do Gerenciador de Tarefas.

## Para desenvolvedores

```
npm ci
npm test                                   # testes das funções de data (node:test, sem dependências)
cargo test --manifest-path src-tauri/Cargo.toml   # gravação e backup
npx tauri build                            # gera o .exe e o instalador (no Windows)
```

Estrutura:

```
src/                 interface (HTML/CSS/JS puro, sem framework)
  js/datas.js        datas "AAAA-MM-DD" em horário local (sem UTC)
  js/calendario.js   Páscoa, feriados nacionais, dia útil, data segura
  js/alertas.js      níveis de alerta (compartilhado pelos módulos)
  js/relogio.js      um único timer: minuto, virada do dia, volta da suspensão
  js/modulos/        um módulo por assunto (rescisoes/; etapa 2: ferias/)
  js/telas/          feriados e configurações
src-tauri/           Rust: ler, salvar e backup (sem plugins de rede)
tests/               testes das funções de data
scripts/             medição de RAM e dados de exemplo
```
