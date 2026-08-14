(()=>{
'use strict';

const POPUP_ID='absence-object-context';

function closePopup(){
  document.getElementById(POPUP_ID)?.remove();
}

function openPopup(itemId){
  closePopup();

  const item=document.querySelector(`.item[data-id="${CSS.escape(itemId)}"]`);
  if(!item)return;

  const wrap=item.closest('.item-wrap');
  const name=item.querySelector('.itemcopy b')?.textContent?.trim()||'Objet';
  const meta=item.querySelector('.itemcopy small')?.textContent?.trim()||'';
  const icon=item.querySelector('.itemicon')?.textContent?.trim()||'▤';
  const actionSource=wrap?.querySelector('.item-actions');
  const noteSource=wrap?.querySelector('.item-note');

  const overlay=document.createElement('div');
  overlay.id=POPUP_ID;
  overlay.className='object-context-overlay';
  overlay.innerHTML=`
    <section class="object-context-sheet" role="dialog" aria-modal="true" aria-labelledby="object-context-title">
      <div class="object-context-head">
        <div class="object-context-identity">
          <div class="object-context-icon"></div>
          <div>
            <div class="object-context-kicker">Objet</div>
            <div class="object-context-title" id="object-context-title"></div>
            <div class="object-context-meta"></div>
          </div>
        </div>
        <button class="object-context-close" type="button" aria-label="Fermer">×</button>
      </div>
      <div class="object-context-actions"></div>
    </section>`;

  overlay.querySelector('.object-context-icon').textContent=icon;
  overlay.querySelector('.object-context-title').textContent=name;
  overlay.querySelector('.object-context-meta').textContent=meta;

  const actions=overlay.querySelector('.object-context-actions');
  if(actionSource&&actionSource.children.length){
    [...actionSource.children].forEach(node=>actions.appendChild(node.cloneNode(true)));
  }else{
    const empty=document.createElement('div');
    empty.className='object-context-empty';
    empty.textContent=noteSource?.textContent?.trim()||'Aucune action disponible pour cet objet ici.';
    actions.appendChild(empty);
  }

  document.body.appendChild(overlay);
  overlay.querySelector('.object-context-close')?.focus({preventScroll:true});
}

function injectStyles(){
  const style=document.createElement('style');
  style.textContent=`
    /* Les actions d'objet ne doivent jamais encombrer les listes. */
    .item-actions,.item-note{display:none!important}
    .item .chev{font-size:20px}

    .object-context-overlay{
      position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.72);
      display:flex;align-items:flex-end;justify-content:center;
      padding:0;
    }
    .object-context-sheet{
      width:min(100%,520px);max-height:min(72dvh,620px);overflow:auto;
      background:#0f151a;border:1px solid #34414b;border-bottom:0;
      border-radius:20px 20px 0 0;padding:14px 14px calc(16px + env(safe-area-inset-bottom));
      box-shadow:0 -14px 40px rgba(0,0,0,.45);
    }
    .object-context-head{
      display:flex;align-items:flex-start;justify-content:space-between;gap:12px;
      padding-bottom:13px;border-bottom:1px solid #28333c;margin-bottom:10px;
    }
    .object-context-identity{display:flex;align-items:center;gap:11px;min-width:0}
    .object-context-icon{
      width:42px;height:42px;flex:0 0 42px;border-radius:11px;background:#1e282f;
      display:grid;place-items:center;font-size:20px;color:#edf2f5;
    }
    .object-context-kicker{
      font-size:8px;color:#788791;font-weight:900;letter-spacing:1px;text-transform:uppercase;
    }
    .object-context-title{
      margin-top:2px;font-size:18px;font-weight:900;color:#f1f4f6;line-height:1.15;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:330px;
    }
    .object-context-meta{margin-top:4px;font-size:10px;color:#8998a2}
    .object-context-close{
      width:38px;height:38px;flex:0 0 38px;border-radius:10px;border:1px solid #3a4751;
      background:#171f25;color:#e7edf1;font-size:23px;line-height:1;display:grid;place-items:center;
    }
    .object-context-actions .action{margin:8px 0}
    .object-context-empty{
      padding:15px 12px;color:#8b98a1;font-size:11px;line-height:1.45;
      border:1px dashed #34414b;border-radius:11px;background:#11181d;
    }
  `;
  document.head.appendChild(style);
}

/* Le gestionnaire de l'app v0.1.10 s'exécute d'abord et calcule les actions via le moteur.
   Nous récupérons ensuite ces actions et les déplaçons visuellement dans le popup. */
document.addEventListener('click',ev=>{
  const close=ev.target.closest('.object-context-close');
  if(close){
    ev.preventDefault();
    ev.stopPropagation();
    closePopup();
    return;
  }

  const item=ev.target.closest('[data-ui="select-item"]');
  if(item){
    const id=item.dataset.id;
    if(!id)return;
    queueMicrotask(()=>openPopup(id));
    return;
  }

  if(ev.target.closest(`#${POPUP_ID} [data-ui="engine-action"]`)){
    queueMicrotask(closePopup);
  }
});

document.addEventListener('keydown',ev=>{
  if(ev.key==='Escape')closePopup();
});

injectStyles();
})();
