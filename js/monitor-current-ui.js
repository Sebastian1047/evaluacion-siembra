// Interfaz vigente del Asegurador.
// Este archivo concentra en un solo lugar las decisiones visuales actuales del rol.
(function(){
  function revealApprovedUI(){
    const bootStyle=document.querySelector('#approved-ui-boot');
    if(bootStyle)bootStyle.remove();
    const root=document.querySelector('#app');
    if(root)root.style.visibility='visible';
  }

  function install(){
    if(typeof state==='undefined'||typeof layout!=='function'||typeof personCard!=='function'){
      return setTimeout(install,25);
    }

    const originalNav=nav;
    nav=function(active){
      if(state.role==='monitor')return '';
      return originalNav(active);
    };

    personCard=function(p){
      const pc=Math.min(100,Math.round((Number(p.done)||0)/Math.max(1,Number(p.required)||30)*100));
      const turn=typeof p.sampleTurn==='number'?p.sampleTurn:(Number(p.done)||0);
      return `<article class="card person" data-name="${p.name.toLowerCase()}" onclick="openPerson('${p.id}')" style="padding:9px 12px;margin-bottom:7px">
        <div class="row between" style="gap:8px;align-items:center;min-height:28px">
          <b style="line-height:1.15">${p.name}</b>
          <span class="badge ${pc<100?'warn':''}" style="padding:3px 7px;font-size:11px">${pc===100?'Completado':'En proceso'}</span>
        </div>
        <div style="display:grid;grid-template-columns:auto auto 1fr;gap:8px;align-items:center;margin-top:5px;font-size:12px;line-height:1.15">
          <span><b>${p.done}/${p.required}</b> evaluaciones</span>
          <button class="btn danger small" style="margin:0;padding:4px 7px;min-height:0;font-size:11px;line-height:1.1" onclick="event.stopPropagation();confirmRemoveWorker('${p.id}')">Quitar de la semana</button>
          <span class="muted" style="text-align:right;white-space:nowrap">Turno resuelto: <b>${turn}</b></span>
        </div>
        <div class="progress" style="margin-top:5px;height:4px"><span style="width:${pc}%"></span></div>
      </article>`;
    };

    function removeLegacyFollowPercentage(){
      if(state.role!=='monitor'||state.view!=='seguimiento')return;
      document.querySelectorAll('.hero p').forEach(p=>{
        const text=(p.textContent||'').replace(/\s+/g,' ').trim();
        if(/^\d+% completado\s*\(no es desempeño\)$/i.test(text))p.remove();
      });
    }

    const observer=new MutationObserver(()=>removeLegacyFollowPercentage());
    observer.observe(document.querySelector('#app'),{childList:true,subtree:true});

    if(state.role==='monitor')render();
    removeLegacyFollowPercentage();
    revealApprovedUI();
  }

  install();
})();
