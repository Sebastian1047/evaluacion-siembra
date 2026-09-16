// Persiste una evaluación individual en Azure antes de aplicar el cambio local.
// Se carga después de person-sample-turns para conservar todas sus reglas de turno.
(function(){
  const commitEvalWithTurnRules=window.commitEval;

  window.commitEval=async function(ids){
    const p=current();
    if(!p)return commitEvalWithTurnRules(ids);

    if(!p.azureParticipationId){
      return toast('Esta participación no está vinculada con Azure. No se guardó la evaluación.');
    }
    if(!window.SiembraApi||typeof SiembraApi.resolveTurn!=='function'){
      return toast('No se pudo conectar con Azure. No se guardó la evaluación.');
    }
    if(window.SiembraCriteriaSource!=='azure'){
      return toast('Los criterios no provienen de Azure. No se guardó la evaluación.');
    }

    // La misma regla que ya usa person-sample-turns determina el turno a resolver.
    const info=typeof canAdvancePerson==='function' ? canAdvancePerson(p) : {ok:true,next:(Number(p.sampleTurn)||0)+1};
    if(!info.ok){
      if(typeof showTurnBlock==='function')return showTurnBlock(p,info);
      return;
    }

    const itemIds=[];
    for(const code of ids){
      const itemId=Number(window.SiembraAzureItemIds?.[String(code)]);
      if(!itemId){
        console.error('No existe IdItem Azure para el criterio',code);
        return toast('No se pudo identificar un criterio en Azure. No se guardó la evaluación.');
      }
      itemIds.push(itemId);
    }

    try{
      const result=await SiembraApi.resolveTurn(p.azureParticipationId,info.next,{
        tipo:'EVALUACION',
        incumplimientos:itemIds,
        // Identificador temporal del login de pruebas. La autenticación corporativa lo sustituirá.
        usuarioCorporativoId:'asegurador-prueba'
      });

      const beforeCount=state.evals.length;
      commitEvalWithTurnRules(ids);

      // El flujo local existente crea el registro visual; ahora sabemos que ya está persistido.
      const created=state.evals.length>beforeCount ? state.evals[state.evals.length-1] : null;
      if(created){
        created.synced=true;
        created.azureResolutionId=result.idResolucion;
        created.week=state.currentWeek;
        state.pending=Math.max(0,(Number(state.pending)||0)-1);
        save();
      }
      render();
      toast('Evaluación guardada y sincronizada con Azure');
    }catch(error){
      console.error('No fue posible guardar la evaluación en Azure.',error);
      toast('No se pudo guardar la evaluación en Azure. No se modificaron los datos locales.');
    }
  };
})();
