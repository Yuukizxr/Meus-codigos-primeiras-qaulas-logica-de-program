# Painel RH

Painel leve e **100% local** para controlar prazos de **rescisões** e **férias**.
Não calcula valores (isso fica no Linx People): só datas, prazos e alertas.
Sem internet, sem telemetria, sem login. O nome do painel pode ser trocado em Configurações.

## Como abrir

**Recomendado — `PainelRH.html`:** baixe em *Releases* e dê dois cliques (abre no Microsoft Edge).
É um único arquivo com tudo dentro (fontes, ícones, código). Não instala nada e não é barrado
pelo Controle Inteligente de Aplicativos do Windows. Dica: no Edge, menu `…` → *Aplicativos* →
*Instalar este site como aplicativo* para ele abrir numa janela própria, com atalho.

Na primeira vez, clique em **Escolher pasta de dados** (no pé da barra lateral; ex.: `Documentos\PainelRH`). O painel grava ali:
- `dados.json` — todos os dados;
- `backups\dados-AAAA-MM-DD.json` — uma cópia por dia, ficam as 14 mais recentes.

Uma cópia também fica guardada dentro do próprio navegador. Por segurança, o Edge pode pedir
**um clique para autorizar a pasta** ao abrir o painel; até lá, nada se perde (fica na cópia interna).

**Alternativa — aplicativo (`.exe`):** `Painel RH_x64-setup.exe` (instalador) ou `PainelRH-portatil.exe`.
Os dados ficam em `%APPDATA%\painel-rh`. Sem assinatura digital paga, o Windows pode avisar ou barrar.

## Já tem férias/rescisões numa planilha?

Em Férias ou Rescisões, clique em **Importar do Excel**: selecione as linhas no Excel (pode incluir o cabeçalho),
copie, cole na caixa e confira a prévia. Também abre arquivos `.csv`. Linhas com erro aparecem em vermelho e
repetidas são ignoradas.
- Férias: **Nome · Início · Dias** (opcional) · **Status** (opcional: pendente, avisado, solicitado, pago)
- Rescisões: **Nome · Data da carta · Tipo** (trabalhado/indenizado) · **Dias de aviso** · **Status** (opcionais)

## Visões

Cada módulo tem **Cards** (completo, com edição), **Quadro** (colunas por status — arraste para mudar o status)
e **Tabela** (todas as datas lado a lado; clique no título para ordenar), mais busca por nome e filtros
rápidos (Atrasados, Próximos 7 dias, Próximos 30 dias).

## Regras (todas em Configurações, com o botão **?** explicando cada uma)

**Rescisões:** início do aviso = data da carta; fim = início + 30 dias (ou os dias que a pessoa vai cumprir,
informados no cadastro/card); indenizado = desligamento na carta;
lançar no Linx = fim/desligamento + 0 dias; pagamento = fim/desligamento + 10 dias corridos.
Status: Pendente → Solicitada → Paga.

**Férias:** aviso 30 dias antes do início; **pagar em** uma data exata, 2 dias úteis antes do início
(sábado, domingo e feriado não contam; ex.: início terça 01/12/2026 → pagar sexta 27/11); alerta quando o início cai nos 2 dias antes de
feriado ou domingo (CLT art. 134 §3º); na última semana do mês, prévia dos avisos e pagamentos do mês seguinte.
Status: Pendente → Avisado → Solicitado → Pago.

**Alertas** (faixa "Hoje", sobre a data segura): amarelo = faltam até 3 dias; laranja = hoje, com contagem
regressiva até 12:00; vermelho = passou. Vermelho fica fixo no topo e não pode ser dispensado.
Quando um prazo cai em fim de semana/feriado, o card mostra o selo 🛡 com o dia útil anterior.

## Medir a RAM

- Versão HTML no seu Edge: `Shift+Esc` abre o Gerenciador de Tarefas do Edge, com a memória da aba.
- `scripts/medir-ram.ps1` mede o `.exe` aberto, ou `-Html PainelRH.html` (abre um Edge separado só com o painel).

## Para desenvolvedores

```
npm ci
npm test               # testes das regras de data, rescisões, férias e configurações (node:test)
npm run build:html     # gera dist/PainelRH.html (esbuild só na geração; o app não usa bibliotecas)
cargo test --manifest-path src-tauri/Cargo.toml   # gravação e backup do .exe
npx tauri build        # gera o .exe e o instalador (no Windows)
```

```
src/
  index.html, css/ (fontes, temas, base, animacoes), fonts/ (OFL)
  js/datas.js        datas "AAAA-MM-DD" em horário local (sem UTC)
  js/calendario.js   Páscoa, feriados, dia útil, data segura
  js/alertas.js      níveis de alerta
  js/relogio.js      um único timer: minuto, virada do dia, volta da suspensão
  js/store.js        dados: .exe (Rust) ou navegador (IndexedDB + pasta escolhida)
  js/componentes.js  peças de interface compartilhadas
  js/modulos/        rescisoes/, ferias/, lista.js (cards/quadro/tabela) e _modelo/ (esqueleto)
  js/importar.js     importação do Excel/CSV (leitura testável + tela de prévia)
  js/telas/          feriados e configurações
src-tauri/           versão .exe (Rust: ler, salvar, backup)
tests/               testes
```

Esqueletos para as próximas etapas: `js/modulos/_modelo/` (novo módulo, ex.: lembretes mensais),
`TEMAS` em `js/dados.js` + `css/temas.css` (novos temas), `ESQUEMA` em `js/dados.js` (novas configurações),
e o atributo `data-animacoes` (base do "modo leve").

## Licenças

Código: [MIT](../LICENSE). Fonte Nunito: SIL Open Font License (`src/fonts/OFL-nunito.txt`).
