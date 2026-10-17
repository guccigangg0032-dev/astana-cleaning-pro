# ACPro permanent DIRECT Instagram poller via Meta Facebook Login.
# Does NOT depend on Meta Webhook / Plesk. Uses official Page API.
# Never put Page Access Tokens in GitHub, websites or chats.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$cfgPath = Join-Path $env:APPDATA 'ACPro\facebook-direct.json'
if (!(Test-Path -LiteralPath $cfgPath)) {
    Write-Host ('Create the PRIVATE config first: ' + $cfgPath)
    Write-Host 'See automation/DIRECT_POLLING.md (do not paste the token into chat).'
    exit 2
}
$cfg = Get-Content -LiteralPath $cfgPath -Raw -Encoding UTF8 | ConvertFrom-Json
$pageId = [string]$cfg.facebook_page_id
$ownId = [string]$cfg.instagram_account_id
$token = [string]$cfg.facebook_page_access_token
if ($pageId -notmatch '^[0-9]{5,32}$' -or $ownId -notmatch '^[0-9]{5,32}$' -or $token.Length -lt 30 -or $token.StartsWith('REPLACE_')) { throw 'Invalid private ACPro Facebook Page configuration.' }
if (![string]$cfg.model) { throw 'Missing local Ollama model name.' }
$mode = [string]$cfg.mode
if ($mode -ne 'dry_run' -and $mode -ne 'live') { throw 'mode must be dry_run or live.' }
$pollSeconds = [Math]::Max(60,[int]$cfg.poll_seconds)
$allowAll = ($cfg.allow_all_inbound -eq $true)
$testSender = [string]$cfg.test_sender_id
$headers = @{ Authorization = 'Bearer '+$token }
$stateFile = Join-Path (Split-Path -Parent $cfgPath) 'facebook-direct-state.json'
$seen = New-Object 'System.Collections.Generic.HashSet[string]'
$humanThreads = @{}
$firstStart = [DateTimeOffset]::UtcNow
$bootstrapped = $false
if (Test-Path -LiteralPath $stateFile) {
    try {
        $old = Get-Content -LiteralPath $stateFile -Raw -Encoding UTF8 | ConvertFrom-Json
        $firstStart=[DateTimeOffset]::Parse([string]$old.first_start).ToUniversalTime()
        foreach ($s in @($old.seen_hashes)) { [void]$seen.Add([string]$s) }
        if ($null -ne $old.human_threads) { foreach ($x in $old.human_threads.PSObject.Properties) { $humanThreads[$x.Name] = [long]$x.Value } }
        $bootstrapped=($old.bootstrapped -eq $true)
    } catch { throw 'Invalid state. Stop and repair the state before restarting to prevent duplicate replies.' }
}
function Hash-Id([string]$value) {
    $b = [System.Text.Encoding]::UTF8.GetBytes($value)
    $h = [System.Security.Cryptography.SHA256]::Create()
    try {return ([BitConverter]::ToString($h.ComputeHash($b))).Replace('-','').ToLowerInvariant()}
    finally {$h.Dispose()}
}
function Save-State {
    $parent=Split-Path -Parent $stateFile
    if (!(Test-Path -LiteralPath $parent)) { New-Item -Type Directory -Path $parent | Out-Null }
    $out=@{first_start=$firstStart.ToString('o');bootstrapped=$bootstrapped;seen_hashes=@($seen);human_threads=$humanThreads}
    $tmp=$stateFile+'.tmp'
    $j=ConvertTo-Json -InputObject $out -Depth 4 -Compress
    [System.IO.File]::WriteAllText($tmp,$j,[System.Text.Encoding]::UTF8)
    if (Test-Path -LiteralPath $stateFile) {
        # Atomic replacement on Windows NTFS. Never delete prior state before a send.
        [System.IO.File]::Replace($tmp,$stateFile,$null)
    } else { [System.IO.File]::Move($tmp,$stateFile) }
}
function Graph-Get([string]$path) {
    Invoke-RestMethod -Uri ('https://graph.facebook.com/v26.0/'+$path) -Headers $headers -Method Get -TimeoutSec 30 -ErrorAction Stop
}
function Graph-Send([string]$sender,[string]$message) {
    $payload = @{recipient=@{id=$sender};messaging_type='RESPONSE';message=@{text=$message}} | ConvertTo-Json -Compress -Depth 5
    Invoke-RestMethod -Uri ('https://graph.facebook.com/v26.0/'+$pageId+'/messages') -Headers $headers -Method Post -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($payload)) -TimeoutSec 30 -ErrorAction Stop
}
function Has-Recipient([object]$message) {
    # Facebook Graph 'to' can be an object with data[]; do not guess on absent data.
    $ids=@()
    if ($null -ne $message.to) {
        if ($null -ne $message.to.data) { foreach($o in @($message.to.data)) {if($null -ne $o.id){$ids+=([string]$o.id)}} }
        elseif ($null -ne $message.to.id) {$ids+=([string]$message.to.id)}
    }
    return ($ids -contains $ownId -or $ids -contains $pageId)
}
$phone = '+7 777 614 66 64'
$developer = '+7 776 000 19 66'
$identity = 'Я ИИ-менеджер Astana Cleaning Pro. '
$notice = 'Это предварительный расчёт «от», а не окончательная стоимость или подтверждение записи. Точную цену и выезд согласует человек лично по телефону или WhatsApp ' + $phone + '.'
function Get-PolicyReply([string]$question) {
    $s = $question.ToLowerInvariant()
    $after = ([DateTime]::UtcNow.AddHours(5).Hour -ge 20)
    $late = if ($after) {' После 20:00 заявки на сегодня не подтверждаем. Детали согласуем завтра.'} else {''}
    if ($s -match 'жалоб|плохо убра|вернит[еь] денеж|возврат|претензи|менеджер|оператор|живым человеком|тұтынушы шағым|complaint') {
        return @{reply=($identity+'Передаю вопрос человеку. Для связи напишите в WhatsApp '+$phone+'.'+$late);handoff=$true}
    }
    if ($s -match 'разработчик|кто создал|ии для бизнес|хочу такого бота|автоматизац|партнерств|партнёрств|developer') {
        return @{reply=($identity+'По разработке ИИ и партнёрству свяжитесь с владельцем: '+$developer+'.');handoff=$false}
    }
    $hasPrice = $s -match 'цен[ауы]|сколько|скок|стоим|посчит|рассчит|предварительн|қанша|баға|how much|price|cost|quote'
    if ($hasPrice) {
        if ($s -match 'после пожар|после смерт|труп|гниль|стуль|штор|озонир|biohazard') {
            return @{reply=($identity+'Эта услуга требует индивидуальной оценки. '+$notice+$late);handoff=$false}
        }
        if ($s -match 'индукц|induction') {
            return @{reply=($identity+'Для индукционной панели предусмотрен ориентир от 15 000 до 25 000 ₸ по ширине. Мы ищем профильных партнёров, доступность и безопасный метод нужно уточнить. Связь: '+$developer+'. Это предварительный ориентир, не окончательная цена.');handoff=$false}
        }
        $type = $null; $rate = 0; $minimum = 0
        if ($s -match 'после ремонт|постремонт|жөндеу|renovation') {$type='после ремонта';$rate=1200;$minimum=52000}
        elseif ($s -match 'генерал|күрделі|deep clean') {$type='генеральная';$rate=900;$minimum=38000}
        elseif ($s -match 'поддержива|влажн|регулярн|maintenance|қолдаушы') {$type='поддерживающая';$rate=400;$minimum=18000}
        $area = $null
        if ($s -match '(\d{1,4})\s*(?:м2|м²|кв\.?\s*м|квадрат|sqm|square meter)') {$area=[int]$matches[1]}
        $addon=0;$extraText=@()
        if ($s -match 'диван|sofa') { $addon+=10000;$extraText+='двухместный диван: от 10 000 ₸' }
        if ($s -match 'кресл|armchair') { $addon+=5500;$extraText+='кресло: от 5 500 ₸' }
        if ($s -match 'окн|окон|витраж|терез|window') { $addon+=3000;$extraText+='окна: от 3 000 ₸' }
        if ($s -match 'духовк|холодильник|микроволнов|бытов.*техник|appliance') { $addon+=3000;$extraText+='техника: от 3 000 ₸' }
        if ($s -match '\b[2-9]\s*(диван|кресл|окн|стул|sofa|chair)' -or $s -match '\b1\d\s*(диван|кресл|окн|стул)') {
            return @{reply=($identity+'Для нескольких предметов цену уточняем по количеству и состоянию. '+$notice+$late);handoff=$false}
        }
        if ($type -and $area -ge 20 -and $area -le 2000) {
            $base = [Math]::Max($minimum,$rate*$area)
            $sum = $base+$addon
            $line='Уборка '+$type+' '+$area+' м²: от '+$base.ToString('N0')+' ₸.'
            if ($extraText.Count -gt 0) {$line+=' Дополнительно: '+($extraText -join ', ')+'.'}
            return @{reply=($identity+$line+' Итого от '+$sum.ToString('N0')+' ₸. '+$notice+$late);handoff=$false}
        }
        if (!$type -and $addon -gt 0 -and !$area) {
            return @{reply=($identity+'Предварительный ориентир за одну выбранную категорию услуг: от '+$addon.ToString('N0')+' ₸. '+$notice+$late);handoff=$false}
        }
        return @{reply=($identity+'Для расчёта укажите вид уборки (поддерживающая, генеральная или после ремонта) и площадь в м². '+$notice+$late);handoff=$false}
    }
    return $null
}
function Ask-LocalQwen([string]$question) {
    $policy = 'Ты ИИ-менеджер Astana Cleaning Pro, не человек. Отвечай по-русски кратко, вежливо. Работы выполняют люди. Нельзя подтверждать цену, запись, время визита, оплату или действия, которых не было. Нет предоплаты; оплата после выполнения работ. Предварительные цены: поддерживающая от 400 тенге за м2 (минимум 18000), генеральная от 900 (минимум 38000), после ремонта от 1200 (минимум 52000). Дополнительные услуги отдельно. Любую итоговую стоимость подтверждает человек. WhatsApp клининга +7 777 614 66 64. Разработчик +7 776 000 19 66. Если вопрос непонятен, пригласи в WhatsApp. Не придумывай отзывы, обещания, гарантии и даты.'
    $json = @{model=[string]$cfg.model;stream=$false;think=$false;messages=@(@{role='system';content=$policy},@{role='user';content=$question});options=@{temperature=0;num_predict=250}} | ConvertTo-Json -Depth 7 -Compress
    $result=Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/chat' -Method Post -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($json)) -TimeoutSec 180
    $msg=[string]$result.message.content
    if ([string]::IsNullOrWhiteSpace($msg)) {throw 'Qwen returned empty reply'}
    if ($msg.Length -gt 900) { $msg=$msg.Substring(0,900) }
    if ($msg -match '₸|тенге|KZT') { return $identity + 'Могу посчитать предварительную стоимость, если укажете тип уборки и площадь в м². '+$notice }
    if ($msg -match 'подтверждаю запись|записал вас|подтвержден заказ|итоговая стоимость|гарантирую') {return $identity+'Для оформления заявки, окончательной цены и даты визита напишите менеджеру в WhatsApp '+$phone+'.'}
    $out=$identity+$msg
    if (([DateTime]::UtcNow.AddHours(5)).Hour -ge 20) {$out+=' После 20:00 заявки на сегодня не подтверждаем, согласуем завтра.'}
    return $out
}

Write-Host 'ACPro DIRECT Instagram manager: official Meta Page API, local Qwen.'
Write-Host ('Mode='+$mode+'; interval='+$pollSeconds+' sec; Webhook not required.')
if ($mode -eq 'live' -and !$allowAll -and $testSender -eq '') {
    throw 'Live mode requires an explicit test_sender_id or allow_all_inbound=true.'
}
if ($mode -eq 'live' -and $allowAll) {
    Write-Warning 'ALL inbound Instagram DMs can receive automatic replies while this window stays running.'
}
# Only the newest inbound message in each updated conversation is considered per pass.
# First pass is intentionally a baseline: DO NOT reply to historical chats.
while ($true) {
    try {
        $list=Graph-Get ($pageId+'/conversations?platform=instagram&fields=id,updated_time&limit=20')
        $count=0;$candidates=0;$blocked=0
        foreach ($conversation in @($list.data)) {
            if ($null -eq $conversation.id) {continue}
            Start-Sleep -Milliseconds 600
            $cid=[Uri]::EscapeDataString([string]$conversation.id)
            $threadHash=Hash-Id ([string]$conversation.id)
            try {$resp=Graph-Get ($cid+'/messages?fields=id,message,from,to,created_time&limit=10')}
            catch {Write-Warning 'Could not fetch one conversation; no sending.';continue}
            $messages=@($resp.data | Where-Object { $null -ne $_ -and $null -ne $_.id -and $null -ne $_.created_time } | Sort-Object { [DateTimeOffset]::Parse([string]$_.created_time) })
            if ($messages.Count -eq 0) {continue}
            foreach ($item in $messages) {
                $hash=Hash-Id ([string]$item.id)
                if (!$bootstrapped) { [void]$seen.Add($hash) }
            }
            if (!$bootstrapped) {continue}
            $last=$messages[-1]
            $hash=Hash-Id ([string]$last.id)
            if ($seen.Contains($hash)) {continue}
            # Mark all observed messages seen, even ignored/outgoing/unsupported messages.
            foreach($item in $messages) { [void]$seen.Add((Hash-Id ([string]$item.id))) }
            Save-State
            $created=[DateTimeOffset]::Parse([string]$last.created_time).ToUniversalTime()
            $age=[DateTimeOffset]::UtcNow-$created
            if ($created -lt $firstStart -or $age.TotalHours -ge 23 -or $age.TotalSeconds -lt -120) { $blocked++;continue }
            $from=[string]$last.from.id
            if ($from -eq $ownId -or $from -eq $pageId) {
                # A human's outbound reply from the Instagram app pauses the bot.
                # Bot-sent message IDs are pre-marked seen after successful Send API.
                $humanThreads[$threadHash]=[DateTimeOffset]::UtcNow.ToUnixTimeSeconds()+86400
                Save-State
                continue
            }
            if ($humanThreads.ContainsKey($threadHash)) {
                if ([long]$humanThreads[$threadHash] -gt [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()) { continue }
                $humanThreads.Remove($threadHash)
                Save-State
            }
            if ($from -notmatch '^[0-9]{5,32}
            $question=[string]$last.message
            if ([string]::IsNullOrWhiteSpace($question) -or $question.Length -gt 8000) {$blocked++;continue}
            $count++
            $policy=Get-PolicyReply $question
            if ($null -eq $policy) {
                try {$policy=@{reply=(Ask-LocalQwen $question);handoff=$false}}
                catch {$policy=@{reply=($identity+'Не могу надёжно ответить сейчас. Напишите менеджеру в WhatsApp '+$phone+'.');handoff=$true}}
            }
            $reply=[string]$policy.reply
            if ($reply.Length -gt 1000) {$reply=$reply.Substring(0,1000)}
            if ($mode -ne 'live') {
                Write-Host ('DRY-RUN: one new incoming Direct processed; ready to reply. Handoff='+[bool]$policy.handoff)
                continue
            }
            if (!$allowAll -and $from -ne $testSender) {
                Write-Host 'New message from non-test user: no automatic reply.'
                continue
            }
            # At-most-once: persist before sending; ambiguous network errors NEVER auto-retry.
            try {
                $sent=Graph-Send $from $reply
                if ($null -ne $sent.message_id) { [void]$seen.Add((Hash-Id ([string]$sent.message_id))) }
                if ([bool]$policy.handoff) {
                    $humanThreads[$threadHash]=[DateTimeOffset]::UtcNow.ToUnixTimeSeconds()+86400
                }
                Save-State
                Write-Host 'A single Instagram Direct reply was accepted by Meta.'
            } catch {Write-Warning 'Meta did NOT confirm the send; do not retry blindly.'}
        }
        if (!$bootstrapped) {
            $bootstrapped=$true
            Save-State
            Write-Host 'Baseline complete. Historical messages skipped. Send a NEW test Direct now.'
        }
    } catch {
        Write-Warning 'Meta polling failed or rate-limited. Pausing without sending.'
    }
    Start-Sleep -Seconds $pollSeconds
}
 -or !(Has-Recipient $last)) {$blocked++;continue}
            $question=[string]$last.message
            if ([string]::IsNullOrWhiteSpace($question) -or $question.Length -gt 8000) {$blocked++;continue}
            $count++
            $policy=Get-PolicyReply $question
            if ($null -eq $policy) {
                try {$policy=@{reply=(Ask-LocalQwen $question);handoff=$false}}
                catch {$policy=@{reply=($identity+'Не могу надёжно ответить сейчас. Напишите менеджеру в WhatsApp '+$phone+'.');handoff=$true}}
            }
            $reply=[string]$policy.reply
            if ($reply.Length -gt 1000) {$reply=$reply.Substring(0,1000)}
            if ($mode -ne 'live') {
                Write-Host ('DRY-RUN: one new incoming Direct processed; ready to reply. Handoff='+[bool]$policy.handoff)
                continue
            }
            if (!$allowAll -and $from -ne $testSender) {
                Write-Host 'New message from non-test user: no automatic reply.'
                continue
            }
            # At-most-once: persist before sending; ambiguous network errors NEVER auto-retry.
            try {Graph-Send $from $reply | Out-Null;Write-Host 'A single Instagram Direct reply was accepted by Meta.'}
            catch {Write-Warning 'Meta did NOT confirm the send; do not retry blindly.'}
        }
        if (!$bootstrapped) {
            $bootstrapped=$true
            Save-State
            Write-Host 'Baseline complete. Historical messages skipped. Send a NEW test Direct now.'
        }
    } catch {
        Write-Warning 'Meta polling failed or rate-limited. Pausing without sending.'
    }
    Start-Sleep -Seconds $pollSeconds
}
