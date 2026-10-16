#!/usr/bin/env python3
"""ACPro preliminary estimator. Never final prices, sends or API calls.

Accepts validated structured fields from a regular bot or Qwen tool extraction.
Only site-backed rules from pricing_catalog.json determine the arithmetic.
"""
from __future__ import annotations
import argparse
import json
from decimal import Decimal, InvalidOperation
from pathlib import Path
import re
import unicodedata

CATALOG = Path(__file__).with_name("pricing_catalog.json")
TITLES = {
    "ru": {"maintenance": "Поддерживающая уборка", "general": "Генеральная уборка", "renovation": "Уборка после ремонта", "extras": "Отдельные услуги", "induction": "Индукционная панель"},
    "kk": {"maintenance": "Қолдаушы тазалау", "general": "Күрделі тазалау", "renovation": "Жөндеуден кейінгі тазалау", "extras": "Жеке қызметтер", "induction": "Индукциялық панель"},
    "en": {"maintenance": "Maintenance cleaning", "general": "Deep cleaning", "renovation": "Post-renovation cleaning", "extras": "Individual services", "induction": "Induction hob"},
}
NOTES = {
    "ru": "Это только предварительный расчёт «от», не окончательная цена и не подтверждение записи. Точную стоимость и возможность выезда согласует человек лично по телефону или в WhatsApp",
    "kk": "Бұл тек алдын ала «бастап» есеп, соңғы баға да, жазылудың расталуы да емес. Нақты құн мен бару мүмкіндігін маман телефон арқылы немесе WhatsApp-та жеке келіседі",
    "en": "This is a preliminary 'from' estimate, not a final quote or a booking confirmation. A person must confirm the final price and visit by phone or WhatsApp",
}
ASK_AREA = {
    "ru": "Для предварительного расчёта уточните площадь помещения в м². Точную цену согласует человек по телефону или в WhatsApp",
    "kk": "Алдын ала есептеу үшін бөлменің ауданын м² бойынша көрсетіңіз. Нақты бағаны маман телефон немесе WhatsApp арқылы келіседі",
    "en": "Please tell us the area in m² for a preliminary estimate. A person confirms final pricing by phone or WhatsApp",
}
ASK_TYPE = {
    "ru": "Уточните вид уборки: поддерживающая, генеральная или после ремонта, и площадь в м². Точную стоимость согласует человек по телефону или в WhatsApp",
    "kk": "Тазалау түрін (қолдаушы, күрделі, жөндеуден кейін) және м² ауданды нақтылаңыз. Соңғы баға телефон не WhatsApp арқылы келісіледі",
    "en": "Which cleaning type (maintenance, deep or post-renovation) and area in m²? A person confirms final pricing by phone or WhatsApp",
}
ASK_WIDTH = {
    "ru": "Для ориентира по индукционной панели укажите ширину в сантиметрах. Мы пока ищем профильных партнёров: возможность обработки и окончательную цену уточняет человек по WhatsApp",
    "kk": "Индукциялық панель үшін енін сантиметрмен көрсетіңіз. Маман серіктестерді іздеп жатырмыз; мүмкіндік пен соңғы бағаны WhatsApp-та маман нақтылайды",
    "en": "Please provide your induction hob's width in centimetres. We are seeking specialist partners; a person must confirm feasibility and final price via WhatsApp",
}
MANUAL = {
    "ru": "По этой услуге цена определяется индивидуально после оценки. Не могу назвать достоверную сумму автоматически. Уточните подробности лично по телефону или WhatsApp",
    "kk": "Бұл қызметтің бағасы жағдайды бағалаудан кейін жеке есептеледі. Автоматты түрде нақты сома айта алмаймын. Телефон немесе WhatsApp арқылы нақтылаңыз",
    "en": "This service requires an individual assessment; I can't reliably calculate a price automatically. Please clarify details by phone or WhatsApp",
}

def catalog() -> dict:
    return json.loads(CATALOG.read_text(encoding="utf-8"))

def money(n: int) -> str:
    return f"{n:,}".replace(",", " ") + " ₸"

def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", str(text or "")).casefold().replace("ё", "е")
    text = re.sub(r"[^\w\s.,-]", " ", text)
    return " ".join(text.split())

def from_text(text: str) -> dict | None:
    """Conservative extraction. No guessing area, quantity or missing service."""
    raw = normalize(text)
    if not raw:
        return None
    wants_price = bool(re.search(r"сколько|скок|цен[ауы]|стоим|рассчит|посчит|подсчит|расчет|расчёт|примерн|ориентир|прайс|баға|қанша|baga|qansha|price|cost|estimate|quote|how much|от \d", raw))
    induction = bool(re.search(r"индукц|индукцион|induction", raw))
    if induction:
        m = re.search(r"(?<!\d)(\d{1,3})(?:[.,]\d+)?\s*(?:см|cm|сантиметр\w*)\b", raw)
        return {"service":"induction", "width_cm": int(m.group(1)) if m else None}
    if re.search(r"после\s+пожар|после\s+смерт|гниль|гниен|трупн|биозагрязн", raw):
        return {"service": "extras", "extras": ["fire" if "пожар" in raw else "bio"]}
    service = None
    if re.search(r"генерал|ген\s+уборк|глубок\w*\s+уборк|күрделі|deep clean", raw):
        service = "general"
    elif re.search(r"после\s+ремонт|постремонт|жөндеуден|post.renovation", raw):
        service = "renovation"
    elif re.search(r"поддержива|влажн\w*\s+уборк|регулярн\w*\s+уборк|қолдаушы|maintenance clean", raw):
        service = "maintenance"
    extras = []
    extra_patterns = [
        ("sofa", r"диван|sofa"),
        ("chair", r"кресл|armchair"),
        ("windows", r"окн[аоуы]?|окон|витраж|терезе|window"),
        ("appliances", r"бытов\w*\s+техник|духовк|микроволнов|холодильник|appliance|oven"),
        ("dining_chairs", r"стуль|стульев|орындық|dining chair"),
        ("curtain_wash", r"стирк\w*\s+штор|постират\w*\s+штор|curtain wash"),
        ("curtain_iron", r"глажк\w*\s+штор|поглад\w*\s+штор|curtain iron"),
        ("curtain_hang", r"снять\w*\s+штор|навешиван\w*\s+штор|повесит\w*\s+штор|curtain hang"),
    ]
    for key, pat in extra_patterns:
        if re.search(pat,raw):
            extras.append(key)
    # Any mention of a sofa cannot justify counting multiple sofas as one fixed bundle.
    multiple_items = bool(re.search(r"\b(?:[2-9]|\d{2,})\s*(?:диван|кресл|окн|окон|стул|стуль|духов|холодильник|sofa|chairs|windows)",raw))
    area_match = re.search(r"(?<!\d)(\d{1,4})(?:[.,]\d+)?\s*(?:м2|кв\s*м|квадрат\w*|sqm|square meters?)\b",raw)
    if area_match is None:
        area_match = re.search(r"(?:площад[ьи]|квартира|квартиры|дом|үй|area)\s*(?:около|примерно|порядка|about)?\s*(\d{1,4})\b",raw)
    area = int(area_match.group(1)) if area_match else None
    if not (wants_price or (service and area is not None)):
        return None
    if multiple_items:
        return {"service":"extras", "extras":extras, "multiple_items":True}
    if service:
        return {"service":service, "area":area, "extras":extras}
    if extras and area is None:
        return {"service":"extras", "extras":extras}
    if area is not None:
        return {"service":None, "area":area}
    if extras:
        return {"service":"extras", "extras":extras}
    return None

def calculate(request: dict, lang: str = "ru") -> dict:
    """Pure structured estimator; both rule bot and Qwen must call this."""
    db = catalog()
    lang = lang if lang in NOTES else "ru"
    service = request.get("service")
    phone = db["phones"]["specialist" if service == "induction" else "cleaning"]
    header = {"kind":"estimate","language":lang,"service":service,"currency":"KZT","amount_from":None,"preliminary":True,"final_price_confirmed":False,"booking_confirmed":False,"phone":"+7 "+phone[1:4]+" "+phone[4:7]+" "+phone[7:9]+" "+phone[9:11]}
    phone_text = header["phone"]
    if request.get("multiple_items"):
        return {**header,"kind":"needs_details","message": MANUAL[lang]+": "+phone_text+". Уточните количество и состав услуг." if lang=="ru" else MANUAL[lang]+": "+phone_text}
    if service == "induction":
        try:
            raw = request.get("width_cm")
            width = Decimal(str(raw)) if raw is not None and not isinstance(raw,bool) else None
        except (InvalidOperation, ValueError):
            width = None
        if width is None or not width.is_finite() or width <= 0:
            return {**header,"kind":"needs_details","message": ASK_WIDTH[lang]+": "+phone_text}
        if width > 200:
            return {**header,"kind":"needs_details","message": ASK_WIDTH[lang]+": "+phone_text}
        tiers=db["induction"]["tiers"]
        price = next(t["price"] for t in tiers if t["max_width_cm"] is None or width <= t["max_width_cm"])
        if lang=="ru":
            message=f"Индукционная панель шириной {width} см: ориентир от {money(price)}. Мы пока ищем профильных партнёров. Возможность безопасной обработки оценивается по модели и состоянию поверхности. "+NOTES[lang]+": "+phone_text+"."
        else:
            message=TITLES[lang]["induction"]+": "+("шамамен " if lang=="kk" else "from ")+money(price)+". "+NOTES[lang]+": "+phone_text+"."
        return {**header,"kind":"estimate","amount_from":price,"message":message}
    if service is None:
        return {**header,"kind":"needs_details","message":ASK_TYPE[lang]+": "+phone_text}
    if service not in db["cleaning"] and service!="extras":
        return {**header,"kind":"needs_details","message":ASK_TYPE[lang]+": "+phone_text}
    supplied_extras=request.get("extras") or []
    if not isinstance(supplied_extras,list) or any(not isinstance(x,str) for x in supplied_extras):
        return {**header,"kind":"needs_details","message": MANUAL[lang]+": "+phone_text}
    extras=list(dict.fromkeys(supplied_extras))
    if any(x not in db["extras"] for x in extras):
        return {**header,"kind":"needs_details","message": MANUAL[lang]+": "+phone_text}
    if service=="extras" and not extras:
        return {**header,"kind":"needs_details","message": MANUAL[lang]+": "+phone_text}
    base=0
    area=None
    parts=[]
    if service != "extras":
        raw=request.get("area")
        try:
            area=Decimal(str(raw)) if raw is not None and not isinstance(raw,bool) else None
        except (InvalidOperation,ValueError):
            area=None
        if area is None or not area.is_finite():
            return {**header,"kind":"needs_details","message":ASK_AREA[lang]+": "+phone_text}
        if area < db["area_min"] or area > db["area_max"]:
            return {**header,"kind":"needs_details","message": ASK_AREA[lang]+f" (20–2000 м²): "+phone_text}
        tariff=db["cleaning"][service]
        base=max(tariff["minimum"],int(area*tariff["rate"]))
        parts.append(TITLES[lang][service]+f" ({area} м²): "+money(base))
    extra_min=0
    unknown=[]
    for item in extras:
        data=db["extras"][item]
        if data["price"] is None:
            unknown.append(data["label_"+lang])
        else:
            extra_min+=data["price"]
            parts.append(data["label_"+lang]+": "+money(data["price"]))
    total=base+extra_min
    if total<=0:
        return {**header,"kind":"individual","message":MANUAL[lang]+": "+phone_text}
    if lang=="ru":
        message="Предварительный расчёт ACPro: "+"; ".join(parts)+f". Итого от {money(total)}."
        if unknown:
            message+=" Отдельно по запросу (не включено в сумму): "+", ".join(unknown)+"."
        message+=" "+NOTES[lang]+": "+phone_text+"."
    else:
        message="; ".join(parts)+(". " if parts else "")+("Барлығы бастап " if lang=="kk" else "Total from ")+money(total)+". "
        if unknown:
            message+=("Қосымша жеке есептеледі: " if lang=="kk" else "Not included, quoted separately: ")+", ".join(unknown)+". "
        message+=NOTES[lang]+": "+phone_text+"."
    return {**header,"kind":"estimate","area":float(area) if area is not None else None,"extras":extras,"amount_from":total,"unpriced_extras":unknown,"message":message}

def main():
    p=argparse.ArgumentParser(description="Local ACPro quote estimator; no outbound messages")
    group=p.add_mutually_exclusive_group(required=True)
    group.add_argument("--text",help="Conservative free-text estimate")
    group.add_argument("--request-json",help="Structured JSON containing service, area, extras or induction width")
    p.add_argument("--lang",default="ru",choices=["ru","kk","en"])
    args=p.parse_args()
    try:
        req=from_text(args.text) if args.text is not None else json.loads(args.request_json)
        if req is None:
            result={"kind":"needs_details","message":"Уточните вид услуги, площадь или размеры. "+NOTES[args.lang]+": +7 777 614 66 64."}
        else:
            result=calculate(req,lang=args.lang)
        print(json.dumps(result,ensure_ascii=False,indent=2))
    except (ValueError,TypeError,KeyError) as e:
        p.error("Invalid estimate request: "+str(e))

if __name__=="__main__":
    main()
