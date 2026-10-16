import fs from 'node:fs';
import path from 'node:path';
import {JSDOM} from 'jsdom';
const root=path.resolve(import.meta.dirname,'..');
const content=JSON.parse(fs.readFileSync(path.join(root,'service-content.json'),'utf8'));
fs.writeFileSync(path.join(root,'service-content.js'),'window.ACProServiceContent='+JSON.stringify(content)+';\n');
const langs=['ru','kk','en'];
const base=['index','services','prices','about','faq','careers','induction','partners','contact'];
const ids=['home',...base.slice(1)];
const metadata={
 ru:[['Клининг в Астане — уборка квартир и офисов | Astana Cleaning Pro','Уборка квартир и офисов в Астане: генеральная, поддерживающая и после ремонта. Химчистка мебели, мойка окон. Калькулятор и заявка в WhatsApp.'],['Клининговые услуги в Астане | Astana Cleaning Pro','Уборка квартир, домов и офисов, химчистка мебели, мойка окон и дополнительные услуги в Астане. Состав работ и предварительный расчёт.'],['Цены на уборку в Астане — калькулятор | Astana Cleaning Pro','Рассчитайте предварительную стоимость уборки в Астане с учётом площади и дополнительных услуг. Окончательную цену согласуем до начала работ.'],['О компании Astana Cleaning Pro — клининг в Астане','Как работает Astana Cleaning Pro: согласование состава уборки, подход к поверхностям и приёмка результата. Уборка в Астане и ближайших районах.'],['Вопросы об уборке в Астане | Astana Cleaning Pro','Ответы о составе уборки, расчёте стоимости, химчистке, окнах и подготовке помещения. Уточните условия заказа Astana Cleaning Pro.'],['Работа в клининге в Астане — вакансии | Astana Cleaning Pro','Вакансии клинеров и специалистов Astana Cleaning Pro в Астане. Требования, направления работы и отклик через WhatsApp.'],['Обработка индукционных панелей в Астане | Astana Cleaning Pro','Бережная очистка индукционных варочных панелей после оценки материала и состояния. Отдельный калькулятор по ширине. Условия обсуждаем по фото.'],['Партнёрство с Astana Cleaning Pro в Астане','Сотрудничество с исполнителями в Астане: направления работ, порядок обсуждения и отдельный контакт для партнёров Astana Cleaning Pro.'],['Контакты клининга в Астане | Astana Cleaning Pro','Свяжитесь с Astana Cleaning Pro для расчёта уборки в Астане. WhatsApp и телефон +7 777 614 66 64. Площадь, состав работ и время согласуем до заказа.']],
 kk:[
  ['Астанадағы клининг — үй мен кеңсе тазалау | Astana Cleaning Pro','Астанада пәтер мен кеңсе тазалау: жалпы, тұрақты және жөндеуден кейінгі тазалау. Жиһазды химиялық тазалау, терезе жуу. Калькулятор және WhatsApp.'],
  ['Астанадағы клининг қызметтері | Astana Cleaning Pro','Пәтер, үй, кеңсе тазалау, жұмсақ жиһазды химиялық тазалау және терезе жуу. Жұмыс құрамы мен алдын ала есеп.'],
  ['Астанада тазалау бағасы — калькулятор | Astana Cleaning Pro','Аудан мен қосымша қызметтер бойынша тазалаудың алдын ала құнын есептеңіз. Соңғы баға жұмыс басталғанға дейін келісіледі.'],
  ['Компания туралы — Астанадағы клининг | Astana Cleaning Pro','Astana Cleaning Pro жұмыс тәртібі: тазалау құрамын келісу, беттердің ерекшелігін ескеру және нәтижені қабылдау. Астанада пәтер мен кеңсе тазалау.'],
  ['Астанада тазалау туралы сұрақтар | Astana Cleaning Pro','Тазалау құрамы, алдын ала баға, жиһазды химиялық тазалау, терезе жуу және үй-жайды дайындау туралы жауаптар. Тапсырыс шарттарын нақтылаңыз.'],
  ['Астанада клининг жұмысы — бос орындар | Astana Cleaning Pro','Astana Cleaning Pro командасына клинерлер мен мамандар шақырылады. Астанадағы жұмыс бағыттары, талаптар және WhatsApp арқылы өтінім.'],
  ['Астанада индукциялық панельді тазалау | Astana Cleaning Pro','Индукциялық пісіру панелін өңдеу мүмкіндігін модель мен бет күйі бойынша бағалаймыз. Еніне қарай бөлек калькулятор бар; шарттар фотосуретпен нақтыланады.'],
  ['Астанада серіктестік | Astana Cleaning Pro','Астанада тазалау, жиһаз және индукциялық панель мамандарымен серіктестікті талқылау. Жұмыс бағыттары, шарттар және серіктестерге арналған байланыс.'],
  ['Астанадағы клининг байланыстары | Astana Cleaning Pro','Тазалауды есептеу үшін Astana Cleaning Pro компаниясына хабарласыңыз: WhatsApp және +7 777 614 66 64. Жұмыс құрамы мен уақыт алдын ала келісіледі.']
 ],
 en:[
  ['Cleaning in Astana — homes and offices | Astana Cleaning Pro','Apartment and office cleaning in Astana: deep, maintenance and post-renovation cleaning. Upholstery cleaning and window washing. Estimate and WhatsApp enquiry.'],
  ['Cleaning services in Astana | Astana Cleaning Pro','Home and office cleaning, upholstery cleaning, window washing and additional services in Astana. Review the scope and request an estimate.'],
  ['Cleaning prices in Astana — calculator | Astana Cleaning Pro','Estimate cleaning costs by floor area and additional services. The final scope and price are agreed before work begins.'],
  ['About our cleaning service in Astana | Astana Cleaning Pro','How Astana Cleaning Pro works: agreeing the cleaning scope, choosing methods for the surfaces and reviewing the result. Home and office cleaning in Astana.'],
  ['Cleaning questions and answers in Astana | Astana Cleaning Pro','Answers about cleaning scope, estimated prices, upholstery care, window washing and preparing your property. Clarify the conditions before booking.'],
  ['Cleaning jobs in Astana — careers | Astana Cleaning Pro','Explore cleaning and specialist roles with Astana Cleaning Pro in Astana. Read the requirements and working arrangements, then enquire on WhatsApp.'],
  ['Induction hob care in Astana | Astana Cleaning Pro','Discuss suitable care for an induction hob after its model and condition are assessed. Use the separate width-based estimator and provide photos for assessment.'],
  ['Cleaning partnerships in Astana | Astana Cleaning Pro','Discuss working with Astana Cleaning Pro in Astana: cleaning, upholstery and induction hob care. Review the specialties and use the dedicated partner contact.'],
  ['Contact our cleaning service in Astana | Astana Cleaning Pro','Contact Astana Cleaning Pro on WhatsApp or call +7 777 614 66 64 for a cleaning estimate in Astana. Scope, price and timing are agreed before booking.']
 ]
};
const url=(slug,l)=>'https://acpro.kz/'+(l==='ru'?'':l+'/')+(slug==='index'?'':slug+'.html');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const renderer=fs.readFileSync(path.join(root,'site.js'),'utf8');
const entries=[];
for(const lang of langs){
 const dir=path.join(root,lang==='ru'?'':lang);fs.mkdirSync(dir,{recursive:true});
 for(const [i,slug] of [...base,...content.pages.map(x=>x.slug)].entries()){
  const id=ids[i]||slug;
  const service=content.pages.find(x=>x.slug===slug);
  const dom=new JSDOM('<!doctype html><html lang="'+lang+'"><head></head><body data-page="'+id+'" data-build="1"><div id="app"></div></body></html>',{url:url(slug,lang),runScripts:'outside-only'});
  dom.window.ACProServiceContent=content;
  dom.window.eval(renderer);
  const doc=dom.window.document;
  const title=service?.[lang].title||metadata[lang][i]?.[0]||doc.querySelector('h1').textContent+' — '+(lang==='kk'?'Астана':'Astana')+' | Astana Cleaning Pro';
  const description=service?.[lang].description||metadata[lang][i]?.[1]||doc.querySelector('main p').textContent;
  const canonical=url(slug,lang);
  const org={'@type':'ProfessionalService','@id':'https://acpro.kz/#business',name:'Astana Cleaning Pro',url:'https://acpro.kz/',logo:'https://acpro.kz/assets/mark.svg',telephone:'+77776146664',areaServed:{'@type':'City',name:'Astana'},contactPoint:[{'@type':'ContactPoint',telephone:'+77776146664',contactType:'customer service',availableLanguage:['Russian','Kazakh','English']},{'@type':'ContactPoint',telephone:'+77760001966',contactType:'specialist enquiries and partnerships'}]};
  const schema={'@context':'https://schema.org','@graph':[org,{'@type':'WebSite','@id':'https://acpro.kz/#website',url:'https://acpro.kz/',name:'Astana Cleaning Pro',inLanguage:langs},{'@type':'WebPage','@id':canonical+'#page',url:canonical,name:title,description,inLanguage:lang,isPartOf:{'@id':'https://acpro.kz/#website'},about:{'@id':'https://acpro.kz/#business'}}]};
  if(service)schema['@graph'].push({'@type':'Service',name:service[lang].h1,url:canonical,description:service[lang].intro,provider:{'@id':'https://acpro.kz/#business'},areaServed:{'@type':'City',name:'Astana'}},{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:lang==='ru'?'Главная':lang==='kk'?'Басты бет':'Home',item:url('index',lang)},{'@type':'ListItem',position:2,name:lang==='ru'?'Услуги':lang==='kk'?'Қызметтер':'Services',item:url('services',lang)},{'@type':'ListItem',position:3,name:service[lang].h1,item:canonical}]});
  doc.head.innerHTML=`<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#f7fbfd"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${canonical}">${langs.map(l=>`<link rel="alternate" hreflang="${l}" href="${url(slug,l)}">`).join('')}<link rel="alternate" hreflang="x-default" href="${url(slug,'ru')}"><meta property="og:type" content="website"><meta property="og:site_name" content="Astana Cleaning Pro"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="https://acpro.kz/assets/mark.svg"><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet"><link rel="stylesheet" href="/styles.css?v=20261016"><link rel="stylesheet" href="/multi.css?v=20261016"><script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script>${service?'<script src="/service-content.js?v=20261016" defer></script>':''}<script src="/site.js?v=20261016" defer></script>${slug==='prices'?'<script src="/script.js?v=20261016" defer></script>':''}<script src="/metrics.js?v=20261016" defer></script>`;
  doc.body.removeAttribute('data-build');doc.body.dataset.built='1';
  doc.body.insertAdjacentHTML('afterbegin','<a class="skip-link" href="#main-content">'+(lang==='ru'?'Перейти к содержанию':lang==='kk'?'Мазмұнға өту':'Skip to content')+'</a>');
  const langlinks=doc.createElement('div');langlinks.className='language-links';langlinks.innerHTML=langs.map(l=>'<a hreflang="'+l+'" lang="'+l+'" href="'+new URL(url(slug,l)).pathname+'">'+({ru:'Русский',kk:'Қазақша',en:'English'})[l]+'</a>').join('');doc.querySelector('.footer-grid>div').append(langlinks);
  const serviceLinks=doc.createElement('div');serviceLinks.className='service-links';serviceLinks.innerHTML=content.pages.map(x=>'<a href="'+new URL(url(x.slug,lang)).pathname+'">'+esc(x[lang].h1)+'</a>').join('');
  if(slug==='services')doc.querySelector('.service-page .container').append(serviceLinks);
  const settings=doc.createElement('button');settings.type='button';settings.className='metrics-settings';settings.dataset.metricsSettings='';settings.textContent=lang==='ru'?'Настройки статистики':lang==='kk'?'Статистика баптаулары':'Statistics preferences';doc.querySelector('.footer-bottom').append(settings);
  const privacy=doc.createElement('a');privacy.href='/privacy.html';privacy.textContent=lang==='ru'?'Конфиденциальность':lang==='kk'?'Құпиялық':'Privacy';doc.querySelector('.footer-bottom').append(privacy);
  for(const img of doc.images){if(!img.hasAttribute('width'))img.width=135;if(!img.hasAttribute('height'))img.height=135;img.decoding='async';if(img.closest('main'))img.loading='lazy';}
  fs.writeFileSync(path.join(dir,slug+'.html'),dom.serialize()+'\n');
  entries.push({slug,lang,url:canonical,title,description});dom.window.close();
 }
}
fs.writeFileSync(path.join(root,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+entries.map(e=>'<url><loc>'+e.url+'</loc></url>').join('')+'<url><loc>https://acpro.kz/privacy.html</loc></url></urlset>\n');
fs.writeFileSync(path.join(root,'seo-manifest.json'),JSON.stringify({canonicalOrigin:'https://acpro.kz',pages:entries},null,2)+'\n');
console.log('Built '+entries.length+' complete, indexable HTML pages in ru/kk/en.');
