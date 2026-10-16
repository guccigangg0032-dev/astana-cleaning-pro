# ACPro Threads official API publisher. Single original text post per Astana day.
# Does not post until a private token and enabled=true are configured.
$ErrorActionPreference='Stop'
$private=Join-Path $env:APPDATA 'ACPro\threads-private.json'
if (!(Test-Path $private)) {Write-Host ('Configure Threads credentials privately: '+$private);exit 2}
$cfg=Get-Content -Raw -Encoding UTF8 $private | ConvertFrom-Json
if ($cfg.enabled -ne $true -or !$cfg.threads_token) {Write-Host 'Threads auto publishing is not enabled or no verified token is configured.';exit 2}
$posted=Join-Path $env:APPDATA 'ACPro\threads-last-post.json'
$today=([DateTime]::UtcNow.AddHours(5)).ToString('yyyy-MM-dd')
if (Test-Path $posted) {
    $state=Get-Content -Raw -Encoding UTF8 $posted | ConvertFrom-Json
    if ($state.date -eq $today) {Write-Host ('Already prepared or posted today: '+$state.status);exit 0}
}
$posts=Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot 'threads_posts.json') | ConvertFrom-Json
$start=([DateTime]::UtcNow.AddHours(5)).Date
$idx=[int]((([DateTime]::ParseExact($today,'yyyy-MM-dd',[Globalization.CultureInfo]::InvariantCulture)-[DateTime]'2026-10-17').TotalDays) % $posts.Count)
if ($idx -lt 0) {$idx=0}
$text=[string]$posts[$idx]
$headers=@{Authorization='Bearer '+[string]$cfg.threads_token}
Write-Host ('ACPro Threads: creating one original post for '+$today)
$create=Invoke-RestMethod -Uri 'https://graph.threads.net/v1.0/me/threads' -Method Post -Headers $headers -Body @{media_type='TEXT';text=$text} -TimeoutSec 30
if (!$create.id) {throw 'Threads did not return a container ID; do not retry without checking.'}
# Persist pending status before publish; if connectivity fails midway we avoid double-posts.
@{date=$today;status='publishing';container_id=[string]$create.id} | ConvertTo-Json | Set-Content -Encoding UTF8 $posted
$sent=Invoke-RestMethod -Uri 'https://graph.threads.net/v1.0/me/threads_publish' -Method Post -Headers $headers -Body @{creation_id=[string]$create.id} -TimeoutSec 30
if (!$sent.id) {throw 'Publication uncertain. Check Threads account before manual retry.'}
@{date=$today;status='published';post_id=[string]$sent.id} | ConvertTo-Json | Set-Content -Encoding UTF8 $posted
Write-Host 'Threads publication confirmed by API.'