"""Self-contained integration tests for PHP webhook under built-in server. No Meta API calls."""
import hashlib,hmac,json,os,subprocess,tempfile,time,urllib.error,urllib.parse,urllib.request,unittest,shutil
from pathlib import Path
BASE=Path(__file__).resolve().parents[1]
class WebhookTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.t=tempfile.TemporaryDirectory(); cls.dir=Path(cls.t.name)
  (cls.dir/'httpdocs'/'api').mkdir(parents=True)
  (cls.dir/'private-acpro-meta').mkdir()
  for name in ('ig-webhook.php','ig-relay.php'):shutil.copy(BASE/'api'/name,cls.dir/'httpdocs'/'api'/name)
  cls.secret='secretsecretsecretsecretverylong';cls.verify='token-verify-very-long-1234';cls.worker='testworkertoken1234567890abcdefghijk'
  text=f'''<?php return ['app_secret'=>'{cls.secret}', 'verify_token'=>'{cls.verify}', 'worker_token'=>'{cls.worker}', 'instagram_access_token'=>'not-configured', 'instagram_account_id'=>'17841455555555555', 'replies_enabled'=>false];'''
  (cls.dir/'private-acpro-meta'/'config.php').write_text(text)
  port=23867;cls.base=f'http://127.0.0.1:{port}'
  env={**os.environ,'HTTPS':'on'}
  cls.proc=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t',str(cls.dir/'httpdocs')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,env=env)
  time.sleep(.5)
 @classmethod
 def tearDownClass(cls):cls.proc.terminate();cls.proc.wait();cls.t.cleanup()
 def req(self,uri,method='GET',body=None,headers=None):
  u=self.base+uri
  req=urllib.request.Request(u,data=body,headers=headers or {},method=method)
  try:
   with urllib.request.urlopen(req,timeout=3) as r:return r.status,r.read().decode()
  except urllib.error.HTTPError as e:return e.code,e.read().decode()
 def test_diagnostic_counters_without_private_data(self):
  payload={'object':'instagram','entry':[{'id':'999999999999','messaging':[{'sender':{'id':'sensitive-user-id'},'recipient':{'id':'999999999999'},'message':{'mid':'private-mid','text':'sensitive-message-text'}}]}]}
  body=json.dumps(payload).encode()
  sig='sha256='+hmac.new(self.secret.encode(),body,hashlib.sha256).hexdigest()
  self.assertEqual(self.req('/api/ig-webhook.php','POST',body,{'Content-Type':'application/json','X-Hub-Signature-256':sig}), (200,'OK'))
  raw=(self.dir/'private-acpro-meta'/'webhook-status.json').read_text()
  log=json.loads(raw)
  self.assertEqual(log['skipped_account_id'],1)
  self.assertEqual(log['queued'],0)
  self.assertNotIn('sensitive-user-id',raw)
  self.assertNotIn('sensitive-message-text',raw)
  self.assertNotIn(self.secret,raw)
 def test_verify(self):
  q=urllib.parse.urlencode({'hub.mode':'subscribe','hub.verify_token':self.verify,'hub.challenge':'123abc'})
  self.assertEqual(self.req('/api/ig-webhook.php?'+q),(200,'123abc'))
  self.assertEqual(self.req('/api/ig-webhook.php?'+q.replace(self.verify,'wrong'))[0],403)
 def test_signature_and_queue(self):
  body=json.dumps({'object':'instagram','entry':[{'id':'17841455555555555','messaging':[{'sender':{'id':'8001'},'recipient':{'id':'17841455555555555'},'message':{'mid':'m_1','text':'сколько стоит генеральная уборка 50 м2'}}]}]}).encode()
  self.assertEqual(self.req('/api/ig-webhook.php','POST',body,{'Content-Type':'application/json'})[0],403)
  sig='sha256='+hmac.new(self.secret.encode(),body,hashlib.sha256).hexdigest()
  self.assertEqual(self.req('/api/ig-webhook.php','POST',body,{'Content-Type':'application/json','X-Hub-Signature-256':sig}), (200,'OK'))
  self.assertEqual(self.req('/api/ig-webhook.php','POST',body,{'Content-Type':'application/json','X-Hub-Signature-256':sig}), (200,'OK'))
  self.assertEqual(len(list((self.dir/'private-acpro-meta'/'queue').glob('*.json'))),1)
  # Built-in PHP HTTP server is deliberately rejected by the relay,
  # which requires real HTTPS through Plesk in production.
  self.assertEqual(self.req('/api/ig-relay.php?mode=poll')[0],403)
if __name__=='__main__':unittest.main()