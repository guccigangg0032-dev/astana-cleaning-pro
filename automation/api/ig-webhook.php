<?php
/**
 * ACPro Instagram webhook. Deploy to https://acpro.kz/api/ig-webhook.php
 * Never put app secrets here or under public httpdocs.
 * Private config path: <subscription-home>/private-acpro-meta/config.php
 */
declare(strict_types=1);
ini_set('display_errors', '0');
header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond(int $status, string $body): never {
    http_response_code($status);
    echo $body;
    exit;
}
$cfgFile = getenv('ACPRO_META_CONFIG') ?: dirname(__DIR__, 2) . '/private-acpro-meta/config.php';
if (!is_file($cfgFile) || !is_readable($cfgFile)) respond(503, 'Not configured');
$cfg = require $cfgFile;
if (!is_array($cfg)) respond(503, 'Not configured');
$secret = $cfg['app_secret'] ?? null;
$verify = $cfg['verify_token'] ?? null;
if (!is_string($secret) || strlen($secret) < 16 || str_starts_with($secret, 'REPLACE_') || !is_string($verify) || strlen($verify) < 16 || str_starts_with($verify, 'REPLACE_')) respond(503, 'Not configured');
$ownAccount = (string)($cfg['instagram_account_id'] ?? '');
if (!preg_match('/^[0-9]{5,32}$/D', $ownAccount)) respond(503, 'Instagram account not configured');
$method = $_SERVER['REQUEST_METHOD'] ?? '';
if ($method === 'GET') {
    $mode = $_GET['hub_mode'] ?? $_GET['hub.mode'] ?? null;
    $token = $_GET['hub_verify_token'] ?? $_GET['hub.verify_token'] ?? null;
    $challenge = $_GET['hub_challenge'] ?? $_GET['hub.challenge'] ?? null;
    if ($mode !== 'subscribe' || !is_string($token) || !hash_equals($verify, $token) || !is_string($challenge) || !preg_match('/^[\w-]{1,256}$/D', $challenge)) respond(403, 'Forbidden');
    respond(200, $challenge);
}
if ($method !== 'POST') { header('Allow: GET, POST'); respond(405, 'Method not allowed'); }
$length = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($length > 131072) respond(413, 'Too large');
$raw = file_get_contents('php://input', false, null, 0, 131073);
if ($raw === false || strlen($raw) > 131072) respond(413, 'Too large');
$signature = $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '';
$expected = 'sha256=' . hash_hmac('sha256', $raw, $secret);
if (!is_string($signature) || !hash_equals($expected, $signature)) respond(403, 'Forbidden');
// Write only operational counters to a file OUTSIDE the public web root.
// Never store tokens, user IDs, message contents, raw payload, or sender IPs.
function saveWebhookStatus(string $configFile, array $status): void {
    $target = dirname($configFile) . '/webhook-status.json';
    if (is_link($target)) return;
    $json = json_encode($status, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    @file_put_contents($target, $json, LOCK_EX);
    @chmod($target, 0600);
}
try { $event = json_decode($raw, true, 32, JSON_THROW_ON_ERROR); }
catch (JsonException $e) { respond(400, 'Bad JSON'); }
$log = [
    'astana_time' => gmdate('Y-m-d H:i:s', time() + 5 * 3600),
    'signature' => 'valid',
    'object' => ($event['object'] ?? null) === 'instagram' ? 'instagram' : 'other',
    'entries' => is_array($event['entry'] ?? null) ? count($event['entry']) : 0,
    'messaging_events' => 0,
    'queued' => 0,
    'skipped_account_id' => 0,
    'skipped_no_message' => 0,
    'skipped_echo_or_deleted' => 0,
    'skipped_missing_text_or_ids' => 0,
    'skipped_recipient_id' => 0,
    'skipped_human_lock' => 0,
    'skipped_duplicate' => 0,
    'write_failed' => 0,
];
if (!is_array($event) || ($event['object'] ?? null) !== 'instagram') {
    saveWebhookStatus($cfgFile, $log);
    respond(200, 'OK');
}
$queue = dirname($cfgFile) . '/queue';
if (is_link($queue)) respond(503, 'Storage error');
if (!is_dir($queue) && !@mkdir($queue, 0700, true) && !is_dir($queue)) respond(503, 'Storage error');
foreach (($event['entry'] ?? []) as $entry) {
    if (!is_array($entry)) { $log['skipped_account_id']++; continue; }
    if ((string)($entry['id'] ?? '') !== $ownAccount) { $log['skipped_account_id']++; continue; }
    foreach (($entry['messaging'] ?? []) as $item) {
        $log['messaging_events']++;
        if (!is_array($item) || !is_array($item['message'] ?? null)) { $log['skipped_no_message']++; continue; }
        $message = $item['message'];
        if (!empty($message['is_echo']) || !empty($message['is_deleted'])) { $log['skipped_echo_or_deleted']++; continue; }
        $sender = (string)($item['sender']['id'] ?? '');
        $recipient = (string)($item['recipient']['id'] ?? '');
        $mid = (string)($message['mid'] ?? '');
        $text = $message['text'] ?? null;
        if ($sender === '' || $recipient === '' || $mid === '' || !is_string($text) || trim($text) === '' || strlen($text) > 8000 || $sender === $ownAccount) { $log['skipped_missing_text_or_ids']++; continue; }
        if ($recipient !== $ownAccount) { $log['skipped_recipient_id']++; continue; }
        $humanLock = dirname($cfgFile) . '/human-lock/' . hash('sha256', $sender) . '.json';
        if (is_file($humanLock)) {
            $locked = json_decode(file_get_contents($humanLock) ?: '', true);
            if ((int)($locked['until'] ?? 0) > time()) { $log['skipped_human_lock']++; continue; }
            @unlink($humanLock);
        }
        $id = hash('sha256', 'instagram|' . $recipient . '|' . $mid);
        $file = $queue . '/' . $id . '.json';
        if (is_file($file)) { $log['skipped_duplicate']++; continue; }
        $payload = json_encode(['id'=>$id,'channel'=>'instagram_dm','event_id'=>$mid,'conversation_id'=>$sender,'recipient_id'=>$recipient,'text'=>$text,'received_at'=>time()], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $handle = @fopen($file, 'x');
        if ($handle === false) { $log['write_failed']++; continue; }
        @chmod($file, 0600);
        $bytes = fwrite($handle, $payload);
        fclose($handle);
        if ($bytes !== strlen($payload)) { @unlink($file); $log['write_failed']++; continue; }
        $log['queued']++;
    }
}
saveWebhookStatus($cfgFile, $log);
respond(200, 'OK');