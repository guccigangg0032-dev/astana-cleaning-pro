import importlib.util, pathlib, tempfile, unittest
from datetime import datetime
from zoneinfo import ZoneInfo
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('acpro_engine',ROOT/'engine.py')
engine=importlib.util.module_from_spec(spec);spec.loader.exec_module(engine)
DT=lambda hour:datetime(2026,10,17,hour,30,tzinfo=ZoneInfo('Asia/Almaty'))

class SafetyTests(unittest.TestCase):
    def reply(self,text,**kwargs):
        return engine.safe_reply({'text':text,'channel':'instagram_dm',**kwargs},when=DT(14))
    def test_rules_count(self):self.assertEqual(len(engine.read_rows()),53)
    def test_bot_identity(self):
        for phrase in ('Ты бот?','Вы человек?','Я с человеком разговариваю?','Кто мне отвечает?','are you a bot?'):
            with self.subTest(phrase=phrase):
                r=self.reply(phrase);self.assertIn('45',r['rule_ids']);self.assertIn('ИИ-менеджер' if r['language']=='ru' else 'AI assistant' if r['language']=='en' else 'ЖИ-менеджер',r['message'])
    def test_developer_route(self):
        for phrase in ('Кто разработчик?','Хочу такого бота','Who developed this?'):
            with self.subTest(phrase=phrase):
                r=self.reply(phrase);self.assertEqual(r['rule_ids'][0],'52');self.assertIn('776 000 19 66',r['message'])
    def test_service_phone_separate(self):
        r=self.reply('как заказать');self.assertIn('777 614 66 64',r['message'])
    def test_human_handoff(self):
        r=self.reply('Позовите менеджера');self.assertTrue(r['requires_human']);self.assertIn('44',r['rule_ids'])
    def test_complaint_override(self):
        r=self.reply('Вы бот? Плохо убрали, верните деньги');self.assertTrue(r['requires_human']);self.assertEqual(r['rule_ids'][0],'43')
    def test_no_final_price(self):
        r=self.reply('цена уборки');self.assertFalse(r['can_set_final_price']);self.assertFalse(r['can_confirm_booking'])
    def test_after_hours(self):
        r=engine.safe_reply({'text':'цена','channel':'instagram_dm'},when=DT(21));self.assertIn('51',r['rule_ids']);self.assertIn('20:00',r['message'])
    def test_before_hours(self):
        r=engine.safe_reply({'text':'цена','channel':'instagram_dm'},when=DT(14));self.assertNotIn('51',r['rule_ids'])
    def test_hello(self):self.assertEqual(self.reply('Здравствуйте!')['rule_ids'][0],'46')
    def test_thanks(self):self.assertEqual(self.reply('Спасибо!')['rule_ids'][0],'47')
    def test_kk_lang(self):self.assertEqual(self.reply('Қанша тұрады?')['language'],'kk')
    def test_kz_latin(self):self.assertEqual(self.reply('qansha?')['language'],'kk')
    def test_en_lang(self):self.assertEqual(self.reply('how much?')['language'],'en')
    def test_photo(self):
        r=engine.safe_reply({'media_type':'photo','channel':'instagram_dm'},when=DT(14));self.assertTrue(r['requires_human']);self.assertIn('48',r['rule_ids'])
    def test_public_private(self):
        r=engine.safe_reply({'text':'плохо убрали','channel':'instagram_comment'},when=DT(14));self.assertTrue(r['requires_human']);self.assertNotIn('адрес',r['message'].lower())
    def test_public_fallback(self):
        r=engine.safe_reply({'text':'asdfghjkl','channel':'instagram_comment'},when=DT(14));self.assertLessEqual(len(r['message']),290)
    def test_suspicious_spam(self):self.assertEqual(self.reply('легкий заработок онлайн')['action'],'ignore')
    def test_unknown_channel(self):
        with self.assertRaises(ValueError):engine.safe_reply({'text':'Привет','channel':'x'},when=DT(14))
    def test_duplicate_and_limit(self):
        with tempfile.TemporaryDirectory() as td:
            state=engine.SafeState(str(pathlib.Path(td)/'test.sqlite'))
            ev={'text':'цена?','channel':'instagram_dm','conversation_id':'alice','event_id':'1'}
            self.assertEqual(state.process(ev,when=DT(14))['action'],'reply')
            self.assertEqual(state.process(ev,when=DT(14))['reason'],'duplicate_event')
            for i in range(2,6):self.assertEqual(state.process({**ev,'event_id':str(i)},when=DT(14))['action'],'reply')
            self.assertEqual(state.process({**ev,'event_id':'6'},when=DT(14))['reason'],'rate_limit_5_per_hour')
    def test_human_lock(self):
        with tempfile.TemporaryDirectory() as td:
            state=engine.SafeState(str(pathlib.Path(td)/'state.sqlite'))
            msg={'conversation_id':'alice','channel':'instagram_dm','event_id':'a','text':'Верните деньги'}
            r=state.process(msg,when=DT(14));self.assertTrue(r['requires_human'])
            msg.update(event_id='b',text='еще вопрос')
            self.assertEqual(state.process(msg,when=DT(15))['reason'],'human_takeover')
    def test_override(self):self.assertEqual(self.reply('цена?',manual_override=True)['reason'],'human_override')
if __name__=='__main__': unittest.main()