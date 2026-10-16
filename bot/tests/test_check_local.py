import importlib.util
import pathlib
import sys
import unittest
from unittest.mock import patch

PATH = pathlib.Path(__file__).resolve().parents[1] / "check_local.py"
spec = importlib.util.spec_from_file_location("acpro_check_local", PATH)
local = importlib.util.module_from_spec(spec)
spec.loader.exec_module(local)

class QwenSmokeTests(unittest.TestCase):
    def test_unavailable_service(self):
        with patch.object(sys, "argv", ["check_local.py"]), patch.object(local, "api", side_effect=OSError("not started")):
            self.assertEqual(local.main(), 2)

    def test_no_qwen(self):
        with patch.object(sys, "argv", ["check_local.py"]), patch.object(local, "api", return_value={"models": [{"name": "llama3:latest"}]}):
            self.assertEqual(local.main(), 3)

    def test_list_installed(self):
        with patch.object(sys, "argv", ["check_local.py"]), patch.object(local, "api", return_value={"models": [{"name": "qwen2.5:3b"}]}):
            self.assertEqual(local.main(), 0)

    def test_local_response(self):
        def fake_api(path, payload=None, timeout=5):
            if path == "/api/tags": return {"models": [{"name": "qwen2.5:3b"}]}
            self.assertEqual(path, "/api/chat")
            self.assertEqual(payload["model"], "qwen2.5:3b")
            self.assertFalse(payload["stream"])
            return {"message": {"content": "Я ИИ-менеджер Astana Cleaning Pro, не живой человек."}}
        with patch.object(sys, "argv", ["check_local.py", "--chat"]), patch.object(local, "api", side_effect=fake_api):
            self.assertEqual(local.main(), 0)

    def test_nontransparent_response_rejected(self):
        def fake_api(path, payload=None, timeout=5):
            if path == "/api/tags": return {"models": [{"name": "qwen2.5:3b"}]}
            return {"message": {"content": "Здравствуйте, я менеджер компании."}}
        with patch.object(sys, "argv", ["check_local.py", "--chat"]), patch.object(local, "api", side_effect=fake_api):
            self.assertEqual(local.main(), 5)

if __name__ == "__main__":
    unittest.main()
