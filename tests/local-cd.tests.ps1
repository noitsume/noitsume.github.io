# Stateful Docker simulation: no daemon, registry, credentials, or real containers are used.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$deployScript = Join-Path (Split-Path -Parent $PSScriptRoot) 'scripts/deploy-local.ps1'
$oldImage = 'sha256:' + ('a' * 64)
$newImage = 'sha256:' + ('b' * 64)
$containerId = 'c' * 64
$temporaryParent = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$testRoot = Join-Path $temporaryParent ('kenangin-cd-tests-' + [guid]::NewGuid().ToString('N'))
$null = New-Item -ItemType Directory -Path $testRoot
$priorImageOverride = $env:KENANGIN_DEPLOY_IMAGE
$passed = 0

function Assert-True([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
}

function global:docker {
    $a = @($args | ForEach-Object { [string]$_ })
    $global:LASTEXITCODE = 0
    $state = $global:LocalCdFake
    $null = $state.calls.Add(($a -join ' '))
    switch ($a[0]) {
        'pull' {
            if ($state.pullFails) { $global:LASTEXITCODE = 1; return 'simulated registry unavailable' }
            return 'pulled'
        }
        'image' {
            if ($a[3] -eq '{{.Id}}') { return $state.newImage }
            return '{"org.opencontainers.image.revision":"test-revision"}'
        }
        'inspect' {
            $name = $a[-1]
            if ($a[2] -eq '{{json .Config.Labels}}') {
                return (@{ 'com.docker.compose.project.working_dir' = $state.root } | ConvertTo-Json -Compress)
            }
            if ($name.StartsWith('kenangin-preflight-')) {
                $health = if ($state.probeFails) { 'unhealthy' } else { 'healthy' }
                return "$($state.newImage)|running|$health"
            }
            if ($name -eq 'kenangin') {
                if ($state.development) { return "$($state.oldImage)|running|" }
                $global:LASTEXITCODE = 1
                return 'no development container'
            }
            if ($state.current) { return "$($state.current)|running|healthy" }
            $global:LASTEXITCODE = 1
            return 'no deployment container'
        }
        'compose' {
            $operation = $a[7]
            switch ($operation) {
                'config' { return }
                'ps' { if ($state.current) { return $state.containerId }; return }
                'run' { $state.probeStarted = $true; return 'probe started' }
                'up' {
                    $target = $env:KENANGIN_DEPLOY_IMAGE
                    $null = $state.upImages.Add($target)
                    $state.current = $target
                    if ($state.deployFails -and $target -eq $state.newImage) {
                        $global:LASTEXITCODE = 1
                        return 'simulated startup failure after container replacement'
                    }
                    return 'healthy'
                }
                'rm' { $state.current = $null; return 'removed failed deployment' }
                default { throw "Unexpected compose operation: $operation" }
            }
        }
        'rm' { $state.probeRemoved = $true; return 'removed probe' }
        'stop' { $state.development = $false; $state.developmentStops++; return 'kenangin' }
        'start' { $state.development = $true; $state.developmentStarts++; return 'kenangin' }
        default { throw "Unexpected Docker invocation: $($a -join ' ')" }
    }
}

try {
    foreach ($scenario in @('first-deploy', 'unchanged', 'probe-failure', 'deploy-rollback', 'first-deploy-rollback', 'pull-failure')) {
        $fixture = Join-Path $testRoot $scenario
        $null = New-Item -ItemType Directory -Path $fixture
        Set-Content -LiteralPath (Join-Path $fixture 'compose.deploy.yaml') -Value 'services: {}'
        Set-Content -LiteralPath (Join-Path $fixture '.env.local') -Value 'NEXT_PUBLIC_APP_URL=http://localhost:3000'
        $global:LocalCdFake = @{
            root = $fixture; oldImage = $oldImage; newImage = $newImage; containerId = $containerId
            current = $oldImage; development = $false; probeFails = $false; deployFails = $false; pullFails = $false
            probeStarted = $false; probeRemoved = $false; developmentStops = 0; developmentStarts = 0
            calls = (New-Object 'System.Collections.Generic.List[string]'); upImages = (New-Object 'System.Collections.Generic.List[string]')
        }
        $fake = $global:LocalCdFake
        if ($scenario -in @('first-deploy', 'first-deploy-rollback')) { $fake.current = $null; $fake.development = $true }
        if ($scenario -eq 'unchanged') { $fake.current = $newImage }
        if ($scenario -eq 'probe-failure') { $fake.probeFails = $true }
        if ($scenario -in @('deploy-rollback', 'first-deploy-rollback')) { $fake.deployFails = $true }
        if ($scenario -eq 'pull-failure') { $fake.pullFails = $true }
        $env:KENANGIN_DEPLOY_IMAGE = 'caller-value'
        $failure = $null
        try { & $deployScript -Mode Once -ProjectDirectory $fixture -ReplaceDevelopment }
        catch { $failure = $_ }
        $expectedFailure = $scenario -notin @('first-deploy', 'unchanged')
        Assert-True (($null -ne $failure) -eq $expectedFailure) "$scenario returned the wrong success/failure result: $failure"
        Assert-True ($env:KENANGIN_DEPLOY_IMAGE -eq 'caller-value') 'Caller environment override was not restored.'
        if ($scenario -eq 'first-deploy') {
            Assert-True ($fake.current -eq $newImage -and -not $fake.development) 'First deployment did not replace development.'
            Assert-True ($fake.probeStarted -and $fake.probeRemoved) 'Preflight container was not cleaned up.'
            $probeCheck = $fake.calls.FindIndex([Predicate[string]]{ param($line) $line.StartsWith('inspect ') -and $line.Contains('kenangin-preflight-') })
            $developmentStop = $fake.calls.IndexOf('stop kenangin')
            Assert-True ($probeCheck -ge 0 -and $probeCheck -lt $developmentStop) 'Development was stopped before preflight.'
        } elseif ($scenario -eq 'unchanged') {
            Assert-True ($fake.upImages.Count -eq 0 -and -not $fake.probeStarted) 'Unchanged healthy image caused a restart.'
        } elseif ($scenario -in @('probe-failure', 'pull-failure')) {
            Assert-True ($fake.current -eq $oldImage -and $fake.upImages.Count -eq 0) 'Failure disturbed the previous deployment.'
            if ($scenario -eq 'probe-failure') { Assert-True $fake.probeRemoved 'Failed preflight was not removed.' }
        } elseif ($scenario -eq 'deploy-rollback') {
            Assert-True ($fake.current -eq $oldImage -and $fake.upImages.Count -eq 2 -and $fake.upImages[1] -eq $oldImage) 'Previous image was not restored.'
            $events = Get-Content -LiteralPath (Join-Path $fixture 'tmp/local-cd/events.jsonl')
            Assert-True (($events -join '') -match 'rollback') 'Rollback was not recorded.'
        } else {
            Assert-True ($null -eq $fake.current -and $fake.development -and $fake.developmentStarts -eq 1) 'First failed deployment did not restore development.'
        }
        $passed++
        Write-Host "PASS: $scenario"
    }
    Write-Host "$passed local CD recovery tests passed. No real Docker operations were executed."
} finally {
    $env:KENANGIN_DEPLOY_IMAGE = $priorImageOverride
    Remove-Item -LiteralPath 'Function:\docker'
    Remove-Variable -Name LocalCdFake -Scope Global -ErrorAction SilentlyContinue
    # Delete only the unique fixture directory created by this test invocation.
    $resolvedFixtureRoot = (Resolve-Path -LiteralPath $testRoot).Path
    $expectedFixtureRoot = [IO.Path]::GetFullPath($testRoot)
    $safePrefix = $temporaryParent.TrimEnd([char[]]'\/') + [IO.Path]::DirectorySeparatorChar
    if ($resolvedFixtureRoot -ne $expectedFixtureRoot -or -not $resolvedFixtureRoot.StartsWith($safePrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected fixture cleanup path.' }
    Remove-Item -LiteralPath $resolvedFixtureRoot -Recurse -Force
}
