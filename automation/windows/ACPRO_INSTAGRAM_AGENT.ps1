# ACPro Instagram agent for Windows PowerShell 5.1+; requires no Python and no paid AI API.
# NEVER commit the local private config with the worker token.
$ErrorActionPreference = 'Stop'
$cfgPath = Join-Path $env:APPDATA 'ACPro\instagram-bridge.json'
if (!(Test-Path $cfgPath)) {
    Write-Host 'ACPro setup needed: missing private config.'
    Write-Host ('Expected: ' + $cfgPath)
    Write-Host 'Use private config instructions in LAUNCH.md.'
    exit 2
}
$cfg = Get-Content -Raw -Encoding UTF8 $cfgPath | ConvertFrom-Json
if (!$cfg.server_url -or !$cfg.worker_token -or !$cfg.model) { throw 'Missing required private configuration.' }
$endpoint = ([string]$cfg.server_url).TrimEnd('/') + '/api/ig-relay.php'
if (!$endpoint.StartsWith('https://acpro.kz/')) { throw 'Only ACPro HTTPS relay is permitted.' }
$headers = @{Authorization='Bearer ' + $cfg.worker_token}
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
Write-Host 'ACPro Instagram Qwen manager. Local Ollama; official Meta relay; no browser tokens.'
Write-Host ('Mode: '+[string]$cfg.mode+'. Stop with Ctrl+C; computer must stay awake.')
while ($true) {
    try {
        $incoming=Invoke-RestMethod -Uri ($endpoint+'?mode=poll') -Headers $headers -TimeoutSec 20
        foreach ($evt in $incoming.events) {
            $intent=Get-PolicyReply ([string]$evt.text)
            if ($null -eq $intent) {
                try {$intent=@{reply=(Ask-LocalQwen ([string]$evt.text));handoff=$false}}
                catch {$intent=@{reply=($identity+'Сейчас не могу надёжно ответить. Свяжитесь с менеджером по WhatsApp '+$phone+'.');handoff=$true}}
            }
            $mode=if ($intent.handoff) {'reply_handoff'} else {'reply'}
            $payload=@{mode=$mode;event_id=[string]$evt.id;message=[string]$intent.reply} | ConvertTo-Json -Compress
            if ($cfg.mode -eq 'live' -and $incoming.reply_enabled) {
                try {$sent=Invoke-RestMethod -Uri $endpoint -Method Post -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($payload)) -TimeoutSec 30; Write-Host ('Instagram response status: '+$sent.status)}
                catch {Write-Warning 'Response NOT confirmed. Check relay state; do not blindly retry.';Start-Sleep -Seconds 15}
            } else { Write-Host ('Dry-run estimate prepared for event '+([string]$evt.id).Substring(0,8)+'. Live sending disabled.'); Start-Sleep -Seconds 10 }
        }
    } catch {Write-Warning 'ACPro relay temporarily unavailable; retry in 15 seconds.';Start-Sleep -Seconds 15}
    Start-Sleep -Seconds 6
}