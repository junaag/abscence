(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.AbsenceEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const VERSION='0.1.9';
  const NEEDS=['hunger','thirst','fatigue','stress','pain'];
  const RATES_PER_MIN={hunger:1/25,thirst:1/15,fatigue:1/20,stress:0,pain:0};
  const EFFECT_TYPES={
    water_puddle:{label:'Eau au sol',glyph:'≈'},
    smoke:{label:'Fumée',glyph:'≋'},
    fire:{label:'Départ de feu',glyph:'▲'},
    persistent_noise:{label:'Bruit continu',glyph:')))'}
  };

  const clamp=(v,a=0,b=100)=>Math.min(b,Math.max(a,Number(v)||0));
  const round=(v,d=3)=>{const p=10**d;return Math.round((Number(v)+Number.EPSILON)*p)/p};
  const clone=v=>JSON.parse(JSON.stringify(v));

  function freshState(){
    return {
      engine:{version:VERSION,worldElapsedSeconds:0,damageBudgetPV:0,nextEffectId:1},
      gameDate:{year:2026,month:8,day:9},
      time:{h:7,m:12,s:0},
      locationId:'bedroom',location:'Chambre',
      stats:{health:100,hunger:12,thirst:10,fatigue:18,stress:22,pain:0},
      inventory:['phone_01'],
      items:{
        phone_01:{id:'phone_01',definitionId:'smartphone',name:'Téléphone',locationId:'player_inventory',batteryChargePct:78},
        apple_01:{id:'apple_01',definitionId:'apple',name:'Pomme',locationId:'kitchen',freshnessPct:94},
        water_01:{id:'water_01',definitionId:'water_bottle_500',name:'Bouteille d’eau 50 cl',locationId:'kitchen',liquidMl:500},
        towel_01:{id:'towel_01',definitionId:'towel',name:'Torchon',locationId:'kitchen'}
      },
      locations:{
        bedroom:{id:'bedroom',name:'Chambre',position:{x:0,y:0},ventilation:0.15},
        kitchen:{id:'kitchen',name:'Cuisine',position:{x:10,y:0},ventilation:0.18},
        garden:{id:'garden',name:'Jardin',position:{x:20,y:0},ventilation:1}
      },
      connections:{
        bedroom_kitchen:{id:'bedroom_kitchen',a:'bedroom',b:'kitchen',open:true,travelSeconds:27},
        kitchen_garden:{id:'kitchen_garden',a:'kitchen',b:'garden',open:true,travelSeconds:20}
      },
      world:{
        effects:[],effectHistory:[],eventHistory:[],
        scheduledEvents:[
          {id:'evt_noise',atSeconds:5*60,type:'noise_source',locationId:'kitchen',processed:false},
          {id:'evt_leak',atSeconds:12*60,type:'water_leak',locationId:'kitchen',processed:false},
          {id:'evt_smoke',atSeconds:25*60,type:'smoke',locationId:'garden',processed:false}
        ],
        leakActive:false,windowsOpen:{bedroom:false,kitchen:false},
        weather:{condition:'clear',temperatureC:24,windKph:10}
      }
    };
  }

  function ensureState(s){
    if(!s||typeof s!=='object') throw new Error('State required');
    s.engine=s.engine||{};s.engine.version=VERSION;
    if(!Number.isFinite(s.engine.worldElapsedSeconds))s.engine.worldElapsedSeconds=0;
    if(!Number.isFinite(s.engine.damageBudgetPV))s.engine.damageBudgetPV=0;
    if(!Number.isFinite(s.engine.nextEffectId))s.engine.nextEffectId=1;
    s.stats=s.stats||{};s.stats.health=clamp(s.stats.health??100);
    for(const k of NEEDS)s.stats[k]=clamp(s.stats[k]??0);
    s.world=s.world||{};s.world.effects=Array.isArray(s.world.effects)?s.world.effects:[];
    s.world.effectHistory=Array.isArray(s.world.effectHistory)?s.world.effectHistory:[];
    s.world.eventHistory=Array.isArray(s.world.eventHistory)?s.world.eventHistory:[];
    s.world.scheduledEvents=Array.isArray(s.world.scheduledEvents)?s.world.scheduledEvents:[];
    s.world.windowsOpen=s.world.windowsOpen||{};
    s.locations=s.locations||{};s.connections=s.connections||{};s.items=s.items||{};s.inventory=s.inventory||[];
    return s;
  }

  function adjacentLocations(state,locationId){
    const out=[];
    for(const c of Object.values(state.connections||{})){
      if(!c||c.open===false)continue;
      if(c.a===locationId)out.push(c.b);else if(c.b===locationId)out.push(c.a);
    }
    return [...new Set(out)];
  }

  function findEffect(state,type,locationId){
    return state.world.effects.find(e=>e.active!==false&&e.type===type&&e.locationId===locationId)||null;
  }

  function addEffect(state,type,locationId,intensity=20,options={}){
    ensureState(state);
    let e=findEffect(state,type,locationId);
    if(e){e.intensity=clamp(Math.max(e.intensity,Number(intensity)||0));Object.assign(e,clone(options));return e;}
    e={id:`fx_${state.engine.nextEffectId++}`,type,locationId,intensity:clamp(intensity),active:true,createdAtSeconds:state.engine.worldElapsedSeconds,updatedAtSeconds:state.engine.worldElapsedSeconds,source:options.source||null,spreading:options.spreading!==false,metadata:clone(options.metadata||{})};
    state.world.effects.push(e);
    state.world.effectHistory.push({type:'created',effectId:e.id,effectType:type,locationId,atSeconds:state.engine.worldElapsedSeconds});
    return e;
  }

  function resolveEffect(state,e,reason='resolved'){
    if(!e||e.active===false)return;
    e.active=false;e.intensity=0;e.resolvedAtSeconds=state.engine.worldElapsedSeconds;e.resolutionReason=reason;
    state.world.effectHistory.push({type:'resolved',effectId:e.id,effectType:e.type,locationId:e.locationId,reason,atSeconds:state.engine.worldElapsedSeconds});
  }

  function addEvent(state,type,locationId,details={}){const ev={id:`world_${state.world.eventHistory.length+1}`,type,locationId,atSeconds:state.engine.worldElapsedSeconds,...clone(details)};state.world.eventHistory.push(ev);return ev;}

  function processScheduledEvents(state,before,after){
    const started=[];
    for(const ev of state.world.scheduledEvents){
      if(ev.processed||ev.atSeconds>after||ev.atSeconds<=before)continue;
      ev.processed=true;
      if(ev.type==='noise_source'){addEffect(state,'persistent_noise',ev.locationId,58,{source:'unattended_device'});started.push(addEvent(state,'WORLD_PERSISTENT_NOISE',ev.locationId));}
      else if(ev.type==='water_leak'){state.world.leakActive=true;addEffect(state,'water_puddle',ev.locationId,18,{source:'leak'});started.push(addEvent(state,'WORLD_WATER_LEAK',ev.locationId));}
      else if(ev.type==='smoke'){addEffect(state,'smoke',ev.locationId,46,{source:'distant_fire'});started.push(addEvent(state,'WORLD_SMOKE',ev.locationId));}
    }
    return started;
  }

  function effectStep(state,minutes){
    const created=[];
    const active=[...state.world.effects].filter(e=>e.active!==false);
    for(const e of active){
      const loc=state.locations[e.locationId]||{};const windowOpen=!!state.world.windowsOpen[e.locationId];
      if(e.type==='water_puddle'){
        if(e.source==='leak'&&state.world.leakActive)e.intensity=clamp(e.intensity+4.5*minutes);else e.intensity=clamp(e.intensity-0.35*minutes);
        if(e.intensity>=55&&e.spreading)for(const dest of adjacentLocations(state,e.locationId)){if(dest==='garden')continue;if(!findEffect(state,'water_puddle',dest))created.push(addEffect(state,'water_puddle',dest,Math.min(22,e.intensity*.25),{source:'spread'}));}
      }else if(e.type==='smoke'){
        const ventilation=(Number(loc.ventilation)||0)+(windowOpen?1.2:0);e.intensity=clamp(e.intensity-(0.8+ventilation*1.7)*minutes);
        if(e.intensity>=18&&e.spreading)for(const dest of adjacentLocations(state,e.locationId)){const transfer=Math.max(0,e.intensity*.08*minutes);if(transfer<1)continue;const destFx=findEffect(state,'smoke',dest);if(destFx)destFx.intensity=clamp(destFx.intensity+transfer);else created.push(addEffect(state,'smoke',dest,Math.min(18,transfer),{source:'spread'}));}
      }else if(e.type==='fire'){
        e.intensity=clamp(e.intensity+1.8*minutes);const smoke=findEffect(state,'smoke',e.locationId)||addEffect(state,'smoke',e.locationId,8,{source:'fire'});smoke.intensity=clamp(smoke.intensity+2.6*minutes);
        if(e.intensity>=75&&e.spreading)for(const dest of adjacentLocations(state,e.locationId))if(!findEffect(state,'fire',dest))created.push(addEffect(state,'fire',dest,12,{source:'spread'}));
      }else if(e.type==='persistent_noise')e.intensity=clamp(e.intensity-0.12*minutes);
      e.updatedAtSeconds=state.engine.worldElapsedSeconds;if(e.intensity<=0.1)resolveEffect(state,e,'natural_decay');
    }
    return created;
  }

  function physiologyStep(state,minutes){
    for(const k of NEEDS)state.stats[k]=clamp(state.stats[k]+(RATES_PER_MIN[k]||0)*minutes);
    const local=state.world.effects.filter(e=>e.active!==false&&e.locationId===state.locationId);const smoke=local.find(e=>e.type==='smoke'),fire=local.find(e=>e.type==='fire'),noise=local.find(e=>e.type==='persistent_noise'),water=local.find(e=>e.type==='water_puddle');
    if(smoke&&smoke.intensity>25){state.stats.stress=clamp(state.stats.stress+0.06*smoke.intensity*minutes);state.stats.pain=clamp(state.stats.pain+0.015*smoke.intensity*minutes);}if(fire)state.stats.stress=clamp(state.stats.stress+0.1*fire.intensity*minutes);if(noise&&noise.intensity>35)state.stats.stress=clamp(state.stats.stress+0.025*noise.intensity*minutes);if(water&&water.intensity>70)state.stats.stress=clamp(state.stats.stress+0.15*minutes);
    let dpm=0;if(state.stats.thirst>75)dpm+=(state.stats.thirst-75)/25*0.18;if(state.stats.hunger>80)dpm+=(state.stats.hunger-80)/20*0.08;if(state.stats.fatigue>90)dpm+=(state.stats.fatigue-90)/10*0.06;if(state.stats.pain>70)dpm+=(state.stats.pain-70)/30*0.12;if(state.stats.stress>92)dpm+=(state.stats.stress-92)/8*0.035;if(smoke&&smoke.intensity>65)dpm+=(smoke.intensity-65)/35*0.22;if(fire&&fire.intensity>35)dpm+=(fire.intensity-35)/65*0.8;
    state.engine.damageBudgetPV+=dpm*minutes;const loss=Math.floor(state.engine.damageBudgetPV+1e-9);if(loss>0){state.stats.health=clamp(state.stats.health-loss);state.engine.damageBudgetPV=round(state.engine.damageBudgetPV-loss,6);}return{healthLostPV:loss};
  }

  function addClockSeconds(state,seconds){let total=(state.time.h||0)*3600+(state.time.m||0)*60+(state.time.s||0)+seconds;const days=Math.floor(total/86400);total=((total%86400)+86400)%86400;state.time={h:Math.floor(total/3600),m:Math.floor((total%3600)/60),s:Math.floor(total%60)};if(days){const d=new Date(Date.UTC(state.gameDate.year,state.gameDate.month-1,state.gameDate.day+days));state.gameDate={year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate()};}}

  function advanceTime(state,seconds){ensureState(state);seconds=Math.max(0,Number(seconds)||0);const before=state.engine.worldElapsedSeconds,events=processScheduledEvents(state,before,before+seconds);let remaining=seconds,healthLostPV=0;while(remaining>0){const step=Math.min(60,remaining),min=step/60;state.engine.worldElapsedSeconds+=step;effectStep(state,min);healthLostPV+=physiologyStep(state,min).healthLostPV;addClockSeconds(state,step);remaining-=step;}return{success:true,elapsedSeconds:seconds,healthLostPV,startedEvents:events,effects:getActiveEffects(state)};}

  function move(state,destinationId){ensureState(state);const conn=Object.values(state.connections).find(c=>c.open!==false&&((c.a===state.locationId&&c.b===destinationId)||(c.b===state.locationId&&c.a===destinationId)));if(!conn)return{success:false,reason:'NO_CONNECTION'};const time=advanceTime(state,conn.travelSeconds||20);state.locationId=destinationId;state.location=state.locations[destinationId]?.name||destinationId;return{success:true,elapsedSeconds:time.elapsedSeconds,destinationId,startedEvents:time.startedEvents};}
  function take(state,itemId){ensureState(state);const item=state.items[itemId];if(!item||item.locationId!==state.locationId)return{success:false,reason:'ITEM_NOT_HERE'};if(!state.inventory.includes(itemId))state.inventory.push(itemId);item.locationId='player_inventory';const t=advanceTime(state,5);return{success:true,elapsedSeconds:t.elapsedSeconds,itemId};}
  function eatApple(state,itemId='apple_01'){ensureState(state);const item=state.items[itemId];if(!item||!state.inventory.includes(itemId))return{success:false,reason:'NOT_CARRIED'};state.stats.hunger=clamp(state.stats.hunger-9);state.stats.thirst=clamp(state.stats.thirst-4);state.inventory=state.inventory.filter(x=>x!==itemId);delete state.items[itemId];const t=advanceTime(state,120);return{success:true,elapsedSeconds:t.elapsedSeconds,hungerEffect:-9,thirstEffect:-4};}
  function drink(state,itemId='water_01',ml=250){ensureState(state);const item=state.items[itemId];if(!item||!state.inventory.includes(itemId))return{success:false,reason:'NOT_CARRIED'};const qty=Math.min(Math.max(0,ml),Number(item.liquidMl)||0);if(qty<=0)return{success:false,reason:'EMPTY'};item.liquidMl-=qty;const thirstEffect=-15*(qty/250);state.stats.thirst=clamp(state.stats.thirst+thirstEffect);const t=advanceTime(state,18*(qty/250));return{success:true,elapsedSeconds:t.elapsedSeconds,drankMl:qty,thirstEffect:round(thirstEffect,2)};}
  function drinkTap(state){ensureState(state);state.stats.thirst=clamp(state.stats.thirst-15);const t=advanceTime(state,20);return{success:true,elapsedSeconds:t.elapsedSeconds,thirstEffect:-15};}

  function mitigateEffect(state,effectId,action){ensureState(state);const e=state.world.effects.find(x=>x.id===effectId&&x.active!==false);if(!e)return{success:false,reason:'EFFECT_NOT_FOUND'};if(e.locationId!==state.locationId)return{success:false,reason:'NOT_LOCAL'};let reduction=0,seconds=0;if(e.type==='water_puddle'&&action==='mop'){if(!state.inventory.includes('towel_01'))return{success:false,reason:'NEED_TOWEL'};reduction=38;seconds=150;}else if(e.type==='smoke'&&action==='ventilate'){state.world.windowsOpen[state.locationId]=true;reduction=18;seconds=20;}else if(e.type==='fire'&&action==='douse'){const water=state.items.water_01;if(!water||!state.inventory.includes('water_01')||(water.liquidMl||0)<250)return{success:false,reason:'NEED_WATER'};water.liquidMl-=250;reduction=48;seconds=15;}else if(e.type==='persistent_noise'&&action==='silence'){reduction=100;seconds=25;}else return{success:false,reason:'ACTION_NOT_SUPPORTED'};e.intensity=clamp(e.intensity-reduction);if(e.intensity<=0.1)resolveEffect(state,e,'player_action');const t=advanceTime(state,seconds);return{success:true,elapsedSeconds:t.elapsedSeconds,effectId,reduction,remainingIntensity:e.intensity};}
  function stopLeak(state){ensureState(state);if(state.locationId!=='kitchen')return{success:false,reason:'NOT_IN_KITCHEN'};state.world.leakActive=false;const t=advanceTime(state,18);addEvent(state,'WATER_LEAK_STOPPED','kitchen');return{success:true,elapsedSeconds:t.elapsedSeconds};}
  function igniteTestFire(state,locationId='kitchen',intensity=28){return addEffect(state,'fire',locationId,intensity,{source:'test'});}
  function getActiveEffects(state,locationId=null){ensureState(state);return state.world.effects.filter(e=>e.active!==false&&(!locationId||e.locationId===locationId)).map(clone);}
  function getEffectLabel(type){return EFFECT_TYPES[type]||{label:type,glyph:'•'};}
  function getRiskSummary(state,locationId=state.locationId){const effects=getActiveEffects(state,locationId);let risk=0;for(const e of effects){const w=e.type==='fire'?1.5:e.type==='smoke'?1:e.type==='water_puddle'?.5:.35;risk+=e.intensity*w;}return{locationId,riskPct:clamp(risk),effects};}

  return{VERSION,EFFECT_TYPES,freshState,ensureState,advanceTime,move,take,eatApple,drink,drinkTap,addEffect,mitigateEffect,stopLeak,igniteTestFire,getActiveEffects,getEffectLabel,getRiskSummary,adjacentLocations};
});
