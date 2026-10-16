import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {JSDOM,VirtualConsole} from 'jsdom';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const reportPath=path.resolve(root,'../../outputs/seo-2026-10-16/CALCULATOR_TESTS.json');
const startedAt=new Date().toISOString();
const results=[];
let attemptedNetworkRequests=0,mockedWhatsAppOpens=0;
const source=fs.readFileSync(path.join(root,'site.js'),'utf8');
const estimator=fs.readFileSync(path.join(root,'script.js'),'utf8');
const normalPhone='77776146664',specialPhone='77760001966';
const amount=el=>Number(el.textContent.replace(/\D/g,''));

function load(lang,file,search=''){
 const relative=(lang==='ru'?'':lang+'/')+file;
 const virtualConsole=new VirtualConsole(),errors=[];
 virtualConsole.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(fs.readFileSync(path.join(root,relative),'utf8'),{url:'https://acpro.kz/'+(lang==='ru'?'':lang+'/')+(file==='index.html'?'':file)+search,runScripts:'outside-only',virtualConsole});
 const w=dom.window,opens=[],trace=[];
 w.fetch=async()=>{attemptedNetworkRequests++;throw new Error('TEST_NETWORK_FORBIDDEN');};
 w.navigator.sendBeacon=()=>{attemptedNetworkRequests++;throw new Error('TEST_NETWORK_FORBIDDEN');};
 w.open=(url,target,features)=>{mockedWhatsAppOpens++;opens.push({url:String(url),target,features});trace.push({kind:'open'});return null;};
 w.addEventListener('acpro:metric',e=>trace.push({kind:'metric',event:e.detail.event,calculator:e.detail.calculator}));
 w.eval(source);
 if(file==='prices.html')w.eval(estimator);
 assert.equal(w.document.documentElement.lang,lang);
 assert.equal(w.document.getElementById('langSelect').value,lang);
 const byId=id=>{const el=w.document.getElementById(id);assert.ok(el,'Missing expected control '+id);return el;};
 const change=(el,value,event='change')=>{if(el.type==='checkbox'||el.type==='radio')el.checked=value;else el.value=String(value);el.dispatchEvent(new w.Event(event,{bubbles:true}));};
 const submit=id=>{const form=byId(id);form.reportValidity=()=>form.checkValidity();form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));};
 return {w,byId,change,submit,opens,trace,errors,close:()=>dom.window.close()};
}
async function check(name,fn){
 try{await fn();results.push({name,status:'passed'});}
 catch(e){results.push({name,status:'failed',error:e instanceof assert.AssertionError?String(e.message).slice(0,350):'FIXTURE_EXECUTION_FAILED'});}
}
function lastOpen(c,phone){
 const o=c.opens.at(-1);assert.ok(o,'Expected a mocked WhatsApp handoff');
 const u=new URL(o.url);assert.equal(u.origin,'https://wa.me');assert.equal(u.pathname,'/'+phone);assert.equal(o.target,'_blank');assert.equal(o.features,'noopener,noreferrer');assert.ok(u.searchParams.get('text'));return u;
}
function eventBeforeOpen(c,calculator){
 assert.deepEqual(c.trace.slice(-2),[{kind:'metric',event:'quote_handoff',calculator},{kind:'open'}]);
}

for(const lang of ['ru','kk','en']){
 await check(lang+': quick estimator default, minimums, 100m² rates, localized prefill links and metric before mocked WhatsApp',()=>{
  const c=load(lang,'index.html');try{
   assert.equal(amount(c.byId('quickPrice')),49500);
   for(const [service,min,at100] of [['maintenance',18000,40000],['general',38000,90000],['renovation',52000,120000]]){
    c.change(c.byId('quickService'),service);c.change(c.byId('quickArea'),20,'input');assert.equal(amount(c.byId('quickPrice')),min);
    c.change(c.byId('quickArea'),100,'input');assert.equal(amount(c.byId('quickPrice')),at100);
    const link=new URL(c.byId('quickDetails').href);assert.equal(link.pathname,(lang==='ru'?'/':'/'+lang+'/')+'prices.html');assert.equal(link.searchParams.get('service'),service);assert.equal(link.searchParams.get('area'),'100');
   }
   c.submit('quickForm');const u=lastOpen(c,normalPhone);assert.ok(u.searchParams.get('text').includes('100'));eventBeforeOpen(c,'quick');assert.equal(c.errors.length,0);
  }finally{c.close();}
 });
 await check(lang+': main estimator rates/minimums, 55m² general+sofa, extras validation, window amount and custom chair quote',()=>{
  const c=load(lang,'prices.html');try{
   assert.equal(amount(c.byId('priceResult')),49500);c.change(c.byId('addonSofa'),true);assert.equal(amount(c.byId('priceResult')),59500);c.change(c.byId('addonSofa'),false);
   const selectService=value=>c.change(c.w.document.querySelector('input[name="service"][value="'+value+'"]'),true);
   for(const [service,min,at100] of [['maintenance',18000,40000],['general',38000,90000],['renovation',52000,120000]]){
    selectService(service);c.change(c.byId('area'),20,'input');assert.equal(amount(c.byId('priceResult')),min);c.change(c.byId('area'),100,'input');assert.equal(amount(c.byId('priceResult')),at100);
   }
   selectService('extras');assert.equal(c.byId('sendEstimate').disabled,true);assert.equal(c.byId('area').disabled,true);assert.equal(c.byId('areaGroup').hidden,true);
   c.byId('sendEstimate').dispatchEvent(new c.w.Event('click',{bubbles:true}));assert.equal(c.opens.length,0);
   c.change(c.byId('addonWindows'),true);assert.equal(amount(c.byId('priceResult')),3000);assert.equal(c.byId('sendEstimate').disabled,false);c.byId('sendEstimate').click();lastOpen(c,normalPhone);eventBeforeOpen(c,'main');
   c.change(c.byId('addonWindows'),false);c.change(c.byId('addonDiningChairs'),true);assert.equal(c.byId('sendEstimate').disabled,false);assert.doesNotMatch(c.byId('priceResult').textContent,/\d/);c.byId('sendEstimate').click();const quote=lastOpen(c,normalPhone);assert.ok(quote.searchParams.get('text').includes(c.w.ACPro.t.prices.addons[4]));eventBeforeOpen(c,'main');assert.equal(c.errors.length,0);
  }finally{c.close();}
 });
 await check(lang+': service and area URL prefills are applied and bounded',()=>{
  for(const [query,type,area,price] of [['?service=maintenance&area=100','maintenance','100',40000],['?service=renovation&area=10','renovation','20',52000],['?service=unknown&area=99999','general','2000',1800000]]){
   const c=load(lang,'prices.html',query);try{assert.equal(c.w.document.querySelector('input[name="service"]:checked').value,type);assert.equal(c.byId('area').value,area);assert.equal(amount(c.byId('priceResult')),price);assert.equal(c.errors.length,0);}finally{c.close();}
  }
 });
 await check(lang+': induction three sizes, consent validation, specialist phone and metric before mocked open',()=>{
  const c=load(lang,'induction.html');try{
   assert.equal(amount(c.byId('inductionPrice')),15000);c.submit('inductionForm');assert.equal(c.opens.length,0);
   for(const [size,price] of [[0,15000],[1,20000],[2,25000]]){c.change(c.w.document.querySelector('input[name="inductionSize"][value="'+size+'"]'),true);assert.equal(amount(c.byId('inductionPrice')),price);}
   c.byId('inductionConsent').checked=true;c.byId('inductionModel').value='FIXTURE-MODEL';c.byId('inductionNotes').value='Synthetic test only';c.submit('inductionForm');const u=lastOpen(c,specialPhone);assert.ok(u.searchParams.get('text').includes('FIXTURE-MODEL'));eventBeforeOpen(c,'induction');assert.equal(new URL(c.w.document.querySelector('.header-cta').href).pathname,'/'+specialPhone);assert.equal(c.errors.length,0);
  }finally{c.close();}
 });
 await check(lang+': careers retains general contact phone and valid form only hands off to mocked WhatsApp',()=>{
  const c=load(lang,'careers.html');try{
   c.submit('careerForm');assert.equal(c.opens.length,0);c.byId('careerName').value='TEST FIXTURE';c.byId('careerPhone').value='+77000000000';c.byId('careerAck').checked=true;c.submit('careerForm');const u=lastOpen(c,normalPhone);assert.ok(u.searchParams.get('text').includes('TEST FIXTURE'));assert.ok(u.searchParams.get('text').includes('+77000000000'));assert.equal(new URL(c.w.document.querySelector('.header-cta').href).pathname,'/'+normalPhone);assert.equal(c.errors.length,0);
  }finally{c.close();}
 });
 await check(lang+': partners uses specialist phone and consent-gated mocked handoff',()=>{
  const c=load(lang,'partners.html');try{
   c.submit('partnerForm');assert.equal(c.opens.length,0);c.byId('partnerName').value='TEST FIXTURE';c.byId('partnerPhone').value='+77000000000';c.byId('partnerConsent').checked=true;c.submit('partnerForm');lastOpen(c,specialPhone);assert.equal(new URL(c.w.document.querySelector('.header-cta').href).pathname,'/'+specialPhone);assert.equal(c.errors.length,0);
  }finally{c.close();}
 });
}

const failed=results.filter(x=>x.status==='failed').length;
const report={startedAt,completedAt:new Date().toISOString(),timezone:'Asia/Qyzylorda',environment:'jsdom 26.1.0, built HTML, manually evaluated site.js then script.js, outside-only scripts, no resource loading',languages:['ru','kk','en'],passed:results.length-failed,failed,attemptedNetworkRequests,mockedWhatsAppOpens,realWhatsAppOpens:0,realMessages:0,results};
fs.mkdirSync(path.dirname(reportPath),{recursive:true});fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,failed,attemptedNetworkRequests,mockedWhatsAppOpens,report:reportPath}));
for(const r of results.filter(x=>x.status==='failed'))console.log(r.name+': '+r.error);
process.exitCode=failed?1:0;
