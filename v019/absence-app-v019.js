(async()=>{
'use strict';
const ORIGINAL='absence-app-v019-original.js';
function showFatal(err){
  console.error('[ABSENCE v0.1.9 hotfix]',err);
  const app=document.getElementById('app');
  if(app)app.innerHTML='<main style="padding:16px"><div style="background:#181213;border:1px solid #783d3d;border-radius:14px;padding:16px;color:#eee"><b>Erreur de chargement</b><p style="font-size:12px;line-height:1.5;color:#cbb">Le correctif v0.1.9 n’a pas pu être appliqué. Recharge la page. Si le problème persiste, signale-le.</p></div></main>';
}
try{
  const response=await fetch(ORIGINAL,{cache:'no-store'});
  if(!response.ok)throw new Error('Source originale introuvable: '+response.status);
  let src=await response.text();

  const actionFix=`const action=(t,sub,fn,kind='')=>{const safe=String(fn).replace(/&/g,'&amp;').replace(/"/g,'&quot;');return \`<button type="button" class="action \${kind}" onclick="\${safe}"><div class="acopy"><div class="atitle">\${t}</div><div class="asub">\${sub}</div></div><div class="chev">›</div></button>\`};`;
  const mapViewFix=`function mapView(){return \`<main class="mapmain"><div class="mapshell"><div id="map"></div><div class="mapstatus">EXPLORATION · MARTIGUES</div></div><div class="card mapnote">Le brouillard est lié aux coordonnées explorées : déplacer ou zoomer la carte ne déplace plus la zone révélée.</div></main>\`}`;
  const mapFix=`function initMap(){if(map){try{map.remove()}catch(_){}map=null}const el=$('#map');if(!el||!window.L)return;const HOME=[43.4053,5.0548];if(!s.mapExploration||!Array.isArray(s.mapExploration.zones))s.mapExploration={zones:[]};if(!s.mapExploration.zones.length)s.mapExploration.zones.push({id:'home',lat:HOME[0],lng:HOME[1],radiusM:95});save();map=L.map(el,{zoomControl:true,attributionControl:true}).setView(HOME,17);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,updateWhenIdle:true,keepBuffer:2,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);map.createPane('fogPane');const pane=map.getPane('fogPane');pane.style.zIndex='450';pane.style.pointerEvents='none';const circleRing=(lat,lng,radiusM,steps=64)=>{const pts=[],latScale=111320,lngScale=Math.max(1,111320*Math.cos(lat*Math.PI/180));for(let i=0;i<steps;i++){const a=2*Math.PI*i/steps;pts.push([lat+(radiusM*Math.sin(a))/latScale,lng+(radiusM*Math.cos(a))/lngScale])}return pts};const outer=[[42.4,3.8],[42.4,6.3],[44.6,6.3],[44.6,3.8]];const holes=s.mapExploration.zones.map(z=>circleRing(Number(z.lat),Number(z.lng),Math.max(25,Number(z.radiusM)||95)));const fog=L.polygon([outer,...holes],{pane:'fogPane',stroke:false,fill:true,fillColor:'#555b60',fillOpacity:.94,fillRule:'evenodd',interactive:false,className:'absence-fog-mask'}).addTo(map);const path=fog.getElement();if(path){path.style.pointerEvents='none';path.style.filter='contrast(1.06)'}L.marker(HOME,{zIndexOffset:1000}).addTo(map).bindPopup('<b>Maison</b><br>Point de départ');setTimeout(()=>map.invalidateSize(),80)}`;

  const before=src;
  src=src.replace(/^const action=.*$/m,actionFix);
  src=src.replace(/^function mapView\(\).*$/m,mapViewFix);
  src=src.replace(/^function initMap\(\).*$/m,mapFix);
  if(src===before||!src.includes('absence-fog-mask')||!src.includes('&quot;'))throw new Error('Le patch source n’a pas été appliqué complètement.');
  (0,eval)(src);
}catch(err){showFatal(err)}
})();