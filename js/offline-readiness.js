// Estado visible de preparación offline para el Asegurador.
(function(){
  function fmtDate(value){if(!value)return 'Todavía no preparado';const d=new Date(value);return Number.isNaN(d.getTime())?'Preparado':d.toLocaleString('es-CO')}
  function decorate(){
    if(state.role!=='monitor'||state.view!=='grupo')return;
    const hero=document.querySelector('.hero');if(!hero||hero.querySelector('#offline-readiness'))return;
    const box=document.createElement('div');box.id='offline-readiness';box.className='card';box.style.cssText='margin-top:10px;padding:9px 11px';
    const online=navigator.onLine,ready=!!state.offlineDataUpdatedAt;
    box.innerHTML='<div class="row between wrap"><span><b>'+(online?'Con conexión':'Sin conexión')+'</b> · '+(ready?'Tablet preparada para trabajo offline':'Preparando datos offline')+'</span><span class="badge '+(ready?'':'warn')+'">'+(ready?'Offline listo':'Pendiente')+'</span></div><div class="muted small" style="margin-top:5px">Última actualización local: '+fmtDate(state.offlineDataUpdatedAt)+'</div>';
    hero.appendChild(box);
  }
  addEventListener('online',()=>{if(window.SiembraOfflineBootstrap)SiembraOfflineBootstrap.refresh().then(()=>render()).catch(()=>render());else render()});
  addEventListener('offline',()=>render());
  const observer=new MutationObserver(()=>{clearTimeout(window.__offlineReadyTimer);window.__offlineReadyTimer=setTimeout(decorate,0)});
  observer.observe(document.querySelector('#app'),{childList:true,subtree:true});setTimeout(decorate,0);
})();