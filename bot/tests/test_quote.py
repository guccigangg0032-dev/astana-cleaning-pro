import importlib.util
import json
import pathlib
import re
import unittest
from datetime import datetime, timedelta, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
REPO = ROOT.parent
spec = importlib.util.spec_from_file_location("acpro_quote", ROOT / "quote.py")
quote = importlib.util.module_from_spec(spec)
spec.loader.exec_module(quote)
engine_spec = importlib.util.spec_from_file_location("acpro_engine", ROOT / "engine.py")
engine = importlib.util.module_from_spec(engine_spec)
engine_spec.loader.exec_module(engine)
AT = datetime(2026,10,17,14,0,tzinfo=timezone(timedelta(hours=5)))

class EstimatorTests(unittest.TestCase):
    def quote(self,**params):
        return quote.calculate(params)

    def test_matches_current_website_tariffs(self):
        db=quote.catalog()
        js=(REPO/"script.js").read_text(encoding="utf-8")
        for k,prices in db["cleaning"].items():
            self.assertIn(f"{k}:{{index:",js)
            self.assertRegex(js,re.escape(k)+r":\{index:\d+,rate:"+str(prices["rate"])+",min:"+str(prices["minimum"])+r"\}")
        self.assertIn("Math.max(20,Math.min(2000",js)
        site=(REPO/"site.js").read_text(encoding="utf-8")
        expected={"addonSofa":"sofa","addonChair":"chair","addonWindows":"windows","addonAppliances":"appliances","addonDiningChairs":"dining_chairs","addonFire":"fire","addonBio":"bio","addonCurtainWash":"curtain_wash","addonCurtainIron":"curtain_iron","addonCurtainHang":"curtain_hang"}
        for ident,name in expected.items():
            price=db["extras"][name]["price"]
            self.assertIn("{id:'"+ident+"',sum:"+(str(price) if price is not None else "null")+"}",site)
        self.assertIn('"amounts":[15000,20000,25000]',site)

    def test_general_example(self):
        r=self.quote(service="general",area=50,extras=["sofa"])
        self.assertEqual(r["amount_from"],55000)
        self.assertIn("55 000 ₸",r["message"])
        self.assertIn("предварительный",r["message"])
        self.assertIn("+7 777 614 66 64",r["message"])
        self.assertFalse(r["final_price_confirmed"])
        self.assertFalse(r["booking_confirmed"])

    def test_minimums_and_100_m2(self):
        for k,minval,at100 in (("maintenance",18000,40000),("general",38000,90000),("renovation",52000,120000)):
            with self.subTest(k=k):
                self.assertEqual(self.quote(service=k,area=20)["amount_from"],minval)
                self.assertEqual(self.quote(service=k,area=100)["amount_from"],at100)

    def test_area_boundary(self):
        for area in (0,-1,19,2001,"nan","50m²",True):
            with self.subTest(area=area):
                self.assertEqual(self.quote(service="general",area=area)["kind"],"needs_details")
        self.assertEqual(self.quote(service="general",area=2000)["amount_from"],1800000)

    def test_unknown_area_or_service(self):
        self.assertEqual(self.quote(service="general")["kind"],"needs_details")
        self.assertEqual(self.quote(area=50)["kind"],"needs_details")
        self.assertEqual(self.quote(service="random",area=50)["kind"],"needs_details")

    def test_extra_standalone(self):
        r=self.quote(service="extras",extras=["windows","appliances"])
        self.assertEqual(r["amount_from"],6000)
        self.assertIn("предварительный",r["message"])

    def test_extra_custom_no_invented_prices(self):
        r=self.quote(service="extras",extras=["fire","bio","dining_chairs"])
        self.assertEqual(r["kind"],"individual")
        self.assertIsNone(r["amount_from"])
        self.assertIn("WhatsApp",r["message"])
        r2=self.quote(service="general",area=50,extras=["fire","windows"])
        self.assertEqual(r2["amount_from"],48000)
        self.assertEqual(len(r2["unpriced_extras"]),1)
        self.assertIn("не включено",r2["message"])

    def test_dedup(self):
        self.assertEqual(self.quote(service="extras",extras=["sofa","sofa"])["amount_from"],10000)
        self.assertEqual(self.quote(service="extras",extras=["bad-id"])["kind"],"needs_details")

    def test_induction(self):
        for width,price in [(35,15000),(36,20000),(65,20000),(66,25000)]:
            with self.subTest(width=width):
                r=self.quote(service="induction",width_cm=width)
                self.assertEqual(r["amount_from"],price)
                self.assertIn("+7 776 000 19 66",r["message"])
                self.assertIn("ищем профильных партнёров",r["message"])
        self.assertEqual(self.quote(service="induction")["kind"],"needs_details")
        self.assertEqual(self.quote(service="induction",width_cm=350)["kind"],"needs_details")

    def test_multilingual_preliminary(self):
        for lang,needle in [("kk","алдын ала"),("en","preliminary")]:
            with self.subTest(lang=lang):
                r=quote.calculate({"service":"general","area":50},lang=lang)
                self.assertEqual(r["amount_from"],45000)
                self.assertIn(needle,r["message"].casefold())
                self.assertIn("WhatsApp",r["message"])

    def test_free_text(self):
        for phrase,service,amount in [
            ("Сколько стоит генеральная уборка 50 квадратов и диван?", "general", 55000),
            ("Нужна уборка после ремонта 100 м²", "renovation", 120000),
            ("Посчитай влажную уборку 40 кв м", "maintenance",18000),
            ("Сколько стоит химчистка дивана?", "extras", 10000),
            ("Индукционная панель 60 см сколько стоит?", "induction",20000),
            ("Сколько за окна?", "extras",3000),
        ]:
            with self.subTest(phrase=phrase):
                data=quote.from_text(phrase)
                self.assertIsNotNone(data)
                self.assertEqual(data["service"],service)
                self.assertEqual(quote.calculate(data)["amount_from"],amount)

    def test_no_multiple_items_fabrication(self):
        data=quote.from_text("Сколько стоит химчистка 3 диванов?")
        self.assertTrue(data["multiple_items"])
        self.assertIsNone(quote.calculate(data)["amount_from"])

    def test_unrecognized_is_not_calculation(self):
        self.assertIsNone(quote.from_text("Здравствуйте! Вы работаете сегодня?"))
        self.assertIsNone(quote.from_text("Нужна информация о химчистке мебели"))

    def test_engine_direct(self):
        r=engine.safe_reply({"text":"Посчитай генеральную уборку 50 м2 и диван","channel":"instagram_dm"},when=AT)
        self.assertEqual(r["rule_ids"],["quote"])
        self.assertEqual(r["quote"]["amount_from"],55000)
        self.assertIn("предварительный",r["message"])
        self.assertFalse(r["can_confirm_booking"])

    def test_engine_public(self):
        r=engine.safe_reply({"text":"Посчитай генеральную уборку 50 м2 и диван","channel":"instagram_comment"},when=AT)
        self.assertEqual(r["quote"]["amount_from"],55000)
        self.assertLessEqual(len(r["message"]),280)
        self.assertIn("окончательная",r["message"])
        self.assertIn("WhatsApp",r["message"])

    def test_engine_after_hours(self):
        r=engine.safe_reply({"text":"Посчитай генеральную уборку 50 м2","channel":"instagram_dm"},when=AT.replace(hour=21))
        self.assertIn("51",r["rule_ids"])
        self.assertIn("20:00",r["message"])

    def test_complaint_still_overrides_calc(self):
        r=engine.safe_reply({"text":"Плохо убрали, верните деньги, сколько стоит генеральная уборка 50 м2?","channel":"instagram_dm"},when=AT)
        self.assertTrue(r["requires_human"])
        self.assertEqual(r["rule_ids"],["43"])

if __name__=="__main__":
    unittest.main()
