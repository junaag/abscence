(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.AbsenceEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const VERSION='0.1.10';
const NEEDS=['hunger','thirst','fatigue','stress','pain'];
const RATES={hunger:1/25,thirst:1/15,fatigue:1/20};
const clamp=(v,a=0,b=100)=>Math.min(b,Math.max(a,Number(v)||0));
const clone=v=>JSON.parse(JSON.stringify(v));
const round=(v,d=2)=>{const p=10**d;return Math.round((Number(v)+Number.EPSILON)*p)/p};

const EFFECT_TYPES={
  water_puddle:{label:'Eau au sol',glyph:'≈'},
  smoke:{label:'Fumée',glyph:'≋'},
  fire:{label:'Départ de feu',glyph:'▲'},
  persistent_noise:{label:'Bruit continu',glyph:')))'}
};

function freshState(){
  return {
    engine:{version:VERSION,worldElapsedSeconds:0,damageBudgetPV:0,nextEffectId:1},
    gameDate:{year:2026,month:8,day:9},
    time:{h:7,m:12,s:0},
    locationId:'bedroom',
    location:'Chambre',
    stats:{health:100,hunger:12,thirst:10,fatigue:18,stress:22,pain:0},
    inventory:['phone_01'],
    items:{
      phone_01:{id:'phone_01',definitionId:'smartphone',name:'Téléphone',locationId:'player_inventory',batteryChargePct:78},
      apple_01:{id:'apple_01',definitionId:'apple',name:'Pomme',locationId:'kitchen',freshnessPct:94},
      water_01:{id:'water_01',definitionId:'water_bottle_500',name:'Bouteille d’eau 50 cl',locationId:'kitchen',liquidMl:500,capacityMl:500},
      towel_01:{id:'towel_01',definitionId:'towel',name:'Torchon',locationId:'kitchen'}
    },
    locations:{
      bedroom:{id:'bedroom',name:'Chambre',ventilation:0.15,tap:false,outdoors:false},
      kitchen:{id:'kitchen',name:'Cuisine',ventilation:0.18,tap:true,outdoors:false},
      garden:{id:'garden',name:'Jardin',ventilation:1,tap:false,outdoors:true}
    },
    connections:{
      bedroom_kitchen:{a:'bedroom',b:'kitchen',open:true,travelSeconds:27},
      kitchen_garden:{a:'kitchen',b:'garden',open:true,travelSeconds:20}
    },
    world:{
      waterNetworkAvailable:true,
      powerAvailable:true,
      effects:[],effectHistory:[],eventHistory:[],
      scheduledEvents:[
        {id:'evt_noise',atSeconds:5*60,type:'noise_source',locationId:'kitchen',processed:false},
        {id:'evt_leak',atSeconds:12*60,type:'water_leak',locationId:'kitchen',processed:false},
        {id:'evt_smoke',atSeconds:25*60,type:'smoke',locationId:'garden',processed:false}
      ],
      leakActive:false,
      windowsOpen:{bedroom:false,kitchen:false},
      weather:{condition:'clear',temperatureC:24,windKph:10}
    },
    memory:{shoutedForWife:false,visited:{bedroom:true,kitchen:false,garden:false}},
    map:{explored:[],poiCache:{}},
    uiResult:null
  };
}

function ensureState(s){
  if(!s||typeof s!=='object') throw new Error('State required');
  s.engine=s.engine||{};
  s.engine.version=VERSION;
  if(!Number.isFinite(s.engine.worldElapsedSeconds))s.engine.worldElapsedSeconds=0;
  if(!Number.isFinite(s.engine.damageBudgetPV))s.engine.damageBudgetPV=0;
  if(!Number.isFinite(s.engine.nextEffectId))s.engine.nextEffectId=1;
  s.gameDate=s.gameDate||{year:2026,month:8,day:9};
  s.time=s.time||{h:7,m:12,s:0};
  s.locationId=s.locationId||'bedroom';
  s.locations=s.locations||freshState().locations;
  for(const [id,loc] of Object.entries(freshState().locations)){
    s.locations[id]=Object.assign({},loc,s.locations[id]||{});
  }
  s.location=s.locations[s.locationId]?.name||s.location||s.locationId;
  s.connections=s.connections||freshState().connections;
  s.stats=s.stats||{};
  s.stats.health=clamp(s.stats.health??100);
  for(const k of NEEDS)s.stats[k]=clamp(s.stats[k]??0);
  s.inventory=Array.isArray(s.inventory)?s.inventory:[];
  s.items=s.items||{};
  for(const [id,item] of Object.entries(freshState().items)){
    if(!s.items[id] && !['apple_01'].includes(id)) s.items[id]=clone(item);
  }
  if(s.items.water_01){
    s.items.water_01.capacityMl=Number(s.items.water_01.capacityMl)||500;
    s.items.water_01.liquidMl=clamp(s.items.water_01.liquidMl??500,0,s.items.water_01.capacityMl);
  }
  s.world=s.world||{};
  if(typeof s.world.waterNetworkAvailable!=='boolean')s.world.waterNetworkAvailable=true;
  if(typeof s.world.powerAvailable!=='boolean')s.world.powerAvailable=true;
  s.world.effects=Array.isArray(s.world.effects)?s.world.effects:[];
  s.world.effectHistory=Array.isArray(s.world.effectHistory)?s.world.effectHistory:[];
  s.world.eventHistory=Array.isArray(s.world.eventHistory)?s.world.eventHistory:[];
  s.world.scheduledEvents=Array.isArray(s.world.scheduledEvents)?s.world.scheduledEvents:freshState().world.scheduledEvents;
  s.world.windowsOpen=s.world.windowsOpen||{};
  if(typeof s.world.leakActive!=='boolean')s.world.leakActive=false;
  s.world.weather=s.world.weather||freshState().world.weather;
  s.memory=s.memory||{};
  if(typeof s.memory.shoutedForWife!=='boolean')s.memory.shoutedForWife=false;
  s.memory.visited=s.memory.visited||{};
  s.memory.visited[s.locationId]=true;
  s.map=s.map||{};
  s.map.explored=Array.isArray(s.map.explored)?s.map.explored:[];
  s.map.poiCache=s.map.poiCache||{};
  return s;
}

function itemHere(state,id){return state.items[id]?.locationId===state.locationId}
function carrying(state,id){return state.inventory.includes(id)&&state.items[id]?.locationId==='player_inventory'}
function itemByDef(state,def){return Object.values(state.items).find(x=>x?.definitionId===def)||null}
function adjacentLocations(state,id){
  const out=[];
  for(const c of Object.values(state.connections||{})){
    if(c.open===false)continue;
    if(c.a===id)out.push(c.b);
    else if(c.b===id)out.push(c.a);
  }
  return [...new Set(out)];
}
function findEffect(state,type,locationId=state.locationId){
  return state.world.effects.find(e=>e.active!==false&&e.type===type&&e.locationId===locationId)||null;
}
function addEffect(state,type,locationId,intensity=20,options={}){
  ensureState(state);
  let e=findEffect(state,type,locationId);
  if(e){e.intensity=clamp(Math.max(e.intensity,Number(intensity)||0));return e}
  e={id:`fx_${state.engine.nextEffectId++}`,type,locationId,intensity:clamp(intensity),active:true,createdAtSeconds:state.engine.worldElapsedSeconds,source:options.source||null,spreading:options.spreading!==false};
  state.world.effects.push(e);
  state.world.effectHistory.push({type:'created',effectId:e.id,effectType:type,locationId,atSeconds:state.engine.worldElapsedSeconds});
  return e;
}
function resolveEffect(state,e,reason='resolved'){
  if(!e||e.active===false)return;
  e.active=false;e.intensity=0;e.resolvedAtSeconds=state.engine.worldElapsedSeconds;e.resolutionReason=reason;
  state.world.effectHistory.push({type:'resolved',effectId:e.id,effectType:e.type,locationId:e.locationId,reason,atSeconds:state.engine.worldElapsedSeconds});
}
function addEvent(state,type,locationId){
  const ev={id:`world_${state.world.eventHistory.length+1}`,type,locationId,atSeconds:state.engine.worldElapsedSeconds};
  state.world.eventHistory.push(ev);return ev;
}
function processScheduledEvents(state,before,after){
  const started=[];
  for(const ev of state.world.scheduledEvents){
    if(ev.processed||ev.atSeconds>after||ev.atSeconds<=before)continue;
    ev.processed=true;
    if(ev.type==='noise_source'){addEffect(state,'persistent_noise',ev.locationId,58,{source:'unattended_device'});started.push(addEvent(state,'WORLD_PERSISTENT_NOISE',ev.locationId))}
    else if(ev.type==='water_leak'){state.world.leakActive=true;addEffect(state,'water_puddle',ev.locationId,18,{source:'leak'});started.push(addEvent(state,'WORLD_WATER_LEAK',ev.locationId))}
    else if(ev.type==='smoke'){addEffect(state,'smoke',ev.locationId,46,{source:'distant_fire'});started.push(addEvent(state,'WORLD_SMOKE',ev.locationId))}
  }
  return started;
}
function effectStep(state,minutes){
  for(const e of [...state.world.effects].filter(x=>x.active!==false)){
    const loc=state.locations[e.locationId]||{};
    if(e.type==='water_puddle'){
      e.intensity=clamp(e.intensity+((e.source==='leak'&&state.world.leakActive)?4.5:-0.35)*minutes);
      if(e.intensity>=60&&e.spreading)for(const dest of adjacentLocations(state,e.locationId)){
        if(dest==='garden'||findEffect(state,'water_puddle',dest))continue;
        addEffect(state,'water_puddle',dest,Math.min(20,e.intensity*.22),{source:'spread'});
      }
    }else if(e.type==='smoke'){
      const vent=(Number(loc.ventilation)||0)+(state.world.windowsOpen[e.locationId]?1.2:0);
      e.intensity=clamp(e.intensity-(.8+vent*1.7)*minutes);
      if(e.intensity>=25&&e.spreading)for(const dest of adjacentLocations(state,e.locationId)){
        if(!findEffect(state,'smoke',dest))addEffect(state,'smoke',dest,Math.min(15,e.intensity*.06*minutes),{source:'spread'});
      }
    }else if(e.type==='fire'){
      e.intensity=clamp(e.intensity+1.8*minutes);
      const smoke=findEffect(state,'smoke',e.locationId)||addEffect(state,'smoke',e.locationId,8,{source:'fire'});
      smoke.intensity=clamp(smoke.intensity+2.4*minutes);
    }else if(e.type==='persistent_noise') e.intensity=clamp(e.intensity-.12*minutes);
    if(e.intensity<=.1)resolveEffect(state,e,'natural_decay');
  }
}
function physiologyStep(state,minutes){
  for(const [k,r] of Object.entries(RATES))state.stats[k]=clamp(state.stats[k]+r*minutes);
  const local=state.world.effects.filter(e=>e.active!==false&&e.locationId===state.locationId);
  const smoke=local.find(e=>e.type==='smoke'),fire=local.find(e=>e.type==='fire'),noise=local.find(e=>e.type==='persistent_noise');
  if(smoke&&smoke.intensity>25){state.stats.stress=clamp(state.stats.stress+.05*smoke.intensity*minutes);state.stats.pain=clamp(state.stats.pain+.012*smoke.intensity*minutes)}
  if(fire)state.stats.stress=clamp(state.stats.stress+.08*fire.intensity*minutes);
  if(noise&&noise.intensity>35)state.stats.stress=clamp(state.stats.stress+.02*noise.intensity*minutes);
  let dpm=0;
  if(state.stats.thirst>75)dpm+=(state.stats.thirst-75)/25*.18;
  if(state.stats.hunger>80)dpm+=(state.stats.hunger-80)/20*.08;
  if(state.stats.fatigue>90)dpm+=(state.stats.fatigue-90)/10*.06;
  if(state.stats.pain>70)dpm+=(state.stats.pain-70)/30*.12;
  if(smoke&&smoke.intensity>65)dpm+=(smoke.intensity-65)/35*.22;
  if(fire&&fire.intensity>35)dpm+=(fire.intensity-35)/65*.8;
  state.engine.damageBudgetPV+=dpm*minutes;
  const loss=Math.floor(state.engine.damageBudgetPV+1e-9);
  if(loss){state.stats.health=clamp(state.stats.health-loss);state.engine.damageBudgetPV-=loss}
  return loss;
}
function addClock(state,seconds){
  let total=state.time.h*3600+state.time.m*60+(state.time.s||0)+seconds;
  const days=Math.floor(total/86400);total=((total%86400)+86400)%86400;
  state.time={h:Math.floor(total/3600),m:Math.floor((total%3600)/60),s:Math.floor(total%60)};
  if(days){const d=new Date(Date.UTC(state.gameDate.year,state.gameDate.month-1,state.gameDate.day+days));state.gameDate={year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate()}}
}
function advanceTime(state,seconds){
  ensureState(state);seconds=Math.max(0,Number(seconds)||0);
  const before=state.engine.worldElapsedSeconds,events=processScheduledEvents(state,before,before+seconds);
  let remain=seconds,healthLostPV=0;
  while(remain>0){const step=Math.min(60,remain),min=step/60;state.engine.worldElapsedSeconds+=step;effectStep(state,min);healthLostPV+=physiologyStep(state,min);addClock(state,step);remain-=step}
  return{success:true,elapsedSeconds:seconds,healthLostPV,startedEvents:events};
}

function move(state,destinationId){
  ensureState(state);
  const c=Object.values(state.connections).find(x=>x.open!==false&&((x.a===state.locationId&&x.b===destinationId)||(x.b===state.locationId&&x.a===destinationId)));
  if(!c)return{success:false,reason:'NO_CONNECTION'};
  const t=advanceTime(state,c.travelSeconds||20);state.locationId=destinationId;state.location=state.locations[destinationId]?.name||destinationId;state.memory.visited[destinationId]=true;
  return{success:true,...t};
}
function take(state,itemId){
  ensureState(state);const item=state.items[itemId];
  if(!item||item.locationId!==state.locationId)return{success:false,reason:'ITEM_NOT_HERE'};
  if(!state.inventory.includes(itemId))state.inventory.push(itemId);
  item.locationId='player_inventory';
  return{success:true,...advanceTime(state,5),itemId};
}
function eatApple(state,itemId='apple_01'){
  ensureState(state);const item=state.items[itemId];
  if(!item||!carrying(state,itemId))return{success:false,reason:'NOT_CARRIED'};
  state.stats.hunger=clamp(state.stats.hunger-9);state.stats.thirst=clamp(state.stats.thirst-4);
  state.inventory=state.inventory.filter(x=>x!==itemId);delete state.items[itemId];
  return{success:true,...advanceTime(state,120),hungerEffect:-9,thirstEffect:-4};
}
function drinkBottle(state,itemId='water_01',ml=250){
  ensureState(state);const item=state.items[itemId];
  if(!item||!carrying(state,itemId))return{success:false,reason:'NOT_CARRIED'};
  const qty=Math.min(Math.max(0,ml),Number(item.liquidMl)||0);if(!qty)return{success:false,reason:'EMPTY'};
  item.liquidMl-=qty;const effect=-15*(qty/250);state.stats.thirst=clamp(state.stats.thirst+effect);
  return{success:true,...advanceTime(state,18*(qty/250)),drankMl:qty,thirstEffect:round(effect)};
}
function drinkTap(state){
  ensureState(state);const loc=state.locations[state.locationId];
  if(!loc?.tap)return{success:false,reason:'NO_TAP'};
  if(!state.world.waterNetworkAvailable)return{success:false,reason:'NO_RUNNING_WATER'};
  state.stats.thirst=clamp(state.stats.thirst-15);
  return{success:true,...advanceTime(state,20),thirstEffect:-15};
}
function refillBottle(state,itemId='water_01'){
  ensureState(state);const loc=state.locations[state.locationId],item=state.items[itemId];
  if(!loc?.tap)return{success:false,reason:'NO_TAP'};
  if(!state.world.waterNetworkAvailable)return{success:false,reason:'NO_RUNNING_WATER'};
  if(!item||!carrying(state,itemId))return{success:false,reason:'NOT_CARRIED'};
  const cap=Number(item.capacityMl)||500,current=Number(item.liquidMl)||0,added=Math.max(0,cap-current);
  if(added<1)return{success:false,reason:'ALREADY_FULL'};
  item.liquidMl=cap;
  return{success:true,...advanceTime(state,Math.max(8,Math.round(added/25))),addedMl:added,liquidMl:cap};
}
function stopLeak(state){
  ensureState(state);if(state.locationId!=='kitchen')return{success:false,reason:'NOT_IN_KITCHEN'};
  if(!state.world.leakActive)return{success:false,reason:'NO_ACTIVE_LEAK'};
  state.world.leakActive=false;addEvent(state,'WATER_LEAK_STOPPED','kitchen');return{success:true,...advanceTime(state,18)};
}
function mitigateEffect(state,effectId,action){
  ensureState(state);const e=state.world.effects.find(x=>x.id===effectId&&x.active!==false);
  if(!e)return{success:false,reason:'EFFECT_NOT_FOUND'};if(e.locationId!==state.locationId)return{success:false,reason:'NOT_LOCAL'};
  let reduction=0,seconds=0;
  if(e.type==='water_puddle'&&action==='mop'){if(!carrying(state,'towel_01'))return{success:false,reason:'NEED_TOWEL'};reduction=38;seconds=150}
  else if(e.type==='smoke'&&action==='ventilate'){state.world.windowsOpen[state.locationId]=true;reduction=18;seconds=20}
  else if(e.type==='persistent_noise'&&action==='silence'){reduction=100;seconds=25}
  else if(e.type==='fire'&&action==='douse'){const water=state.items.water_01;if(!water||!carrying(state,'water_01')||(water.liquidMl||0)<250)return{success:false,reason:'NEED_WATER'};water.liquidMl-=250;reduction=48;seconds=15}
  else return{success:false,reason:'ACTION_NOT_SUPPORTED'};
  e.intensity=clamp(e.intensity-reduction);if(e.intensity<=.1)resolveEffect(state,e,'player_action');
  return{success:true,...advanceTime(state,seconds),reduction,remainingIntensity:e.intensity};
}
function shout(state){
  ensureState(state);state.memory.shoutedForWife=true;state.stats.stress=clamp(state.stats.stress+2);
  return{success:true,...advanceTime(state,12)};
}

function describeLocation(state){
  ensureState(state);
  const local=getActiveEffects(state,state.locationId);
  if(state.locationId==='bedroom'){
    const bits=['La place à côté de vous est vide.','Aucun bruit de circulation ne monte de la rue.'];
    if(state.memory.shoutedForWife)bits.push('Votre appel n’a obtenu aucune réponse.');
    else bits.push('Le silence de la maison semble anormal.');
    return bits.join(' ');
  }
  if(state.locationId==='kitchen'){
    const bits=[];
    bits.push(state.world.powerAvailable?'Le réfrigérateur ronronne encore.':'Le réfrigérateur est silencieux : le courant semble coupé.');
    const present=[];
    if(itemHere(state,'apple_01'))present.push('une pomme');
    if(itemHere(state,'water_01'))present.push('une bouteille d’eau');
    if(itemHere(state,'towel_01'))present.push('un torchon');
    if(present.length)bits.push(`${present.length===1?'Sur le plan de travail se trouve':'Sur le plan de travail se trouvent'} ${present.join(', ').replace(/, ([^,]*)$/, ' et $1')}.`);
    else bits.push('Le plan de travail est désormais presque vide.');
    if(state.world.waterNetworkAvailable)bits.push('Le robinet fonctionne encore.');
    else bits.push('En ouvrant le robinet, rien ne coule.');
    if(local.some(e=>e.type==='persistent_noise'))bits.push('Un bruit mécanique continu rompt le silence.');
    if(local.some(e=>e.type==='water_puddle'))bits.push('De l’eau s’étend sur le sol.');
    if(local.some(e=>e.type==='smoke'))bits.push('Une odeur de fumée devient perceptible.');
    return bits.join(' ');
  }
  const bits=['Le jardin est immobile.','Au-delà des clôtures, aucune activité humaine n’est visible.'];
  if(local.some(e=>e.type==='smoke'))bits.push('Une fumée est visible ou perceptible dans l’air.');
  return bits.join(' ');
}

function getContextActions(state){
  ensureState(state);const out=[];
  const add=(id,label,detail,args=[],kind='')=>out.push({id,label,detail,args,kind});
  if(state.locationId==='bedroom'){
    add('shout','Appeler votre épouse à haute voix',state.memory.shoutedForWife?'Appeler de nouveau et écouter.':'Écouter si quelqu’un répond.');
    add('move','Aller dans la cuisine','Traverser la maison.',['kitchen']);
  }else if(state.locationId==='kitchen'){
    add('move','Retourner dans la chambre','Revenir au point de départ.',['bedroom']);
    add('move','Sortir dans le jardin','Observer l’extérieur.',['garden']);
    for(const id of ['apple_01','water_01','towel_01']){
      const item=state.items[id];if(itemHere(state,id))add('take',`Prendre ${item.name.toLowerCase()}`,'Ajouter cet objet à l’inventaire.',[id]);
    }
    if(state.world.waterNetworkAvailable)add('drink_tap','Boire au robinet','Boire environ 25 cl.');
    const bottle=state.items.water_01;
    if(bottle&&carrying(state,'water_01')&&(bottle.liquidMl||0)<(bottle.capacityMl||500)&&state.world.waterNetworkAvailable){
      add('refill_bottle','Remplir la bouteille au robinet',`Compléter la bouteille (${Math.round(bottle.liquidMl||0)}/${bottle.capacityMl||500} ml).`,['water_01']);
    }
    if(state.world.leakActive)add('stop_leak','Fermer l’arrivée d’eau','Stopper la fuite en cours.',[],'warn');
  }else add('move','Rentrer dans la cuisine','Revenir à l’intérieur.',['kitchen']);
  for(const e of getActiveEffects(state,state.locationId)){
    if(e.type==='water_puddle')add('mitigate','Éponger l’eau','Réduire l’étendue de la flaque.',[e.id,'mop'],'warn');
    if(e.type==='smoke')add('mitigate','Aérer la pièce','Renouveler l’air.',[e.id,'ventilate'],'warn');
    if(e.type==='persistent_noise')add('mitigate','Chercher et couper la source','Faire cesser le bruit.',[e.id,'silence'],'warn');
    if(e.type==='fire')add('mitigate','Jeter de l’eau sur le feu','Utilise 25 cl de la bouteille.',[e.id,'douse'],'danger');
  }
  add('wait','Attendre 15 minutes','Observer l’évolution du monde et de vos besoins.',[900]);
  return out;
}
function getItemActions(state,itemId){
  ensureState(state);const x=state.items[itemId];if(!x||!carrying(state,itemId))return[];
  if(x.definitionId==='apple')return[{id:'eat_apple',label:'Manger la pomme',detail:'Réduit la faim et légèrement la soif.',args:[itemId]}];
  if(x.definitionId==='water_bottle_500'){
    const out=[];
    if((x.liquidMl||0)>0)out.push({id:'drink_bottle',label:'Boire 25 cl',detail:`Il reste ${Math.round(x.liquidMl)} ml.`,args:[itemId,250]});
    if(state.locations[state.locationId]?.tap&&state.world.waterNetworkAvailable&&(x.liquidMl||0)<(x.capacityMl||500))out.push({id:'refill_bottle',label:'Remplir au robinet',detail:'Compléter la bouteille avec l’eau courante.',args:[itemId]});
    return out;
  }
  return[];
}
function getActiveEffects(state,locationId=null){ensureState(state);return state.world.effects.filter(e=>e.active!==false&&(!locationId||e.locationId===locationId)).map(clone)}
function getEffectLabel(type){return EFFECT_TYPES[type]||{label:type,glyph:'•'}}

function result(ok,title,body,effects=[],extra={}){return Object.assign({success:ok,title,body,effects},extra)}
function performAction(state,id,args=[]){
  ensureState(state);let r;
  if(id==='move'){r=move(state,args[0]);if(!r.success)return r;return result(true,`Vous arrivez dans ${state.location.toLowerCase()}.`,'Le silence reste total.',[`${Math.round(r.elapsedSeconds)} s`],r)}
  if(id==='shout'){r=shout(state);return result(true,'Aucune réponse.','Votre voix traverse la maison. Rien ne répond.',['+2% stress','12 s'],r)}
  if(id==='wait'){r=advanceTime(state,args[0]||900);return result(true,'Le temps passe.','Le monde continue d’évoluer sans intervention humaine.',[`${Math.round(r.elapsedSeconds/60)} min`],r)}
  if(id==='take'){const name=state.items[args[0]]?.name||'Objet';r=take(state,args[0]);if(!r.success)return r;return result(true,`${name} récupéré.`,'Vous l’ajoutez à ce que vous transportez.',['5 s'],r)}
  if(id==='eat_apple'){r=eatApple(state,args[0]);if(!r.success)return r;return result(true,'Vous mangez la pomme.','Le fruit calme la faim et vous apporte aussi un peu d’eau.',['-9% faim','-4% soif','2 min'],r)}
  if(id==='drink_bottle'){r=drinkBottle(state,args[0],args[1]||250);if(!r.success)return r;return result(true,'Vous buvez dans la bouteille.',`${Math.round(r.drankMl)} ml consommés.`,[`${r.thirstEffect}% soif`],r)}
  if(id==='drink_tap'){r=drinkTap(state);if(!r.success)return r;return result(true,'Vous buvez au robinet.','L’eau coule encore normalement.',['-15% soif','20 s'],r)}
  if(id==='refill_bottle'){r=refillBottle(state,args[0]);if(!r.success)return r;return result(true,'Vous remplissez la bouteille.',`${Math.round(r.addedMl)} ml d’eau ajoutés.`,[`${Math.round(r.liquidMl)} ml dans la bouteille`],r)}
  if(id==='stop_leak'){r=stopLeak(state);if(!r.success)return r;return result(true,'La fuite est stoppée.','L’eau déjà au sol reste présente.',['18 s'],r)}
  if(id==='mitigate'){r=mitigateEffect(state,args[0],args[1]);if(!r.success)return r;return result(true,'Vous intervenez sur la situation.',r.remainingIntensity>0?`Le phénomène persiste à ${Math.round(r.remainingIntensity)}%.`:'Le phénomène est résolu.',[`-${Math.round(r.reduction)} intensité`],r)}
  if(id==='fire_test'){addEffect(state,'fire',state.locationId,32,{source:'test'});return result(true,'Un départ de feu apparaît.','Mode de test : le feu produit de la fumée et peut empirer.',['Feu 32%'])}
  return{success:false,reason:'UNKNOWN_ACTION'};
}

return{
  VERSION,EFFECT_TYPES,freshState,ensureState,advanceTime,getActiveEffects,getEffectLabel,
  describeLocation,getContextActions,getItemActions,performAction,refillBottle,
  addEffect
};
});