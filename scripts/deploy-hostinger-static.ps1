param(
  [Parameter(Mandatory = $true)]
  [string]$Host,

  [Parameter(Mandatory = $true)]
  [string]$User,

  [int]$Port = 22,
  [string]$KeyPath = "",
  [string]$RemotePath = "/var/www/saasvala-site",
  [string]$SiteUrl = "https://saasvala.com",
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Assert-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $Name"
  }
}

Assert-Command "ssh"
Assert-Command "scp"
Assert-Command "npm"
Assert-Command "tar"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

if (-not $SkipBuild) {
  Write-Host "[1/5] Building production bundle..." -ForegroundColor Cyan
  npm run build
}

$tmpDir = Join-Path $repoRoot ".deploy"
if (-not (Test-Path $tmpDir)) {
  New-Item -Path $tmpDir -ItemType Directory | Out-Null
}

$archivePath = Join-Path $tmpDir "site.tgz"
if (Test-Path $archivePath) {
  Remove-Item $archivePath -Force
}

Write-Host "[2/5] Creating deployment archive..." -ForegroundColor Cyan
tar -czf $archivePath -C "$repoRoot/dist" .

$sshArgs = @("-p", "$Port")
$scpArgs = @("-P", "$Port")
if ($KeyPath) {
  $sshArgs += @("-i", $KeyPath)
  $scpArgs += @("-i", $KeyPath)
}

$remote = "$User@$Host"

Write-Host "[3/5] Uploading archive to VPS..." -ForegroundColor Cyan
& scp @scpArgs $archivePath "$remote:/tmp/saasvala-site.tgz"
if ($LASTEXITCODE -ne 0) {
  throw "SCP upload failed"
}

$remoteScript = @"
set -e
sudo mkdir -p $RemotePath
sudo rm -rf $RemotePath/*
sudo tar -xzf /tmp/saasvala-site.tgz -C $RemotePath
sudo chown -R www-data:www-data $RemotePath
sudo find $RemotePath -type d -exec chmod 755 {} \;
sudo find $RemotePath -type f -exec chmod 644 {} \;
sudo nginx -t
sudo systemctl reload nginx
rm -f /tmp/saasvala-site.tgz
"@

Write-Host "[4/5] Extracting on VPS and reloading nginx..." -ForegroundColor Cyan
& ssh @sshArgs $remote $remoteScript
if ($LASTEXITCODE -ne 0) {
  throw "Remote deploy command failed"
}

Write-Host "[5/5] Health check..." -ForegroundColor Cyan
try {
  $res = Invoke-WebRequest -Uri $SiteUrl -UseBasicParsing -TimeoutSec 20
  Write-Host "Live check status: $($res.StatusCode) $SiteUrl" -ForegroundColor Green
} catch {
  Write-Warning "Health check failed. Please verify manually: $SiteUrl"
}

Write-Host "Deploy completed successfully." -ForegroundColor Green
