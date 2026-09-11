// Cierre de semana desde Grupo.
// Una semana cerrada permanece visible, pero queda en modo solo lectura.
if(!state.closedGroupWeeks)state.closedGroupWeeks={};
function groupWeekIsClosed(){return !!state.closedGroupWeeks['w'+state.currentWeek]}
function closedWeekMessage(){toast('Semana cerrada · información disponible solo para consulta')}
function askCloseGroupWeek(){if(groupWeekIsClosed())return closedWeekMessage();modal('<h3>Cerrar Semana '+state.currentWeek+'</h3><p>Al cerrar la semana, su información seguirá disponible para consulta, pero <b>ya no se podrán registrar evaluaciones ni modificar el grupo</b>.</p><div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="confirmCloseGroupWeek()">Cerrar semana</button></div>')}
function confirmCloseGroupWeek(){state.closedGroupWeeks['w'+state.currentWeek]={closed:true,closedAt:new Date().toISOString()};save();closeModal();state.view='grupo';render();toast('Semana '+state.currentWeek+' cerrada · modo solo lectura')}

// Bloqueos funcionales: no dependen solo de ocultar botones.
if(typeof go==='function'){
  const goBeforeWeekLock=go;
  go=function(v){if(groupWeekIsClosed()&&['nueva','agregar','evaluarItems'].includes(v)){closedWeekMessage();return}return goBeforeWeekLock(v)};
}
if(typeof saveEval==='function'){
  const saveEvalBeforeWeekLock=saveEval;
  saveEval=function(){if(groupWeekIsClosed())return closedWeekMessage();return saveEvalBeforeWeekLock()};
}
if(typeof commitEval==='function'){
  const commitEvalBeforeWeekLock=commitEval;
  commitEval=function(ids){if(groupWeekIsClosed())return closedWeekMessage();return commitEvalBeforeWeekLock(ids)};
}
if(typeof adjustRequired==='function'){
  const adjustRequiredBeforeWeekLock=adjustRequired;
  adjustRequired=function(){if(groupWeekIsClosed())return closedWeekMessage();return adjustRequiredBeforeWeekLock()};
}
if(typeof applyRequired==='function'){
  const applyRequiredBeforeWeekLock=applyRequired;
  applyRequired=function(){if(groupWeekIsClosed())return closedWeekMessage();return applyRequiredBeforeWeekLock()};
}
if(typeof addWorker==='function'){
  const addWorkerBeforeWeekLock=addWorker;
  addWorker=function(id){if(groupWeekIsClosed())return closedWeekMessage();return addWorkerBeforeWeekLock(id)};
}
if(typeof confirmRemoveFromGroup==='function'){
  const removeBeforeWeekLock=confirmRemoveFromGroup;
  confirmRemoveFromGroup=function(id){if(groupWeekIsClosed())return closedWeekMessage();return removeBeforeWeekLock(id)};
}
if(typeof annulEval==='function'){
  const annulBeforeWeekLock=annulEval;
  annulEval=function(){if(groupWeekIsClosed())return closedWeekMessage();return annulBeforeWeekLock()};
}

function decorateGroupWeekClose(){
  if(state.role!=='monitor')return;
  let closed=groupWeekIsClosed();
  if(state.view==='grupo'){
    let hero=document.querySelector('.hero');
    if(hero&&!document.querySelector('#group-week-close')){
      let wrap=document.createElement('div');wrap.id='group-week-close';wrap.style.cssText='margin-top:14px;padding-top:12px;border-top:1px solid #e1e6e3';
      wrap.innerHTML=closed?'<div class="row between"><div><b>Semana cerrada</b><div class="muted small">Solo consulta · no se permiten nuevas evaluaciones ni cambios al grupo</div></div><span class="badge">Cerrada</span></div>':'<button type="button" class="btn danger block" onclick="askCloseGroupWeek()">Cerrar semana</button>';
      hero.appendChild(wrap);
    }
  }
  if(!closed)return;
  // Refuerzo visual: se mantienen los datos visibles, pero se retiran acciones de escritura.
  document.querySelectorAll('button').forEach(b=>{
    let t=(b.textContent||'').trim().toLowerCase();
    if(t.includes('nueva evaluación')||t.includes('ajustar evaluaciones')||t.includes('agregar')||t.includes('quitar del grupo')||t.includes('evaluar grupo')||t.includes('anular evaluación')){
      b.disabled=true;b.style.opacity='.45';b.style.cursor='not-allowed';b.onclick=closedWeekMessage;
    }
  });
}
const groupCloseObserver=new MutationObserver(()=>{clearTimeout(window.__groupCloseTimer);window.__groupCloseTimer=setTimeout(decorateGroupWeekClose,0)});groupCloseObserver.observe(document.querySelector('#app'),{childList:true,subtree:true});setTimeout(decorateGroupWeekClose,0);
