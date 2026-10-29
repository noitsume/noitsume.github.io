[CmdletBinding()]
param(
    [ValidateSet('Once', 'Watch', 'Start', 'Stop', 'Status')]
    [string]$Mode = 'Once',
    [ValidateRange(30, 86400)]
    [int]$IntervalSeconds = 300,
    [ValidatePattern('^[a-z0-9][a-z0-9._/@:-]+$')]
    [string]$Image = 'hwrdfarr/kenangin:latest',
    [switch]$ReplaceDevelopment,
    [string]$ProjectDirectory = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($ProjectDirectory)) { $ProjectDirectory = Split-Path -Parent $PSScriptRoot }
$root = (Resolve-Path -LiteralPath $ProjectDirectory).Path
$stateDirectory = Join-Path $root 'tmp/local-cd'
$null = New-Item -ItemType Directory -Path $stateDirectory -Force
$workerFile = Join-Path $stateDirectory 'worker.json'
$stopFile = Join-Path $stateDirectory 'stop.request'
$deploymentFile = Join-Path $stateDirectory 'deployment.json'
$eventFile = Join-Path $stateDirectory 'events.jsonl'
$composeFile = Join-Path $root 'compose.deploy.yaml'
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Write-Log([string]$Message) {
    Write-Host ('[{0}] {1}' -f [DateTimeOffset]::Now.ToString('s'), $Message)
}

function Write-Event([string]$Event, [string]$ImageId, [string]$Revision = '') {
    $record = [ordered]@{ time = [DateTimeOffset]::Now.ToString('o'); event = $Event; imageId = $ImageId; revision = $Revision }
    [IO.File]::AppendAllText($eventFile, (($record | ConvertTo-Json -Compress) + [Environment]::NewLine), $utf8)
}

function Get-Worker {
    if (-not (Test-Path -LiteralPath $workerFile)) { return $null }
    $worker = Get-Content -LiteralPath $workerFile -Raw | ConvertFrom-Json
    $process = Get-Process -Id $worker.pid -ErrorAction SilentlyContinue
    # PID alone may have been reused after a restart.
    if ($process -and $process.StartTime.ToUniversalTime().Ticks.ToString() -eq $worker.startTicks) { return $worker }
    return $null
}

if ($Mode -eq 'Status') {
    $worker = Get-Worker
    if ($worker) { Write-Log "CD worker aktif (PID $($worker.pid)); log: $($worker.log)" }
    else { Write-Log 'CD worker background tidak aktif.' }
    if (Test-Path -LiteralPath $deploymentFile) {
        Write-Log 'Catatan deploy terakhir (gunakan docker compose ps untuk status container saat ini):'
        Get-Content -LiteralPath $deploymentFile
    }
    return
}

if ($Mode -eq 'Stop') {
    if (Get-Worker) {
        [IO.File]::WriteAllText($stopFile, 'stop after current cycle', $utf8)
        Write-Log 'Permintaan berhenti dikirim. Siklus deploy aktif diselesaikan dahulu; container aplikasi tetap berjalan.'
    } else { Write-Log 'Tidak ada CD worker background yang aktif.' }
    return
}

foreach ($requiredPath in @($composeFile, (Join-Path $root '.env.local'))) {
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) { throw "File wajib belum ada: $requiredPath" }
}
$null = Get-Command docker -ErrorAction Stop

if ($Mode -eq 'Start') {
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'Mode Start khusus Windows. Gunakan -Mode Watch di terminal pada OS lain.' }
    if (Get-Worker) { Write-Log 'CD worker sudah aktif. Gunakan -Mode Status untuk melihat log.'; return }
    if (Test-Path -LiteralPath $stopFile) { Remove-Item -LiteralPath $stopFile }
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
    $logFile = Join-Path $stateDirectory "watch-$stamp.log"
    $errorFile = Join-Path $stateDirectory "watch-$stamp.error.log"
    $powershellPath = Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
    $workerArguments = '-NoProfile -ExecutionPolicy Bypass -File "{0}" -Mode Watch -IntervalSeconds {1} -Image "{2}" -ProjectDirectory "{3}"' -f $PSCommandPath, $IntervalSeconds, $Image, $root
    if ($ReplaceDevelopment) { $workerArguments += ' -ReplaceDevelopment' }
    $workerProcess = Start-Process -FilePath $powershellPath -ArgumentList $workerArguments -WindowStyle Hidden -PassThru -RedirectStandardOutput $logFile -RedirectStandardError $errorFile
    $workerRecord = [ordered]@{ pid = $workerProcess.Id; startTicks = $workerProcess.StartTime.ToUniversalTime().Ticks.ToString(); log = $logFile; errorLog = $errorFile }
    [IO.File]::WriteAllText($workerFile, ($workerRecord | ConvertTo-Json), $utf8)
    Start-Sleep -Seconds 2
    if ($workerProcess.HasExited) { throw "Worker berhenti saat startup. Periksa $errorFile" }
    Write-Log "CD background aktif (PID $($workerProcess.Id)), interval $IntervalSeconds detik. Log: $logFile"
    return
}

function Invoke-DockerCommand([string[]]$ArgumentList, [switch]$AllowFailure) {
    $previousPreference = $ErrorActionPreference
    try {
        # Native tools may write progress to stderr even on success, including on PowerShell 5.1.
        $ErrorActionPreference = 'Continue'
        $lines = @(& docker @ArgumentList 2>&1)
        $code = $LASTEXITCODE
    } finally { $ErrorActionPreference = $previousPreference }
    $outputText = ($lines | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
    if ($code -ne 0 -and -not $AllowFailure) { throw "docker $($ArgumentList[0]) gagal ($code): $outputText" }
    return [pscustomobject]@{ ExitCode = $code; Text = $outputText }
}

function Invoke-Compose([string[]]$Arguments, [switch]$AllowFailure) {
    $commandArguments = @('compose', '--ansi', 'never', '--project-directory', $root, '--file', $composeFile) + $Arguments
    return Invoke-DockerCommand -ArgumentList $commandArguments -AllowFailure:$AllowFailure
}

function Get-Container([string]$Name) {
    # Only request selected fields. Never print or save container environment variables.
    $result = Invoke-DockerCommand @('inspect', '--format', '{{.Image}}|{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}', $Name) -AllowFailure
    if ($result.ExitCode -ne 0) { return $null }
    $parts = $result.Text.Trim() -split '\|'
    return [pscustomobject]@{ Name = $Name; ImageId = $parts[0]; Status = $parts[1]; Health = $parts[2] }
}

function Get-Deployment {
    $result = Invoke-Compose @('ps', '--all', '--quiet', 'kenangin')
    $ids = @($result.Text -split '\r?\n' | Where-Object { $_ -match '^[a-f0-9]{12,64}$' })
    if ($ids.Count -gt 1) { throw 'Lebih dari satu container deployment ditemukan.' }
    if ($ids.Count -eq 0) { return $null }
    return Get-Container $ids[0]
}

function Wait-Healthy([string]$Name) {
    $deadline = [DateTime]::UtcNow.AddSeconds(90)
    do {
        $container = Get-Container $Name
        if (-not $container) { throw "Container $Name tidak ditemukan." }
        if ($container.Status -eq 'running' -and $container.Health -eq 'healthy') { return }
        if ($container.Status -in @('exited', 'dead') -or $container.Health -eq 'unhealthy') { throw "Container $Name gagal pemeriksaan startup." }
        Start-Sleep -Seconds 2
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "Container $Name belum healthy setelah 90 detik."
}

$failedImageId = ''
function Invoke-Deployment {
    Write-Log "Memeriksa $Image ..."
    $null = Invoke-DockerCommand @('pull', '--quiet', $Image)
    $candidateId = (Invoke-DockerCommand @('image', 'inspect', '--format', '{{.Id}}', $Image)).Text.Trim()
    if ($candidateId -notmatch '^sha256:[a-f0-9]{64}$') { throw 'Docker tidak mengembalikan ID image yang valid.' }
    if ($Mode -eq 'Watch' -and $candidateId -eq $script:failedImageId) {
        Write-Log 'Image ini sebelumnya gagal. Menunggu image baru; restart worker untuk mencoba kembali setelah memperbaiki konfigurasi.'
        return
    }
    # Pin this cycle to the exact local image ID, even if the remote latest tag changes meanwhile.
    $env:KENANGIN_DEPLOY_IMAGE = $candidateId
    $current = Get-Deployment
    if ($current -and $current.ImageId -eq $candidateId -and $current.Status -eq 'running' -and $current.Health -eq 'healthy') {
        Write-Log 'Image sudah terbaru dan container healthy; tidak ada restart.'
        return
    }

    $labels = (Invoke-DockerCommand @('image', 'inspect', '--format', '{{json .Config.Labels}}', $candidateId)).Text | ConvertFrom-Json
    $revision = ''
    if ($labels) {
        $property = $labels.PSObject.Properties['org.opencontainers.image.revision']
        if ($property) { $revision = [string]$property.Value }
    }
    $probe = 'kenangin-preflight-' + [guid]::NewGuid().ToString('N').Substring(0, 12)
    $developmentStopped = $false
    $deploymentAttempted = $false
    try {
        Write-Log "Image baru terdeteksi. Commit: $revision. Menguji tanpa mengambil port 3000 ..."
        try {
            $null = Invoke-Compose @('run', '--detach', '--no-deps', '--pull', 'never', '--name', $probe, 'kenangin')
            Wait-Healthy $probe
        } finally {
            $null = Invoke-DockerCommand @('rm', '--force', $probe) -AllowFailure
        }

        $development = Get-Container 'kenangin'
        if ($development -and $development.Status -eq 'running') {
            if (-not $ReplaceDevelopment) { throw 'Container development kenangin masih aktif. Gunakan -ReplaceDevelopment untuk perpindahan pertama.' }
            $developmentLabels = (Invoke-DockerCommand @('inspect', '--format', '{{json .Config.Labels}}', 'kenangin')).Text | ConvertFrom-Json
            $directoryProperty = $developmentLabels.PSObject.Properties['com.docker.compose.project.working_dir']
            if (-not $directoryProperty -or [IO.Path]::GetFullPath($directoryProperty.Value).TrimEnd([char[]]'\/') -ne $root.TrimEnd([char[]]'\/')) {
                throw 'Container bernama kenangin bukan milik folder proyek ini; tidak dihentikan.'
            }
            $null = Invoke-DockerCommand @('stop', 'kenangin')
            $developmentStopped = $true
        }

        $deploymentAttempted = $true
        $null = Invoke-Compose @('up', '--detach', '--no-build', '--pull', 'never', '--wait', '--wait-timeout', '90', 'kenangin')
        $active = Get-Deployment
        if (-not $active -or $active.ImageId -ne $candidateId -or $active.Health -ne 'healthy') { throw 'Hasil deploy tidak cocok dengan image yang diuji.' }
    } catch {
        $originalError = $_
        $script:failedImageId = $candidateId
        Write-Event 'failed' $candidateId $revision
        if ($deploymentAttempted) {
            if ($current) {
                Write-Log 'Deploy gagal; memulihkan image sebelumnya ...'
                $env:KENANGIN_DEPLOY_IMAGE = $current.ImageId
                $null = Invoke-Compose @('up', '--detach', '--no-build', '--pull', 'never', '--wait', '--wait-timeout', '90', 'kenangin')
                Write-Event 'rollback' $current.ImageId
            } else {
                $null = Invoke-Compose @('rm', '--stop', '--force', 'kenangin')
            }
        }
        if ($developmentStopped) { $null = Invoke-DockerCommand @('start', 'kenangin') }
        throw $originalError
    }
    $script:failedImageId = ''
    $previousImageId = if ($current) { $current.ImageId } else { $null }
    $record = [ordered]@{ deployedAt = [DateTimeOffset]::Now.ToString('o'); source = $Image; imageId = $candidateId; revision = $revision; previousImageId = $previousImageId; url = 'http://localhost:3000' }
    [IO.File]::WriteAllText($deploymentFile, ($record | ConvertTo-Json), $utf8)
    Write-Event 'deployed' $candidateId $revision
    Write-Log "Deploy berhasil. http://localhost:3000 | commit $revision"
}

$previousImageOverride = $env:KENANGIN_DEPLOY_IMAGE
$lock = $null
try {
    try {
        $lock = [IO.File]::Open((Join-Path $stateDirectory 'deploy.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    } catch { throw 'CD lain sedang aktif. Hentikan worker sebelum menjalankan deploy manual.' }
    $env:KENANGIN_DEPLOY_IMAGE = $Image
    $null = Invoke-Compose @('config', '--quiet')
    Write-Log "CD lokal dimulai: mode $Mode, image $Image."
    do {
        if ($Mode -eq 'Watch' -and (Test-Path -LiteralPath $stopFile)) { break }
        try { Invoke-Deployment }
        catch {
            Write-Log "GAGAL: $($_.Exception.Message)"
            if ($Mode -eq 'Once') { throw }
        }
        # The takeover flag is only relevant to the first cycle.
        $ReplaceDevelopment = $false
        if ($Mode -eq 'Once') { break }
        $remaining = $IntervalSeconds
        while ($remaining -gt 0 -and -not (Test-Path -LiteralPath $stopFile)) {
            $pause = [Math]::Min(5, $remaining)
            Start-Sleep -Seconds $pause
            $remaining -= $pause
        }
    } while (-not (Test-Path -LiteralPath $stopFile))
    Write-Log 'CD selesai/berhenti. Container aplikasi tetap berjalan.'
} finally {
    $env:KENANGIN_DEPLOY_IMAGE = $previousImageOverride
    if ($lock) { $lock.Dispose() }
}
