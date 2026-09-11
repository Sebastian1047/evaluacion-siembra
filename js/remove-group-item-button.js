// El flujo de evaluación actual es individual por sembrador.
// Retira únicamente el acceso antiguo "Evaluar grupo por ítems" de la pantalla Grupo.
function removeGroupItemEvaluationButton(){
  if(state.role!=='monitor'||state.view!=='grupo')return;
  document.querySelectorAll('button').forEach(b=>{
    if((b.textContent||'').trim().toLowerCase()==='evaluar grupo por ítems')b.remove();
  });
}
const removeGroupItemObserver=new MutationObserver(()=>{clearTimeout(window.__removeGroupItemTimer);window.__removeGroupItemTimer=setTimeout(removeGroupItemEvaluationButton,0)});
removeGroupItemObserver.observe(document.querySelector('#app'),{childList:true,subtree:true});
setTimeout(removeGroupItemEvaluationButton,0);
