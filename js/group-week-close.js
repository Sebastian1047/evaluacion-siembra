// Cierre de semana desde Grupo.
// Una semana cerrada permanece visible, pero queda en modo solo lectura.
if(!state.closedGroupWeeks)state.closedGroupWeeks={};
function groupWeekRecord(){return state.closedGroupWeeks['w'+state.currentWeek]||null}
function groupWeekIsClosed(){return !!groupWeekRecord()}
function groupWeekEditEnabled(){let r=groupWeekRecord();return !!(r&&r.editEnabled&&!r.permanentlyLocked)}
function groupWeekReadOnly(){return groupWeekIsClosed()&&!groupWeekEditEnabled()}
function closedWeekMessage(){toast('Semana cerrada · información disponible solo para consulta')}
function unequalSampleTurns(){
  if(typeof ensureSampleTurns==='function')ensureSampleTurns();
  let people=state.people||[];if(!people.length)return null;
  let turns=people.map(p=>Number(p.sampleTurn)||0),min=Math.min(...turns),max=Math.max(...turns);
  if(min===max)return null;
  return {min,max,pending:people.filter(p=>(Number(p.sampleTurn)||0)<max)};
}
function showUnequalTurns(info){
  let rows=info.pending.map(p=>`<div class="row between" style="padding:7px 0;border-bottom:1px solid #eee"><span>${p.name}</span><b>Turno ${Number(p.sampleTurn)||0}</b></div>`).join('');
  modal(`<h3>No se puede cerrar la semana</h3><p>Todos los sembradores deben quedar en el <b>mismo turno de muestra</b> antes de cerrar.</p><p>Hay <b>${info.pending.length}</b> sembrador${info.pending.length===1?'':'es'} pendiente${info.pending.length===1?'':'s'} de nivelar hasta el turno ${info.max}.</p><div style="max-height:220px;overflow:auto">${rows}</div><p class="muted">Evalúe a cada persona pendiente o registre <b>No realizar muestra</b>. Esta validación seguirá apareciendo mientras los turnos sean diferentes.</p><button class="btn primary block" onclick="closeModal()">Resolver pendientes</button>`);
}
function askCloseGroupWeek(){
  if(groupWeekIsClosed())return closedWeekMessage();
  let unequal=unequalSampleTurns();if(unequal)return showUnequalTurns(unequal);
  let turn=(state.people&&state.people.length)?(Number(state.people[0].sampleTurn)||0):0;
  modal(`<h3>¿Está seguro que quiere cerrar la Semana ${state.currentWeek}?</h3><p>Todos los sembradores están nivelados en el <b>turno de muestra ${turn}</b>.</p><p>Si cierra la semana, podrá <b>ver la información</b>, pero no podrá modificarla.</p><div class="card" style="margin:12px 0"><b>Correcciones después del cierre</b><p class="muted" style="margin-bottom:0">Si necesita modificar algo, debe comunicarse con el <b>Analista</b> para que le habilite temporalmente la modificación. Esto solo será posible <b>antes de crear la nueva semana</b>. Una vez creada la siguiente semana, ni el Analista podrá habilitar modificaciones sobre esta semana.</p></div><div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn danger" onclick="confirmCloseGroupWeek()">Cerrar semana</button></div>`);
}
function confirmCloseGroupWeek(){
  let unequal=unequalSampleTurns();if(unequal)return showUnequalTurns(unequal);
  state.closedGroupWeeks['w'+state.currentWeek]={closed:true,closedAt:new Date().toISOString(),editEnabled:false,permanentlyLocked:false};
  save();closeModal();state.view='grupo';render();toast('Semana '+state.currentWeek+' cerrada · modo solo lectura');
}
// Al crear una nueva semana, la anterior queda bloqueada definitivamente.
if(typeof createNextWeek==='function'){
  const createNextWeekBeforePermanentLock=createNextWeek;
  createNextWeek=function(){
    let previousWeek=state.currentWeek,r=state.closedGroupWeeks&&state.closedGroupWeeks['w'+previousWeek];
    if(r){r.editEnabled=false;r.permanentlyLocked=true;r.lockedAt=new Date().toISOString();save()}
    return createNextWeekBeforePermanentLock();
  };
}
// Bloqueos funcionales: una semana cerrada solo admite escritura si el Analista la habilitó y aún no se creó la siguiente semana.
if(typeof go==='function'){
  const goBeforeWeekLock=go;
  go=function(v){if(groupWeekReadOnly()&&['nueva','agregar','evaluarItems'].includes(v)){closedWeekMessage();return}return goBeforeWeekLock(v)};
}
if(typeof saveEval==='function'){const f=saveEval;saveEval=function(){if(groupWeekReadOnly())return closedWeekMessage();return f()}}
if(typeof commitEval==='function'){const f=commitEval;commitEval=function(ids){if(groupWeekReadOnly())return closedWeekMessage();return f(ids)}}
if(typeof adjustRequired==='function'){const f=adjustRequired;adjustRequired=function(){if(groupWeekReadOnly())return closedWeekMessage();return f()}}
if(typeof applyRequired==='function'){const f=applyRequired;applyRequired=function(){if(groupWeekReadOnly())return closedWeekMessage();return f()}}
if(typeof addWorker==='function'){const f=addWorker;addWorker=function(id){if(groupWeekReadOnly())return closedWeekMessage();return f(id)}}
if(typeof confirmRemoveFromGroup==='function'){const f=confirmRemoveFromGroup;confirmRemoveFromGroup=function(id){if(groupWeekReadOnly())return closedWeekMessage();return f(id)}}
if(typeof annulEval==='function'){const f=annulEval;annulEval=function(){if(groupWeekReadOnly())return closedWeekMessage();return f()}}
function decorateGroupWeekClose(){
  if(state.role!=='monitor')return;
  let closed=groupWeekIsClosed(),readOnly=groupWeekReadOnly();
  if(state.view==='grupo'){
    let hero=document.querySelector('.hero');
    if(hero&&!document.querySelector('#group-week-close')){
      let wrap=document.createElement('div');wrap.id='group-week-close';wrap.style.cssText='margin-top:14px;padding-top:12px;border-top:1px solid #e1e6e3';
      if(!closed)wrap.innerHTML='<button type="button" class="btn danger block" onclick="askCloseGroupWeek()">Cerrar semana</button>';
      else if(groupWeekEditEnabled())wrap.innerHTML='<div class="row between"><div><b>Semana cerrada · modificación habilitada</b><div class="muted small">Permiso temporal del Analista, disponible solo antes de crear la siguiente semana</div></div><span class="badge warn">Modificando</span></div>';
      else wrap.innerHTML='<div class="row between"><div><b>Semana cerrada</b><div class="muted small">Solo consulta · solicite al Analista habilitación antes de crear la nueva semana</div></div><span class="badge">Cerrada</span></div>';
      hero.appendChild(wrap);
    }
  }
  if(!readOnly)return;
  document.querySelectorAll('button').forEach(b=>{
    let t=(b.textContent||'').trim().toLowerCase();
    if(t.includes('nueva evaluación')||t.includes('ajustar evaluaciones')||t.includes('agregar')||t.includes('quitar del grupo')||t.includes('evaluar grupo')||t.includes('anular evaluación')||t.includes('no realizar muestra')){
      b.disabled=true;b.style.opacity='.45';b.style.cursor='not-allowed';b.onclick=closedWeekMessage;
    }
  });
}
const groupCloseObserver=new MutationObserver(()=>{clearTimeout(window.__groupCloseTimer);window.__groupCloseTimer=setTimeout(decorateGroupWeekClose,0)});groupCloseObserver.observe(document.querySelector('#app'),{childList:true,subtree:true});setTimeout(decorateGroupWeekClose,0);
