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
      // Se reactiva esa misma participación y se reconstruye su estado operativo
      // desde Azure, que es la fuente de verdad de sus turnos y evaluaciones.
      if(candidate.removedFromWeek && Number(candidate.azureParticipationId)){
        if(typeof SiembraApi.changeParticipantState!=='function')throw new Error('API de estado no disponible');
        if(typeof SiembraApi.getOperationalState!=='function')throw new Error('API de estado operativo no disponible');

        const participationId=Number(candidate.azureParticipationId);
        await SiembraApi.changeParticipantState(participationId,'EN_LA_SEMANA');

        const operationalRows=await SiembraApi.getOperationalState(semanaId);
        const rows=(Array.isArray(operationalRows)?operationalRows:[])
          .filter(row=>Number(row.IdParticipacion)===participationId);
        if(!rows.length)throw new Error('Azure no devolvió el estado de la participación restaurada');

        const first=rows[0];
        const resolutions=new Map();
        for(const row of rows){
          if(row.IdResolucion!=null && !resolutions.has(String(row.IdResolucion))){
            resolutions.set(String(row.IdResolucion),{
              turno:Number(row.NumeroTurno)||0,
              tipo:String(row.Tipo||'')
            });
          }
        }
        const resolved=[...resolutions.values()];
        const done=resolved.filter(r=>r.tipo==='EVALUACION').length;
        const omitted=resolved.filter(r=>r.tipo==='NO_REALIZADA').length;
        const sampleTurn=resolved.length
          ? Math.max(...resolved.map(r=>r.turno))
          : Math.max(0,(Number(first.TurnoInicio)||1)-1);

        localAddWorker(id);
        const added=state.people.find(p=>String(p.doc)===String(candidate.doc));
        if(!added)throw new Error('No se encontró el sembrador reincorporado en el grupo local');

        added.azureParticipationId=participationId;
        added.turnoInicio=Number(first.TurnoInicio)||1;
        added.done=done;
        added.originalRequired=30;
        added.required=Math.max(0,30-omitted);
        added.sampleTurn=sampleTurn;
        delete added.removedFromWeek;

        // Nunca retroceder el turno operativo de la semana al restaurar a alguien.
        state.weekOperationalSampleTurn=Math.max(
          Number(state.weekOperationalSampleTurn)||1,
          sampleTurn+1
        );
        save();
        render();
        return toast(candidate.name+' volvió a la semana con su estado restaurado');
      }

      // El turno operativo pertenece a la semana, no al número de evaluaciones
      // que tenga una persona recién incorporada. Si el grupo está vacío usamos
      // weekOperationalSampleTurn; si ya hay participantes, currentGroupSampleTurn.
      const turnoInicio=state.people.length
        ? (typeof window.currentGroupSampleTurn==='function'?currentGroupSampleTurn():Math.max(1,Number(state.weekOperationalSampleTurn)||1))
        : Math.max(1,Number(state.weekOperationalSampleTurn)||1);

      const participant=await SiembraApi.addParticipant(semanaId,{
        sembradorId:String(candidate.doc),
        turnoInicio
      });

      // Solo después de confirmar Azure se aplica el alta local.
      localAddWorker(id);
      const added=state.people.find(p=>p.id===candidate.id);
      if(added){
        added.azureParticipationId=participant.IdParticipacion;
        added.turnoInicio=Number(participant.TurnoInicio)||turnoInicio;
        // sampleTurn representa el último turno resuelto. Una incorporación tardía
        // que comienza en el turno N aún no ha resuelto N, por lo que parte en N-1.
        added.sampleTurn=Math.max(0,added.turnoInicio-1);
        state.weekOperationalSampleTurn=turnoInicio;
        save();
        render();
      }
    }catch(error){
      console.error('No fue posible agregar/restaurar el sembrador en Azure.',error);
      toast('No se pudo guardar el sembrador en Azure. El grupo no fue modificado.');
    }
  };
})();