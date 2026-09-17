// El seguimiento del Asegurador ya usa evaluaciones reales/locales del flujo actual.
// Conservamos la limpieza del texto demostrativo antiguo, pero NO eliminamos las
// tarjetas de evaluaciones: son necesarias para consultar registros recuperados de Azure.
function normalizeEvaluationHistorySection(){
  if(state.role!=='monitor'||state.view!=='seguimiento')return;
  const headings=[...document.querySelectorAll('h3')];
  const h=headings.find(e=>(e.textContent||'').trim().toLowerCase()==='evaluaciones registradas en la demo');
  if(!h)return;

  h.textContent='Evaluaciones registradas';

  // Quita únicamente el lenguaje de demostración de las tarjetas existentes.
  let node=h.nextElementSibling;
  while(node){
    if(node.classList&&node.classList.contains('eval')){
      const p=node.querySelector('p');
      if(p)p.innerHTML=p.innerHTML.replace(/\s*·\s*Resultado demostrativo\s*\d+%/i,'');
    }
    node=node.nextElementSibling;
  }
}
const removeDemoEvaluationsObserver=new MutationObserver(()=>{
  clearTimeout(window.__removeDemoEvaluationsTimer);
  window.__removeDemoEvaluationsTimer=setTimeout(normalizeEvaluationHistorySection,0);
});
removeDemoEvaluationsObserver.observe(document.querySelector('#app'),{childList:true,subtree:true});
setTimeout(normalizeEvaluationHistorySection,0);
