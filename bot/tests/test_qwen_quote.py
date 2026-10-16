import importlib.util
import pathlib
import unittest
from unittest.mock import patch

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("acpro_qwen_quote", ROOT/"qwen_quote.py")
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class QwenQuoteTests(unittest.TestCase):
    def test_valid_extraction_never_trusts_model_prices(self):
        user="Сколько стоит генеральная уборка 50 квадратов с диваном?"
        model={"is_quote":True,"service":"general","area":50,"extras":["sofa"],"width_cm":None,"multiple_items":False,"amount":5,"total":"FREE"}
        parsed=module.parse_extraction(user,model)
        self.assertNotIn("amount",parsed)
        self.assertNotIn("total",parsed)
        with patch.object(module,"qwen_extract",return_value=model):
            answer=module.answer(user)
        self.assertEqual(answer["amount_from"],55000)
        self.assertIn("предварительный",answer["message"])

    def test_no_fabricated_area(self):
        model={"is_quote":True,"service":"general","area":50,"extras":[],"width_cm":None,"multiple_items":False}
        result=module.parse_extraction("Сколько стоит генеральная уборка?",model)
        self.assertIsNone(result["area"])
        self.assertEqual(module.calculate(result)["kind"],"needs_details")

    def test_no_fabricated_service(self):
        model={"is_quote":True,"service":"general","area":50,"extras":[],"width_cm":None,"multiple_items":False}
        result=module.parse_extraction("Сколько за уборку 50 м2?",model)
        self.assertIsNone(result["service"])
        self.assertEqual(module.calculate(result)["kind"],"needs_details")

    def test_qwen_missing_falls_back(self):
        with patch.object(module,"qwen_extract",side_effect=OSError("not running")):
            r=module.answer("Сколько стоит генеральная уборка 50 м2?")
        self.assertEqual(r["amount_from"],45000)
        self.assertFalse(r["used_model_extraction"])

    def test_illegal_extra_rejected(self):
        self.assertIsNone(module.parse_extraction("сколько уборка",{"is_quote":True,"service":"extras","extras":["security_deposit"]}))

    def test_model_cannot_add_unrequested_extras(self):
        user="Сколько стоит генеральная уборка 50 м2?"
        malicious={"is_quote":True,"service":"general","area":50,"extras":["sofa","windows"],"width_cm":None,"multiple_items":False}
        r=module.parse_extraction(user,malicious)
        self.assertEqual(r["extras"],[])
        self.assertEqual(module.calculate(r)["amount_from"],45000)

    def test_model_cannot_invent_unsupported_service_type(self):
        text="Сколько за уборку 50 м2?"
        model={"is_quote":True,"service":"renovation","area":50,"extras":[],"width_cm":None,"multiple_items":False}
        r=module.parse_extraction(text,model)
        self.assertIsNone(r["service"])
        self.assertEqual(module.calculate(r)["kind"],"needs_details")

    def test_duplicate_safeguard(self):
        model={"is_quote":True,"service":"extras","area":None,"extras":["sofa"],"width_cm":None,"multiple_items":False}
        r=module.parse_extraction("Сколько стоят 3 дивана?",model)
        self.assertTrue(r["multiple_items"])
        self.assertIsNone(module.calculate(r)["amount_from"])

    def test_no_pricing_request(self):
        with patch.object(module,"qwen_extract",return_value={"is_quote":False,"service":None,"area":None,"extras":[]}):
            result=module.answer("Здравствуйте")
        self.assertEqual(result["kind"],"not_a_quote")

    def test_induction_specialist(self):
        model={"is_quote":True,"service":"induction","area":None,"width_cm":60,"extras":[],"multiple_items":False}
        with patch.object(module,"qwen_extract",return_value=model):
            result=module.answer("Индукционная панель 60 см сколько будет?")
        self.assertEqual(result["amount_from"],20000)
        self.assertIn("+7 776 000 19 66",result["message"])

if __name__=="__main__":
    unittest.main()
