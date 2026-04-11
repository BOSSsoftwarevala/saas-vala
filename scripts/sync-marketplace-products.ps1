param(
  [Parameter(Mandatory = $true)]
  [string]$OldProjectUrl,

  [Parameter(Mandatory = $true)]
  [string]$OldAnonKey,

  [Parameter(Mandatory = $true)]
  [string]$NewProjectUrl,

  [Parameter(Mandatory = $true)]
  [string]$NewServiceRoleKey,

  [int]$PageSize = 200,
  [int]$ChunkSize = 50
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$allowedColumns = @(
  'id', 'name', 'slug', 'description', 'category_id', 'status', 'price', 'currency', 'version',
  'features', 'meta', 'created_by', 'created_at', 'updated_at', 'short_description', 'apk_url',
  'download_count', 'is_apk', 'git_repo_url', 'git_repo_name', 'git_default_branch', 'deploy_status',
  'marketplace_visible', 'demo_url', 'live_url', 'thumbnail_url', 'featured', 'trending',
  'package_name', 'app_hash', 'storage_path', 'tags_json', 'keywords_json', 'seo_title',
  'seo_description', 'license_enabled', 'device_limit', 'device_bind', 'expiry_type',
  'require_payment', 'secure_download', 'log_downloads', 'demo_login', 'demo_password',
  'demo_enabled', 'sub_category', 'nano_category', 'micro_category', 'deep_category',
  'tech_stack_json', 'use_case', 'target_industry', 'source_method', 'apk_file_size',
  'apk_version_code', 'demo_click_count', 'discount_percent', 'rating', 'tags', 'apk_enabled',
  'buy_enabled', 'download_enabled', 'is_visible', 'requires_api_key', 'api_documentation_url',
  'demo_source_url'
)

function Get-AllProducts {
  param(
    [string]$ProjectUrl,
    [hashtable]$Headers,
    [int]$FetchPageSize
  )

  $offset = 0
  $rows = @()

  while ($true) {
    $uri = "$ProjectUrl/rest/v1/products?select=*&order=created_at.desc&limit=$FetchPageSize&offset=$offset"
    $batch = Invoke-RestMethod -Headers $Headers -Uri $uri -Method Get
    $batchRows = @($batch)

    if ($batchRows.Count -eq 0) {
      break
    }

    $rows += $batchRows

    if ($batchRows.Count -lt $FetchPageSize) {
      break
    }

    $offset += $FetchPageSize
  }

  return $rows
}

function Convert-ProductForMaskedDemo {
  param([object]$Row)

  $mapped = [ordered]@{}
  foreach ($property in $Row.PSObject.Properties) {
    if ($allowedColumns -contains $property.Name) {
      $mapped[$property.Name] = $property.Value
    }
  }

  if ((-not $mapped.Contains('target_industry') -or -not $mapped['target_industry']) -and $Row.PSObject.Properties.Name -contains 'business_type' -and $Row.business_type) {
    $mapped['target_industry'] = [string]$Row.business_type
  }

  $sourceUrl = $null
  if ($Row.PSObject.Properties.Name -contains 'demo_source_url' -and $Row.demo_source_url) {
    $sourceUrl = [string]$Row.demo_source_url
  } elseif ($Row.demo_url -and -not ([string]$Row.demo_url).StartsWith('https://demo.saasvala.com/')) {
    $sourceUrl = [string]$Row.demo_url
  }

  if ($sourceUrl) {
    $mapped['demo_source_url'] = $sourceUrl
    if ($Row.slug) {
      $mapped['demo_url'] = "https://demo.saasvala.com/$($Row.slug)"
    }
  }

  if (-not $mapped.Contains('download_enabled')) {
    $mapped['download_enabled'] = $false
  }

  if (-not $mapped.Contains('is_visible')) {
    $mapped['is_visible'] = $true
  }

  if (-not $mapped.Contains('requires_api_key')) {
    $mapped['requires_api_key'] = $false
  }

  return [pscustomobject]$mapped
}

function Split-Chunks {
  param(
    [object[]]$Items,
    [int]$Size
  )

  $chunks = [System.Collections.Generic.List[object[]]]::new()
  for ($index = 0; $index -lt $Items.Count; $index += $Size) {
    $end = [Math]::Min($index + $Size - 1, $Items.Count - 1)
    $chunks.Add(@($Items[$index..$end]))
  }

  return $chunks
}

$oldHeaders = @{
  apikey        = $OldAnonKey
  Authorization = "Bearer $OldAnonKey"
}

$newHeaders = @{
  apikey        = $NewServiceRoleKey
  Authorization = "Bearer $NewServiceRoleKey"
  Prefer        = 'resolution=merge-duplicates,return=minimal'
  'Content-Type' = 'application/json'
}

Write-Host "Fetching products from old project..." -ForegroundColor Cyan
$sourceRows = @(Get-AllProducts -ProjectUrl $OldProjectUrl -Headers $oldHeaders -FetchPageSize $PageSize)
Write-Host "Fetched $($sourceRows.Count) rows" -ForegroundColor Green

$transformedRows = @($sourceRows | ForEach-Object { Convert-ProductForMaskedDemo -Row $_ })
$chunks = @(Split-Chunks -Items $transformedRows -Size $ChunkSize)

$uploaded = 0
foreach ($chunk in $chunks) {
  $json = $chunk | ConvertTo-Json -Depth 20 -Compress
  $uri = "$NewProjectUrl/rest/v1/products?on_conflict=id"
  Invoke-RestMethod -Headers $newHeaders -Uri $uri -Method Post -Body $json | Out-Null
  $uploaded += $chunk.Count
  Write-Host "Uploaded $uploaded/$($transformedRows.Count)" -ForegroundColor Yellow
}

Write-Host "Sync complete. Migrated $($transformedRows.Count) products." -ForegroundColor Green