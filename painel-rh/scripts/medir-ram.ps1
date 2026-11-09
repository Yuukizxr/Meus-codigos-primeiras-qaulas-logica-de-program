<#
  Mede a memória e a CPU do Painel RH (app + processos do WebView2).

  Uso no seu PC (com o app JÁ aberto e parado há pelo menos 30 s):
    1. Clique com o botão direito em medir-ram.ps1 > "Executar com o PowerShell"
       ou, no PowerShell:  powershell -ExecutionPolicy Bypass -File .\medir-ram.ps1

  Se o app não estiver aberto, informe o .exe:  .\medir-ram.ps1 -Exe "C:\caminho\painel-rh.exe"
  Versão HTML (abre um Edge separado só com o painel e mede ele inteiro):
    .\medir-ram.ps1 -Html "C:\caminho\PainelRH.html"
  (Para a aba do painel no seu Edge do dia a dia, use o Gerenciador de Tarefas do Edge: Shift+Esc.)
  "Memória" = conjunto de trabalho privado, o mesmo número da coluna Memória do Gerenciador de Tarefas.
#>
param(
  [string]$Exe = "",
  [string]$Html = "",
  [int]$Espera = 30,      # segundos parado antes de medir (só quando o script abre o app)
  [int]$JanelaCpu = 60,   # segundos observando a CPU
  [switch]$Fechar         # fecha o app no fim (usado na automação)
)
$ErrorActionPreference = 'Stop'

if ($Html) {
  $edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
  if (-not (Test-Path $edge)) { $edge = "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe" }
  $perfil = Join-Path $env:TEMP ("painel-rh-edge-" + (Get-Random))
  $arquivo = (Resolve-Path $Html).Path
  $app = Start-Process -FilePath $edge -ArgumentList "--app=`"file:///$($arquivo -replace '\\','/')`"", "--user-data-dir=`"$perfil`"", "--no-first-run", "--no-default-browser-check" -PassThru
  Write-Host "Edge iniciado só com o painel (PID $($app.Id)). Aguardando $Espera s parado..."
  Start-Sleep -Seconds $Espera
} else {
  $app = Get-Process -Name 'painel-rh' -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $app) {
    if (-not $Exe) { Write-Host "O Painel RH não está aberto. Abra o app ou use -Exe / -Html."; exit 1 }
    $app = Start-Process -FilePath $Exe -PassThru
    Write-Host "App iniciado (PID $($app.Id)). Aguardando $Espera s parado..."
    Start-Sleep -Seconds $Espera
  }
}

function Get-Arvore([int]$raiz) {
  $todos = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId
  $ids = New-Object System.Collections.Generic.List[int]
  $ids.Add($raiz)
  $i = 0
  while ($i -lt $ids.Count) {
    foreach ($p in $todos) {
      if ($p.ParentProcessId -eq $ids[$i] -and -not $ids.Contains([int]$p.ProcessId)) { $ids.Add([int]$p.ProcessId) }
    }
    $i++
  }
  return $ids
}

$ids = Get-Arvore $app.Id
$perf = Get-CimInstance Win32_PerfRawData_PerfProc_Process | Where-Object { $ids -contains [int]$_.IDProcess }
$procs = Get-Process -Id $ids -ErrorAction SilentlyContinue

$linhas = foreach ($p in $procs) {
  $pp = $perf | Where-Object { [int]$_.IDProcess -eq $p.Id } | Select-Object -First 1
  [pscustomobject]@{
    Processo          = $p.ProcessName
    PID               = $p.Id
    'Memória (MB)'    = [math]::Round(($pp.WorkingSetPrivate) / 1MB, 1)
    'WorkingSet (MB)' = [math]::Round($p.WorkingSet64 / 1MB, 1)
    'Privada (MB)'    = [math]::Round($p.PrivateMemorySize64 / 1MB, 1)
  }
}
$linhas | Format-Table -AutoSize | Out-String | Write-Host

$memoria = ($linhas | Measure-Object 'Memória (MB)' -Sum).Sum
$ws      = ($linhas | Measure-Object 'WorkingSet (MB)' -Sum).Sum
$priv    = ($linhas | Measure-Object 'Privada (MB)' -Sum).Sum

function Get-CpuMs { param($lista) $t = 0; foreach ($id in $lista) { $p = Get-Process -Id $id -ErrorAction SilentlyContinue; if ($p) { $t += $p.TotalProcessorTime.TotalMilliseconds } }; return $t }
$c0 = Get-CpuMs $ids
Start-Sleep -Seconds $JanelaCpu
$c1 = Get-CpuMs $ids
$nucleos = [Environment]::ProcessorCount
$cpu = [math]::Round(($c1 - $c0) / ($JanelaCpu * 1000 * $nucleos) * 100, 2)

Write-Host ("Processos medidos: {0}" -f $linhas.Count)
Write-Host ("MEMÓRIA TOTAL (como no Gerenciador de Tarefas): {0:N1} MB" -f $memoria)
Write-Host ("  Working set total (inclui partes compartilhadas): {0:N1} MB" -f $ws)
Write-Host ("  Memória privada comprometida: {0:N1} MB" -f $priv)
Write-Host ("CPU parado em {0} s: {1}% (média sobre {2} núcleos)" -f $JanelaCpu, $cpu, $nucleos)
if ($memoria -gt 150) { Write-Host "ATENÇÃO: acima da meta de 150 MB." } else { Write-Host "Dentro da meta de 150 MB." }

if ($Fechar) { foreach ($id in $ids) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue } }
