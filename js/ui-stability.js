// Normalización visual final del Asegurador.
// Se carga al final para que el HTML base del prototipo no vuelva a mostrar
// componentes antiguos después de renderizar o recargar la aplicación.
(function(){
  let applying=false;

  function normalizeMonitorUI(){
    if(applying||!window.state||state.role!=='monitor')return;
    applying=true;
    try{
      // El Asegurador no necesita navegación a Historial/Evaluar.
      document.querySelectorAll('nav.bottom').forEach(n=>n.remove());

      if(state.view==='grupo'){
        document.querySelectorAll('#people .person').forEach(card=>{
          const onclick=card.getAttribute('onclick')||'';
          const match=onclick.match(/openPerson\('([^']+)'\)/);
          const p=match ? (state.people||[]).find(x=>x.id===match[1]) : null;
          if(!p)return;
          const pc=Math.min(100,Math.round((Number(p.done)||0)/Math.max(1,Number(p.required)||30)*100));
          const turn=typeof p.sampleTurn==='number'?p.sampleTurn:(Number(p.done)||0);
          card.style.cssText='padding:9px 12px;margin-bottom:7px';
          card.innerHTML=`
            <div class="row between" style="gap:8px;align-items:center;min-height:28px">
              <b style="line-height:1.15">${p.name}</b>
              <span class="badge ${pc<100?'warn':''}" style="padding:3px 7px;font-size:11px">${pc===100?'Completado':'En proceso'}</span>
            </div>
            <div style="display:grid;grid-template-columns:auto auto 1fr;gap:8px;align-items:center;margin-top:5px;font-size:12px;line-height:1.15">
              <span><b>${p.done}/${p.required}</b> evaluaciones</span>
              <button class="btn danger small" style="margin:0;padding:4px 7px;min-height:0;font-size:11px;line-height:1.1" onclick="event.stopPropagation();confirmRemoveWorker('${p.id}')">Quitar de la semana</button>
              <span class="muted" style="text-align:right;white-space:nowrap">Turno resuelto: <b>${turn}</b></span>
            </div>
            <div class="progress" style="margin-top:5px;height:4px"><span style="width:${pc}%"></span></div>`;
        });
      }

      if(state.view==='seguimiento'){
        // El porcentaje de avance es redundante y visualmente parecía desempeño.
        // Conservamos el contador real done/required y la barra de avance.
        const hero=document.querySelector('.hero');
        if(hero){
          [...hero.querySelectorAll('p')].forEach(p=>{
            if(/%\s*completado/i.test(p.textContent||''))p.remove();
          });
        }
      }
    } finally {
      applying=false;
    }
  }

  const observer=new MutationObserver(()=>{
    clearTimeout(window.__uiStabilityTimer);
    window.__uiStabilityTimer=setTimeout(normalizeMonitorUI,10);
  });
  observer.observe(document.querySelector('#app'),{childList:true,subtree:true});
  setTimeout(normalizeMonitorUI,20);
})();
