// Permite corregir el grupo semanal cuando se agregó un sembrador por error.
(function(){
  const originalPersonCard = window.personCard;

  window.personCard = function(p){
    let pc=Math.min(100,Math.round(p.done/p.required*100));
    let turn=typeof p.sampleTurn==='number'?p.sampleTurn:(Number(p.done)||0);
    return `<article class="card person" data-name="${p.name.toLowerCase()}" onclick="openPerson('${p.id}')" style="padding:9px 12px;margin-bottom:7px">
      <div class="row between" style="gap:8px;align-items:center;min-height:28px">
        <b style="line-height:1.15">${p.name}</b>
        <span class="badge ${pc<100?'warn':''}" style="padding:3px 7px;font-size:11px">${pc===100?'Completado':'En proceso'}</span>
      </div>
      <div style="display:grid;grid-template-columns:auto auto 1fr;gap:8px;align-items:center;margin-top:5px;font-size:12px;line-height:1.15">
        <span><b>${p.done}/${p.required}</b> evaluaciones</span>
        <button class="btn danger small" style="margin:0;padding:4px 7px;min-height:0;font-size:11px;line-height:1.1" onclick="event.stopPropagation();confirmRemoveWorker('${p.id}')">Quitar de la semana</button>
        <span class="muted" style="text-align:right;white-space:nowrap">Turno resuelto: <b>${turn}</b></span>
      </div>
      <div class="progress" style="margin-top:5px;height:4px"><span style="width:${pc}%"></span></div>
    </article>`;
  };

  window.confirmRemoveWorker = function(id){
    const p=state.people.find(x=>x.id===id);
    if(!p)return;
    modal(`<h3>Quitar sembrador de la semana</h3>
      <p>¿Desea quitar a <b>${p.name}</b> del grupo de evaluación de la Semana ${state.currentWeek}?</p>
      <p class="muted">El trabajador dejará de aparecer en esta semana y podrá volver a agregarse después si fue retirado por error.</p>
      <div class="row">
        <button class="btn ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn danger" onclick="removeWorkerFromGroup('${p.id}')">Quitar de la semana</button>
      </div>`);
  };

  window.removeWorkerFromGroup = function(id){
    const i=state.people.findIndex(x=>x.id===id);
    if(i<0)return;
    const p=state.people.splice(i,1)[0];
    if(!state.available.some(x=>x.id===p.id)){
      state.available.push({id:p.id,name:p.name,doc:p.doc});
    }
    save();
    closeModal();
    state.view='grupo';
    render();
    toast(p.name+' fue quitado de la semana');
  };
})();
