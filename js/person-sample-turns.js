// Control de turnos de muestra en la evaluación individual.
// sampleTurn = turnos resueltos (evaluados u omitidos).
// done/required conserva evaluaciones efectivamente realizadas/meta efectiva.
if(!state.sampleTurnOmissions)state.sampleTurnOmissions=[];
function ensureSampleTurns(){
  (state.people||[]).forEach(p=>{
    if(typeof p.sampleTurn!=='number') p.sampleTurn=Number(p.done)||0;
    if(typeof p.originalRequired!=='number') p.originalRequired=Number(p.required)||30;
  });
}
function minSampleTurn(){ensureSampleTurns();return state.people.length?Math.min(...state.people.map(p=>p.sampleTurn)):0}
function currentGroupSampleTurn(){return minSampleTurn()+1}
function pendingForTurn(turn){ensureSampleTurns();return state.people.filter(p=>p.sampleTurn<turn)}
function canAdvancePerson(p){
  ensureSampleTurns();
  let min=minSampleTurn(),next=p.sampleTurn+1;
  if(next<=min+1)return {ok:true,next};
  let pending=pendingForTurn(min+1).filter(x=>x.id!==p.id);
  return {ok:false,next,pending,turn:min+1};
}
function showTurnBlock(p,info){
  let names=info.pending.map(x=>x.name).join(', ');
  modal(`<h3>Turno de muestra ${info.turn} pendiente</h3><p><b>${p.name}</b> no puede avanzar todavía al turno ${info.next}.</p><p>Falta${info.pending.length===1?'':'n'} <b>${info.pending.length}</b> persona${info.pending.length===1?'':'s'} por resolver en el turno ${info.turn}.</p>${names?`<p class="muted">${names}</p>`:''}<p>Evalúe a las personas pendientes o registre <b>No realizar muestra</b> para quien corresponda.</p><button class="btn primary block" onclick="closeModal();go('grupo')">Volver al grupo</button>`);
}
function omitCurrentSample(){
  let p=current();if(!p)return;
  if(typeof groupWeekIsClosed==='function'&&groupWeekIsClosed())return closedWeekMessage();
  let info=canAdvancePerson(p);if(!info.ok)return showTurnBlock(p,info);
  modal(`<h3>No realizar muestra</h3><p><b>${p.name}</b></p><p>Se registrará como resuelto el <b>turno de muestra ${info.next}</b>, pero no contará como evaluación realizada.</p><p>Su meta efectiva bajará de <b>${p.required}</b> a <b>${Math.max(p.done,p.required-1)}</b> evaluaciones.</p><div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn danger" onclick="confirmOmitCurrentSample()">No realizar muestra y volver al grupo</button></div>`);
}
function confirmOmitCurrentSample(){
  let p=current();if(!p)return;
  let info=canAdvancePerson(p);if(!info.ok){closeModal();return showTurnBlock(p,info)}
  p.sampleTurn=info.next;p.required=Math.max(p.done,p.required-1);
  state.sampleTurnOmissions.push({week:state.currentWeek,person:p.id,turn:p.sampleTurn,date:new Date().toISOString()});
  state.view='grupo';save();closeModal();render();toast('Muestra no realizada · turno '+p.sampleTurn+' resuelto');
}
const goBeforeSampleTurns=go;
go=function(v){
  if(v==='nueva'&&state.role==='monitor'){
    let p=current();if(p){let info=canAdvancePerson(p);if(!info.ok){showTurnBlock(p,info);return}}
  }
  return goBeforeSampleTurns(v);
};
const commitEvalBeforeSampleTurns=commitEval;
commitEval=function(ids){
  let p=current();if(!p)return commitEvalBeforeSampleTurns(ids);
  let info=canAdvancePerson(p);if(!info.ok)return showTurnBlock(p,info);
  let beforeDone=p.done;
  commitEvalBeforeSampleTurns(ids);
  if(p.done>beforeDone){p.sampleTurn=info.next;save()}
};
function decorateSampleTurnUI(){
  ensureSampleTurns();
  if(state.role!=='monitor')return;
  if(state.view==='grupo'){
    // Indicador principal al lado de Semana N: muestra el turno que el grupo está resolviendo ahora.
    let hero=document.querySelector('.hero');
    if(hero&&!hero.querySelector('#group-current-sample-turn')){
      let h2=hero.querySelector('h2');
      if(h2){
        let row=document.createElement('div');row.className='row between';row.style.cssText='align-items:center;margin-top:8px;gap:12px';
        h2.parentNode.insertBefore(row,h2);row.appendChild(h2);h2.style.margin='0';
        let badge=document.createElement('span');badge.id='group-current-sample-turn';badge.className='badge';badge.style.cssText='font-size:14px;padding:7px 10px;white-space:nowrap';badge.innerHTML=`Turno de muestra ${currentGroupSampleTurn()}`;row.appendChild(badge);
      }
    }
  }
  if(state.view==='seguimiento'){
    let p=current();if(!p)return;let hero=document.querySelector('.hero');if(!hero||hero.querySelector('#sample-turn-person'))return;
    let box=document.createElement('div');box.id='sample-turn-person';box.className='card';box.style.marginTop='12px';
    box.innerHTML=`<div class="row between"><span>Turno de muestra resuelto</span><b>${p.sampleTurn}</b></div><div class="row between"><span>Evaluaciones efectivas</span><b>${p.done} / ${p.required}</b></div><button class="btn ghost block" style="margin-top:10px" onclick="omitCurrentSample()">No realizar muestra y volver al grupo</button>`;
    hero.appendChild(box);
  }
}
const sampleTurnObserver=new MutationObserver(()=>{clearTimeout(window.__sampleTurnTimer);window.__sampleTurnTimer=setTimeout(decorateSampleTurnUI,0)});sampleTurnObserver.observe(document.querySelector('#app'),{childList:true,subtree:true});ensureSampleTurns();save();setTimeout(decorateSampleTurnUI,0);
