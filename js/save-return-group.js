// Al guardar una evaluación individual, regresar siempre al listado del grupo.
// Este módulo define una utilidad global; offline-sync la invoca después del guardado.
window.returnToAssurerGroupAfterSave=function(){
  state.selectedPerson=null;
  state.evalId=null;
  state.view='grupo';
  save();
  render();
};

function decorateSaveEvaluationButton(){
  if(state.role!=='monitor'||state.view!=='nueva')return;
  document.querySelectorAll('button').forEach(b=>{
    if((b.textContent||'').trim().toLowerCase()==='guardar evaluación')b.textContent='Guardar evaluación y regresar al grupo';
  });
}
const saveReturnGroupObserver=new MutationObserver(()=>{clearTimeout(window.__saveReturnGroupTimer);window.__saveReturnGroupTimer=setTimeout(decorateSaveEvaluationButton,0)});
saveReturnGroupObserver.observe(document.querySelector('#app'),{childList:true,subtree:true});
setTimeout(decorateSaveEvaluationButton,0);
