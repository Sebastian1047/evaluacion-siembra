// El Asegurador solo necesita recoger la información del turno actual.
// Oculta la sección antigua "Evaluaciones registradas en la demo" del seguimiento individual.
function removeDemoEvaluationsSection(){
  if(state.role!=='monitor'||state.view!=='seguimiento')return;
  const headings=[...document.querySelectorAll('h3')];
  const h=headings.find(e=>(e.textContent||'').trim().toLowerCase()==='evaluaciones registradas en la demo');
  if(!h)return;
  let node=h.nextSibling;
  while(node){let next=node.nextSibling;node.remove();node=next}
  h.remove();
}
const removeDemoEvaluationsObserver=new MutationObserver(()=>{clearTimeout(window.__removeDemoEvaluationsTimer);window.__removeDemoEvaluationsTimer=setTimeout(removeDemoEvaluationsSection,0)});
removeDemoEvaluationsObserver.observe(document.querySelector('#app'),{childList:true,subtree:true});
setTimeout(removeDemoEvaluationsSection,0);
