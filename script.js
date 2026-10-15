
'use strict';
// Runs only on prices.html. Other pages do not load the calculator script.
(function(){
const app=window.ACPro,form=document.getElementById('priceForm');
if(!app||!form)return;
const t=app.t,fmt=app.money,byId=id=>document.getElementById(id),p=t.prices;
const tariffConfig={maintenance:{index:0,rate:400,min:18000},general:{index:1,rate:900,min:38000},renovation:{index:2,rate:1200,min:52000},extras:{index:3,rate:0,min:0}};
const extraIds=['addonSofa','addonChair','addonWindows','addonAppliances','addonDiningChairs','addonFire','addonBio','addonCurtains'];
const extraRates=[10000,5500,3000,3000,null,null,null,null];
function calc(){
 const type=document.querySelector('input[name="service"]:checked')?.value||'general';
 const tariff=tariffConfig[type]||tariffConfig.general;
 const raw=Number.parseInt(byId('area').value,10);
 const area=Number.isFinite(raw)?Math.max(20,Math.min(2000,raw)):55;
 const floor=type==='extras'?0:Math.max(tariff.min,tariff.rate*area);
 const extras=extraIds.map((id,i)=>({id,i,checked:byId(id).checked,rate:extraRates[i],name:p.addons[i]})).filter(x=>x.checked);
 const total=floor+extras.reduce((sum,item)=>sum+(item.rate||0),0);
 const custom=extras.some(x=>x.rate===null);
 return {type,tariff,area,floor,extras,total,custom,empty:type==='extras'&&extras.length===0};
}
function update(){
 const e=calc();
 byId('areaGroup').hidden=e.type==='extras';
 byId('priceResult').textContent=e.empty?p.zeroExtra:e.total?t.from+' '+fmt(e.total)+(e.custom?' '+p.requestExtra:''):p.onlyRequest;
 byId('sendEstimate').disabled=e.empty;
 byId('priceDetails').textContent=p.types[e.tariff.index]+(e.type==='extras'?'':' · '+e.area+' м²')+(e.extras.length?' + '+p.more:'');
}
function buildMessage(){
 const e=calc(),lab=p.waLabels;
 const lines=[t.waHello,'',lab.service+': '+p.types[e.tariff.index]];
 if(e.type!=='extras')lines.push(lab.area+': '+e.area+' м²',lab.base+': '+t.from+' '+fmt(e.floor));
 for(const extra of e.extras){lines.push(lab.extra+': '+extra.name+' — '+(extra.rate?'+'+fmt(extra.rate):lab.individual))}
 lines.push(lab.sum+': '+(e.total?t.from+' '+fmt(e.total)+(e.custom?' '+p.requestExtra:''):p.onlyRequest),'',lab.end);
 return app.wapp(lines.join('\n'));
}
byId('areaRange').addEventListener('input',e=>{byId('area').value=e.target.value;update()});
byId('area').addEventListener('input',e=>{const n=Number(e.target.value);if(Number.isFinite(n))byId('areaRange').value=String(Math.max(20,Math.min(250,n)));update()});
byId('area').addEventListener('blur',e=>{e.target.value=String(calc().area);update()});
form.addEventListener('change',update);
byId('sendEstimate').addEventListener('click',()=>{if(!calc().empty)window.open(buildMessage(),'_blank','noopener,noreferrer')});
update();
})();
