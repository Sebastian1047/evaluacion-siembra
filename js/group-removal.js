// Permite corregir el grupo semanal cuando se agregó un sembrador por error.
(function(){
  const originalPersonCard = window.personCard;

  window.personCard = function(p){
    let pc=Math.min(100,Math.round(p.done/p.required*100));
    return `<article class="card person" data-name="${p.name.toLowerCase()}" onclick="openPerson('${p.id}')">
      <div class="row between">
        <b>${p.name}</b>
        <span class="badge ${pc<100?'warn':''}">${pc===100?'Completado':'En proceso'}</span>
      </div>
      <div class="row between"><span>${p.done} / ${p.required} evaluaciones</span><b>${pc}%</b></div>
      <div class="progress"><span style="width:${pc}%"></span></div>
      <button class="btn danger small" style="margin-top:12px" onclick="event.stopPropagation();confirmRemoveWorker('${p.id}')">Quitar del grupo</button>
    </article>`;
  };

  window.confirmRemoveWorker = function(id){
    const p=state.people.find(x=>x.id===id);
    if(!p)return;
    modal(`<h3>Quitar sembrador del grupo</h3>
      <p>¿Desea quitar a <b>${p.name}</b> del grupo de evaluación de la Semana ${state.currentWeek}?</p>
      <p class="muted">El trabajador dejará de aparecer en el grupo y podrá volver a agregarse después si fue retirado por error.</p>
      <div class="row">
        <button class="btn ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn danger" onclick="removeWorkerFromGroup('${p.id}')">Quitar del grupo</button>
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
    toast(p.name+' fue quitado del grupo');
  };
})();
