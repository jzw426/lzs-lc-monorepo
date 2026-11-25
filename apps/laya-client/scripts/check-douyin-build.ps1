[CmdletBinding()]
param(
    [string]$AppId = 'ttc499b2245aeb01e602',
    [string]$Dir = 'apps/laya-client/dist/douyin',
    [string]$ShaFile = ''
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
if (-not [System.IO.Path]::IsPathRooted($Dir)) {
    $Dir = Join-Path $repoRoot $Dir
}
if ([string]::IsNullOrWhiteSpace($ShaFile)) {
    $ShaFile = Join-Path (Split-Path $Dir -Parent) 'douyin-sha256.txt'
} elseif (-not [System.IO.Path]::IsPathRooted($ShaFile)) {
    $ShaFile = Join-Path $repoRoot $ShaFile
}

$script:failed = $false

function Pass([string]$message) {
    Write-Host "[PASS] $message" -ForegroundColor Green
}

function Fail([string]$message) {
    Write-Host "[FAIL] $message" -ForegroundColor Red
    $script:failed = $true
}

function Warn([string]$message) {
    Write-Host "[WARN] $message" -ForegroundColor Yellow
}

Write-Host "== 1. 构建目录 =="
if (-not (Test-Path -LiteralPath $Dir -PathType Container)) {
    Fail "目录不存在：$Dir"
    Write-Host '请先在 LayaAir IDE 3.3.0 中发布到该目录，再运行本脚本。' -ForegroundColor Yellow
    exit 1
}
Pass "目录存在：$Dir"

$entries = @(Get-ChildItem -LiteralPath $Dir -File)
if ($entries.Count -eq 0) {
    Fail '目录为空，构建可能未完成'
} else {
    Pass ("顶层文件 $($entries.Count) 个：" + (($entries | Select-Object -ExpandProperty Name) -join ', '))
}

Write-Host ''
Write-Host '== 2. 必需文件 =='
foreach ($name in @('game.json', 'project.config.json', 'share.png')) {
    if (Test-Path -LiteralPath (Join-Path $Dir $name) -PathType Leaf) {
        Pass "$name 存在"
    } else {
        Fail "$name 缺失"
    }
}

$entryJs = @(Get-ChildItem -LiteralPath $Dir -Filter *.js -File | Where-Object { $_.Length -gt 0 })
if ($entryJs.Count -gt 0) {
    Pass ('入口 JS：' + (($entryJs | Select-Object -ExpandProperty Name) -join ', '))
} else {
    Fail '包根缺少非空 .js'
}

Write-Host ''
Write-Host '== 3. project.config.json =='
$configPath = Join-Path $Dir 'project.config.json'
if (Test-Path -LiteralPath $configPath -PathType Leaf) {
    $config = $null
    try {
        $config = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
    } catch {
        Fail "project.config.json 解析失败：$($_.Exception.Message)"
    }
    if ($null -ne $config) {
        if ([string]::IsNullOrWhiteSpace($config.appid)) {
            Fail 'project.config.json 缺少 appid'
        } elseif ($config.appid -ne $AppId) {
            Fail "appid=$($config.appid) 与期望 $AppId 不一致"
        } else {
            Pass "appid=$($config.appid)"
        }
        if ([string]::IsNullOrWhiteSpace($config.projectname)) {
            Warn 'projectname 为空（不影响运行，建议填写项目名称）'
        } else {
            Pass "projectname=$($config.projectname)"
        }
        if ($null -ne $config.compileType -and $config.compileType -ne 'game') {
            Warn "compileType=$($config.compileType)，抖音小游戏通常应为 game"
        }
        if ($null -ne $config.miniprogramRoot -and $config.miniprogramRoot -notin @('', '.', './')) {
            Warn "miniprogramRoot=$($config.miniprogramRoot)，请确认资源根目录是否正确"
        }
    }
}

Write-Host ''
Write-Host '== 4. game.json =='
$gamePath = Join-Path $Dir 'game.json'
if (Test-Path -LiteralPath $gamePath -PathType Leaf) {
    $game = $null
    try {
        $game = Get-Content -LiteralPath $gamePath -Raw -Encoding UTF8 | ConvertFrom-Json
    } catch {
        Fail "game.json 解析失败：$($_.Exception.Message)"
    }
    if ($null -ne $game) {
        if ($game.deviceOrientation -eq 'portrait') {
            Pass 'deviceOrientation=portrait'
        } else {
            Fail "deviceOrientation=$($game.deviceOrientation)，应为 portrait"
        }
    }
}

Write-Host ''
Write-Host '== 5. 产物哈希 =='
if (Test-Path -LiteralPath $ShaFile -PathType Leaf) {
    $shaLines = @(Get-Content -LiteralPath $ShaFile -Encoding UTF8 | Where-Object { $_.Trim() -ne '' })
    $valid = @($shaLines | Where-Object { $_ -match '^[0-9a-fA-F]{64}\s{2}.+$' })
    if ($shaLines.Count -eq 0) {
        Fail "哈希文件为空：$ShaFile"
    } elseif ($valid.Count -eq 0) {
        Fail "哈希文件无有效 SHA256 行：$ShaFile"
    } else {
        Pass "哈希文件有效：$ShaFile（$($shaLines.Count) 行）"
    }
} else {
    Fail "哈希文件不存在：$ShaFile（请先生成 douyin-sha256.txt）"
}

Write-Host ''
if ($script:failed) {
    Write-Host '预检未通过，已停止完整校验。修复上述 FAIL 后重跑。' -ForegroundColor Red
    exit 1
}

Write-Host '== 6. 完整产物校验（validate:build）=='
Push-Location $repoRoot
try {
    & pnpm exec tsx packages/tools/src/cli.ts validate-build --appid $AppId --sha $ShaFile $Dir
    $code = $LASTEXITCODE
} finally {
    Pop-Location
}

if ($code -ne 0) {
    Write-Host '完整校验未通过，见上方 JSON 报告。' -ForegroundColor Red
    exit 1
}

Write-Host ''
Write-Host "构建产物校验通过：$Dir" -ForegroundColor Green
exit 0
