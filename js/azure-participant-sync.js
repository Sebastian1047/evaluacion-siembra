// Persiste en Azure la incorporación de sembradores sin alterar el flujo visual existente.
(function(){
  const localAddWorker = window.addWorker;

  window.addWorker = async function(id){
    const i=state.available.findIndex(x=>x.id===id);
    if(i<0)return;
    const candidate=state.available[i];

    if(!window.SiembraApi || typeof SiembraApi.addParticipant!=='function'){
      return toast('No se pudo conectar con Azure. El sembrador no fue agregado.');
    }

    let semanaId=Number(state.currentAzureWeekId)||0;
    try{
      // Semanas creadas antes de guardar currentAzureWeekId pueden recuperar su Id sin modificar datos locales.
      if(!semanaId){
        const azureWeek=await SiembraApi.getWeek(state.currentYear||2026,state.currentWeek);
        semanaId=Number(azureWeek.IdSemana)||0;
        if(!semanaId)throw new Error('La semana no tiene IdSemana');
        state.currentAzureWeekId=semanaId;
        save();
      }

      // Un sembrador quitado temporalmente ya tiene participación semanal.
      // Se reactiva esa misma participación para conservar turnos, evaluaciones y omisiones.
      if(candidate.removedFromWeek && Number(candidate.azureParticipationId)){
        if(typeof SiembraApi.changeParticipantState!=='function')throw new Error('API de estado no disponible');
        await SiembraApi.changeParticipantState(Number(candidate.azureParticipationId),'EN_LA_SEMANA');

        localAddWorker(id);
        const added=state.people.find(p=>p.id===candidate.id);
        if(added){
          added.azureParticipationId=Number(candidate.azureParticipationId);
          added.turnoInicio=candidate.turnoInicio;
          if(Number.isFinite(Number(candidate.done)))added.done=Number(candidate.done);
          if(Number.isFinite(Number(candidate.required)))added.required=Number(candidate.required);
          if(Number.isFinite(Number(candidate.originalRequired)))added.originalRequired=Number(candidate.originalRequired);
          if(Number.isFinite(Number(candidate.sampleTurn)))added.sampleTurn=Number(candidate.sampleTurn);
          save();
        }
        return toast(candidate.name+' volvió a la semana');
      }

      const turnoInicio=typeof window.currentGroupSampleTurn==='function'
        ? currentGroupSampleTurn()
        : 1;
      const participant=await SiembraApi.addParticipant(semanaId,{
        sembradorId:String(candidate.doc),
        turnoInicio
      });

      // Solo después de confirmar Azure se aplica la misma alta local que ya funcionaba.
      localAddWorker(id);
      const added=state.people.find(p=>p.id===candidate.id);
      if(added){
        added.azureParticipationId=participant.IdParticipacion;
        added.turnoInicio=participant.TurnoInicio;
        save();
      }
    }catch(error){
      console.error('No fue posible agregar/restaurar el sembrador en Azure.',error);
      toast('No se pudo guardar el sembrador en Azure. El grupo no fue modificado.');
    }
  };
})();