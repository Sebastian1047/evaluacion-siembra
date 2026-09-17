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

        // localAddWorker crea un objeto nuevo con los valores iniciales (0/30, turno 0).
        // Por eso guardamos primero el historial reconstruido de Azure y lo aplicamos
        // al objeto que acaba de incorporarse.
        const restored={
          azureParticipationId:Number(candidate.azureParticipationId),
          turnoInicio:candidate.turnoInicio,
          done:Number(candidate.done)||0,
          required:Number.isFinite(Number(candidate.required))?Number(candidate.required):30,
          originalRequired:Number.isFinite(Number(candidate.originalRequired))?Number(candidate.originalRequired):30,
          sampleTurn:Number(candidate.sampleTurn)||0
        };

        localAddWorker(id);
        const added=state.people.find(p=>String(p.doc)===String(candidate.doc));
        if(!added)throw new Error('No se encontró el sembrador reincorporado en el grupo local');

        added.azureParticipationId=restored.azureParticipationId;
        added.turnoInicio=restored.turnoInicio;
        added.done=restored.done;
        added.required=restored.required;
        added.originalRequired=restored.originalRequired;
        added.sampleTurn=restored.sampleTurn;
        delete added.removedFromWeek;
        save();
        render();
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