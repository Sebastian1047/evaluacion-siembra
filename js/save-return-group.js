// En el flujo individual, al guardar una evaluación se regresa directamente al grupo.
function decorateSaveEvaluationButton(){
  if(state.role!=='monitor'||state.view!=='nueva')return;
  document.querySelectorAll('button').forEach(b=>{
    if((b.textContent||'').trim().toLowerCase()==='guardar evaluación')b.textContent='Guardar evaluación y regresar al grupo';
  });
}

// Conserva toda la lógica existente de commitEval (incluido el control de turno)
// y cambia únicamente el destino final de navegación cuando el guardado fue exitoso.
const commitEvalBeforeReturnGroup=commitEval;
commitEval=function(ids){
  let p=current(),beforeDone=p?Number(p.done):null;
  let result=commitEvalBeforeReturnGroup(ids);
  if(p&&Number(p.done)>beforeDone){
    state.view='grupo';
    save();
    render();
  }
  return result;
};

const saveReturnGroupObserver=new MutationObserver(()=>{clearTimeout(window.__saveReturnGroupTimer);window.__saveReturnGroupTimer=setTimeout(decorateSaveEvaluationButton,0)});
saveReturnGroupObserver.observe(document.querySelector('#app'),{childList:true,subtree:true});
setTimeout(decorateSaveEvaluationButton,0);
