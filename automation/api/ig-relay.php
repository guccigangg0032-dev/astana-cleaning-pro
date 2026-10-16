<?php
/**
 * ACPro local PC secure relay: GET ?mode=poll ; POST {mode:"reply",event_id:"...",message:"..."}.
 * Requires bearer token from PRIVATE config. No autonomous replies on server.
 */
declare(strict_types=1);
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
function finish(int $code, array $data): never {http_response_code($code); echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit;}
if (empty($_SERVER['HTTPS']) || $_SERVER['HTTPS'] === 'off') finish(403,['error'=>'HTTPS_REQUIRED']);
$cfgFile = getenv('ACPRO_META_CONFIG') ?: dirname(__DIR__, 2) . '/private-acpro-meta/config.php';
if (!is_file($cfgFile) || !is_readable($cfgFile)) finish(503,['error'=>'NOT_CONFIGURED']);
$cfg = require $cfgFile;
$key = $cfg['worker_token'] ?? null;
if (!is_string($key) || strlen($key)<32 || str_starts_with($key,'REPLACE_')) finish(503,['error'=>'NOT_CONFIGURED']);
$header = $_SERVER['HTTP_AUTHORIZATION'] ?? (function_exists('getallheaders') ? (getallheaders()['Authorization'] ?? '') : '');
if (!preg_match('/^Bearer ([A-Za-z0-9_-]{32,})$/D', $header, $m) || !hash_equals($key,$m[1])) finish(401,['error'=>'UNAUTHORIZED']);
$queue=dirname($cfgFile).'/queue';
if (!is_dir($queue) || is_link($queue)) finish(503,['error'=>'NO_QUEUE']);
$done=dirname($cfgFile).'/done';
if (!is_dir($done) && !@mkdir($done,0700,true) && !is_dir($done)) finish(503,['error'=>'NO_STATE']);
if (is_link($done)) finish(503,['error'=>'NO_STATE']);
$method=$_SERVER['REQUEST_METHOD'] ?? '';
if ($method === 'GET' && ($_GET['mode'] ?? '') === 'poll') {
    $out=[];
    foreach (glob($queue.'/*.json') ?: [] as $file) {
        if (count($out)>=5) break;
        if (!preg_match('/\/[0-9a-f]{64}\.json$/D',$file)) continue;
        $entry=json_decode(file_get_contents($file) ?: '',true);
        if (!is_array($entry) || !isset($entry['id'])) continue;
        if (time()-(int)($entry['received_at'] ?? 0)>86400) { @unlink($file); continue; }
        if (is_file($done.'/'.$entry['id'].'.json')) continue;
        $out[]=$entry;
    }
    finish(200,['events'=>$out,'reply_enabled'=>($cfg['replies_enabled']??false)===true]);
}
if ($method !== 'POST') {header('Allow: GET, POST');finish(405,['error'=>'METHOD_NOT_ALLOWED']);}
if ((int)($_SERVER['CONTENT_LENGTH']??0)>12000) finish(413,['error'=>'TOO_LARGE']);
$raw=file_get_contents('php://input',false,null,0,12001);
$body=json_decode($raw===false?'':$raw,true);
if (!is_array($body)) finish(400,['error'=>'INVALID_JSON']);
$id=(string)($body['event_id'] ?? '');
if (!preg_match('/^[a-f0-9]{64}$/D',$id)) finish(400,['error'=>'INVALID_ID']);
$path=$queue.'/'.$id.'.json';
$state=$done.'/'.$id.'.json';
$lockfile=$done.'/'.$id.'.lock';
$lock=fopen($lockfile,'c');
if ($lock===false || !flock($lock,LOCK_EX)) finish(503,['error'=>'STATE_LOCK_FAILED']);
if (is_file($state)) finish(200,['status'=>'already_handled']);
if (!is_file($path)) finish(404,['error'=>'EVENT_NOT_FOUND']);
$event=json_decode(file_get_contents($path) ?: '',true);
if (!is_array($event) || ($event['id'] ?? '')!==$id) finish(400,['error'=>'EVENT_CORRUPT']);
$mode=$body['mode']??'';
if ($mode==='handoff') {
    file_put_contents($state,json_encode(['status'=>'human','at'=>time()]),LOCK_EX);
    @chmod($state,0600); @unlink($path);
    finish(200,['status'=>'human']);
}
if ($mode!=='reply' && $mode!=='reply_handoff') finish(400,['error'=>'BAD_MODE']);
if (($cfg['replies_enabled']??false)!==true) finish(409,['error'=>'REPLIES_DISABLED']);
$msg=$body['message']??null;
if (!is_string($msg) || trim($msg)==='' || strlen($msg)>3000) finish(400,['error'=>'INVALID_MESSAGE']);
if (preg_match('/[₸]|\bKZT\b/i',$msg) && !preg_match('/предвар|ориентир|бастап|алдын ала|preliminar|estimate|\bот\b/iu',$msg)) finish(422,['error'=>'PRICE_DISCLAIMER_REQUIRED']);
$token=$cfg['instagram_access_token']??null;
if (!is_string($token) || strlen($token)<30 || str_starts_with($token,'REPLACE_')) finish(503,['error'=>'INSTAGRAM_TOKEN_MISSING']);
// At-most-once processing: write status before remote send; an ambiguous failure
// requires manual reconciliation rather than risking duplicate replies.
file_put_contents($state,json_encode(['status'=>'sending','at'=>time()]),LOCK_EX);
@chmod($state,0600);
$api='https://graph.instagram.com/v26.0/me/messages';
$payload=json_encode(['recipient'=>['id'=>(string)$event['conversation_id']],'message'=>['text'=>$msg]],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
$ch=curl_init($api);
curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>$payload,CURLOPT_HTTPHEADER=>['Content-Type: application/json','Authorization: Bearer '.$token],CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>20]);
$response=curl_exec($ch);$http=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
if ($response===false || $http<200 || $http>=300) {
    file_put_contents($state,json_encode(['status'=>'uncertain_failed','at'=>time(),'http_status'=>$http]),LOCK_EX);
    finish(502,['error'=>'SEND_NOT_CONFIRMED','http_status'=>$http,'manual_review'=>true]);
}
file_put_contents($state,json_encode(['status'=>'sent','at'=>time()]),LOCK_EX);
if ($mode==='reply_handoff') {
    $humanDir=dirname($cfgFile).'/human-lock';
    if (!is_dir($humanDir)) @mkdir($humanDir,0700,true);
    if (is_dir($humanDir) && !is_link($humanDir)) {
        $humanFile=$humanDir.'/'.hash('sha256',(string)$event['conversation_id']).'.json';
        file_put_contents($humanFile,json_encode(['until'=>time()+86400]),LOCK_EX);
        @chmod($humanFile,0600);
    }
}
@unlink($path);
finish(200,['status'=>'sent']);