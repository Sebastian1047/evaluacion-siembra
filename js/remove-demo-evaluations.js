// El seguimiento del Asegurador ya usa evaluaciones reales/locales del flujo actual.
// Conservamos las tarjetas de evaluaciones recuperadas y retiramos únicamente
// elementos heredados del prototipo demostrativo.
function normalizeEvaluationHistorySection(){
  if(state.role!=='monitor')return;

  if(state.view==='seguimiento'){
    const headings=[...document.querySelectorAll('h3')];
    const h=headings.find(e=>(e.textContent||'').trim().toLowerCase()==='evaluaciones registradas en la demo');
    if(h){
      h.textContent='Evaluaciones registradas';
      let node=h.nextElementSibling;
      while(node){
        if(node.classList&&node.classList.contains('eval')){
          const p=node.querySelector('p');
          if(p)p.innerHTML=p.innerHTML.replace(/\s*·\s*Resultado demostrativo\s*\d+%/i,'');
        }
        node=node.nextElementSibling;
      }
    }
  }

  if(state.view==='detalle'){
    // El porcentaje 100 - 8% por incumplimiento era solo una simulación y no
    // representa ninguna fórmula válida del proceso real.
    const demoLabel=[...document.querySelectorAll('.muted')].find(e=>(e.textContent||'').trim().toLowerCase()==='resultado demostrativo');
    if(demoLabel){
      const demoCard=demoLabel.closest('.card');
      if(demoCard)demoCard.remove();
    }

    // La anulación demostrativa no forma parte del flujo real. Las correcciones
    // se gestionan mediante el control de corrección de turnos.
    const demoAnnul=[...document.querySelectorAll('button')].find(b=>/anular evaluación\s*\(demo\)/i.test((b.textContent||'').trim()));
    if(demoAnnul)demoAnnul.remove();
  }
}
const removeDemoEvaluationsObserver=new MutationObserver(()=>{
  clearTimeout(window.__removeDemoEvaluationsTimer);
  window.__removeDemoEvaluationsTimer=setTimeout(normalizeEvaluationHistorySection,0);
});
removeDemoEvaluationsObserver.observe(document.querySelector('#app'),{childList:true,subtree:true});
setTimeout(normalizeEvaluationHistorySection,0);
