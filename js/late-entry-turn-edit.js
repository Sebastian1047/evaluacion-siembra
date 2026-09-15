// Ingreso tardío al grupo y corrección de turnos anteriores.
// Capa de prototipo: conserva el flujo existente y agrega estas reglas sin reescribir app.js.
(function(){
  function ensureTurnEvents(){
    if(!state.turnEvents)state.turnEvents=[];
    (state.evals||[]).forEach(e=>{
      if(e.turn==null){
        let p=(state.people||[]).find(x=>x.id===e.person);
        let same=(state.evals||[]).filter(x=>x.person===e.person);
        let idx=same.indexOf(e);
        e.turn=idx>=0?idx+1:null;
      }
    });
  }
  ensureTurnEvents();

  // Al agregar una persona con la semana avanzada, entra al menor turno resuelto del grupo.
  if(typeof addWorker==='function'){
    const addWorkerBeforeLateEntry=addWorker;
    addWorker=function(id){
      if(typeof groupWeekReadOnly==='function'&&groupWeekReadOnly())return closedWeekMessage();
      let existing=(state.people||[]).slice();
      let inherited=0;
      if(existing.length){
        if(typeof ensureSampleTurns==='function')ensureSampleTurns();
        inherited=Math.min(...existing.map(p=>Number(p.sampleTurn)||0));
      }
      let candidate=(state.available||[]).find(x=>x.id===id);
      addWorkerBeforeLateEntry(id);
      let added=(state.people||[]).find(x=>x.id===id)||(candidate&&(state.people||[]).find(x=>x.name===candidate.name&&x.doc===candidate.doc));
      if(added){
        added.sampleTurn=inherited;
        added.entryTurn=inherited+1;
        added.originalRequired=30;
        added.required=Math.max(0,30-inherited);
        added.done=Number(added.done)||0;
        save();render();
        if(inherited>0)toast(added.name+' se incorpora al turno '+(inherited+1));
      }
    };
  }

  // Las evaluaciones nuevas conservan explícitamente el turno en que ocurrieron.
  if(typeof commitEval==='function'){
    const commitEvalBeforeTurnNumber=commitEval;
    commitEval=function(ids){
      let p=current();if(!p)return commitEvalBeforeTurnNumber(ids);
      let expected=(Number(p.sampleTurn)||0)+1;
      let before=(state.evals||[]).length;
      let result=commitEvalBeforeTurnNumber(ids);
      let created=(state.evals||[]).slice(before).find(e=>e.person===p.id);
      if(created&&created.turn==null){created.turn=expected;save()}
      return result;
    };
  }

  function personTurnRows(p){
    ensureTurnEvents();
    let start=Math.max(1,Number(p.entryTurn)||1),end=Number(p.sampleTurn)||0;
    if(end<start)return '<div class="card muted">Todavía no hay turnos resueltos para esta persona.</div>';
    let rows=[];
    for(let turn=end;turn>=start;turn--){
      let omission=(state.sampleTurnOmissions||[]).find(o=>o.week===state.currentWeek&&o.person===p.id&&Number(o.turn)===turn);
      let evaluation=(state.evals||[]).find(e=>e.person===p.id&&Number(e.turn)===turn);
      let type=omission?'noSample':'evaluation';
      let label=omission?'No realizar muestra':'Evaluación realizada';
      let badge=omission?'warn':'';
      rows.push(`<article class="card" style="padding:10px 12px;margin-bottom:7px"><div class="row between" style="gap:10px"><div><b>Turno ${turn}</b><div class="muted small">${label}</div></div><div class="row" style="gap:7px;align-items:center"><span class="badge ${badge}">${omission?'Sin muestra':'Evaluado'}</span><button class="btn ghost small" onclick="editPreviousTurn(${turn},'${type}')">Corregir</button></div></div></article>`);
    }
    return rows.join('');
  }

  window.showPreviousTurns=function(){
    let p=current();if(!p)return;
    modal(`<h3>Corregir turno anterior</h3><p><b>${p.name}</b></p><p class="muted">Puede revisar un turno ya resuelto y cambiarlo entre <b>Evaluación realizada</b> y <b>No realizar muestra</b>. Esto no cambia el turno actual de la persona.</p><div style="max-height:360px;overflow:auto">${personTurnRows(p)}</div><button class="btn ghost block" onclick="closeModal()">Cerrar</button>`);
  };

  window.editPreviousTurn=function(turn,type){
    let p=current();if(!p)return;
    let isEval=type==='evaluation';
    modal(`<h3>Corregir turno ${turn}</h3><p><b>${p.name}</b></p><p>Estado actual: <b>${isEval?'Evaluación realizada':'No realizar muestra'}</b></p><p class="muted">El turno ${turn} seguirá siendo un turno resuelto y el consecutivo actual no cambiará.</p><div class="card" style="margin:12px 0"><b>Cambiar estado a</b><p style="margin-bottom:0">${isEval?'No realizar muestra':'Evaluación realizada'}</p></div><div class="row"><button class="btn ghost" onclick="showPreviousTurns()">Cancelar</button><button class="btn primary" onclick="confirmPreviousTurnChange(${turn},'${type}')">Guardar corrección</button></div>`);
  };

  window.confirmPreviousTurnChange=function(turn,type){
    let p=current();if(!p)return;
    if(typeof groupWeekReadOnly==='function'&&groupWeekReadOnly())return closeModal(),closedWeekMessage();
    ensureTurnEvents();
    if(type==='evaluation'){
      let idx=(state.evals||[]).findIndex(e=>e.person===p.id&&Number(e.turn)===Number(turn));
      if(idx>=0)state.evals.splice(idx,1);
      if(!(state.sampleTurnOmissions||[]).some(o=>o.week===state.currentWeek&&o.person===p.id&&Number(o.turn)===Number(turn))){
        state.sampleTurnOmissions.push({week:state.currentWeek,person:p.id,turn:Number(turn),date:new Date().toISOString(),corrected:true});
      }
      p.done=Math.max(0,(Number(p.done)||0)-1);
      p.required=Math.max(p.done,(Number(p.required)||30)-1);
    }else{
      state.sampleTurnOmissions=(state.sampleTurnOmissions||[]).filter(o=>!(o.week===state.currentWeek&&o.person===p.id&&Number(o.turn)===Number(turn)));
      state.evals.push({id:'e'+Date.now(),person:p.id,turn:Number(turn),failures:[],score:100,synced:false,date:new Date().toLocaleString('es-CO'),corrected:true});
      p.done=(Number(p.done)||0)+1;
      p.required=(Number(p.required)||0)+1;
      state.pending=(Number(state.pending)||0)+1;
    }
    save();
    modal(`<h3>Turno ${turn} corregido</h3><p>El estado fue cambiado a <b>${type==='evaluation'?'No realizar muestra':'Evaluación realizada'}</b>.</p><p class="muted">La persona continúa en su turno operativo actual.</p><button class="btn primary block" onclick="closeModal();render()">Aceptar</button>`);
  };

  function decoratePreviousTurnButton(){
    if(state.role!=='monitor'||state.view!=='seguimiento')return;
    let p=current();if(!p||(Number(p.sampleTurn)||0)<(Number(p.entryTurn)||1))return;
    let hero=document.querySelector('.hero');if(!hero||hero.querySelector('#edit-previous-turn'))return;
    let btn=document.createElement('button');btn.id='edit-previous-turn';btn.className='btn ghost block';btn.style.marginTop='8px';btn.textContent='Corregir turno anterior';btn.onclick=showPreviousTurns;hero.appendChild(btn);
  }
  const obs=new MutationObserver(()=>{clearTimeout(window.__previousTurnTimer);window.__previousTurnTimer=setTimeout(decoratePreviousTurnButton,0)});
  obs.observe(document.querySelector('#app'),{childList:true,subtree:true});
  setTimeout(decoratePreviousTurnButton,0);
})();
