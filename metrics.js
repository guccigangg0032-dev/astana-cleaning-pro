/* Optional first-party aggregate counters. No identifiers, URLs or form values. */
(function(){
  'use strict';
  const KEY='acpro_metrics_consent_v1';
  const PAGES=new Set(['home','services','prices','about','faq','careers','induction','partners','contact','privacy','service','other','uborka-kvartir-astana','generalnaya-uborka-astana','uborka-posle-remonta-astana','himchistka-mebeli-astana','moika-okon-astana','uborka-ofisov-astana']);
  const SOURCES=new Set(['direct','google','yandex','2gis','instagram','threads','facebook','other']);
  const CALCULATORS=new Set(['quick','main','induction']);
  const EVENTS=new Set(['page_view','whatsapp_click','phone_click','calculator_change','quote_handoff']);
  const TEXT={
    ru:{label:'Необязательная статистика',text:'Разрешить суммарную статистику просмотров, калькулятора и переходов к контактам? Без текста заявок, персональных данных и идентификаторов. Отказ не влияет на сайт.',yes:'Разрешить',no:'Не разрешать',policy:'Конфиденциальность',blocked:'Настройки приватности браузера (DNT/GPC) отключают статистику. Согласие не отменяет этот сигнал.'},
    kk:{label:'Міндетті емес статистика',text:'Бет қаралымдарын, калькуляторды және байланысқа өтулерді жиынтық санауға рұқсат бересіз бе? Өтінім мәтіні, жеке деректер мен идентификаторлар жіберілмейді. Бас тарту сайтқа әсер етпейді.',yes:'Рұқсат беру',no:'Рұқсат бермеу',policy:'Құпиялылық',blocked:'Браузердің құпиялылық баптаулары (DNT/GPC) статистиканы өшіреді. Келісім бұл белгіні өзгертпейді.'},
    en:{label:'Optional statistics',text:'Allow aggregate counts of views, calculator use and contact clicks? No enquiry text, personal data or visitor identifiers. Declining does not affect the website.',yes:'Allow',no:'Do not allow',policy:'Privacy',blocked:'Your browser privacy setting (DNT/GPC) disables statistics. Consent does not override this signal.'}
  };
  let choice=null,pageViewed=false,banner=null;
  const changed=new Set();
  try{const saved=localStorage.getItem(KEY);if(saved==='yes'||saved==='no')choice=saved;}catch{}
  function blocked(){return navigator.globalPrivacyControl===true || [navigator.doNotTrack,navigator.msDoNotTrack,window.doNotTrack].some(v=>v==='1'||v==='yes');}
  function lang(){const raw=(document.documentElement.lang||document.body?.dataset.lang||'ru').toLowerCase().split('-')[0];return Object.hasOwn(TEXT,raw)?raw:'ru';}
  function page(){const raw=document.body?.dataset.page;return PAGES.has(raw)?raw:'other';}
  function allowed(){return choice==='yes'&&!blocked()&&location.protocol==='https:'&&location.hostname==='acpro.kz';}
  function source(){
    // Called only after consent. Only a fixed category leaves this function.
    try{const tag=new URLSearchParams(location.search).get('utm_source');if(tag&&SOURCES.has(tag.toLowerCase()))return tag.toLowerCase();}catch{}
    if(!document.referrer)return 'direct';
    let host;try{host=new URL(document.referrer).hostname.toLowerCase();}catch{return 'other';}
    if(host==='acpro.kz'||host==='www.acpro.kz')return 'direct';
    const groups={google:['google.com','google.kz','google.ru','google.co.uk','google.de','google.fr','google.com.tr','google.co.jp'],yandex:['yandex.ru','yandex.kz','yandex.com','yandex.by','yandex.uz','yandex.com.tr'],'2gis':['2gis.kz','2gis.ru','2gis.com','2gis.uz'],instagram:['instagram.com'],threads:['threads.net','threads.com'],facebook:['facebook.com','fb.com']};
    for(const [category,domains]of Object.entries(groups))if(domains.some(domain=>host===domain||host.endsWith('.'+domain)))return category;
    return 'other';
  }
  function send(event,calculator='none'){
    if(!allowed()||!EVENTS.has(event)||calculator!=='none'&&!CALCULATORS.has(calculator))return false;
    const payload={consent:true,event,page:page(),lang:lang(),calculator,source:source()};
    // Deliberately no beacon, cookies, referrer, URL, field values or retry queue.
    try{void fetch('/metrics.php',{method:'POST',mode:'same-origin',credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer',keepalive:true,headers:{'content-type':'application/json'},body:JSON.stringify(payload)}).catch(()=>{});return true;}catch{return false;}
  }
  function view(){if(!pageViewed&&send('page_view'))pageViewed=true;}
  function remember(value){choice=value;try{localStorage.setItem(KEY,value);}catch{}if(banner){banner.remove();banner=null;}if(value==='yes')view();}
  function show(){
    const t=TEXT[lang()];if(banner)banner.remove();
    banner=document.createElement('section');banner.id='acpro-metrics-consent';banner.setAttribute('role','region');banner.setAttribute('aria-label',t.label);
    const title=document.createElement('strong');title.textContent=t.label;
    const text=document.createElement('p');text.textContent=blocked()?t.blocked:t.text;
    const actions=document.createElement('div');actions.className='acpro-metrics-actions';
    for(const [value,label]of [['yes',t.yes],['no',t.no]]){const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.metricsChoice=value;button.disabled=value==='yes'&&blocked();actions.append(button);}
    const link=document.createElement('a');link.href='/privacy.html';link.textContent=t.policy;actions.append(link);banner.append(title,text,actions);document.body.append(banner);
  }
  function installStyle(){
    const style=document.createElement('style');style.textContent='#acpro-metrics-consent{position:fixed;left:16px;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:10000;max-width:580px;margin:auto;padding:16px;background:#fff;color:#082846;border:1px solid #cde1ed;border-radius:12px;box-shadow:0 8px 30px #08284626;font:13px/1.5 system-ui,sans-serif}#acpro-metrics-consent p{margin:8px 0 12px}.acpro-metrics-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.acpro-metrics-actions button{font:inherit;font-weight:600;min-height:44px;cursor:pointer;padding:9px 14px;border:1px solid #cde1ed;border-radius:8px;background:#edf6fc;color:#082846}.acpro-metrics-actions button:disabled{cursor:not-allowed;opacity:.55}.acpro-metrics-actions a{color:#087dd8;text-decoration:underline}.acpro-metrics-actions :focus-visible{outline:3px solid #087dd8;outline-offset:3px}@media(max-width:480px){#acpro-metrics-consent{left:8px;right:8px;max-height:65vh;overflow:auto}.acpro-metrics-actions button{flex:1}}';document.head.append(style);
  }
  function ready(){
    installStyle();if(choice===null)show();else view();
    document.addEventListener('click',event=>{
      const target=event.target instanceof Element?event.target:null;if(!target)return;
      const settings=target.closest('[data-metrics-settings]');if(settings){event.preventDefault();show();return;}
      const consent=target.closest('[data-metrics-choice]');if(consent&&banner?.contains(consent)){event.preventDefault();const value=consent.dataset.metricsChoice;if(value==='no'||value==='yes'&&!blocked())remember(value);return;}
      const anchor=target.closest('a');if(!anchor)return;
      if(anchor.protocol==='tel:'){send('phone_click');return;}
      if(anchor.protocol==='whatsapp:'||anchor.protocol==='https:'&&['wa.me','api.whatsapp.com','web.whatsapp.com'].includes(anchor.hostname.toLowerCase()))send('whatsapp_click');
    });
    document.addEventListener('change',event=>{
      const target=event.target instanceof Element?event.target:null;if(!target)return;let calculator;
      if(target.id==='quickArea'||target.id==='quickService'||target.closest('#quickForm'))calculator='quick';
      else if(target.closest('#priceForm'))calculator='main';
      else if(target.closest('#inductionForm'))calculator='induction';
      if(calculator&&!changed.has(calculator)&&send('calculator_change',calculator))changed.add(calculator);
    });
    window.addEventListener('acpro:metric',event=>{const detail=event.detail;if(detail?.event==='quote_handoff'&&CALCULATORS.has(detail.calculator))send('quote_handoff',detail.calculator);});
    window.addEventListener('storage',event=>{if(event.key!==KEY)return;choice=event.newValue==='yes'||event.newValue==='no'?event.newValue:null;if(banner){banner.remove();banner=null;}if(choice===null)show();else view();});
    new MutationObserver(()=>{if(banner)show();}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
