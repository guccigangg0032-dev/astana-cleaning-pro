'use strict';
const phone = '77776146664';
const tariffs = {
  maintenance: {title:'Поддерживающая уборка',rate:400,min:18000},
  general: {title:'Генеральная уборка',rate:900,min:38000},
  renovation: {title:'Уборка после ремонта',rate:1200,min:52000}
};
const byId=(id)=>document.getElementById(id);
const money=(n)=>n.toLocaleString('ru-RU')+' ₸';
function getEstimate(){
  const type=document.querySelector('input[name="service"]:checked')?.value || 'general';
  const tariff=tariffs[type];
  const raw=parseInt(byId('area').value,10);
  const area=Number.isFinite(raw)?Math.min(2000,Math.max(20,raw)):55;
  const floor=Math.max(tariff.min,area*tariff.rate);
  const sofa=byId('addonSofa').checked?10000:0;
  const chair=byId('addonChair').checked?5500:0;
  return {type,tariff,area,floor,sofa,chair,total:floor+sofa+chair};
}
function updateEstimate(){
  const e=getEstimate();
  byId('priceResult').textContent=money(e.total);
  byId('priceDetails').textContent=e.tariff.title+' · '+e.area+' м²'+(e.sofa||e.chair?' + дополнительные услуги':'');
}
function whatsappMessage(){
  const e=getEstimate();
  let lines=['Здравствуйте! Хочу уточнить стоимость уборки ASTANA CLEANING PRO.','',
    'Услуга: '+e.tariff.title,
    'Площадь: '+e.area+' м²',
    'Базовый расчёт: от '+money(e.floor)];
  if(e.sofa)lines.push('Химчистка двухместного дивана: +'+money(e.sofa));
  if(e.chair)lines.push('Химчистка кресла: +'+money(e.chair));
  lines.push('Ориентир по сумме: от '+money(e.total),'',
    'Пожалуйста, уточните состав работ, доступное время и окончательную стоимость. Могу отправить фотографии помещения.');
  return 'https://wa.me/'+phone+'?text='+encodeURIComponent(lines.join('\n'));
}
byId('areaRange').addEventListener('input',(event)=>{byId('area').value=event.target.value;updateEstimate();});
byId('area').addEventListener('input',(event)=>{
  const n=Number(event.target.value);
  if(Number.isFinite(n))byId('areaRange').value=String(Math.min(250,Math.max(20,n)));
  updateEstimate();
});
byId('area').addEventListener('blur',(event)=>{event.target.value=String(getEstimate().area);updateEstimate();});
byId('priceForm').addEventListener('change',updateEstimate);
byId('sendEstimate').addEventListener('click',()=>{window.open(whatsappMessage(),'_blank','noopener,noreferrer');});
const toggle=byId('navToggle');const nav=byId('mainNav');
toggle.addEventListener('click',()=>{const opened=nav.classList.toggle('active');toggle.setAttribute('aria-expanded',String(opened));});
nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('active');toggle.setAttribute('aria-expanded','false');}));
document.addEventListener('keydown',(event)=>{if(event.key==='Escape'){nav.classList.remove('active');toggle.setAttribute('aria-expanded','false');}});
byId('currentYear').textContent=String(new Date().getFullYear());
updateEstimate();