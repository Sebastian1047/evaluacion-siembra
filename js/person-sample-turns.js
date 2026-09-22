// Control de turnos de muestra en la evaluación individual.
// sampleTurn = posición operativa del último turno resuelto; para una incorporación
// tardía parte en TurnoInicio-1, pero los turnos previos no pertenecen a la persona.
// done = evaluaciones realmente realizadas. required = máximo de evaluaciones reales
// que todavía puede completar dentro de las 30 rondas semanales.
// Cada ronda ya pasada sin evaluación reduce required, sin eliminar el turno operativo.
if(!state.sampleTurnOmissions)state.sampleTurnOmissions=[];
// Migración del prototipo al control manual de turnos. La semana activa estaba avanzando
// automáticamente al evaluar a una sola persona; al activar este modelo, el turno vuelve a 1
// una sola vez y desde aquí solo cambia mediante el botón explícito.
if(!state.manualSampleTurnControl){state.weekOperationalSampleTurn=1;state.manualSampleTurnControl=true;save();}
function effectiveEvaluationTarget(p){
  const done=Math.max(0,Number(p&&p.done)||0);
  const startTurn=Math.max(1,Number(p&&p.turnoInicio)||1);
  const resolvedSinceEntry=Math.max(0,(Number(p&&p.sampleTurn)||0)-startTurn+1);
  const missedSinceEntry=Math.max(0,resolvedSinceEntry-done);
  const turnsBeforeEntry=startTurn-1;
  return Math.max(done,Math.min(30,30-turnsBeforeEntry-missedSinceEntry));
}
window.effectiveEvaluationTarget=effectiveEvaluationTarget;
function refreshEffectiveEvaluationTarget(p){
  if(!p)return 30;
  p.originalRequired=30;
  p.required=effectiveEvaluationTarget(p);
  return p.required;
}
window.refreshEffectiveEvaluationTarget=refreshEffectiveEvaluationTarget;
function ensureSampleTurns(){
  (state.people||[]).forEach(p=>{
    if(typeof p.sampleTurn!=='number') p.sampleTurn=Number(p.done)||0;
    refreshEffectiveEvaluationTarget(p);
  });
}
function minSampleTurn(){ensureSampleTurns();return state.people.length?Math.min(...state.people.map(p=>p.sampleTurn)):Math.max(0,(Number(state.weekOperationalSampleTurn)||1)-1)}
function currentGroupSampleTurn(){return Math.max(1,Number(state.weekOperationalSampleTurn)||1)}
function pendingForTurn(turn){ensureSampleTurns();return state.people.filter(p=>Number(p.turnoInicio||1)<=turn&&Number(p.sampleTurn||0)<turn)}
function canAdvancePerson(p){
  ensureSampleTurns();
  const turn=currentGroupSampleTurn();
  const start=Math.max(1,Number(p.turnoInicio)||1);
  if(start>turn)return {ok:false,next:turn,pending:[],turn,notStarted:true};
  if(Number(p.sampleTurn||0)>=turn)return {ok:false,next:turn,pending:[],turn,alreadyResolved:true};
  return {ok:true,next:turn};
}
function showTurnBlock(p,info){
  if(info.alreadyResolved)return modal(`<h3>Turno ${info.turn} ya resuelto</h3><p><b>${p.name}</b> ya resolvió este turno.</p><p>Use <b>Pasar al siguiente turno</b> desde el grupo cuando corresponda.</p><button class="btn primary block" onclick="closeModal();go('grupo')">Volver al grupo</button>`);
  if(info.notStarted)return modal(`<h3>Participación aún no iniciada</h3><p><b>${p.name}</b> inicia en el turno ${p.turnoInicio}.</p><button class="btn primary block" onclick="closeModal();go('grupo')">Volver al grupo</button>`);
}
function omitCurrentSample(){
  let p=current();if(!p)return;
  if(typeof groupWeekIsClosed==='function'&&groupWeekIsClosed())return closedWeekMessage();
  let info=canAdvancePerson(p);if(!info.ok)return showTurnBlock(p,info);
  modal(`<h3>No realizar muestra</h3><p><b>${p.name}</b></p><p>Se registrará como resuelto el <b>turno de muestra ${info.next}</b>, pero no contará como evaluación realizada.</p><p>Su meta efectiva bajará de <b>${p.required}</b> a <b>${Math.max(p.done,p.required-1)}</b> evaluaciones.</p><div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn danger" onclick="confirmOmitCurrentSample()">No realizar muestra y volver al grupo</button></div>`);
}
async function confirmOmitCurrentSample(){
  let p=current();if(!p)return;
  let info=canAdvancePerson(p);if(!info.ok){closeModal();return showTurnBlock(p,info)}
  if(!p.azureParticipationId||!window.SiembraApi||typeof SiembraApi.resolveTurn!=='function'){
    return toast('No se puede registrar la omisión: Azure no está disponible.');
  }
  const button=[...document.querySelectorAll('.modal button')].find(b=>/No realizar muestra y volver al grupo/i.test(b.textContent||''));
  if(button){button.disabled=true;button.textContent='Guardando en Azure...'}
  try{
    const result=await SiembraApi.resolveTurn(p.azureParticipationId,info.next,{
      tipo:'NO_REALIZADA',
      incumplimientos:[],
      usuarioCorporativoId:'asegurador-prueba'
    });
    p.sampleTurn=info.next;
    refreshEffectiveEvaluationTarget(p);
    state.sampleTurnOmissions.push({
      week:state.currentWeek,
      year:state.currentYear,
      person:p.id,
      turn:p.sampleTurn,
      date:new Date().toISOString(),
      synced:true,
      azureResolutionId:result&&result.idResolucion
    });
    state.view='grupo';save();closeModal();render();toast('Muestra no realizada · turno '+p.sampleTurn+' guardado en Azure');
  }catch(error){
    console.error('No fue posible guardar No realizar muestra en Azure.',error);
    if(button){button.disabled=false;button.textContent='No realizar muestra y volver al grupo'}
    toast('No se pudo guardar en Azure. No se modificó el turno local.');
  }
}
const goBeforeSampleTurns=go;
go=function(v){
  if(v==='nueva'&&state.role==='monitor'){
    let p=current();
    if(p){
      const turn=currentGroupSampleTurn();
      if(Number(p.sampleTurn||0)>=turn){
        return modal(`<h3>Turno ${turn} ya evaluado</h3><p><b>${p.name}</b> ya tiene resuelto el turno de muestra ${turn}.</p><p>Para realizar otra evaluación, primero vuelva al grupo y pulse <b>Pasar al siguiente turno</b>.</p><button class="btn primary block" onclick="closeModal();go('grupo')">Volver al grupo</button>`);
      }
      let info=canAdvancePerson(p);if(!info.ok){showTurnBlock(p,info);return}
    }
  }
  return goBeforeSampleTurns(v);
};
const commitEvalBeforeSampleTurns=commitEval;
commitEval=function(ids){
  let p=current();if(!p)return commitEvalBeforeSampleTurns(ids);
  let info=canAdvancePerson(p);if(!info.ok)return showTurnBlock(p,info);
  let beforeDone=p.done;
  commitEvalBeforeSampleTurns(ids);
  if(p.done>beforeDone){p.sampleTurn=info.next;refreshEffectiveEvaluationTarget(p);save()}
};

function advanceGroupTurn(){
  if(typeof groupWeekIsClosed==='function'&&groupWeekIsClosed())return closedWeekMessage();
  const turn=currentGroupSampleTurn();
  const pending=pendingForTurn(turn);
  if(pending.length){
    const names=pending.map(p=>p.name).join(', ');
    return modal(`<h3>No se puede pasar al turno ${turn+1}</h3><p>Falta resolver el turno ${turn} para <b>${pending.length}</b> sembrador${pending.length===1?'':'es'}.</p><p class="muted">${names}</p><p>Registre una evaluación o <b>No realizar muestra</b> para cada pendiente.</p><button class="btn primary block" onclick="closeModal()">Entendido</button>`);
  }
  state.weekOperationalSampleTurn=turn+1;
  save();render();toast('Turno de muestra '+(turn+1)+' iniciado');
}
window.advanceGroupTurn=advanceGroupTurn;

function decorateSampleTurnUI(){
  ensureSampleTurns();
  if(state.role!=='monitor')return;
  if(state.view==='grupo'){
    // El turno grupal avanza únicamente por decisión explícita del Asegurador.
    let hero=document.querySelector('.hero');
    if(hero&&!hero.querySelector('#advance-group-turn')){
      let btn=document.createElement('button');btn.id='advance-group-turn';btn.className='btn secondary';btn.style.cssText='margin-top:8px;width:100%';btn.textContent='Pasar al siguiente turno';const closed=typeof groupWeekIsClosed==='function'&&groupWeekIsClosed();btn.disabled=closed;if(closed){btn.title='La semana está cerrada';btn.style.opacity='.55';btn.style.cursor='not-allowed';}btn.onclick=advanceGroupTurn;hero.appendChild(btn);
    }
    // Indicador principal al lado de Semana N: muestra el turno que el grupo está resolviendo ahora.
    hero=document.querySelector('.hero');
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
    let p=current();if(!p)return;let hero=document.querySelector('.hero');if(!hero)return;
    if(!hero.querySelector('#sample-turn-person')){
      const startTurn=Math.max(1,Number(p.turnoInicio)||1);
      const internalTurn=Number(p.sampleTurn)||0;
      const hasResolvedSinceEntry=internalTurn>=startTurn;
      const turnLabel=hasResolvedSinceEntry?'Último turno de muestra resuelto':'Turno de incorporación';
      const turnValue=hasResolvedSinceEntry?internalTurn:startTurn;
      let box=document.createElement('div');box.id='sample-turn-person';box.className='card';box.style.marginTop='12px';
      box.innerHTML=`<div class="row between"><span>${turnLabel}</span><b>${turnValue}</b></div>${!hasResolvedSinceEntry&&startTurn>1?'<p class="muted" style="margin:6px 0 0">Aún no ha resuelto ningún turno desde su incorporación.</p>':''}<div class="row between"><span>Evaluaciones efectivas</span><b>${p.done} / ${p.required}</b></div><button class="btn ghost block" style="margin-top:10px" onclick="omitCurrentSample()">No realizar muestra y volver al grupo</button>`;
      hero.appendChild(box);
    }

    // Trazabilidad visible de turnos resueltos sin evaluación. Se muestran aparte
    // para no confundir una omisión con una evaluación efectiva.
    if(!document.querySelector('#sample-turn-omissions')){
      const omissions=(state.sampleTurnOmissions||[])
        .filter(o=>o.person===p.id&&Number(o.week)===Number(state.currentWeek)&&(!o.year||Number(o.year)===Number(state.currentYear)))
        .slice().sort((a,b)=>Number(b.turn)-Number(a.turn));
      if(omissions.length){
        const section=document.createElement('section');section.id='sample-turn-omissions';section.style.marginTop='18px';
        section.innerHTML=`<h3>Muestras no realizadas</h3>${omissions.map(o=>`<div class="card" style="margin-top:10px"><div class="row between"><div><b>Turno ${o.turn}</b><p style="margin:6px 0 0">Muestra no realizada · Sin evaluación</p></div>${o.synced?'<span class="badge ok">Sincronizada</span>':''}</div></div>`).join('')}`;
        const evalHeading=[...document.querySelectorAll('h3')].find(h=>(h.textContent||'').trim()==='Evaluaciones registradas');
        if(evalHeading&&evalHeading.parentNode)evalHeading.parentNode.insertBefore(section,evalHeading);
        else hero.insertAdjacentElement('afterend',section);
      }
    }
  }
}
const sampleTurnObserver=new MutationObserver(()=>{clearTimeout(window.__sampleTurnTimer);window.__sampleTurnTimer=setTimeout(decorateSampleTurnUI,0)});sampleTurnObserver.observe(document.querySelector('#app'),{childList:true,subtree:true});ensureSampleTurns();save();setTimeout(decorateSampleTurnUI,0);