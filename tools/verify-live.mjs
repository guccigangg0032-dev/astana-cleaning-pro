import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {JSDOM} from 'jsdom';
const root=path.resolve(import.meta.dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'seo-manifest.json'),'utf8'));
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const report={checkedAt:new Date().toISOString(),origin:'https://acpro.kz',checks:[],failures:[],realMessagesSent:0};
function check(name,ok,details={}){report.checks.push({name,passed:!!ok,...details});if(!ok)report.failures.push(name);}
const pending=[...manifest.pages];
await Promise.all(Array.from({length:4},async()=>{while(pending.length){const page=pending.shift();try{const start=Date.now();const response=await fetch(page.url,{redirect:'manual',signal:AbortSignal.timeout(20000)});const body=await response.text();const pathname=new URL(page.url).pathname;const file=path.join(root,pathname.endsWith('/')?pathname+'index.html':pathname);const doc=new JSDOM(body).window.document;check('HTML '+page.url,response.status===200&&hash(body)===hash(fs.readFileSync(file))&&doc.querySelector('link[rel="canonical"]')?.href===page.url&&doc.documentElement.lang===page.lang,{status:response.status,sha256:hash(body),elapsedMs:Date.now()-start,encoding:response.headers.get('content-encoding')});}catch(e){check('HTML '+page.url,false,{error:e.name});}}}));
for(const file of ['site.js','script.js','styles.css','multi.css','service-content.js','metrics.js','privacy.html','robots.txt','sitemap.xml']){
 try{const response=await fetch('https://acpro.kz/'+file,{signal:AbortSignal.timeout(20000)});const text=await response.text();check('Asset '+file,response.status===200&&hash(text)===hash(fs.readFileSync(path.join(root,file))),{status:response.status,encoding:response.headers.get('content-encoding'),cacheControl:response.headers.get('cache-control')});}catch(e){check('Asset '+file,false,{error:e.name});}
}
for(const [url,target]of [['http://acpro.kz/','https://acpro.kz/'],['https://www.acpro.kz/','https://acpro.kz/'],['http://www.acpro.kz/','https://acpro.kz/'],['https://acpro.kz/index.html','https://acpro.kz/'],['https://acpro.kz/services.html?lang=kk','https://acpro.kz/kk/services.html'],['https://acpro.kz/astana-cleaning-pro-main/services.html','https://acpro.kz/services.html']]){
 try{const r=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(20000)});check('Redirect '+url,[301,308].includes(r.status)&&r.headers.get('location')===target,{status:r.status,location:r.headers.get('location')});}catch(e){check('Redirect '+url,false,{error:e.name});}
}
for(const [file,allowed]of [['/seo-nonexistent-check-20261016',[404]],['/.git/config',[403,404]],['/bitrixsetup.php',[403,404]],['/private-acpro-metrics/test-2026-10-16.json',[403,404]]]){
 try{const r=await fetch('https://acpro.kz'+file,{redirect:'manual',signal:AbortSignal.timeout(20000)});check('Protected/404 '+file,allowed.includes(r.status),{status:r.status});}catch(e){check('Protected/404 '+file,false,{error:e.name});}
}
const payload={consent:true,event:'test',page:'home',lang:'ru',calculator:'none',source:'direct'};
for(const [name,options,expected]of [
 ['GET',{method:'GET'},405],
 ['No origin',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)},403],
 ['Invalid field',{method:'POST',headers:{origin:'https://acpro.kz','content-type':'application/json'},body:JSON.stringify({...payload,unknown:true})},400],
 ['DNT',{method:'POST',headers:{origin:'https://acpro.kz','content-type':'application/json',DNT:'1'},body:JSON.stringify(payload)},204],
 ['Isolated test',{method:'POST',headers:{origin:'https://acpro.kz','content-type':'application/json'},body:JSON.stringify(payload)},200]
 ]){
 try{const r=await fetch('https://acpro.kz/metrics.php',{...options,redirect:'error',signal:AbortSignal.timeout(20000)});const text=await r.text();check('Metrics '+name,r.status===expected&&(expected!==200||JSON.parse(text).storage==='ready'),{status:r.status,...(name==='Isolated test'?{response:text}:{})});}catch(e){check('Metrics '+name,false,{error:e.name});}
}
report.status=report.failures.length?'FAILED':'PASSED';
const output=process.argv[2];if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,checks:report.checks.length,failures:report.failures},null,2));if(report.failures.length)process.exitCode=1;
