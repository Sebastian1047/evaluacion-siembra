// Cierre de semana desde Grupo.
// Una semana cerrada permanece visible, pero queda en modo solo lectura.
if(!state.closedGroupWeeks)state.closedGroupWeeks={};
function groupWeekRecord(){return state.closedGroupWeeks['w'+state.currentWeek]||null}
function groupWeekIsClosed(){return !!groupWeekRecord()}
function groupWeekEditEnabled(){let r=groupWeekRecord();return !!(r&&r.editEnabled&&!r.permanentlyLocked)}
function groupWeekReadOnly(){return groupWeekIsClosed()&&!groupWeekEditEnabled()}
function closedWeekMessage(){toast('Semana cerrada · información disponible solo para consulta')}
function weekHasReviewedSample(){return (state.people||[]).some(p=>(Number(p.done)||0)>0)}
function showWeekWithoutReviewedSamples(){
  modal(`<h3>No se puede cerrar la Semana ${state.currentWeek}</h3><p>Aunque todos los turnos de muestra hayan sido resueltos, una semana con <b>0 muestras revisadas</b> no puede guardarse como semana cerrada.</p><p>Para cerrar la semana debe existir <b>al menos una evaluación realizada</b> a uno de los sembradores.</p><div class="card" style="margin:12px 0"><b>¿La semana fue creada con un consecutivo incorrecto?</b><p class="muted" style="margin-bottom:0">Mientras no exista ninguna muestra revisada, esta semana puede eliminarse para corregir el consecutivo y crear la semana correspondiente.</p></div><div class="row"><button class="btn ghost" onclick="closeModal()">Volver</button><button class="btn danger" onclick="askDeleteEmptyWeek()">Eliminar semana</button></div>`);
}
function askDeleteEmptyWeek(){
  if(groupWeekIsClosed())return closedWeekMessage();
  if(weekHasReviewedSample())return toast('La semana ya contiene evaluaciones y no puede eliminarse');
  modal(`<h3>Eliminar Semana ${state.currentWeek}</h3><p>Esta opción solo está disponible porque la semana todavía tiene <b>0 muestras revisadas</b>.</p><p class="muted">Se eliminará la semana operativa actual para permitir corregir el número/consecutivo. Esta acción no debe utilizarse cuando ya exista información de evaluación.</p><div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn danger" onclick="confirmDeleteEmptyWeek()">Eliminar semana</button></div>`);
}
function confirmDeleteEmptyWeek(){
  if(groupWeekIsClosed()||weekHasReviewedSample())return closeModal(),toast('Esta semana ya no puede eliminarse');
  let deletedWeek=state.currentWeek;
  // Conserva los trabajadores como disponibles; elimina únicamente el período operativo vacío.
  (state.people||[]).forEach(p=>{if(!(state.available||[]).some(x=>x.id===p.id))state.available.push({id:p.id,name:p.name,doc:p.doc})});
  state.people=[];state.evals=[];state.pending=0;state.selectedPerson=null;
  if(state.sampleTurnOmissions)state.sampleTurnOmissions=state.sampleTurnOmissions.filter(x=>x.week!==deletedWeek);
  if(state.itemReviews)delete state.itemReviews['w'+deletedWeek];
  if(state.weekSampleClosure)delete state.weekSampleClosure['w'+deletedWeek];
  state.currentWeek=Math.max(1,deletedWeek-1);
  save();closeModal();state.view='grupo';render();toast('Semana '+deletedWeek+' eliminada');
}
function currentTurnCloseStatus(){
  if(typeof ensureSampleTurns==='function')ensureSampleTurns();
  const people=state.people||[];
  const turn=typeof currentGroupSampleTurn==='function'?currentGroupSampleTurn():Math.max(1,Number(state.weekOperationalSampleTurn)||1);
  const participants=people.filter(p=>Number(p.turnoInicio||1)<=turn);
  const resolved=participants.filter(p=>Number(p.sampleTurn||0)>=turn);
  const pending=participants.filter(p=>Number(p.sampleTurn||0)<turn);
  return {turn,participants,resolved,pending};
}
function closeWeekConfirmation(status){
  const turn=status.turn,goal=30,completed=Math.max(0,turn-1),missing=Math.max(0,goal-completed);
  if(!status.resolved.length){
    return modal(`<h3>Cierre de la Semana ${state.currentWeek}</h3><p>El <b>turno de muestra ${turn}</b> fue iniciado, pero <b>no se evaluó ni se registró No realizar muestra para ningún sembrador</b> en este turno.</p><p>La semana puede cerrarse en este punto. El turno ${turn} y los posteriores <b>no se registrarán como No realizar muestra</b>; simplemente no fueron alcanzados durante esta semana.</p><p><b>¿Desea cerrar la semana de todas formas?</b></p><div class="row"><button class="btn ghost" onclick="closeModal()">Continuar semana</button><button class="btn danger" onclick="confirmCloseGroupWeek(true)">Cerrar semana</button></div>`);
  }
  if(status.pending.length){
    const resolvedNames=status.resolved.map(p=>p.name).join(', ');
    const pendingNames=status.pending.map(p=>p.name).join(', ');
    return modal(`<h3>Cierre de la Semana ${state.currentWeek}</h3><p>El grupo está trabajando en el <b>turno de muestra ${turn}</b>, pero el turno quedó parcialmente resuelto.</p><div class="card" style="margin:12px 0"><p style="margin-top:0"><b>Ya resolvieron el turno ${turn}:</b></p><p class="muted">${resolvedNames}</p><p><b>Falta resolver el turno ${turn}:</b></p><p class="muted" style="margin-bottom:0">${pendingNames}</p></div><p>Las personas pendientes <b>no se registrarán como No realizar muestra</b>. El cierre conservará únicamente lo que realmente se alcanzó a registrar.</p><p><b>¿Desea cerrar la semana con el turno ${turn} incompleto?</b></p><div class="row"><button class="btn ghost" onclick="closeModal()">Continuar semana</button><button class="btn danger" onclick="confirmCloseGroupWeek(true)">Cerrar semana</button></div>`);
  }
  if(turn<=goal){
    return modal(`<h3>Cierre anticipado de la Semana ${state.currentWeek}</h3><p>Todos los sembradores participantes resolvieron el <b>turno de muestra ${turn}</b>.</p><div class="card" style="margin:12px 0"><div class="row between"><span>Último turno completado</span><b>${turn} de ${goal}</b></div><div class="row between" style="margin-top:8px"><span>Turnos que faltan para completar</span><b>${Math.max(0,goal-turn)}</b></div></div><p>Los turnos posteriores que no se alcancen esta semana <b>no se registrarán como No realizar muestra</b>.</p><p><b>¿Desea cerrar la semana?</b></p><div class="row"><button class="btn ghost" onclick="closeModal()">Continuar semana</button><button class="btn danger" onclick="confirmCloseGroupWeek(true)">Cerrar semana</button></div>`);
  }
}
function askCloseGroupWeek(){
  if(groupWeekIsClosed())return closedWeekMessage();
  if(!weekHasReviewedSample())return showWeekWithoutReviewedSamples();
  return closeWeekConfirmation(currentTurnCloseStatus());
}
async function confirmCloseGroupWeek(closeConfirmed){
  if(!weekHasReviewedSample())return showWeekWithoutReviewedSamples();
  if(!closeConfirmed)return closeWeekConfirmation(currentTurnCloseStatus());
  if(!window.SiembraApi||typeof SiembraApi.closeWeek!=='function')return toast('No se pudo conectar con el servicio de cierre');
  let weekId=Number(state.currentAzureWeekId)||0;
  try{
    if(!weekId){
      const week=await SiembraApi.getWeek(state.currentYear||2026,state.currentWeek);
      weekId=Number(week.IdSemana)||0;
    }
    if(!weekId)throw new Error('Semana Azure no identificada');
    await SiembraApi.closeWeek(weekId,{usuarioCorporativoId:'asegurador-prueba'});
  }catch(error){
    console.error('No fue posible cerrar la semana en Azure.',error);
    return toast('No se pudo cerrar la semana. Mantenga la conexión a Internet e inténtelo nuevamente.');
  }
  state.currentAzureWeekId=weekId;
  state.closedGroupWeeks['w'+state.currentWeek]={closed:true,closedAt:new Date().toISOString(),editEnabled:false,permanentlyLocked:false};
  save();closeModal();state.view='grupo';render();toast('Semana '+state.currentWeek+' cerrada y sincronizada con Azure');
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
async function reconcilePendingAzureWeekClose(){
  const rec=closedRecord();
  if(!rec||!rec.closed||!window.SiembraApi||typeof SiembraApi.closeWeek!=='function')return true;
  try{
    const week=await SiembraApi.getWeek(state.currentYear||2026,state.currentWeek);
    if(String(week.Estado||'').toUpperCase()!=='CERRADA')await SiembraApi.closeWeek(Number(week.IdSemana),{usuarioCorporativoId:'asegurador-prueba'});
    state.currentAzureWeekId=Number(week.IdSemana)||state.currentAzureWeekId;
    rec.azureClosed=true;rec.azureClosedAt=new Date().toISOString();save();
    return true;
  }catch(error){
    console.error('No fue posible reconciliar el cierre pendiente con Azure.',error);
    toast('El cierre sigue pendiente de sincronizar con Azure');
    return false;
  }
}
window.reconcilePendingAzureWeekClose=reconcilePendingAzureWeekClose;
if(typeof doSync==='function'){
  const doSyncBeforeWeekCloseReconciliation=doSync;
  doSync=async function(){
    const ok=await reconcilePendingAzureWeekClose();
    if(!ok)return;
    return doSyncBeforeWeekCloseReconciliation.apply(this,arguments);
  };
}


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
