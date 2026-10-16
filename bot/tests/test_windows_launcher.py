import pathlib
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]

class WindowsLauncherTests(unittest.TestCase):
    def test_windows_launcher_has_crlf_not_lf(self):
        b=(ROOT/'TEST_QWEN_WINDOWS.cmd').read_bytes()
        self.assertTrue(b.startswith(b'@echo off\r\n'))
        self.assertGreater(b.count(b'\r\n'),30)
        self.assertEqual(b.count(b'\n'),b.count(b'\r\n'))
        self.assertNotIn(b'\xef\xbb\xbf',b[:3])

    def test_windows_launcher_expects_existing_python_and_qwen(self):
        s=(ROOT/'TEST_QWEN_WINDOWS.cmd').read_text(encoding='utf-8')
        self.assertIn('qwen_quote.py',s)
        self.assertIn('where py',s)
        self.assertIn('where python',s)
        self.assertIn('used_model_extraction',s)
        self.assertIn('Press any key to close',s)

if __name__=='__main__': unittest.main()
