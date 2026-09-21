// Persiste en Azure la incorporación y reincorporación de sembradores.
(function(){
  const localAddWorker=window.addWorker;
  window.addWorker=async function(id){
    const i=state.available.findIndex(x=>x.id===id);if(i<0)return;const candidate=state.available[i];
    if(!window.SiembraApi||typeof SiembraApi.addParticipant!=='function')return toast('No se pudo conectar con Azure. El sembrador no fue agregado.');
    let semanaId=Number(state.currentAzureWeekId)||0;
    try{
      if(!semanaId){const azureWeek=await SiembraApi.getWeek(state.currentYear||2026,state.currentWeek);semanaId=Number(azureWeek.IdSemana)||0;if(!semanaId)throw new Error('La semana no tiene IdSemana');state.currentAzureWeekId=semanaId;save();}
      const turnoOperativo=state.people.length&&typeof window.currentGroupSampleTurn==='function'?currentGroupSampleTurn():Math.max(1,Number(state.weekOperationalSampleTurn)||1);

      if(candidate.removedFromWeek&&Number(candidate.azureParticipationId)){
        if(typeof SiembraApi.changeParticipantState!=='function'||typeof SiembraApi.getOperationalState!=='function')throw new Error('API de reincorporación no disponible');
        const participationId=Number(candidate.azureParticipationId);
        await SiembraApi.changeParticipantState(participationId,'EN_LA_SEMANA',turnoOperativo);
        const operationalRows=await SiembraApi.getOperationalState(semanaId);
        const rows=(Array.isArray(operationalRows)?operationalRows:[]).filter(row=>Number(row.IdParticipacion)===participationId);
        if(!rows.length)throw new Error('Azure no devolvió el estado de la participación reincorporada');
        const first=rows[0];const resolutions=new Map();
        for(const row of rows)if(row.IdResolucion!=null&&!resolutions.has(String(row.IdResolucion)))resolutions.set(String(row.IdResolucion),{turno:Number(row.NumeroTurno)||0,tipo:String(row.Tipo||'')});
        const resolved=[...resolutions.values()];const done=resolved.filter(r=>r.tipo==='EVALUACION').length;const omitted=resolved.filter(r=>r.tipo==='NO_REALIZADA').length;
        localAddWorker(id);const added=state.people.find(p=>String(p.doc)===String(candidate.doc));if(!added)throw new Error('No se encontró el sembrador reincorporado localmente');
        added.azureParticipationId=participationId;
        added.turnoInicio=Number(first.TurnoInicio)||1;
        added.ultimoTurnoIncorporacion=turnoOperativo;
        added.done=done;added.originalRequired=30;
        // Al reincorporarse en N queda habilitado para resolver N. No inventamos
        // resoluciones N-1, N-2...: sampleTurn=N-1 es solo el cursor operativo local.
        added.sampleTurn=Math.max(0,turnoOperativo-1);
        added.required=typeof refreshEffectiveEvaluationTarget==='function'?refreshEffectiveEvaluationTarget(added):Math.max(done,30-added.sampleTurn+done);
        delete added.removedFromWeek;
        state.weekOperationalSampleTurn=Math.max(Number(state.weekOperationalSampleTurn)||1,turnoOperativo);
        save();render();return toast(candidate.name+' se reincorporó en el turno '+turnoOperativo);
      }

      // Puede existir ya en Azure aunque el estado local del navegador lo muestre como disponible
      // (por ejemplo, tras recargar una semana después de un cambio de caché). Reutilizamos esa
      // participación en vez de intentar insertar un duplicado.
      let participant;
      const existing=typeof SiembraApi.getParticipants==='function'
        ? (await SiembraApi.getParticipants(semanaId)).find(x=>String(x.SembradorCorporativoId)===String(candidate.doc))
        : null;
      if(existing){
        participant=existing;
        if(existing.Estado==='QUITADO_TEMPORALMENTE'){
          if(typeof SiembraApi.changeParticipantState!=='function')throw new Error('API de reincorporación no disponible');
          await SiembraApi.changeParticipantState(Number(existing.IdParticipacion),'EN_LA_SEMANA',turnoOperativo);
        }
      }else{
        participant=await SiembraApi.addParticipant(semanaId,{sembradorId:String(candidate.doc),turnoInicio:turnoOperativo});
      }
      localAddWorker(id);const added=state.people.find(p=>String(p.doc)===String(candidate.doc));
      if(added){added.azureParticipationId=participant.IdParticipacion;added.turnoInicio=Number(participant.TurnoInicio)||turnoOperativo;added.ultimoTurnoIncorporacion=turnoOperativo;added.sampleTurn=Math.max(0,turnoOperativo-1);added.required=typeof refreshEffectiveEvaluationTarget==='function'?refreshEffectiveEvaluationTarget(added):Math.max(Number(added.done)||0,30-added.sampleTurn+(Number(added.done)||0));state.weekOperationalSampleTurn=turnoOperativo;save();render();}
    }catch(error){console.error('No fue posible agregar/reincorporar el sembrador en Azure.',error);toast('No se pudo guardar el sembrador en Azure. El grupo no fue modificado.');}
  };
})();