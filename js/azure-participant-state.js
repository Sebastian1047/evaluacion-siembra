// Gestiona el retiro temporal de un sembrador de la semana.
// Azure se confirma primero; solo después se modifica el estado local.
(function(){
  window.confirmRemoveWorker=function(id){
    const p=state.people.find(x=>x.id===id);
    if(!p)return;
    modal(`<h3>Quitar sembrador de la semana</h3>
      <p>¿Desea quitar a <b>${p.name}</b> del grupo de evaluación de la Semana ${state.currentWeek}?</p>
      <p class="muted">Sus turnos y evaluaciones se conservarán. Si fue retirado por error, podrá restaurarse posteriormente.</p>
      <div class="row">
        <button class="btn ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn danger" onclick="removeWorkerFromGroup('${p.id}')">Quitar de la semana</button>
      </div>`);
  };

  window.removeWorkerFromGroup=async function(id){
    const i=state.people.findIndex(x=>x.id===id);
    if(i<0)return;
    const p=state.people[i];
    const participationId=Number(p.azureParticipationId)||0;

    if(!participationId || !window.SiembraApi || typeof SiembraApi.changeParticipantState!=='function'){
      return toast('No se pudo identificar la participación en Azure. No se quitó al sembrador.');
    }

    try{
      await SiembraApi.changeParticipantState(participationId,'QUITADO_TEMPORALMENTE');

      // Solo después de la confirmación del servidor se retira de la lista activa local.
      state.people.splice(i,1);
      if(!state.available.some(x=>x.id===p.id)){
        state.available.push({
          id:p.id,
          name:p.name,
          doc:p.doc,
          azureParticipationId:participationId,
          removedFromWeek:true
        });
      }
      save();
      closeModal();
      state.view='grupo';
      render();
      toast(p.name+' fue quitado de la semana');
    }catch(error){
      console.error('No fue posible quitar el sembrador en Azure.',error);
      toast('No se pudo guardar el cambio en Azure. El sembrador permanece en la semana.');
    }
  };
})();