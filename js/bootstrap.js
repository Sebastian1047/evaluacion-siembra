// Arranque offline-first: restaura datos locales antes de iniciar la aplicación y nunca exige red para abrir.
(async function () {
  async function loadScript(src){
    return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>reject(new Error('No se pudo cargar '+src));document.body.appendChild(script)});
  }

  // Este módulo no depende de state y puede restaurar localStorage desde IndexedDB
  // antes de que app.js construya el estado de la sesión.
  await loadScript('js/offline-storage.js?v=20260923-3');
  if(window.SiembraOfflineStore)await SiembraOfflineStore.restore();

  // Los criterios locales permiten arrancar sin red. La consulta Azure es una
  // mejora cuando hay cobertura, no una condición de arranque.
  if(navigator.onLine){
    await SiembraApi.loadCriteriaIntoSeed().catch(()=>seed.criteria);
  }else{
    window.SiembraCriteriaSource='local-offline';
  }

  const scripts = [
    'js/app.js?v=20260923-offline-save',
    'js/monitor-current-ui.js?v=20260916-2',
    'js/empleados-reales.js',
    'js/offline-bootstrap.js?v=20260923-3',
    'js/offline-readiness.js?v=20260923-1',
    'js/week-options.js',
    'js/historial-analista.js?v=20260923-real-azure-history',
    'js/item-review-quick.js?v=20260918-2',
    'js/weekly-sample-closure.js?v=20260911-1',
    'js/group-week-close.js?v=20260918-2',
    'js/person-sample-turns.js?v=20260921-closed-turn-lock',
    'js/late-entry-turn-edit.js?v=20260920-audit-all-corrections',
    'js/noncompliance-x.js?v=20260915-1',
    'js/sync-attention.js?v=20260911-2',
    'js/remove-group-item-button.js?v=20260911-1',
    'js/remove-adjust-required.js?v=20260911-1',
    'js/remove-demo-evaluations.js?v=20260916-3',
    'js/save-return-group.js?v=20260923-return-group-3',
    'js/group-pagination.js?v=20260911-1',
    'js/week-lifecycle.js?v=20260912-1',
    'js/calendar-week-control.js?v=20260916-1',
    'js/analyst-conformity-calculations.js?v=20260923-eleven-items',
    'js/test-mode-week-control.js?v=20260924-clean-previous',
    'js/azure-participant-sync.js?v=20260921-new-worker-full-target',
    'js/azure-participant-state.js?v=20260917-1',
    'js/azure-evaluation-sync.js?v=20260916-1',
    'js/person-evaluation-table.js?v=20260923-1',
    'js/authorization-by-person.js?v=20260923-1',
    'js/week-calendar-expiry.js?v=20260923-1',
    'js/offline-sync.js?v=20260923-return-group-3'
  ];

  for(const src of scripts)await loadScript(src);
  if(window.SiembraInstallOfflinePersistence)SiembraInstallOfflinePersistence();
})().catch(error=>{
  console.error('No fue posible iniciar la aplicación.',error);
  const app=document.querySelector('#app');
  if(app){app.style.visibility='visible';app.innerHTML='<main><section class="card"><h2>No fue posible iniciar la aplicación</h2><p>Conéctese una vez a Internet para preparar esta tablet y vuelva a intentarlo.</p></section></main>'}
});