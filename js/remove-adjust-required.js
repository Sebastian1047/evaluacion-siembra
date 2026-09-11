// El ajuste manual de evaluaciones requeridas ya no forma parte del flujo.
// La meta efectiva solo cambia mediante las reglas vigentes, como "No realizar muestra".
function removeAdjustRequiredButton(){
  if(state.role!=='monitor'||state.view!=='seguimiento')return;
  document.querySelectorAll('button').forEach(b=>{
    if((b.textContent||'').trim().toLowerCase()==='ajustar evaluaciones requeridas')b.remove();
  });
}
const removeAdjustRequiredObserver=new MutationObserver(()=>{clearTimeout(window.__removeAdjustRequiredTimer);window.__removeAdjustRequiredTimer=setTimeout(removeAdjustRequiredButton,0)});
removeAdjustRequiredObserver.observe(document.querySelector('#app'),{childList:true,subtree:true});
setTimeout(removeAdjustRequiredButton,0);
