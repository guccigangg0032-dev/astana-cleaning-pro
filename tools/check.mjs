// Read-only checks of built pages, routing, metadata and existing calculator behavior.
// No forms are submitted, no network is used, no output files are written.
import fs from 'node:fs';
import path from 'node:path';
import {JSDOM} from 'jsdom';
const root=path.resolve(import.meta.dirname,'..');
const ORIGIN='https://acpro.kz',LANGS=['ru','kk','en'];
const PRIMARY='77776146664',SPECIAL='77760001966';
const BASE=['index','services','prices','about','faq','careers','induction','partners','contact'];
const failures=new Set(),docs=new Map(),existsCache=new Map();let checks=0;
const check=(ok,message)=>{checks++;if(!ok)failures.add(message);};
const normalized=s=>String(s??'').replace(/\s+/g,' ').trim();
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
function allHtml(folder=root){return fs.readdirSync(folder,{withFileTypes:true}).flatMap(e=>{
  if(e.isDirectory())return ['.git','node_modules','tools'].includes(e.name)?[]:allHtml(path.join(folder,e.name));
  return e.isFile()&&e.name.endsWith('.html')&&!/^(?:google[a-f0-9]+|yandex_[a-f0-9]+)[.]html$/i.test(e.name)?[path.relative(root,path.join(folder,e.name)).replaceAll(path.sep,'/')]:[];
});}
function diskPath(url){
  if(url.origin!==ORIGIN)return null;
  let pathname;
  try{pathname=decodeURIComponent(url.pathname);}catch{return null;}
  const relative=pathname.endsWith('/')?pathname+'index.html':pathname;
  const file=path.resolve(root,'.'+relative);
  if(file!==root&&!file.startsWith(root+path.sep))return null;
  return file;
}
function exists(file){if(!file)return false;if(!existsCache.has(file)){let ok=false;try{ok=fs.statSync(file).isFile();}catch{}existsCache.set(file,ok);}return existsCache.get(file);}
function primaryUrl(value){try{const u=new URL(value);return u.origin===ORIGIN&&!u.hash&&!u.search;}catch{return false;}}
function parseDoc(relative){
  const url=ORIGIN+'/'+relative;
  const dom=new JSDOM(read(relative),{url});
  docs.set(relative,{dom,doc:dom.window.document});return docs.get(relative);
}
function walk(value,visitor){if(value&&typeof value==='object'){visitor(value);for(const v of Object.values(value))walk(v,visitor);}}
function urlRelative(url){const file=diskPath(new URL(url));return file?path.relative(root,file).replaceAll(path.sep,'/'):null;}
function fail(message){check(false,message);}

let manifest,content;
try{manifest=JSON.parse(read('seo-manifest.json'));content=JSON.parse(read('service-content.json'));}
catch{console.error(JSON.stringify({status:'FAILED',reason:'Built manifest/service-content JSON missing or invalid.'}));process.exit(1);}
check(manifest.canonicalOrigin===ORIGIN,'Manifest canonicalOrigin must be the primary HTTPS host.');
check(Array.isArray(content.pages)&&content.pages.length===6,'Expected six service-content pages.');
const serviceSlugs=new Set((content.pages??[]).map(p=>p.slug));
for(const slug of serviceSlugs)check(typeof slug==='string'&&/^[a-z0-9-]+$/.test(slug),'Service slug must have no extension, slash or unsafe characters.');
const slugs=new Set([...BASE,...serviceSlugs]);
check(slugs.size===15,'Expected nine base slugs plus six distinct service slugs.');
check(Array.isArray(manifest.pages)&&manifest.pages.length===45,'Expected 45 manifest entries (15 slugs × 3 languages).');
const entries=manifest.pages??[],byUrl=new Map(),byKey=new Map();
for(const e of entries){
  check(slugs.has(e.slug)&&LANGS.includes(e.lang),'Manifest entry has an unexpected slug/language.');
  check(primaryUrl(e.url),'Manifest URL must be canonical HTTPS primary-host without query/fragment.');
  check(!byUrl.has(e.url),'Manifest has duplicate URL: '+e.url);
  check(!byKey.has(e.slug+':'+e.lang),'Manifest has duplicate slug/language: '+e.slug+':'+e.lang);
  byUrl.set(e.url,e);byKey.set(e.slug+':'+e.lang,e);
}
for(const slug of slugs)for(const lang of LANGS)check(byKey.has(slug+':'+lang),'Manifest language variant missing: '+slug+':'+lang);

const htmlFiles=allHtml();
const titleByLang=new Map(),descriptionByLang=new Map();
let serviceSchemaCount=0,routingAnchorsChecked=0;
for(const relative of htmlFiles){
  const {doc}=parseDoc(relative);
  const canonicals=[...doc.querySelectorAll('link[rel="canonical"]')];
  check(canonicals.length===1,relative+': exactly one canonical required.');
  const canonical=canonicals[0]?.getAttribute('href');
  check(primaryUrl(canonical),relative+': canonical must use the primary HTTPS origin.');
  if(primaryUrl(canonical))check(urlRelative(canonical)===relative,relative+': canonical does not map to this HTML file.');
  const entry=byUrl.get(canonical);
  check(!!entry||relative==='privacy.html',relative+': HTML absent from manifest (except standalone privacy policy).');
  const lang=doc.documentElement.lang;
  check(LANGS.includes(lang),relative+': missing/unsupported HTML lang.');
  check(doc.querySelectorAll('h1').length===1,relative+': exactly one H1 required.');
  const title=normalized(doc.title),descriptionNodes=[...doc.querySelectorAll('meta[name="description"]')];
  const description=normalized(descriptionNodes[0]?.getAttribute('content'));
  check(doc.querySelectorAll('title').length===1&&title.length>0,relative+': exactly one nonempty title required.');
  check(descriptionNodes.length===1&&description.length>0,relative+': exactly one nonempty description required.');
  for(const [map,value,label]of [[titleByLang,title,'title'],[descriptionByLang,description,'description']]){
    const key=lang+':'+value.toLowerCase();check(!map.has(key),relative+': duplicate '+label+' within '+lang+' (also '+map.get(key)+').');map.set(key,relative);
  }
  check(![...doc.querySelectorAll('meta[name="robots"]')].some(m=>/\bnoindex\b/i.test(m.content)),relative+': unintended noindex.');
  if(entry){
    check(entry.lang===lang,relative+': lang differs from manifest.');
    check(title===normalized(entry.title),relative+': title differs from manifest.');
    check(description===normalized(entry.description),relative+': description differs from manifest.');
    check(doc.querySelector('meta[property="og:url"]')?.content===canonical,relative+': og:url differs from canonical.');
    const alternates=[...doc.querySelectorAll('link[rel="alternate"][hreflang]')];
    for(const code of [...LANGS,'x-default']){
      const matches=alternates.filter(a=>a.hreflang===code);
      check(matches.length===1,relative+': hreflang '+code+' must occur exactly once.');
      const expected=byKey.get(entry.slug+':'+(code==='x-default'?'ru':code))?.url;
      check(matches[0]?.getAttribute('href')===expected,relative+': hreflang '+code+' points to wrong language/host/slug.');
    }
    const contactAnchors=[...doc.querySelectorAll('a[href]')].filter(a=>!a.closest('main,noscript')&&(/^(?:tel:|https:\/\/wa\.me\/)/i.test(a.getAttribute('href'))));
    check(contactAnchors.length>=2,relative+': expected header/footer/mobile contact anchors.');
    const expectedPhone=['induction','partners'].includes(entry.slug)?SPECIAL:PRIMARY;
    let hasTel=false,hasWA=false;
    for(const a of contactAnchors){
      const href=a.getAttribute('href');let phone;
      if(href.startsWith('tel:')){hasTel=true;phone=href.slice(4).replace(/\D/g,'');}
      else{hasWA=true;phone=new URL(href).pathname.replace(/\D/g,'');}
      check(phone===expectedPhone,relative+': navigation contact routed to wrong phone.');routingAnchorsChecked++;
    }
    check(hasTel&&hasWA,relative+': both tel and WhatsApp navigation routes required.');
    const schemas=[];
    for(const script of doc.querySelectorAll('script[type="application/ld+json"]')){
      try{schemas.push(JSON.parse(script.textContent));}catch{fail(relative+': invalid JSON-LD.');}
    }
    check(schemas.length>0,relative+': structured data missing.');
    const entities=schemas.flatMap(s=>s['@graph']??[s]);
    const services=entities.filter(x=>x['@type']==='Service');
    const org=entities.find(x=>x['@type']==='ProfessionalService');
    check(org?.['@id']===ORIGIN+'/#business'&&org.url===ORIGIN+'/'&&org.telephone==='+'+PRIMARY,relative+': organization identity/primary telephone inconsistent.');
    for(const schema of schemas)walk(schema,node=>{
      const types=Array.isArray(node['@type'])?node['@type']:[node['@type']];
      check(!types.some(t=>['Review','AggregateRating','Rating'].includes(t))&&!Object.hasOwn(node,'aggregateRating')&&!Object.hasOwn(node,'review'),relative+': unverified review/rating markup prohibited.');
    });
    if(serviceSlugs.has(entry.slug)){
      check(services.length===1,relative+': exactly one Service entity required.');
      const s=services[0];
      check(s?.url===canonical&&normalized(s.name)===normalized(doc.querySelector('h1')?.textContent)&&normalized(s.description).length>0,relative+': Service name/url/description invalid.');
      check(s?.provider?.['@id']===ORIGIN+'/#business'&&s.areaServed?.['@type']==='City'&&s.areaServed?.name==='Astana',relative+': Service provider/areaServed invalid.');
      check(entities.some(x=>x['@type']==='BreadcrumbList'),relative+': service breadcrumb schema missing.');serviceSchemaCount+=services.length;
    }
    const visibleText=normalized(doc.body.textContent);
    check(!/(?:рейтинг|rating|бағалау)\s*[:–-]?\s*\d[.,]\d/iu.test(visibleText),relative+': unverified numerical rating claim found.');
  }
  // A valid local URL must point at a real file; fragments must exist in its target document.
  for(const element of doc.querySelectorAll('a[href],script[src],link[href],img[src],source[src],video[poster]')){
    if(element.closest('noscript'))continue;
    const attr=element.hasAttribute('href')?'href':element.hasAttribute('src')?'src':'poster';
    const raw=element.getAttribute(attr);if(!raw||/^(?:tel:|mailto:|data:)/i.test(raw))continue;
    let target;try{target=new URL(raw,canonical??ORIGIN+'/'+relative);}catch{fail(relative+': invalid '+attr+' URL.');continue;}
    if(target.origin!==ORIGIN)continue;
    const file=diskPath(target);check(exists(file),'Missing local route/asset: '+target.pathname);
    if(element.tagName==='A'&&target.hash&&file?.endsWith('.html')&&exists(file)){
      const targetRelative=path.relative(root,file).replaceAll(path.sep,'/');
      const targetDoc=(docs.get(targetRelative)??parseDoc(targetRelative)).doc;
      let id;try{id=decodeURIComponent(target.hash.slice(1));}catch{id='__invalid_fragment';}
      check(!!targetDoc.getElementById(id),relative+': broken local fragment '+target.pathname+target.hash);
    }
  }
}
for(const e of entries)check(exists(diskPath(new URL(e.url))),'Manifest URL missing HTML: '+e.url);
check(serviceSchemaCount===18,'Expected 18 Service entities (six services × three languages).');

// Explicit reciprocal checks across emitted HTML, independent of manifest formatting.
for(const [relative,{doc}]of docs){
  const self=doc.querySelector('link[rel="canonical"]')?.getAttribute('href');
  if(!byUrl.has(self))continue;
  for(const a of doc.querySelectorAll('link[rel="alternate"][hreflang]')){
    if(!LANGS.includes(a.hreflang))continue;
    const destination=docs.get(urlRelative(a.href))?.doc;
    check(!!destination&&[...destination.querySelectorAll('link[rel="alternate"][hreflang]')].some(x=>x.hreflang===doc.documentElement.lang&&x.getAttribute('href')===self),relative+': non-reciprocal hreflang '+a.hreflang);
  }
}
try{
  const xml=new JSDOM(read('sitemap.xml'),{contentType:'application/xml'}).window.document;
  check(!xml.querySelector('parsererror'),'Sitemap XML parse error.');
  check(xml.documentElement.namespaceURI==='http://www.sitemaps.org/schemas/sitemap/0.9','Sitemap namespace invalid.');
  const locs=[...xml.querySelectorAll('url > loc')].map(x=>normalized(x.textContent));
  check(new Set(locs).size===locs.length,'Duplicate sitemap loc.');
  for(const e of entries)check(locs.includes(e.url),'Manifest URL omitted from sitemap: '+e.url);
  for(const loc of locs){check(primaryUrl(loc),'Sitemap contains noncanonical URL.');check(exists(diskPath(new URL(loc))),'Sitemap URL missing local file: '+loc);}
}catch{fail('Sitemap missing or invalid XML.');}
try{
  const robots=read('robots.txt');
  check(/^User-agent:\s*\*/im.test(robots),'robots.txt wildcard User-agent missing.');
  check(!/^Disallow:\s*\/\s*$/im.test(robots),'robots.txt blocks the entire site.');
  check(new RegExp('^Sitemap:\\s*'+ORIGIN.replaceAll('.','\\.')+'/sitemap\\.xml\\s*$','im').test(robots),'robots.txt primary-host Sitemap declaration missing.');
}catch{fail('robots.txt missing.');}

// Execute only the existing local UI scripts in isolated DOMs; events below recalculate only.
// No click, submit or WhatsApp handoff occurs; network and window.open are blocked.
let calculatorCases=0;
for(const lang of LANGS){
  const e=byKey.get('prices:'+lang);if(!e)continue;
  let dom;
  try{
    dom=new JSDOM(read(urlRelative(e.url)),{url:e.url,runScripts:'outside-only'});
    const w=dom.window;w.fetch=()=>{throw new Error('NETWORK_FORBIDDEN_IN_CHECK');};w.open=()=>{throw new Error('WINDOW_OPEN_FORBIDDEN_IN_CHECK');};
    w.eval(read('site.js'));w.eval(read('script.js'));
    for(const [service,rate,minimum]of [['maintenance',400,18000],['general',900,38000],['renovation',1200,52000]]){
      for(const area of [20,100]){
        for(const input of w.document.querySelectorAll('input[type="checkbox"]'))input.checked=false;
        for(const input of w.document.querySelectorAll('input[name="service"]'))input.checked=input.value===service;
        w.document.getElementById('area').value=String(area);
        w.document.getElementById('priceForm').dispatchEvent(new w.Event('change',{bubbles:true}));
        const actual=Number(w.document.getElementById('priceResult').textContent.replace(/\D/g,''));
        check(actual===Math.max(minimum,rate*area),'Calculator tariff/minimum changed: '+lang+'/'+service+'/'+area);calculatorCases++;
      }
    }
  }catch{fail('Calculator isolated DOM validation failed for '+lang);}
  finally{dom?.window.close();}
}
for(const {dom}of docs.values())dom.window.close();
const report={checkedAt:new Date().toISOString(),status:failures.size?'FAILED':'PASSED',htmlFiles:htmlFiles.length,manifestPages:entries.length,serviceSchemaCount,routingAnchorsChecked,calculatorCases,checks,failures:[...failures],networkRequests:0,formsSubmitted:0,limitations:['Static/isolated DOM validation is not proof of production redirects, Google indexing or Core Web Vitals.']};
console.log(JSON.stringify(report,null,2));if(failures.size)process.exitCode=1;
