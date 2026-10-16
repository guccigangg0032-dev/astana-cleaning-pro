// Follow built links into the actual estimator without loading resources or submitting forms.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {JSDOM,VirtualConsole} from 'jsdom';

const root=path.resolve(import.meta.dirname,'..'),origin='https://acpro.kz';
const source=fs.readFileSync(path.join(root,'site.js'),'utf8');
const estimator=fs.readFileSync(path.join(root,'script.js'),'utf8');
const results=[];let attemptedNetworkRequests=0,attemptedWindowOpens=0;
const prefix=lang=>lang==='ru'?'/':'/'+lang+'/';
function load(url,evaluate=false){
 const parsed=new URL(url,origin),relative=parsed.pathname.endsWith('/')?parsed.pathname+'index.html':parsed.pathname;
 const errors=[],console=new VirtualConsole();console.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(fs.readFileSync(path.join(root,relative.slice(1)),'utf8'),{url:parsed.href,runScripts:'outside-only',virtualConsole:console});
 dom.window.fetch=()=>{attemptedNetworkRequests++;throw new Error('TEST_NETWORK_FORBIDDEN');};
 dom.window.navigator.sendBeacon=()=>{attemptedNetworkRequests++;throw new Error('TEST_NETWORK_FORBIDDEN');};
 dom.window.open=()=>{attemptedWindowOpens++;throw new Error('TEST_WINDOW_OPEN_FORBIDDEN');};
 if(evaluate){dom.window.eval(source);dom.window.eval(estimator);}
 return {dom,doc:dom.window.document,errors,close:()=>dom.window.close()};
}
function check(name,fn){try{fn();results.push({name,status:'passed'});}catch(e){results.push({name,status:'failed',error:String(e.message).slice(0,400)});}}
function followsEstimator(anchor,lang,type){
 const url=new URL(anchor.href);assert.equal(url.origin,origin);assert.equal(url.pathname,prefix(lang)+'prices.html');
 assert.equal(url.searchParams.get('service'),type);assert.equal(url.hash,type==='extras'?'#extraNotice':'#estimate');
 const c=load(url,true);try{
  assert.ok(c.doc.getElementById(url.hash.slice(1)),'Built CTA fragment must exist');
  assert.equal(c.doc.querySelector('input[name="service"]:checked').value,type,'Destination must select the matching real tariff');
  const area=c.doc.getElementById('area'),price=c.doc.getElementById('priceResult');
  if(type==='extras'){
   assert.equal(area.disabled,true);assert.equal(c.doc.getElementById('areaGroup').hidden,true);
   assert.equal(c.doc.getElementById('sendEstimate').disabled,true,'No invented whole-property estimate for an individual service');
   assert.doesNotMatch(price.textContent,/\d/,'Must ask the visitor to choose the actual extra first');
  }else{
   assert.equal(area.disabled,false);assert.equal(Number(price.textContent.replace(/\D/g,'')),{general:49500,maintenance:22000,renovation:66000}[type]);
  }
  assert.deepEqual(c.errors,[]);
 }finally{c.close();}
}
const targets=[['uborka-kvartir-astana','general'],['generalnaya-uborka-astana','general'],['uborka-posle-remonta-astana','renovation'],['himchistka-mebeli-astana','extras'],['moika-okon-astana','extras'],['uborka-ofisov-astana',null]];
for(const lang of ['ru','kk','en']){
 for(const [slug,type]of targets)check(lang+': '+slug+' primary and mobile CTA destination',()=>{
  const c=load(prefix(lang)+slug+'.html');try{
   const primary=c.doc.querySelector('.service-detail .hero-buttons .btn-primary'),mobile=c.doc.querySelector('.mobile-bar a');
   assert.ok(primary);assert.ok(mobile);
   if(type){followsEstimator(primary,lang,type);followsEstimator(mobile,lang,type);
    if(slug==='uborka-kvartir-astana')assert.match(primary.textContent,{ru:/Выбрать вид/,kk:/түрін таңдау/,en:/Choose a cleaning type/}[lang]);
   }else{
    for(const a of [primary,mobile]){const url=new URL(a.href);assert.equal(url.origin,'https://wa.me');assert.equal(url.pathname,'/77776146664');}
    assert.ok(new URL(primary.href).searchParams.get('text').includes(c.doc.querySelector('h1').textContent));
    assert.equal(c.doc.querySelectorAll('.service-detail .hero-buttons a').length,1,'Avoid duplicate office quote buttons');
   }
  }finally{c.close();}
 });
 for(const file of ['index.html','services.html'])check(lang+': '+file+' tariff cards retain their selected cleaning type',()=>{
  const c=load(prefix(lang)+(file==='index.html'?'':file));try{
   const cards=[...c.doc.querySelectorAll('.service-card')];assert.ok(cards.length>=3);
   for(const [i,type]of ['general','maintenance','renovation'].entries())followsEstimator(cards[i].querySelector('.service-foot a'),lang,type);
  }finally{c.close();}
 });
}
const metadataIntents={
 kk:{about:/Компания туралы/,faq:/тазалау туралы сұрақтар/,careers:/клининг жұмысы/,induction:/индукциялық панельді тазалау/,partners:/серіктестік/,contact:/клининг байланыстары/},
 en:{about:/About.*cleaning service/,faq:/Cleaning questions and answers/,careers:/Cleaning jobs/,induction:/Induction hob care/,partners:/Cleaning partnerships/,contact:/Contact.*cleaning service/}
};
for(const [lang,pages]of Object.entries(metadataIntents))for(const [slug,intent]of Object.entries(pages))check(lang+': '+slug+' metadata communicates page purpose without repeated brand',()=>{
 const c=load(prefix(lang)+slug+'.html');try{
  assert.match(c.doc.title,intent);assert.equal(c.doc.title.split('Astana Cleaning Pro').length-1,1);
  const description=c.doc.querySelector('meta[name="description"]').content;
  assert.notEqual(description,c.doc.querySelector('main p').textContent,'An editorial description must replace the generic lead fallback');
  if(slug==='contact')assert.ok(description.includes('+7 777 614 66 64'));
  assert.equal(c.doc.querySelector('meta[property="og:title"]').content,c.doc.title);
  assert.equal(c.doc.querySelector('meta[property="og:description"]').content,description);
 }finally{c.close();}
});
assert.equal(attemptedNetworkRequests,0);assert.equal(attemptedWindowOpens,0);
const failed=results.filter(x=>x.status==='failed');
const report={checkedAt:new Date().toISOString(),passed:results.length-failed.length,failed:failed.length,attemptedNetworkRequests,attemptedWindowOpens,results};
if(process.env.ACPRO_CTA_REPORT)fs.writeFileSync(path.resolve(process.env.ACPRO_CTA_REPORT),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,failed:report.failed,attemptedNetworkRequests,attemptedWindowOpens}));
for(const result of failed)console.error(result.name+': '+result.error);
process.exitCode=failed.length?1:0;
