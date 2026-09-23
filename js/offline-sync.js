// Offline-first: el Asegurador trabaja localmente y sincroniza explícitamente cuando recupera cobertura.
(function(){
  function queue(){
    if(!Array.isArray(state.syncQueue))state.syncQueue=[];
    return state.syncQueue;
  }
  function pendingCount(){return queue().filter(x=>x.status!=='SYNCED').length}
  function refreshPending(){state.pending=pendingCount()}
  function enqueue(type,payload){
    const op={id:'op-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),type,payload,status:'PENDING',createdAt:new Date().toISOString(),attempts:0,lastError:null};
    queue().push(op);refreshPending();save();return op;
  }
  function weekPayload(){
    return {year:Number(state.currentYear||new Date().getFullYear()),week:Number(state.currentWeek),start:state.currentWeekStart||null,end:state.currentWeekEnd||null};
  }
  function localPersonByDoc(doc){return (state.people||[]).find(p=>String(p.doc)===String(doc))||(state.available||[]).find(p=>String(p.doc)===String(doc))}
  function localEvalById(id){return (state.evals||[]).find(e=>String(e.id)===String(id))}
  async function ensureAzureWeek(w){
    let found=null;
    try{found=await SiembraApi.getWeek(w.year,w.week)}catch(_){}
    if(found&&Number(found.IdSemana))return found;
    if(!w.start||!w.end)throw new Error('La semana local no tiene fechas calendario para sincronizar');
    return SiembraApi.ensureWeek({anio:w.year,numero:w.week,inicio:w.start,fin:w.end});
  }
  async function ensureParticipant(w,doc,turnoInicio){
    const week=await ensureAzureWeek(w);
    const weekId=Number(week.IdSemana);
    const existing=(await SiembraApi.getParticipants(weekId)).find(x=>String(x.SembradorCorporativoId)===String(doc));
    let part=existing;
    if(!part)part=await SiembraApi.addParticipant(weekId,{sembradorId:String(doc),turnoInicio:Number(turnoInicio)||1});
    const local=localPersonByDoc(doc);
    if(local){local.azureParticipationId=Number(part.IdParticipacion);local.turnoInicio=Number(part.TurnoInicio)||Number(turnoInicio)||1}
    if(Number(w.year)===Number(state.currentYear)&&Number(w.week)===Number(state.currentWeek))state.currentAzureWeekId=weekId;
    return {week,part};
  }
  async function syncOne(op){
    const p=op.payload||{},w=p.week;
    if(op.type==='ADD_PARTICIPANT'){
      const {part}=await ensureParticipant(w,p.doc,p.turnoInicio);
      if(p.rejoin&&String(part.Estado)!=='EN_LA_SEMANA')await SiembraApi.changeParticipantState(Number(part.IdParticipacion),'EN_LA_SEMANA',Number(p.turnoInicio)||1);
      return;
    }
    if(op.type==='REMOVE_PARTICIPANT'){
      const {part}=await ensureParticipant(w,p.doc,p.turnoInicio);
      await SiembraApi.changeParticipantState(Number(part.IdParticipacion),'QUITADO_TEMPORALMENTE',Number(p.turnoOperativo)||1);return;
    }
    if(op.type==='RESOLVE_TURN'){
      const {part}=await ensureParticipant(w,p.doc,p.turnoInicio);
      const itemIds=[];
      for(const code of (p.failures||[])){
        const id=Number(window.SiembraAzureItemIds?.[String(code)]);
        if(!id)throw new Error('No existe IdItem Azure para '+code);
        itemIds.push(id);
      }
      const result=await SiembraApi.resolveTurn(Number(part.IdParticipacion),Number(p.turn),{tipo:p.tipo,incumplimientos:itemIds,usuarioCorporativoId:'asegurador-prueba'});
      if(p.tipo==='EVALUACION'){
        const e=localEvalById(p.localEvalId);if(e){e.synced=true;e.azureResolutionId=result&&result.idResolucion}
      }else{
        const o=(state.sampleTurnOmissions||[]).find(x=>String(x.localSyncId)===String(op.id));if(o){o.synced=true;o.azureResolutionId=result&&result.idResolucion}
      }
      return;
    }
    if(op.type==='CLOSE_WEEK'){
      const week=await ensureAzureWeek(w);await SiembraApi.closeWeek(Number(week.IdSemana),{usuarioCorporativoId:'asegurador-prueba'});
      const rec=state.closedGroupWeeks&&state.closedGroupWeeks['w'+w.week];if(rec)rec.azureClosed=true;return;
    }
    if(op.type==='NO_EVALUADA'){
      const week=await ensureAzureWeek(w);await SiembraApi.markWeekNotEvaluated(Number(week.IdSemana));return;
    }
  }

  window.doSync=async function(){
    const items=queue().filter(x=>x.status!=='SYNCED');
    if(!items.length){refreshPending();save();closeModal();render();return toast('Todo está sincronizado')}
    const modalBox=document.querySelector('.modal');if(modalBox)modalBox.innerHTML='<h3>Sincronizando...</h3><p>Enviando '+items.length+' operación(es) pendientes al servidor.</p>';
    let ok=0,failed=0;
    for(const op of items){
      op.attempts=(Number(op.attempts)||0)+1;
      try{await syncOne(op);op.status='SYNCED';op.syncedAt=new Date().toISOString();op.lastError=null;ok++}
      catch(error){op.status='PENDING';op.lastError=String(error&&error.message||error);failed++;console.error('Sincronización pendiente',op,error)}
      refreshPending();save();
    }
    state.syncQueue=queue().filter(x=>x.status!=='SYNCED');refreshPending();save();closeModal();render();
    if(failed)toast(ok+' sincronizada(s) · '+failed+' pendiente(s)');
    else toast(ok+' operación(es) sincronizada(s) correctamente');
  };
  window.syncModal=function(){
    refreshPending();save();
    modal('<h3>Sincronización</h3><p><b>'+state.pending+'</b> operación(es) pendientes.</p><p class="muted">Los datos permanecen guardados en este dispositivo hasta que el servidor confirme cada operación.</p><button class="btn primary block" onclick="doSync()">Sincronizar ahora</button>');
  };

  // Evaluaciones: siempre se confirman localmente primero.
  window.commitEval=function(ids){
    const p=current();if(!p)return;
    const info=typeof canAdvancePerson==='function'?canAdvancePerson(p):{ok:true,next:(Number(p.sampleTurn)||0)+1};
    if(!info.ok){if(typeof showTurnBlock==='function')return showTurnBlock(p,info);return}
    p.done=(Number(p.done)||0)+1;
    const e={id:'e'+Date.now(),person:p.id,personId:p.id,week:state.currentWeek,year:state.currentYear,turn:info.next,sampleTurn:info.next,failures:[...ids],fails:[...ids],failed:[...ids],score:Math.max(0,100-ids.length*8),synced:false,date:new Date().toLocaleString('es-CO')};
    state.evals.push(e);p.sampleTurn=info.next;if(typeof refreshEffectiveEvaluationTarget==='function')refreshEffectiveEvaluationTarget(p);
    enqueue('RESOLVE_TURN',{week:weekPayload(),doc:p.doc,turnoInicio:p.turnoInicio||1,turn:info.next,tipo:'EVALUACION',failures:[...ids],localEvalId:e.id});
    state.view='seguimiento';save();render();toast('Evaluación guardada localmente · pendiente de sincronización');
  };

  // Incorporación/reincorporación: no exige Internet.
  window.addWorker=function(id){
    const i=(state.available||[]).findIndex(x=>x.id===id);if(i<0)return toast('El sembrador ya no está disponible');
    const candidate=state.available.splice(i,1)[0];
    const turn=state.people.length&&typeof currentGroupSampleTurn==='function'?currentGroupSampleTurn():Math.max(1,Number(state.weekOperationalSampleTurn)||1);
    const rejoin=!!candidate.removedFromWeek;
    const person={...candidate,required:Number(candidate.lastKnownRequired)||30,done:Number(candidate.lastKnownDone)||0,turnoInicio:rejoin?(Number(candidate.turnoInicio)||1):turn,ultimoTurnoIncorporacion:turn,sampleTurn:Math.max(Number(candidate.lastKnownResolvedTurn)||0,turn-1)};
    delete person.removedFromWeek;state.people.push(person);state.weekOperationalSampleTurn=turn;
    enqueue('ADD_PARTICIPANT',{week:weekPayload(),doc:person.doc,turnoInicio:turn,rejoin});
    save();state.view=state.role==='analista'?'gestion':'grupo';render();toast(person.name+' agregado localmente · pendiente de sincronización');
  };

  window.removeWorkerFromGroup=function(id){
    const i=(state.people||[]).findIndex(x=>x.id===id);if(i<0)return;const p=state.people[i];
    const turn=typeof currentGroupSampleTurn==='function'?currentGroupSampleTurn():Math.max(1,Number(state.weekOperationalSampleTurn)||1);
    state.people.splice(i,1);
    if(!state.available.some(x=>x.id===p.id))state.available.push({...p,removedFromWeek:true,lastKnownDone:Number(p.done)||0,lastKnownRequired:Number(p.required)||30,lastKnownResolvedTurn:Number(p.sampleTurn)||0});
    enqueue('REMOVE_PARTICIPANT',{week:weekPayload(),doc:p.doc,turnoInicio:p.turnoInicio||1,turnoOperativo:turn});
    save();closeModal();state.view='grupo';render();toast(p.name+' fue quitado localmente · pendiente de sincronización');
  };

  window.confirmOmitCurrentSample=function(){
    const p=current();if(!p)return;const info=canAdvancePerson(p);if(!info.ok){closeModal();return showTurnBlock(p,info)}
    p.sampleTurn=info.next;if(typeof refreshEffectiveEvaluationTarget==='function')refreshEffectiveEvaluationTarget(p);
    const op=enqueue('RESOLVE_TURN',{week:weekPayload(),doc:p.doc,turnoInicio:p.turnoInicio||1,turn:info.next,tipo:'NO_REALIZADA',failures:[]});
    if(!Array.isArray(state.sampleTurnOmissions))state.sampleTurnOmissions=[];
    state.sampleTurnOmissions.push({week:state.currentWeek,year:state.currentYear,person:p.id,turn:info.next,date:new Date().toISOString(),synced:false,localSyncId:op.id});
    refreshPending();save();closeModal();state.view='grupo';render();toast('Muestra no realizada guardada localmente · pendiente de sincronización');
  };

  // Cierre: queda efectivo localmente aunque no haya cobertura.
  window.confirmCloseGroupWeek=function(closeConfirmed){
    if(typeof weekHasReviewedSample==='function'&&!weekHasReviewedSample())return showWeekWithoutReviewedSamples();
    if(!closeConfirmed)return closeWeekConfirmation(currentTurnCloseStatus());
    if(!state.closedGroupWeeks)state.closedGroupWeeks={};
    state.closedGroupWeeks['w'+state.currentWeek]={closed:true,closedAt:new Date().toISOString(),editEnabled:false,permanentlyLocked:false,azureClosed:false};
    enqueue('CLOSE_WEEK',{week:weekPayload()});save();closeModal();state.view='grupo';render();toast('Semana cerrada localmente · pendiente de sincronización');
  };

  // Semana no evaluada: misma filosofía local-first.
  if(typeof window.confirmWeekNotEvaluated==='function'){
    window.confirmWeekNotEvaluated=function(){
      const key=(state.currentYear||new Date().getFullYear())+'-w'+state.currentWeek;
      if(!state.calendarWeeks)state.calendarWeeks={};state.calendarWeeks[key]={...(state.calendarWeeks[key]||{}),status:'NO_EVALUADA'};
      if(!state.closedGroupWeeks)state.closedGroupWeeks={};state.closedGroupWeeks['w'+state.currentWeek]={closed:true,noEvaluada:true,editEnabled:false,permanentlyLocked:false};
      enqueue('NO_EVALUADA',{week:weekPayload()});save();closeModal();state.view='grupo';render();toast('Semana marcada no evaluada localmente · pendiente de sincronización');
    };
  }

  refreshPending();save();setTimeout(()=>{if(state.role==='monitor')render()},0);
})();