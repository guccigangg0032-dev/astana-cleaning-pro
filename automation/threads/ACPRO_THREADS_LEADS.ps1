# Read-only discovery of public Threads posts, no comments and no unsolicited DMs.
$ErrorActionPreference='Stop'
$private=Join-Path $env:APPDATA 'ACPro\threads-private.json'
if (!(Test-Path $private)) {Write-Host ('First set private Threads API access: '+$private);exit 2}
$cfg=Get-Content -Raw -Encoding UTF8 $private | ConvertFrom-Json
if (!$cfg.threads_token) {throw 'Missing Threads token.'}
$headers=@{Authorization='Bearer '+[string]$cfg.threads_token}
$dir=Join-Path $env:APPDATA 'ACPro'
$out=Join-Path $dir 'threads-public-leads.csv'
$terms=@('ищу клининг Астана','нужна уборка Астана','химчистка дивана Астана')
$seen=@{}
if (Test-Path $out) {Import-Csv $out | ForEach-Object {if ($_.id) {$seen[[string]$_.id]=$true}}}
foreach($term in $terms) {
    try {
        $u='https://graph.threads.net/v1.0/keyword_search?q='+[Uri]::EscapeDataString($term)+'&search_type=RECENT&limit=20&fields=id,username,text,permalink,timestamp'
        $data=Invoke-RestMethod -Uri $u -Method Get -Headers $headers -TimeoutSec 30
        foreach($item in $data.data) {
            if (!$item.permalink -or !$item.id -or $seen.ContainsKey([string]$item.id)) {continue}
            $seen[[string]$item.id]=$true
            $snippet=([string]$item.text).Replace("`r",' ').Replace("`n",' ')
            if ($snippet.Length -gt 220) {$snippet=$snippet.Substring(0,220)}
            $snippet=[regex]::Replace($snippet,'(?<!\d)\+?\d[\d\s()-]{8,18}\d(?!\d)','[контакт скрыт]')
            # Public permalink, minimal excerpt; no phone numbers, no direct contact.
            [PSCustomObject]@{captured_at=[DateTime]::UtcNow.ToString('o');id=[string]$item.id;permalink=[string]$item.permalink;snippet=$snippet} | Export-Csv -Path $out -Encoding UTF8 -Append -NoTypeInformation
        }
    } catch {Write-Warning 'Threads keyword search unavailable or permission missing; check scopes.'}
}
Write-Host ('Read-only public Threads results, if available: '+$out)