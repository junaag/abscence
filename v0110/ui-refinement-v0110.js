(()=>{
'use strict';

const E=window.AbsenceEngine;
if(!E)return;

// Actions concerning an object already carried belong exclusively to its popup.
const originalContextActions=E.getContextActions?.bind(E);
if(originalContextActions){
  E.getContextActions=(state)=>originalContextActions(state).filter(a=>a.id!=='refill_bottle');
}

const TOP_ICONS={health:'❤️',hunger:'🍽️',thirst:'💧',fatigue:'💤',stress:'🧠',pain:'🩹'};
const TOP_INFO={
  health:['Santé','Points de vie du personnage. À 0 PV, la partie est terminée.'],
  hunger:['Faim','Augmente avec le temps. Une faim trop élevée finit par affecter la santé.'],
  thirst:['Soif','Augmente avec le temps. Une soif élevée devient rapidement dangereuse.'],
  fatigue:['Fatigue','Représente le besoin de repos et de sommeil.'],
  stress:['Stress','Reflète la tension psychologique du personnage et peut modifier ses possibilités.'],
  pain:['Douleur','Représente les blessures et douleurs physiques, avec un impact possible sur le repos et les actions.']
};
const BOTTOM_ICONS={home:'🏠',map:'🗺️',inventory:'🎒',world:'🌍'};

let statBubble=null;
let applying=false;

function removeStatBubble(){statBubble?.remove();statBubble=null;}

function showStatBubble(btn,key){
  removeStatBubble();
  const info=TOP_INFO[key]||[key,''];
  const value=btn.querySelector('.val')?.textContent?.trim()||'';
  const r=btn.getBoundingClientRect();
  const bubble=document.createElement('div');
  bubble.className='absence-stat-bubble';
  bubble.dataset.stat=key;
  bubble.innerHTML=`<div class="absence-stat-bubble-title">${TOP_ICONS[key]||''} ${info[0]} <strong>${value}</strong></div><div class="absence-stat-bubble-copy">${info[1]}</div>`;
  document.body.appendChild(bubble);
  const width=Math.min(300,window.innerWidth-24);
  bubble.style.width=width+'px';
  let left=r.left+r.width/2-width/2;
  left=Math.max(12,Math.min(window.innerWidth-width-12,left));
  bubble.style.left=left+'px';
  bubble.style.top=Math.min(window.innerHeight-bubble.offsetHeight-12,r.bottom+8)+'px';
  statBubble=bubble;
}

function refineTop(){
  document.querySelectorAll('.stat[data-stat]').forEach(btn=>{
    const key=btn.dataset.stat,ico=btn.querySelector('.ico');
    if(ico&&TOP_ICONS[key]&&ico.textContent!==TOP_ICONS[key])ico.textContent=TOP_ICONS[key];
    if(TOP_INFO[key])btn.setAttribute('aria-label',`${TOP_INFO[key][0]} : ${btn.querySelector('.val')?.textContent||''}`);
  });
}

function refineBottom(){
  const nav=document.getElementById('bottom-nav');
  if(!nav)return;
  nav.querySelector('[data-screen="state"]')?.remove();
  nav.querySelectorAll('[data-screen]').forEach(btn=>{
    const id=btn.dataset.screen,span=btn.querySelector('span');
    if(span&&BOTTOM_ICONS[id]&&span.textContent!==BOTTOM_ICONS[id])span.textContent=BOTTOM_ICONS[id];
  });
  if(nav.style.gridTemplateColumns!=='repeat(4, 1fr)')nav.style.gridTemplateColumns='repeat(4, 1fr)';
}

function removeInventoryFromHome(){
  if(!document.querySelector('#bottom-nav .nav.active[data-screen="home"]'))return;
  const host=document.getElementById('view-host');
  if(!host||host.hidden)return;
  const section=[...host.querySelectorAll('.section')].find(x=>x.textContent.trim().toLowerCase()==='sur vous');
  if(!section)return;
  let node=section;
  while(node){const next=node.nextSibling;node.remove();node=next;}
}

function applyRefinements(){
  if(applying)return;
  applying=true;
  refineTop();refineBottom();removeInventoryFromHome();
  applying=false;
}

document.addEventListener('click',ev=>{
  const stat=ev.target.closest('.stat[data-ui="stat"]');
  if(stat){
    ev.preventDefault();ev.stopImmediatePropagation();
    const key=stat.dataset.stat;
    if(statBubble?.dataset.stat===key){removeStatBubble();return;}
    showStatBubble(stat,key);return;
  }
  if(statBubble&&!ev.target.closest('.absence-stat-bubble'))removeStatBubble();
},true);

window.addEventListener('resize',removeStatBubble,{passive:true});
window.addEventListener('scroll',removeStatBubble,{passive:true,capture:true});

const style=document.createElement('style');
style.textContent=`
.stat .ico{font-size:17px;line-height:20px;filter:saturate(.9)}
#bottom-nav .nav span{font-size:20px;line-height:22px;filter:saturate(.85)}
.absence-stat-bubble{position:fixed;z-index:9000;background:#141b21;border:1px solid #3b4852;border-radius:12px;padding:10px 11px;box-shadow:0 10px 30px #000b;color:#eef3f6;pointer-events:auto}
.absence-stat-bubble:before{content:'';position:absolute;top:-5px;left:50%;width:9px;height:9px;background:#141b21;border-left:1px solid #3b4852;border-top:1px solid #3b4852;transform:translateX(-50%) rotate(45deg)}
.absence-stat-bubble-title{position:relative;font-size:12px;font-weight:900;display:flex;align-items:center;gap:6px}
.absence-stat-bubble-title strong{margin-left:auto;color:#e7b94b;font-size:11px}
.absence-stat-bubble-copy{position:relative;margin-top:5px;color:#aeb9c1;font-size:10px;line-height:1.45}
`;
document.head.appendChild(style);

const observer=new MutationObserver(()=>queueMicrotask(applyRefinements));
observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
applyRefinements();
})();