<?php
// First-party daily aggregates only. Never collect IP, UA, URLs, referrers or IDs.
declare(strict_types=1);
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

function reply(int $status, array $body = []): void {
    http_response_code($status);
    if ($status !== 204) echo json_encode($body, JSON_UNESCAPED_SLASHES);
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    reply(405, ['error' => 'METHOD_NOT_ALLOWED']);
}
// No CORS support: cross-origin OPTIONS and POST are rejected.
if (($_SERVER['HTTP_ORIGIN'] ?? '') !== 'https://acpro.kz') reply(403, ['error' => 'ORIGIN_FORBIDDEN']);
if (isset($_SERVER['HTTP_SEC_FETCH_SITE']) && $_SERVER['HTTP_SEC_FETCH_SITE'] !== 'same-origin') reply(403, ['error' => 'ORIGIN_FORBIDDEN']);
if (($_SERVER['HTTP_SEC_GPC'] ?? '') === '1' || ($_SERVER['HTTP_DNT'] ?? '') === '1') reply(204);
$type = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
if ($type !== 'application/json') reply(415, ['error' => 'JSON_REQUIRED']);
if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 2048) reply(413, ['error' => 'BODY_TOO_LARGE']);
$raw = file_get_contents('php://input', false, null, 0, 2049);
if ($raw === false || strlen($raw) > 2048) reply(413, ['error' => 'BODY_TOO_LARGE']);
$data = json_decode($raw, true, 8);
if (!is_array($data) || array_keys($data) === range(0, count($data) - 1)) reply(400, ['error' => 'INVALID_INPUT']);
foreach (array_keys($data) as $field) if (!in_array($field, ['consent', 'event', 'page', 'lang', 'calculator', 'source'], true)) reply(400, ['error' => 'INVALID_INPUT']);
if (($data['consent'] ?? null) !== true) reply(400, ['error' => 'CONSENT_REQUIRED']);
$events = ['page_view', 'whatsapp_click', 'phone_click', 'calculator_change', 'quote_handoff', 'test'];
$pages = ['home', 'services', 'prices', 'about', 'faq', 'careers', 'induction', 'partners', 'contact', 'privacy', 'service', 'other', 'uborka-kvartir-astana', 'generalnaya-uborka-astana', 'uborka-posle-remonta-astana', 'himchistka-mebeli-astana', 'moika-okon-astana', 'uborka-ofisov-astana'];
$sources = ['direct', 'google', 'yandex', '2gis', 'instagram', 'threads', 'facebook', 'other'];
$event = $data['event'] ?? null;
$page = $data['page'] ?? null;
$lang = $data['lang'] ?? null;
$calculator = $data['calculator'] ?? 'none';
$source = $data['source'] ?? null;
if (!in_array($event, $events, true) || !in_array($page, $pages, true) || !in_array($lang, ['ru', 'kk', 'en'], true) || !in_array($calculator, ['none', 'quick', 'main', 'induction'], true) || !in_array($source, $sources, true)) reply(400, ['error' => 'INVALID_INPUT']);
$usesCalculator = in_array($event, ['calculator_change', 'quote_handoff'], true);
if (($usesCalculator && $calculator === 'none') || (!$usesCalculator && $calculator !== 'none')) reply(400, ['error' => 'INVALID_INPUT']);

$dir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'private-acpro-metrics';
$lock = null;
$temporary = null;
try {
    umask(0077);
    if (is_link($dir) || (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir))) throw new RuntimeException('STORAGE_UNAVAILABLE');
    $realDir = realpath($dir);
    $public = realpath($_SERVER['DOCUMENT_ROOT'] ?? __DIR__);
    if ($realDir === false || $public === false || $realDir === $public || strpos($realDir, $public . DIRECTORY_SEPARATOR) === 0) throw new RuntimeException('STORAGE_NOT_PRIVATE');
    $lockPath = $realDir . DIRECTORY_SEPARATOR . '.aggregate.lock';
    if (is_link($lockPath)) throw new RuntimeException('STORAGE_UNAVAILABLE');
    $lock = @fopen($lockPath, 'c+b');
    if ($lock === false || !flock($lock, LOCK_EX | LOCK_NB)) throw new RuntimeException('STORAGE_BUSY');
    $zone = new DateTimeZone('Asia/Qyzylorda');
    $today = new DateTimeImmutable('now', $zone);
    $day = $today->format('Y-m-d');
    $isTest = $event === 'test';
    $file = $realDir . DIRECTORY_SEPARATOR . ($isTest ? 'test-' : '') . $day . '.json';
    if (is_link($file)) throw new RuntimeException('STORAGE_UNAVAILABLE');
    $aggregate = ['schema' => 2, 'day' => $day, 'timezone' => 'Asia/Qyzylorda', 'test' => $isTest, 'counts' => []];
    if (is_file($file)) {
        $old = @file_get_contents($file, false, null, 0, 262145);
        if ($old === false || strlen($old) > 262144) throw new RuntimeException('STORAGE_INVALID');
        $aggregate = json_decode($old, true, 8);
        if (!is_array($aggregate) || !in_array($aggregate['schema'] ?? null, [1, 2], true) || ($aggregate['day'] ?? null) !== $day || ($aggregate['test'] ?? null) !== $isTest || !is_array($aggregate['counts'] ?? null)) throw new RuntimeException('STORAGE_INVALID');
        $normalized = [];
        foreach ($aggregate['counts'] as $counter => $value) {
            if (!is_string($counter) || !is_int($value) || $value < 0 || $value > 1000000) throw new RuntimeException('STORAGE_INVALID');
            $parts = explode('|', $counter);
            if (count($parts) === 4 && $aggregate['schema'] === 1) $parts[] = 'other';
            if (count($parts) !== 5 || !in_array($parts[0], $events, true) || !in_array($parts[1], $pages, true) || !in_array($parts[2], ['ru', 'kk', 'en'], true) || !in_array($parts[3], ['none', 'quick', 'main', 'induction'], true) || !in_array($parts[4], $sources, true)) throw new RuntimeException('STORAGE_INVALID');
            $normalized[implode('|', $parts)] = $value;
        }
        $aggregate = ['schema' => 2, 'day' => $day, 'timezone' => 'Asia/Qyzylorda', 'test' => $isTest, 'counts' => $normalized];
    }
    $counter = $event . '|' . $page . '|' . $lang . '|' . $calculator . '|' . $source;
    $aggregate['counts'][$counter] = min(1000000, ($aggregate['counts'][$counter] ?? 0) + 1);
    $encoded = json_encode($aggregate, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($encoded === false) throw new RuntimeException('STORAGE_INVALID');
    $temporary = @tempnam($realDir, '.aggregate-');
    if ($temporary === false || dirname($temporary) !== $realDir) throw new RuntimeException('STORAGE_UNAVAILABLE');
    $out = @fopen($temporary, 'wb');
    if ($out === false) throw new RuntimeException('STORAGE_UNAVAILABLE');
    try {
        $bytes = $encoded . "\n";
        if (fwrite($out, $bytes) !== strlen($bytes) || !fflush($out)) throw new RuntimeException('STORAGE_UNAVAILABLE');
        if (function_exists('fsync') && !fsync($out)) throw new RuntimeException('STORAGE_UNAVAILABLE');
    } finally { fclose($out); }
    @chmod($temporary, 0600);
    if (!@rename($temporary, $file)) throw new RuntimeException('STORAGE_UNAVAILABLE');
    $temporary = null;
    // Retention is traffic-driven; only fixed-format aggregates in this private
    // directory are eligible. There are no raw-event logs or per-user records.
    $cutoff = $today->modify('-90 days')->format('Y-m-d');
    foreach (glob($realDir . DIRECTORY_SEPARATOR . '*.json') ?: [] as $oldFile) {
        if (preg_match('/^(?:test-)?(\d{4}-\d{2}-\d{2})\.json$/D', basename($oldFile), $match) && $match[1] < $cutoff && !is_link($oldFile)) @unlink($oldFile);
    }
    flock($lock, LOCK_UN);fclose($lock);$lock = null;
    reply($isTest ? 200 : 204, $isTest ? ['ok' => true, 'test' => true, 'storage' => 'ready'] : []);
} catch (Throwable $error) {
    if (is_string($temporary) && is_file($temporary)) @unlink($temporary);
    if (is_resource($lock)) { @flock($lock, LOCK_UN); @fclose($lock); }
    // Fixed response only. Paths, exception contents and request data stay out
    // of response/application logs. Hosting access logs have separate settings.
    header('Retry-After: 2');
    reply(503, ['error' => 'METRICS_UNAVAILABLE']);
}
