#!/usr/bin/env python3
"""ACPro safe, local, deterministic triage for an eventual Qwen + Meta integration.

No external API, credentials, message sending or website changes.
Usage:  python bot/engine.py --text 'Вы бот?' --channel instagram_dm
        echo '{"event_id":"test-1","conversation_id":"demo","text":"цена?","channel":"instagram_dm"}' | python bot/engine.py --jsonl
"""
from __future__ import annotations
import argparse
import csv
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import unicodedata

TZ = ZoneInfo('Asia/Almaty')  # Current Astana local time, UTC+05:00.
DATA = Path(__file__).with_name('answers.csv')
PUBLIC_CHANNELS = {'instagram_comment', 'threads_reply'}
SUPPORTED_CHANNELS = PUBLIC_CHANNELS | {'instagram_dm', 'website', 'other'}
KAZAKH = set('әғқңөұүһі')
KAZAKH_LAT = ('qansha', 'kansha', 'bagasy', 'baga', 'tazalau', 'kerek', 'rahmet', 'salem', 'qalai', 'qanday', 'kanday')
EN = ('how much', 'price', 'hello', 'cleaning', 'booking', 'who are you', 'are you', 'developer', 'your service')
SPAM = ('заработок онлайн', 'легкий заработок', 'подпишись на меня', 'подписывайтесь', 'join my channel', 'earn money fast')
AI_ID = '45'
DEV_ID = '52'
HUMAN_ID = '44'
COMPLAINT_ID = '43'
AFTER_HOURS = '51'
FALLBACK = '50'
PHOTO = '48'
VOICE = '49'
SPECIAL = {AFTER_HOURS, FALLBACK, PHOTO, VOICE}
# Direct human handoff must differ from a question like "Я с человеком разговариваю?".
HUMAN_REQUEST = ('позовите менеджера', 'позвать менеджера', 'хочу с менеджером', 'хочу с человеком', 'соедините с оператором', 'дайте оператора', 'нужен менеджер', 'нужен человек', 'живой менеджер', 'не хочу с ботом', 'хочу живого человека', 'хочу поговорить с человеком')
DEV_REQUEST = ('разработчик', 'разработчика', 'кто разработал', 'кто создал', 'кто тебя создал', 'кто вас создал', 'внедрение ии', 'хочу такого бота', 'создать такого бота', 'заказать бота', 'заказать ии', 'автоматизация бизнеса', 'who built', 'developer', 'who developed', 'әзірлеуші')


def normalize(s: str) -> str:
    """Normalize typography and KZ/RU diacritics but preserve word boundaries."""
    s = unicodedata.normalize('NFKC', str(s or '')).lower().replace('ё', 'е')
    s = s.translate(str.maketrans({'ә':'а','ғ':'г','қ':'к','ң':'н','ө':'о','ұ':'у','ү':'у','һ':'х','і':'и','ä':'a','ğ':'g','ş':'s','ı':'i'}))
    s = ''.join(c for c in unicodedata.normalize('NFKD', s) if not unicodedata.combining(c))
    s = re.sub(r'([^\W\d_])\1{2,}', r'\1\1', s, flags=re.UNICODE)
    s = re.sub(r'[^\w\s]', ' ', s, flags=re.UNICODE)
    return ' '.join(s.split())


def detect_lang(message: str) -> str:
    lower = message.lower()
    if any(c in KAZAKH for c in lower):
        return 'kk'
    n = normalize(lower)
    if any(re.search(r'(?<!\w)'+re.escape(x)+r'(?!\w)', n) for x in KAZAKH_LAT):
        return 'kk'
    if any(t in n for t in EN):
        return 'en'
    return 'ru'


def read_rows(path: Path = DATA) -> list[dict]:
    with path.open('r', encoding='utf-8-sig', newline='') as fh:
        rows = list(csv.DictReader(fh))
    if not rows or len({r['id'] for r in rows}) != len(rows):
        raise ValueError('Empty or duplicate-id answer rules')
    mandatory = {'45', '43', '44', '50', '51', '52', '53'}
    if not mandatory.issubset({r['id'] for r in rows}):
        raise ValueError('Missing required identity, escalation or contact rules')
    return rows


def matches(message: str, key: str) -> bool:
    k = normalize(key)
    if not k: return False
    if ' ' in k:
        return bool(re.search(r'(?<!\w)'+re.escape(k)+r'(?!\w)', message))
    # Word matching with endings for 4+ character stems. Short keys require exact match.
    return bool(re.search(r'(?<!\w)'+re.escape(k)+(r'\w*' if len(k) >= 4 else r'')+r'(?!\w)', message))


def best_matches(text: str, rows: list[dict]) -> list[dict]:
    n = normalize(text)
    found = []
    for r in rows:
        if r['id'] in SPECIAL or r['тип']=='вежливость': continue
        keys = [k.strip() for field in ('ключи_ru','ключи_kk','ключи_lat_en') for k in r.get(field,'').split(';') if k.strip()]
        best = max((len(normalize(k)) for k in keys if matches(n, k)),default=0)
        if best:
            found.append((int(r['приоритет']),best,r))
    found.sort(key=lambda x:(x[0],x[1]),reverse=True)
    return [r for _,_,r in found[:3]]


def safe_reply(event: dict, rows: list[dict] | None = None, when: datetime | None = None) -> dict:
    """Pure decision, never sends, saves or claims a booking was confirmed."""
    rows = rows or read_rows()
    lookup = {r['id']:r for r in rows}
    text = str(event.get('text') or '').strip()
    channel = event.get('channel','other')
    if channel not in SUPPORTED_CHANNELS:
        raise ValueError(f'Unknown channel: {channel!r}')
    when = when or datetime.now(TZ)
    when = when.astimezone(TZ) if when.tzinfo else when.replace(tzinfo=TZ)
    lang = event.get('language') or detect_lang(text)
    if lang not in ('ru','kk','en'):
        lang = 'ru'
    res = {'action':'reply','language':lang,'channel':channel,'rule_ids':[], 'message':'', 'requires_human':False, 'can_confirm_booking':False, 'can_set_final_price':False}
    if event.get('manual_override'):
        return {**res, 'action':'ignore','reason':'human_override'}
    if any(normalize(s) in normalize(text) for s in SPAM):
        return {**res, 'action':'ignore','reason':'spam'}
    if (not text) and not event.get('media_type'):
        return {**res, 'action':'ignore','reason':'empty'}
    n = normalize(text)
    if event.get('media_type') in ('image','photo'):
        selected = [lookup[PHOTO]]
        res['requires_human'] = True
    elif event.get('media_type') == 'voice':
        selected = [lookup[VOICE]]
        res['requires_human'] = True
    else:
        # Complaints override every other pattern, including cost and AI questions.
        complaint = best_matches(text,[lookup[COMPLAINT_ID]])
        if complaint:
            selected = complaint
            res['requires_human'] = True
        elif any(matches(n,k) for k in DEV_REQUEST):
            selected = [lookup[DEV_ID]]
        elif any(matches(n,k) for k in HUMAN_REQUEST):
            selected = [lookup[HUMAN_ID]]
            res['requires_human'] = True
        elif any(matches(n,k) for k in lookup[AI_ID]['ключи_ru'].split(';')+lookup[AI_ID]['ключи_kk'].split(';')+lookup[AI_ID]['ключи_lat_en'].split(';')):
            selected = [lookup[AI_ID]]
        else:
            selected = best_matches(text,rows)
            if not selected:
                polite = [r for r in rows if r['тип']=='вежливость' and any(matches(n,k.strip()) for field in ('ключи_ru','ключи_kk','ключи_lat_en') for k in r.get(field,'').split(';') if k.strip())]
                selected = [polite[0]] if polite else [lookup[FALLBACK]]
    res['rule_ids'] = [x['id'] for x in selected]
    if res['requires_human'] and channel in PUBLIC_CHANNELS:
        messages = {'ru':'Спасибо за сообщение. Для личного решения вопроса напишите нам в WhatsApp: +7 777 614 66 64.','kk':'Хабарламаңызға рақмет. Жеке қарастыру үшін WhatsApp арқылы жазыңыз: +7 777 614 66 64.','en':'Thank you. For personal assistance, please contact us via WhatsApp: +7 777 614 66 64.'}
        msg = messages[lang]
    else:
        msg = '\n\n'.join(r.get('ответ_'+lang) or r['ответ_ru'] for r in selected)
    # Public comments: concise, no request for client personal information in comments.
    if channel in PUBLIC_CHANNELS and not res['requires_human'] and selected[0]['id'] not in (AI_ID,DEV_ID):
        msg = msg[:280].rsplit(' ',1)[0] if len(msg)>280 else msg
        if len(msg)>=270:msg=msg.rstrip(' ,.;:')+'…'
    if when.hour >= 20 and res['action']=='reply':
        note = lookup[AFTER_HOURS].get('ответ_'+lang) or lookup[AFTER_HOURS]['ответ_ru']
        if note and note not in msg:
            msg += '\n\n'+note
        res['rule_ids'].append(AFTER_HOURS)
    res['message'] = msg
    return res


class SafeState:
    """Optional local dedup, one reply per event, 5 replies/hour, 24h human takeover.

    No raw message text or personal IDs stored: only SHA-256 of IDs, action and time.
    Use a location outside the public web root; do not share this state DB with clients.
    """
    def __init__(self, db_path: str):
        self.connection = sqlite3.connect(db_path,timeout=10,isolation_level=None)
        self.connection.execute('PRAGMA busy_timeout=10000')
        self.connection.execute('CREATE TABLE IF NOT EXISTS seen (event TEXT PRIMARY KEY, conversation TEXT NOT NULL, at INTEGER NOT NULL)')
        self.connection.execute('CREATE TABLE IF NOT EXISTS sent (conversation TEXT NOT NULL, at INTEGER NOT NULL)')
        self.connection.execute('CREATE TABLE IF NOT EXISTS human_lock (conversation TEXT PRIMARY KEY, until INTEGER NOT NULL)')
    def process(self,event:dict,when:datetime|None=None)->dict:
        event_id,conv_id = str(event.get('event_id') or ''),str(event.get('conversation_id') or '')
        if not event_id or not conv_id:
            raise ValueError('event_id and conversation_id are required for de-duplication')
        when = when or datetime.now(TZ)
        t = int(when.timestamp()); eid = hashlib.sha256(event_id.encode()).hexdigest();cid = hashlib.sha256(conv_id.encode()).hexdigest()
        db=self.connection
        db.execute('BEGIN IMMEDIATE')
        try:
            if db.execute('SELECT 1 FROM seen WHERE event=?',(eid,)).fetchone():
                result={'action':'ignore','reason':'duplicate_event'}
            else:
                db.execute('INSERT INTO seen VALUES (?,?,?)',(eid,cid,t))
                lock=db.execute('SELECT until FROM human_lock WHERE conversation=?',(cid,)).fetchone()
                if lock and lock[0]>t:
                    result={'action':'ignore','reason':'human_takeover'}
                else:
                    count=db.execute('SELECT count(*) FROM sent WHERE conversation=? AND at>?',(cid,t-3600)).fetchone()[0]
                    if count>=5:
                        result={'action':'ignore','reason':'rate_limit_5_per_hour'}
                    else:
                        result=safe_reply(event,when=when)
                        if result['action']=='reply':
                            db.execute('INSERT INTO sent VALUES (?,?)',(cid,t))
                            if result['requires_human']:
                                db.execute('INSERT OR REPLACE INTO human_lock VALUES (?,?)',(cid,t+86400))
            db.execute('COMMIT')
            return result
        except Exception:
            db.execute('ROLLBACK')
            raise


def main():
    p=argparse.ArgumentParser(description='Dry-run ACPro chatbot policy, no platform posting')
    p.add_argument('--text',help='One message to classify')
    p.add_argument('--channel',default='instagram_dm',choices=sorted(SUPPORTED_CHANNELS))
    p.add_argument('--jsonl',action='store_true',help='Read newline-delimited JSON events from stdin')
    p.add_argument('--db',help='Optional local sqlite file for deduplication and human handoff')
    args=p.parse_args()
    if not args.jsonl and not args.text: p.error('Provide --text or --jsonl')
    state=SafeState(args.db) if args.db else None
    def one(event):
        try:return state.process(event) if state else safe_reply(event)
        except Exception as ex:return {'action':'error','error':str(ex)}
    if args.jsonl:
        import sys
        for line in sys.stdin:
            if not line.strip():continue
            try: print(json.dumps(one(json.loads(line)),ensure_ascii=False))
            except Exception as e:print(json.dumps({'action':'error','error':str(e)},ensure_ascii=False))
    else:
        print(json.dumps(one({'text':args.text,'channel':args.channel}),ensure_ascii=False,indent=2))

if __name__ == '__main__': main()