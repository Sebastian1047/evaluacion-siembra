// Ingreso tardío al grupo y corrección completa de turnos anteriores.
(function(){
  function ensureTurnEvents(){
    if(!state.turnEvents)state.turnEvents=[];
    (state.evals||[]).forEach(e=>{
      if(e.turn==null){let same=(state.evals||[]).filter(x=>x.person===e.person),idx=same.indexOf(e);e.turn=idx>=0?idx+1:null}
    });
  }
  ensureTurnEvents();

  if(typeof addWorker==='function'){
    const addWorkerBeforeLateEntry=addWorker;
    addWorker=function(id){
      if(typeof groupWeekReadOnly==='function'&&groupWeekReadOnly())return closedWeekMessage();
      let existing=(state.people||[]).slice(),inherited=0;
      if(existing.length){if(typeof ensureSampleTurns==='function')ensureSampleTurns();inherited=Math.min(...existing.map(p=>Number(p.sampleTurn)||0))}
      let candidate=(state.available||[]).find(x=>x.id===id);addWorkerBeforeLateEntry(id);
      let added=(state.people||[]).find(x=>x.id===id)||(candidate&&(state.people||[]).find(x=>x.name===candidate.name&&x.doc===candidate.doc));
      if(added){added.sampleTurn=inherited;added.entryTurn=inherited+1;added.originalRequired=30;added.done=Number(added.done)||0;added.required=typeof refreshEffectiveEvaluationTarget==='function'?refreshEffectiveEvaluationTarget(added):Math.max(added.done,30-inherited+added.done);save();render();if(inherited>0)toast(added.name+' se incorpora al turno '+(inherited+1))}
    };
  }

  if(typeof commitEval==='function'){
    const commitEvalBeforeTurnNumber=commitEval;
    commitEval=function(ids){let p=current();if(!p)return commitEvalBeforeTurnNumber(ids);let expected=(Number(p.sampleTurn)||0)+1,before=(state.evals||[]).length,result=commitEvalBeforeTurnNumber(ids),created=(state.evals||[]).slice(before).find(e=>e.person===p.id);if(created&&created.turn==null){created.turn=expected;save()}return result};
  }

  function evaluationAt(p,turn){return (state.evals||[]).find(e=>e.person===p.id&&Number(e.turn)===Number(turn))}
  function omissionAt(p,turn){return (state.sampleTurnOmissions||[]).find(o=>o.week===state.currentWeek&&o.person===p.id&&Number(o.turn)===Number(turn))}
  function criterionChecks(selected){selected=selected||[];return seed.criteria.map(c=>`<label><input type="checkbox" name="edit-turn-crit" value="${c[0]}" ${selected.includes(c[0])?'checked':''}> ${c[1]} ${c[2]?'<span class="badge">Crítico</span>':''}</label>`).join('')}

  // "Turno actual" en esta pantalla = último turno ya resuelto de la persona.
  // El Asegurador puede corregir directamente ese turno y el inmediatamente anterior.
  // Los más antiguos requieren habilitación del Analista.
  function lastResolvedTurn(p){return Number(p.sampleTurn)||0}
  function canAssurerEditTurn(p,turn){return Number(turn)>=lastResolvedTurn(p)-1}
  function hasAzureCorrectionAuthorization(evaluation){return Boolean(evaluation&&evaluation.azureCorrectionAuthorized)}
  function correctionWeekIsClosed(){return !!(state.closedGroupWeeks&&state.closedGroupWeeks['w'+state.currentWeek])}
  function canOpenCorrection(p,turn){const evaluation=evaluationAt(p,turn);if(correctionWeekIsClosed())return hasAzureCorrectionAuthorization(evaluation);return canAssurerEditTurn(p,turn)||hasAzureCorrectionAuthorization(evaluation)}
  async function refreshAzureCorrectionAuthorizations(){
    if(!window.SiembraApi||typeof SiembraApi.getCorrectionAuthorizations!=='function')return false;
    let weekId=Number(state.currentAzureWeekId)||0;
    if(!weekId){const week=await SiembraApi.getWeek(state.currentYear||2026,state.currentWeek);weekId=Number(week.IdSemana)||0;}
    if(!weekId)return false;
    const [authorizations,operational]=await Promise.all([
      SiembraApi.getCorrectionAuthorizations(weekId),
      SiembraApi.getOperationalState(weekId)
    ]);
    const active=(Array.isArray(authorizations)?authorizations:[]).filter(a=>a.Estado==='AUTORIZADA'&&!a.UtilizadaEn);
    const authorizedResolutions=new Set(active.map(a=>Number(a.IdResolucion)));
    const authorizedKeys=new Set(active.map(a=>String(a.SembradorCorporativoId||'')+'|'+Number(a.NumeroTurno)));
    const resolutionByKey=new Map((Array.isArray(operational)?operational:[]).filter(r=>r.Tipo==='EVALUACION'&&r.IdResolucion!=null).map(r=>[String(r.SembradorCorporativoId||'')+'|'+Number(r.NumeroTurno),Number(r.IdResolucion)]));
    (state.evals||[]).forEach(e=>{
      const person=(state.people||[]).find(p=>p.id===e.person)||(state.available||[]).find(p=>p.id===e.person);
      const corporateId=String((person&&(person.doc||person.id))||e.personId||e.person||'');
      const key=corporateId+'|'+Number(e.turn);
      const resolutionId=Number(e.azureResolutionId)||resolutionByKey.get(key)||0;
      if(resolutionId&&!e.azureResolutionId)e.azureResolutionId=resolutionId;
      e.azureCorrectionAuthorized=authorizedResolutions.has(resolutionId)||authorizedKeys.has(key);
    });
    state.currentAzureWeekId=weekId;save();return true;
  }

  function personTurnRows(p){
    ensureTurnEvents();
    const evaluations=(state.evals||[]).filter(e=>e.person===p.id&&Number(e.turn)>0).slice().sort((a,b)=>Number(b.turn)-Number(a.turn));
    if(!evaluations.length)return '<div class="card muted">Todavía no hay muestras evaluadas para corregir.</div>';
    return evaluations.map(evaluation=>{
      const turn=Number(evaluation.turn),failures=Array.isArray(evaluation.failures)?evaluation.failures:[],direct=canAssurerEditTurn(p,turn);
      const label=failures.length?`${failures.length} ítem${failures.length===1?'':'s'} con incumplimiento`:'Todos los ítems cumplen';
      return `<article class="card" style="padding:10px 12px;margin-bottom:7px"><div class="row between" style="gap:10px"><div><b>Turno ${turn}</b><div class="muted small">${label}</div></div><div class="row" style="gap:7px;align-items:center"><span class="badge">Evaluado</span><button class="btn ghost small" onclick="requestTurnEdit(${turn})">Corregir</button></div></div></article>`;
    }).join('');
  }

  window.showPreviousTurns=function(){
    let p=current();if(!p)return;
    modal(`<h3>Corregir evaluaciones</h3><p><b>${p.name}</b></p><p class="muted">Solo aparecen turnos en los que realmente se revisó una muestra. Los turnos sin muestra no pueden modificarse. Las evaluaciones más antiguas conservan las condiciones de autorización definidas.</p><div style="max-height:360px;overflow:auto">${personTurnRows(p)}</div><button class="btn ghost block" onclick="closeModal()">Cerrar</button>`);
  };

  window.requestTurnEdit=async function(turn){
    let p=current();if(!p)return;
    let authorizationCheckFailed=false;
    if(correctionWeekIsClosed()||!canAssurerEditTurn(p,turn)){
      try{await refreshAzureCorrectionAuthorizations();}
      catch(error){authorizationCheckFailed=true;console.warn('No fue posible consultar autorizaciones de corrección.',error);}
    }
    if(!evaluationAt(p,turn))return modal(`<h3>Turno ${turn} sin evaluación</h3><p>Este turno no tiene una muestra revisada y no puede modificarse.</p><button class="btn primary block" onclick="showPreviousTurns()">Entendido</button>`);
    if(canOpenCorrection(p,turn))return editPreviousTurn(turn);
    modal(`<h3>Turno ${turn} protegido</h3><p>Para corregir esta evaluación debe solicitar al <b>Analista</b> que la habilite.</p>${authorizationCheckFailed?'<p class="muted"><b>No fue posible verificar la autorización en Azure.</b> Por seguridad, la evaluación permanece bloqueada.</p>':'<p class="muted">La evaluación permanece protegida hasta que exista una autorización vigente del Analista.</p>'}<div class="row"><button class="btn primary" onclick="showPreviousTurns()">Entendido</button></div>`);
  };

  window.editPreviousTurn=function(turn){
    let p=current();if(!p)return;
    let evaluation=evaluationAt(p,turn);
    if(!evaluation)return requestTurnEdit(turn);
    if(!canOpenCorrection(p,turn))return requestTurnEdit(turn);
    let failures=Array.isArray(evaluation.failures)?evaluation.failures:[];
    modal(`<h3>Corregir evaluación · turno ${turn}</h3><p><b>${p.name}</b></p><h3 style="margin-bottom:4px">Ítems incumplidos</h3><p class="muted">Corrija únicamente el resultado de la muestra que realmente fue revisada. Marque los ítems que <b>No cumplen</b>; si no marca ninguno, todos se consideran cumplidos.</p><div class="checks">${criterionChecks(failures)}</div><p class="muted" style="margin-top:14px">La corrección no cambia el turno, no crea ni elimina una evaluación y no modifica la meta efectiva.</p><div class="row"><button class="btn ghost" onclick="showPreviousTurns()">Cancelar</button><button class="btn primary" onclick="savePreviousTurnCorrection(${turn})">Guardar corrección</button></div>`);
  };

  window.savePreviousTurnCorrection=async function(turn){
    let p=current();if(!p)return;
    const evaluation=evaluationAt(p,turn);
    if(!evaluation)return modal(`<h3>No se puede corregir</h3><p>El turno ${turn} no tiene una evaluación real registrada.</p><button class="btn primary block" onclick="showPreviousTurns()">Entendido</button>`);
    const authorized=hasAzureCorrectionAuthorization(evaluation);
    if((correctionWeekIsClosed()||!canAssurerEditTurn(p,turn))&&!authorized)return requestTurnEdit(turn);
    // En una semana cerrada, la autorización Azure es precisamente la excepción temporal
    // al modo solo lectura. Sin autorización, la validación anterior ya bloqueó la corrección.
    if(typeof groupWeekReadOnly==='function'&&groupWeekReadOnly()&&!authorized)return closeModal(),closedWeekMessage();
    ensureTurnEvents();
    const failures=[...document.querySelectorAll('[name=edit-turn-crit]:checked')].map(x=>x.value);
    // Toda corrección de una evaluación ya persistida debe pasar por Azure para
    // dejar auditoría, independientemente de si necesitó autorización del Analista.
    // La autorización sigue siendo únicamente una regla de permiso para abrir la
    // corrección; no debe decidir si el cambio queda auditado o no.
    if(!window.SiembraApi||typeof SiembraApi.saveAuthorizedCorrection!=='function')return toast('No se pudo conectar con el servicio de correcciones');
    // Los checkboxes se construyen directamente desde seed.criteria. Su value es el
    // código de negocio del ítem (c1, c2, ...), por lo que la corrección debe traducir
    // esos códigos con el catálogo oficial de Azure en una sola consulta.
    // El catálogo de ítems es estable y forma parte del contrato de la aplicación.
    // Para guardar una corrección no debemos depender de una segunda petición GET /api/items:
    // la evaluación ya usa los códigos c1..c10 y estos corresponden a los IdItem sembrados
    // en el mismo orden en database/002_seed_items.sql.
    const itemIdByCode={c1:1,c2:2,c3:3,c4:4,c5:5,c6:6,c7:7,c8:8,c9:9,c10:10};
    const itemIds=failures.map(code=>itemIdByCode[String(code).trim().toLowerCase()]);
    const missing=failures.filter((code,index)=>!Number.isInteger(itemIds[index]));
    if(missing.length){
      console.error('Código de criterio no reconocido por el contrato local',{missing,failures});
      return toast('No se reconocieron los criterios: '+missing.join(', '));
    }
    if(!Number(evaluation.azureResolutionId))return toast('La evaluación no está vinculada con Azure y no puede corregirse');
    try{
      await SiembraApi.saveAuthorizedCorrection(Number(evaluation.azureResolutionId),{incumplimientos:itemIds,usuarioCorporativoId:'asegurador-prueba'});
      if(authorized)evaluation.azureCorrectionAuthorized=false;
    }catch(error){
      console.error('No fue posible guardar la corrección en Azure.',error);
      return toast('No se pudo guardar la corrección. Mantenga la conexión a Internet e inténtelo nuevamente.');
    }
    evaluation.failures=failures;
    evaluation.score=Math.max(0,100-failures.length*8);
    evaluation.corrected=true;
    evaluation.correctedAt=new Date().toISOString();
    save();
    const result=failures.length?`Evaluación corregida · ${failures.length} ítem${failures.length===1?'':'s'} con incumplimiento`:'Evaluación corregida · todos los ítems cumplen';
    modal(`<h3>Turno ${turn} corregido</h3><p><b>${result}</b></p><p class="muted">Se conservaron la existencia de la evaluación, el turno y la meta efectiva.</p><button class="btn primary block" onclick="closeModal();render()">Aceptar</button>`);
  };

  function decoratePreviousTurnButton(){
    if(state.role!=='monitor'||state.view!=='seguimiento')return;let p=current();if(!p||lastResolvedTurn(p)<Math.max(1,Number(p.entryTurn)||1))return;let hero=document.querySelector('.hero');if(!hero||hero.querySelector('#edit-previous-turn'))return;
    let btn=document.createElement('button');btn.id='edit-previous-turn';btn.className='btn ghost block';btn.style.marginTop='8px';btn.textContent='Corregir turno';btn.onclick=showPreviousTurns;hero.appendChild(btn);
  }
  const obs=new MutationObserver(()=>{clearTimeout(window.__previousTurnTimer);window.__previousTurnTimer=setTimeout(decoratePreviousTurnButton,0)});obs.observe(document.querySelector('#app'),{childList:true,subtree:true});setTimeout(decoratePreviousTurnButton,0);
})();
