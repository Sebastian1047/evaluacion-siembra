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
      if(added){added.sampleTurn=inherited;added.entryTurn=inherited+1;added.originalRequired=30;added.required=30;added.done=Number(added.done)||0;save();render();if(inherited>0)toast(added.name+' se incorpora al turno '+(inherited+1))}
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

  function personTurnRows(p){
    ensureTurnEvents();let start=Math.max(1,Number(p.entryTurn)||1),end=lastResolvedTurn(p);if(end<start)return '<div class="card muted">Todavía no hay turnos resueltos para esta persona.</div>';
    let rows=[];
    for(let turn=end;turn>=start;turn--){
      let omission=omissionAt(p,turn),evaluation=evaluationAt(p,turn),failures=evaluation&&Array.isArray(evaluation.failures)?evaluation.failures:[],direct=canAssurerEditTurn(p,turn);
      let label=omission?'No realizar muestra':failures.length?`${failures.length} ítem${failures.length===1?'':'s'} con incumplimiento`:'Todos los ítems cumplen';
      rows.push(`<article class="card" style="padding:10px 12px;margin-bottom:7px"><div class="row between" style="gap:10px"><div><b>Turno ${turn}</b><div class="muted small">${label}</div></div><div class="row" style="gap:7px;align-items:center"><span class="badge ${omission?'warn':''}">${omission?'Sin muestra':'Evaluado'}</span><button class="btn ghost small" onclick="requestTurnEdit(${turn})">${direct?'Corregir':'Corregir'}</button></div></div></article>`);
    }
    return rows.join('');
  }

  window.showPreviousTurns=function(){
    let p=current();if(!p)return;
    let end=lastResolvedTurn(p);
    modal(`<h3>Corregir turnos</h3><p><b>${p.name}</b></p><p class="muted">Puede corregir directamente el turno actual resuelto${end>Math.max(1,Number(p.entryTurn)||1)?' y el turno inmediatamente anterior':''}. Para turnos más antiguos necesita autorización del Analista.</p><div style="max-height:360px;overflow:auto">${personTurnRows(p)}</div><button class="btn ghost block" onclick="closeModal()">Cerrar</button>`);
  };

  window.requestTurnEdit=function(turn){
    let p=current();if(!p)return;
    if(canAssurerEditTurn(p,turn))return editPreviousTurn(turn);
    modal(`<h3>Turno ${turn} protegido</h3><p>Para poder corregir algo en este turno debe solicitar al <b>Analista</b> que lo habilite.</p><p class="muted">Los turnos más antiguos quedan protegidos para evitar modificaciones accidentales.</p><div class="row"><button class="btn primary" onclick="showPreviousTurns()">Entendido</button></div>`);
  };

  window.editPreviousTurn=function(turn){
    let p=current();if(!p)return;
    if(!canAssurerEditTurn(p,turn))return requestTurnEdit(turn);
    let omission=omissionAt(p,turn),evaluation=evaluationAt(p,turn),isEval=!omission,failures=evaluation&&Array.isArray(evaluation.failures)?evaluation.failures:[];
    modal(`<h3>Corregir turno ${turn}</h3><p><b>${p.name}</b></p><label class="label">Estado del turno</label><select id="edit-turn-state" class="input" onchange="toggleTurnCriteria()"><option value="evaluation" ${isEval?'selected':''}>Evaluación realizada</option><option value="noSample" ${!isEval?'selected':''}>No realizar muestra</option></select><div id="edit-turn-criteria" style="margin-top:14px;${isEval?'':'display:none'}"><h3 style="margin-bottom:4px">Ítems incumplidos</h3><p class="muted">Marque únicamente los ítems que <b>No cumplen</b>. Si no marca ninguno, todos los ítems se consideran cumplidos.</p><div class="checks">${criterionChecks(failures)}</div></div><p class="muted" style="margin-top:14px">Esta corrección no cambia el número de turno actual de la persona.</p><div class="row"><button class="btn ghost" onclick="showPreviousTurns()">Cancelar</button><button class="btn primary" onclick="savePreviousTurnCorrection(${turn})">Guardar corrección</button></div>`);
  };

  window.toggleTurnCriteria=function(){let box=document.querySelector('#edit-turn-criteria'),sel=document.querySelector('#edit-turn-state');if(box&&sel)box.style.display=sel.value==='evaluation'?'':'none'};

  window.savePreviousTurnCorrection=function(turn){
    let p=current();if(!p)return;
    if(!canAssurerEditTurn(p,turn))return requestTurnEdit(turn);
    if(typeof groupWeekReadOnly==='function'&&groupWeekReadOnly())return closeModal(),closedWeekMessage();
    ensureTurnEvents();let desired=document.querySelector('#edit-turn-state')?.value||'evaluation',failures=[...document.querySelectorAll('[name=edit-turn-crit]:checked')].map(x=>x.value),evaluation=evaluationAt(p,turn),omission=omissionAt(p,turn),wasEval=!omission;
    if(desired==='evaluation'){
      if(omission)state.sampleTurnOmissions=(state.sampleTurnOmissions||[]).filter(o=>o!==omission);
      if(!evaluation){evaluation={id:'e'+Date.now(),person:p.id,turn:Number(turn),failures:[],score:100,synced:false,date:new Date().toLocaleString('es-CO'),corrected:true};state.evals.push(evaluation)}
      evaluation.failures=failures;evaluation.score=Math.max(0,100-failures.length*8);evaluation.corrected=true;evaluation.correctedAt=new Date().toISOString();if(!wasEval){p.done=(Number(p.done)||0)+1;p.required=(Number(p.required)||0)+1;state.pending=(Number(state.pending)||0)+1}
    }else{
      if(evaluation)state.evals=(state.evals||[]).filter(e=>e!==evaluation);if(!omission)state.sampleTurnOmissions.push({week:state.currentWeek,person:p.id,turn:Number(turn),date:new Date().toISOString(),corrected:true});if(wasEval){p.done=Math.max(0,(Number(p.done)||0)-1);p.required=Math.max(p.done,(Number(p.required)||30)-1)}
    }
    save();let result=desired==='evaluation'?(failures.length?`Evaluación realizada · ${failures.length} ítem${failures.length===1?'':'s'} con incumplimiento`:'Evaluación realizada · todos los ítems cumplen'):'No realizar muestra';modal(`<h3>Turno ${turn} corregido</h3><p><b>${result}</b></p><p class="muted">La persona continúa en su turno operativo actual.</p><button class="btn primary block" onclick="closeModal();render()">Aceptar</button>`);
  };

  function decoratePreviousTurnButton(){
    if(state.role!=='monitor'||state.view!=='seguimiento')return;let p=current();if(!p||lastResolvedTurn(p)<Math.max(1,Number(p.entryTurn)||1))return;let hero=document.querySelector('.hero');if(!hero||hero.querySelector('#edit-previous-turn'))return;
    let btn=document.createElement('button');btn.id='edit-previous-turn';btn.className='btn ghost block';btn.style.marginTop='8px';btn.textContent='Corregir turno';btn.onclick=showPreviousTurns;hero.appendChild(btn);
  }
  const obs=new MutationObserver(()=>{clearTimeout(window.__previousTurnTimer);window.__previousTurnTimer=setTimeout(decoratePreviousTurnButton,0)});obs.observe(document.querySelector('#app'),{childList:true,subtree:true});setTimeout(decoratePreviousTurnButton,0);
})();
