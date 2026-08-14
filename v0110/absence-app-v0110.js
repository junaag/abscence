(()=>{
'use strict';
const E=window.AbsenceEngine;
if(!E)throw new Error('AbsenceEngine v0.1.10 missing');

const KEY='absence-preview-v019';
const HOME=[43.4053,5.0548],HOME_RADIUS_M=85;
const $=(q,r=document)=>r.querySelector(q);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');

function load(){
  try{
    const x=JSON.parse(localStorage.getItem(KEY));
    if(x){E.ensureState(x);ensureMapState(x);return x}
  }catch(_){}
  const x=E.freshState();ensureMapState(x);return x;
}
function ensureMapState(x){
  x.map=x.map||{};x.map.explored=Array.isArray(x.map.explored)?x.map.explored:[];
  if(!x.map.explored.length)x.map.explored.push({lat:HOME[0],lng:HOME[1],radius:HOME_RADIUS_M});
  x.map.poiCache=x.map.poiCache||{};
}
let s=load(),screen='home',menuOpen=false,selectedItem=null;
let map=null,fogLayer=null,poiLayer=null,poiTimer=null,poiAbort=null;
const save=()=>localStorage.setItem(KEY,JSON.stringify(s));

function time(){return `${pad(s.time.h)}:${pad(s.time.m)}`}
function daypart(){const h=s.time.h;return h<6?'Nuit':h<12?'Matin':h<18?'Après-midi':'Soir'}
function weather(){const w=s.world.weather||{};return `☀ ${Math.round(w.temperatureC||24)}°C · Ensoleillé · vent faible`}
function statColor(k,v){if(k==='health')return v<=25?'var(--danger)':v<=55?'var(--accent)':'var(--good)';return v>=75?'var(--danger)':v>=45?'var(--accent)':'var(--blue)'}
function criticalText(){const labels={hunger:'faim',thirst:'soif',fatigue:'fatigue',stress:'stress',pain:'douleur'};const k=Object.keys(labels).find(x=>s.stats[x]>=80);return k?`⚠ ${labels[k]} critique`:''}
function activeLocal(){return E.getActiveEffects(s,s.locationId)}
function fxMeta(e){return E.getEffectLabel(e.type)}
function resultObj(){return s.uiResult||{title:'Quelque chose ne va pas.',body:'Le silence de la maison est anormal. Aucune voix, aucune circulation, aucun bruit humain.',effects:[]}}

function hudHTML(){
  const M=[['health','♥'],['hunger','◒'],['thirst','◆'],['fatigue','Zz'],['stress','!'],['pain','+']];
  const alert=criticalText();
  return `<header id="hud"><div class="top"><div class="world"><div class="line"><span class="time">${time()}</span><span class="dot">•</span><span class="part">${daypart()}</span><span class="dot">•</span><span class="loc">${esc(s.location)}</span></div><div class="weather">${weather()}</div>${alert?`<div class="critical">${alert}</div>`:''}</div><button class="menu" data-ui="menu">☰</button></div><div class="stats">${M.map(([k,i])=>`<button class="stat" data-ui="stat" data-stat="${k}"><span class="ico" style="color:${statColor(k,s.stats[k])}">${i}</span><span class="val" style="color:${statColor(k,s.stats[k])}">${k==='health'?Math.round(s.stats[k])+' PV':Math.round(s.stats[k])+'%'}</span></button>`).join('')}</div></header>`;
}
function navHTML(){
  const N=[['home','⌂','Accueil'],['map','◇','Carte'],['inventory','▤','Inventaire'],['state','◉','État'],['world','≋','Monde']];
  return `<nav id="bottom-nav">${N.map(([id,ic,n])=>`<button class="nav ${screen===id?'active':''}" data-ui="go" data-screen="${id}"><span>${ic}</span>${n}</button>`).join('')}</nav>`;
}
function resultHTML(){
  const r=resultObj();
  return `<div class="card result"><div class="rlabel">Résultat de l’action</div><div class="rtitle">${esc(r.title)}</div><div class="rbody">${esc(r.body)}</div>${r.effects?.length?`<div class="effects">${r.effects.map(x=>`<span class="pill">${esc(x)}</span>`).join('')}</div>`:''}</div>`;
}
function actionHTML(a){
  return `<button class="action ${a.kind||''}" data-ui="engine-action" data-id="${esc(a.id)}" data-args="${esc(JSON.stringify(a.args||[]))}"><div class="acopy"><div class="atitle">${esc(a.label)}</div><div class="asub">${esc(a.detail||'')}</div></div><div class="chev">›</div></button>`;
}
function effectHTML(e){
  const m=fxMeta(e);return `<div class="effect-card ${e.type}"><div class="effect-glyph">${esc(m.glyph)}</div><div class="effect-copy"><div class="effect-name">${esc(m.label)}</div><div class="effect-meta">${Math.round(e.intensity)}% · ${esc(s.locations[e.locationId]?.name||e.locationId)}</div></div></div>`;
}
function itemMeta(x){
  if(x.definitionId==='smartphone')return `Batterie ${Math.round(x.batteryChargePct||0)}%`;
  if(x.definitionId==='water_bottle_500')return `${Math.round(x.liquidMl||0)} / ${x.capacityMl||500} ml`;
  if(x.definitionId==='apple')return `Fraîcheur ${Math.round(x.freshnessPct||0)}%`;
  return 'Objet';
}
function itemListHTML(){
  if(!s.inventory.length)return '<div class="card empty">Inventaire vide.</div>';
  return s.inventory.map(id=>{
    const x=s.items[id];if(!x)return'';
    const open=selectedItem===id,acts=open?E.getItemActions(s,id):[];
    return `<div class="item-wrap"><button class="item" data-ui="select-item" data-id="${id}"><span class="itemicon">${x.definitionId==='smartphone'?'▣':x.definitionId==='apple'?'●':x.definitionId==='water_bottle_500'?'◒':'▤'}</span><span class="itemcopy"><b>${esc(x.name)}</b><small>${esc(itemMeta(x))}</small></span><span class="chev">${open?'⌄':'›'}</span></button>${open&&acts.length?`<div class="item-actions">${acts.map(actionHTML).join('')}</div>`:open?'<div class="item-note">Aucune action utile ici pour cet objet.</div>':''}</div>`;
  }).join('');
}
function homeHTML(){
  const local=activeLocal(),actions=E.getContextActions(s);
  return `<main><div class="card hero"><div class="kicker">ABSENCE</div><div class="title">${esc(s.location)}</div><div class="copy">${esc(E.describeLocation(s))}</div></div>${resultHTML()}${local.length?`<div class="section">Situation locale</div>${local.map(effectHTML).join('')}`:''}<div class="section">Actions</div>${actions.map(actionHTML).join('')}<div class="section">Sur vous</div>${itemListHTML()}</main>`;
}
function inventoryHTML(){return `<main><div class="card"><div class="kicker">Inventaire</div><div class="title">Sur vous</div><div class="copy">Touchez un objet pour voir uniquement les actions réellement possibles.</div></div>${itemListHTML()}</main>`}
function stateHTML(){
  const M=[['health','Santé'],['hunger','Faim'],['thirst','Soif'],['fatigue','Fatigue'],['stress','Stress'],['pain','Douleur']];
  return `<main><div class="card"><div class="kicker">État physique</div><div class="title">Indicateurs</div></div><div class="card">${M.map(([k,n])=>`<div class="statrow"><b>${n}</b><div class="track"><div class="fill" style="width:${Math.max(0,Math.min(100,s.stats[k]))}%;background:${statColor(k,s.stats[k])}"></div></div><b>${k==='health'?Math.round(s.stats[k])+' PV':Math.round(s.stats[k])+'%'}</b></div>`).join('')}</div></main>`;
}
function worldHTML(){
  const fx=E.getActiveEffects(s);
  return `<main><div class="card"><div class="kicker">État du monde</div><div class="title">Phénomènes actifs</div><div class="copy">Ces états restent dans le moteur et ne sont pas projetés comme informations de danger sur la carte.</div></div>${fx.length?fx.map(effectHTML).join(''):'<div class="card empty">Aucun phénomène persistant actuellement.</div>'}</main>`;
}
function mapHTML(){return `<main class="mapmain"><div class="mapshell"><div id="map"></div><div id="map-loading" class="maploading">Carte</div></div></main>`}
function menuHTML(){if(!menuOpen)return'';return `<div class="overlay" data-ui="close-menu"><div class="panel" data-stop="1"><div class="phead"><div><div class="kicker">Menu</div><div class="ptitle">ABSENCE</div></div><button class="close" data-ui="close-menu">×</button></div><button class="menurow menubtn" data-ui="go" data-screen="home"><b>Accueil</b><span>›</span></button><div class="menurow"><b>Paramètres</b><span>Son à venir</span></div><div class="menurow"><b>About</b><span>moteur 0.1.10</span></div></div></div>`}

function buildShell(){
  document.getElementById('app').innerHTML=`${hudHTML()}<div id="view-host"></div><div id="persistent-map" hidden>${mapHTML()}</div>${navHTML()}<div id="overlay-host"></div>`;
  render();
}
function updateShell(){
  const h=$('#hud');if(h)h.outerHTML=hudHTML();
  const n=$('#bottom-nav');if(n)n.outerHTML=navHTML();
  const o=$('#overlay-host');if(o)o.innerHTML=menuHTML();
}
function render(){
  save();updateShell();
  const host=$('#view-host'),mapHost=$('#persistent-map');
  if(screen==='map'){
    host.hidden=true;mapHost.hidden=false;ensureMap();
    requestAnimationFrame(()=>{map?.invalidateSize(false);fogLayer?.redraw()});
  }else{
    mapHost.hidden=true;host.hidden=false;
    host.innerHTML=screen==='home'?homeHTML():screen==='inventory'?inventoryHTML():screen==='state'?stateHTML():worldHTML();
  }
}

function failure(r){
  const d={
    NO_CONNECTION:'Ce passage n’est pas accessible.',
    ITEM_NOT_HERE:'Cet objet n’est plus ici.',
    NOT_CARRIED:'Vous ne transportez pas cet objet.',
    EMPTY:'La bouteille est vide.',
    NO_TAP:'Il n’y a pas de robinet utilisable ici.',
    NO_RUNNING_WATER:'L’eau courante ne fonctionne plus.',
    ALREADY_FULL:'La bouteille est déjà pleine.',
    NEED_TOWEL:'Il vous faut un torchon.',
    NEED_WATER:'Il faut au moins 25 cl d’eau dans la bouteille.',
    NOT_LOCAL:'Ce phénomène n’est pas ici.',
    EFFECT_NOT_FOUND:'Le phénomène n’existe plus.'
  };
  s.uiResult={title:'Action impossible.',body:d[r?.reason]||r?.reason||'Cette action n’est pas possible.',effects:[]};
  render();
}
function runEngine(id,args=[]){
  const r=E.performAction(s,id,args);
  if(!r.success)return failure(r);
  s.uiResult={title:r.title,body:r.body,effects:r.effects||[]};
  selectedItem=null;render();
}
function statTip(k){
  const names={health:'Santé',hunger:'Faim',thirst:'Soif',fatigue:'Fatigue',stress:'Stress',pain:'Douleur'};
  s.uiResult={title:names[k]||k,body:k==='health'?'Points de vie du personnage. À 0 PV, vous mourez.':`Niveau actuel : ${Math.round(s.stats[k])}%.`,effects:[]};screen='home';render();
}

function makeFogLayer(){
  return L.Layer.extend({
    onAdd(m){this._map=m;this._canvas=L.DomUtil.create('canvas','absence-fog-canvas');m.getPane('fogPane').appendChild(this._canvas);m.on('move zoom resize',this.redraw,this);this.redraw()},
    onRemove(m){m.off('move zoom resize',this.redraw,this);this._canvas?.remove()},
    redraw(){
      if(!this._map||!this._canvas)return;
      const size=this._map.getSize(),dpr=Math.min(window.devicePixelRatio||1,2),c=this._canvas;
      c.width=Math.round(size.x*dpr);c.height=Math.round(size.y*dpr);c.style.width=size.x+'px';c.style.height=size.y+'px';
      const topLeft=this._map.containerPointToLayerPoint([0,0]);L.DomUtil.setPosition(c,topLeft);
      const ctx=c.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,size.x,size.y);
      ctx.fillStyle='rgba(67,74,80,.97)';ctx.fillRect(0,0,size.x,size.y);
      ctx.globalAlpha=.14;ctx.strokeStyle='#fff';ctx.lineWidth=1;
      for(let x=-size.y;x<size.x+size.y;x+=17){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+size.y,size.y);ctx.stroke()}
      ctx.globalAlpha=1;ctx.globalCompositeOperation='destination-out';
      for(const z of s.map.explored){
        const p=this._map.latLngToContainerPoint([z.lat,z.lng]);
        const edge=this._map.latLngToContainerPoint(L.latLng(z.lat,z.lng).toBounds(z.radius*2).getNorthEast());
        const r=Math.max(28,Math.hypot(edge.x-p.x,edge.y-p.y));
        const g=ctx.createRadialGradient(p.x,p.y,r*.62,p.x,p.y,r);g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(.72,'rgba(0,0,0,.99)');g.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=g;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();
      }
      ctx.globalCompositeOperation='source-over';
    }
  });
}
function ensureMap(){
  if(map||!window.L)return;
  const el=$('#map');if(!el)return;
  map=L.map(el,{zoomControl:true,attributionControl:true,preferCanvas:true,fadeAnimation:false,markerZoomAnimation:false}).setView(HOME,17);
  map.createPane('fogPane');map.getPane('fogPane').style.zIndex=430;map.getPane('fogPane').style.pointerEvents='none';
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,minZoom:13,updateWhenIdle:true,updateWhenZooming:false,keepBuffer:1,detectRetina:false,attribution:'&copy; OpenStreetMap'}).addTo(map);
  poiLayer=L.layerGroup().addTo(map);
  const HomeIcon=L.divIcon({className:'absence-home-marker',html:'⌂',iconSize:[34,34],iconAnchor:[17,17]});
  L.marker(HOME,{icon:HomeIcon,zIndexOffset:1000}).addTo(map).bindPopup('<b>Maison</b><br><button class="map-popup-btn" data-ui="return-home">Revenir à la maison</button>');
  const Fog=makeFogLayer();fogLayer=new Fog().addTo(map);
  map.whenReady(()=>{$('#map-loading')?.remove();schedulePois(900)});
  map.on('moveend zoomend',()=>{fogLayer?.redraw();schedulePois(900)});
  map.on('movestart zoomstart',()=>document.body.classList.add('map-moving'));
  map.on('moveend zoomend',()=>setTimeout(()=>document.body.classList.remove('map-moving'),250));
}
function distance(a,b,c,d){const R=6371000,p1=a*Math.PI/180,p2=c*Math.PI/180,dp=(c-a)*Math.PI/180,dl=(d-b)*Math.PI/180,x=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*R*Math.asin(Math.sqrt(x))}
function schedulePois(delay){clearTimeout(poiTimer);poiTimer=setTimeout(loadPois,delay)}
function poiCat(t={}){
  if(t.amenity==='fuel')return['Services','Station service','⛽'];
  if(['hospital','clinic','doctors','pharmacy','police','fire_station'].includes(t.amenity))return['Services publics',t.amenity==='police'?'Police':t.amenity==='fire_station'?'Pompiers':t.amenity==='pharmacy'?'Pharmacie':'Santé','✚'];
  if(t.shop==='car_repair'||t.amenity==='car_repair')return['Services','Garage','◆'];
  if(t.shop)return['Commerce',t.shop==='supermarket'?'Supermarché':t.shop==='books'?'Librairie':'Commerce','●'];
  if(t.landuse==='industrial'||t.building==='warehouse')return['Industrie','Industrie','■'];
  return null;
}
async function loadPois(){
  if(!map||screen!=='map'||map.getZoom()<15)return;
  const c=map.getCenter();if(distance(c.lat,c.lng,HOME[0],HOME[1])>1600){poiLayer.clearLayers();return}
  const key=`${c.lat.toFixed(3)}:${c.lng.toFixed(3)}`,cached=s.map.poiCache[key];if(cached)return renderPois(cached);
  poiAbort?.abort();poiAbort=new AbortController();
  const b=map.getBounds(),bbox=`${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()}`;
  const q=`[out:json][timeout:4];(nwr[amenity~"^(fuel|hospital|clinic|doctors|pharmacy|police|fire_station|car_repair)$"](${bbox});nwr[shop](${bbox});nwr[landuse=industrial](${bbox});nwr[building=warehouse](${bbox}););out center tags 45;`;
  try{
    const timer=setTimeout(()=>poiAbort.abort(),4500);
    const r=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:q,signal:poiAbort.signal,headers:{'Content-Type':'text/plain;charset=UTF-8'}});
    clearTimeout(timer);if(!r.ok)return;
    const data=await r.json(),pois=[];
    for(const e of data.elements||[]){
      const cat=poiCat(e.tags||{});if(!cat)continue;
      const lat=e.lat??e.center?.lat,lng=e.lon??e.center?.lon;if(!Number.isFinite(lat)||!Number.isFinite(lng))continue;
      pois.push({lat,lng,category:cat[0],type:cat[1],name:e.tags?.name||cat[1],glyph:cat[2]});if(pois.length>=45)break;
    }
    s.map.poiCache[key]=pois;const keys=Object.keys(s.map.poiCache);if(keys.length>4)delete s.map.poiCache[keys[0]];save();renderPois(pois);
  }catch(_){}
}
function renderPois(pois){
  poiLayer.clearLayers();
  for(const p of pois){
    const icon=L.divIcon({className:'absence-poi',html:`<span>${esc(p.glyph)}</span>`,iconSize:[26,26],iconAnchor:[13,13]});
    L.marker([p.lat,p.lng],{icon}).addTo(poiLayer).bindPopup(`<b>${esc(p.category)}</b><br><span>${esc(p.name)}</span><br><small>${esc(p.type)}</small>`);
  }
}

document.addEventListener('click',ev=>{
  if(ev.target.closest('[data-stop]'))return;
  const el=ev.target.closest('[data-ui]');if(!el)return;
  const ui=el.dataset.ui;
  if(ui==='go'){screen=el.dataset.screen;menuOpen=false;selectedItem=null;render()}
  else if(ui==='menu'){menuOpen=!menuOpen;render()}
  else if(ui==='close-menu'){menuOpen=false;render()}
  else if(ui==='engine-action'){let args=[];try{args=JSON.parse(el.dataset.args||'[]')}catch(_){}runEngine(el.dataset.id,args)}
  else if(ui==='select-item'){selectedItem=selectedItem===el.dataset.id?null:el.dataset.id;render()}
  else if(ui==='stat')statTip(el.dataset.stat)
  else if(ui==='return-home'){
    if(s.locationId==='garden')E.performAction(s,'move',['kitchen']);
    if(s.locationId==='kitchen')E.performAction(s,'move',['bedroom']);
    screen='home';s.uiResult={title:'Vous revenez à la maison.',body:'Vous retrouvez la chambre où tout a commencé.',effects:[]};map?.closePopup();render();
  }
});

injectStyles();
function injectStyles(){
  const st=document.createElement('style');
  st.textContent=`.stat{border:0;background:transparent;color:inherit;padding:0;min-width:0}.critical{font-size:9px;color:#ef9d84;font-weight:900;margin-top:4px}.item-wrap{margin-bottom:7px}.item-actions{padding:0 8px 5px 24px}.item-actions .action{margin:5px 0}.item-note{margin:-2px 8px 8px 52px;color:#7f8d96;font-size:10px}.mapmain{padding:8px 8px 76px}.mapshell{position:relative}#persistent-map[hidden],#view-host[hidden]{display:none!important}#map{height:calc(100dvh - 132px);min-height:420px;border-radius:14px;overflow:hidden;background:#151a1d;border:1px solid #2f3c45}.maploading{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:900;background:#0b1116e8;border:1px solid #34414b;border-radius:999px;padding:7px 11px;font-size:9px;font-weight:900}.absence-fog-canvas{position:absolute;left:0;top:0;pointer-events:none}.absence-home-marker{width:34px!important;height:34px!important;border-radius:50%;display:grid!important;place-items:center;background:#111820;border:2px solid #e7b94b;color:#e7b94b;font-size:20px;font-weight:900;box-shadow:0 2px 10px #0008}.absence-poi{width:26px!important;height:26px!important;border-radius:50%;display:grid!important;place-items:center;background:#10161c;border:1px solid #697883;color:#eef;font-size:12px;font-weight:900}.leaflet-popup-pane{z-index:750!important}.leaflet-marker-pane{z-index:650!important}.leaflet-popup-content-wrapper,.leaflet-popup-tip{background:#11181d;color:#edf2f5}.map-popup-btn{margin-top:7px;border:1px solid #5f4b21;background:#211b10;color:#f0ca77;border-radius:8px;padding:7px 9px;font-weight:800}.menubtn{width:100%;border:0;background:transparent;color:inherit;text-align:left}.map-moving #hud,.map-moving #bottom-nav{opacity:0;pointer-events:none;transition:opacity .12s}.map-moving #map{height:100dvh}.map-moving .mapmain{padding:0}`;
  document.head.appendChild(st);
}
buildShell();
})();