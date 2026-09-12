// Ciclo operativo del Asegurador:
// 1) la semana actual debe cerrarse antes de crear la siguiente;
// 2) mientras está cerrada y aún no existe la siguiente, permanece COMPLETA y visible en solo lectura;
// 3) al crear la nueva semana, la anterior desaparece de la vista operativa y solo se indica cuál fue la última.
if(typeof state.lastAssurerWeek==='undefined')state.lastAssurerWeek=null;

function currentWeekClosedForCreation(){
  return !!(state.closedGroupWeeks&&state.closedGroupWeeks['w'+state.currentWeek]);
}

// Reemplaza únicamente la apertura del modal de nueva semana.
const newWeekModalBeforeLifecycle=newWeekModal;
newWeekModal=function(){
  if(state.role==='monitor'&&!currentWeekClosedForCreation()){
    return modal(`<h3>Primero debe cerrar la Semana ${state.currentWeek}</h3><p>No puede crear una nueva semana mientras la actual permanezca abierta.</p><p class="muted">Antes de cerrarla, el sistema validará que todos los sembradores estén nivelados en el mismo turno de muestra.</p><button class="btn primary block" onclick="closeModal()">Entendido</button>`);
  }
  let next=state.currentWeek+1;
  modal(`<h3>Crear Semana ${next}</h3><p>La Semana ${state.currentWeek} ya está cerrada y todavía puede consultarla completa detrás de esta ventana.</p><p>Al crear la nueva semana, la Semana ${state.currentWeek} dejará de mostrarse en la vista del Asegurador y quedará bloqueada definitivamente para modificación.</p><p class="muted">En la nueva semana podrá agregar los sembradores que serán evaluados.</p><div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="createNextWeek()">Crear Semana ${next}</button></div>`);
};

// Este script carga después de group-week-close.js, por lo que envuelve también su bloqueo definitivo.
const createNextWeekBeforeLifecycle=createNextWeek;
createNextWeek=function(){
  if(state.role==='monitor'&&!currentWeekClosedForCreation()){
    return modal(`<h3>No se puede crear una nueva semana</h3><p>Debe cerrar primero la Semana ${state.currentWeek}.</p><button class="btn primary block" onclick="closeModal()">Entendido</button>`);
  }
  let previousWeek=state.currentWeek;
  let r=state.closedGroupWeeks&&state.closedGroupWeeks['w'+previousWeek];
  if(r){
    r.editEnabled=false;
    r.permanentlyLocked=true;
    r.lockedAt=new Date().toISOString();
  }
  state.lastAssurerWeek=previousWeek;
  save();
  return createNextWeekBeforeLifecycle();
};

function decorateLastAssurerWeek(){
  if(state.role!=='monitor'||state.view!=='grupo')return;
  let hero=document.querySelector('.hero');
  if(!hero)return;

  // Antes de crear la siguiente semana, la semana cerrada sigue siendo la semana actual:
  // se conserva toda su pantalla, grupo y sembradores; solo se identifica claramente como cerrada.
  if(currentWeekClosedForCreation()){
    if(!hero.querySelector('#closed-week-visible-note')){
      let note=document.createElement('div');
      note.id='closed-week-visible-note';
      note.className='card';
      note.style.cssText='margin-top:10px;padding:10px 12px';
      note.innerHTML=`<b>Última semana cerrada: ${state.currentWeek}</b><div class="muted small" style="margin-top:3px">Puede consultar toda la información de esta semana hasta crear la siguiente.</div>`;
      hero.appendChild(note);
    }
    return;
  }

  // Solo DESPUÉS de crear la siguiente semana queda la referencia numérica de la anterior.
  if(state.lastAssurerWeek!=null&&!hero.querySelector('#last-assurer-week')){
    let note=document.createElement('div');
    note.id='last-assurer-week';
    note.className='muted small';
    note.style.cssText='margin-top:8px';
    note.textContent='Última semana: '+state.lastAssurerWeek;
    hero.appendChild(note);
  }
}

const weekLifecycleObserver=new MutationObserver(()=>{
  clearTimeout(window.__weekLifecycleTimer);
  window.__weekLifecycleTimer=setTimeout(decorateLastAssurerWeek,0);
});
weekLifecycleObserver.observe(document.querySelector('#app'),{childList:true,subtree:true});
setTimeout(decorateLastAssurerWeek,0);
