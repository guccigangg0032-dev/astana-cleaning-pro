'use strict';
// ASTANA CLEANING PRO: transparent estimates; figures are indicative, not final quotations.
(function(){
const app=window.ACPro;
const form=document.getElementById('priceForm');
if(!app||!form)return;
const t=app.t, p=t.prices, fmt=app.money, byId=id=>document.getElementById(id);
const tariffConfig={
 maintenance:{index:0,rate:400,min:18000},
 general:{index:1,rate:900,min:38000},
 renovation:{index:2,rate:1200,min:52000}
};
const extraIds=app.prices.map(x=>x.id);
const rates=app.prices.map(x=>x.sum);
const hobRates=[15000,20000,25000];
function calculate(){
 const type=document.querySelector('input[name="service"]:checked')?.value||'general';
 const standalone=type==='extras';
 const tariff=standalone?null:(tariffConfig[type]||tariffConfig.general);
 const raw=Number.parseInt(byId('area').value,10);
 const area=Number.isFinite(raw)?Math.max(20,Math.min(2000,raw)):55;
 const base=standalone?0:Math.max(tariff.min,tariff.rate*area);
 const extras=extraIds.map((id,i)=>({id,index:i,selected:byId(id).checked,rate:id==='addonInduction'?(hobRates[Number(byId('hobSize').value)]??hobRates[0]):rates[i],name:p.addons[i]})).filter(item=>item.selected);
 const total=base+extras.reduce((sum,item)=>sum+(item.rate??0),0);
 const custom=extras.some(item=>item.rate===null);
 return {type,standalone,tariff,area,base,extras,total,custom,valid:!standalone||extras.length>0};
}
function amount(e){
 if(!e.valid)return p.needOne;
 if(e.standalone&&e.total===0)return p.quote;
 return t.from+' '+fmt(e.total)+(e.custom?' '+p.requestExtra:'');
}
function update(){
 const e=calculate();
 byId('areaGroup').hidden=e.standalone;
 byId('hobSizeGroup').hidden=!byId('addonInduction').checked;
 byId('area').disabled=e.standalone;
 byId('area').required=!e.standalone;
 byId('areaRange').disabled=e.standalone;
 byId('extraNotice').textContent=e.standalone?p.extraLead:p.optional;
 byId('priceResult').textContent=amount(e);
 byId('priceDetails').textContent=e.standalone
   ?(e.extras.length?e.extras.map(x=>x.name).join(' · '):p.needOne)
   :p.types[e.tariff.index]+' · '+e.area+' м²'+(e.extras.length?' + '+p.more:'');
 byId('sendEstimate').disabled=!e.valid;
}
function makeWhatsAppLink(){
 const e=calculate();
 if(!e.valid)return null;
 const lab=p.waLabels;
 const lines=[t.waHello,'',lab.service+': '+(e.standalone?p.standalone:p.types[e.tariff.index])];
 if(!e.standalone){
   lines.push(lab.area+': '+e.area+' м²');
   lines.push(lab.base+': '+t.from+' '+fmt(e.base));
 }
 for(const extra of e.extras){
   const detail=extra.id==='addonInduction'?' ('+p.hobSizes[Number(byId('hobSize').value)||0]+')':'';
   lines.push(lab.extra+': '+extra.name+detail+' — '+(extra.rate!==null?t.from+' '+fmt(extra.rate):lab.individual));
 }
 lines.push(lab.sum+': '+amount(e),'',lab.end);
 return app.wapp(lines.join('\n'));
}
byId('areaRange').addEventListener('input',event=>{
 byId('area').value=event.target.value;
 update();
});
byId('area').addEventListener('input',event=>{
 const num=Number(event.target.value);
 if(Number.isFinite(num))byId('areaRange').value=String(Math.max(20,Math.min(250,num)));
 update();
});
byId('area').addEventListener('blur',event=>{
 event.target.value=String(calculate().area);
 update();
});
form.addEventListener('change',update);
byId('sendEstimate').addEventListener('click',()=>{
 const href=makeWhatsAppLink();
 if(href)window.open(href,'_blank','noopener,noreferrer');
});
update();
})();
