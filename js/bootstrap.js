// Arranque controlado: primero carga/adapta los ítems y solo después ejecuta la aplicación.
(async function () {
  await SiembraApi.loadCriteriaIntoSeed();

  const scripts = [
    'js/app.js?v=20260920-conformity-nav',
    // Instalar inmediatamente la interfaz vigente del Asegurador. Así el HTML
    // histórico que todavía existe en app.js no permanece visible mientras
    // terminan de cargar las integraciones posteriores.
    'js/monitor-current-ui.js?v=20260916-2',
    'js/week-options.js',
    'js/empleados-reales.js',
    'js/historial-analista.js?v=20260920-history-title',
    'js/item-review-quick.js?v=20260918-2',
    'js/weekly-sample-closure.js?v=20260911-1',
    'js/group-week-close.js?v=20260918-2',
    'js/person-sample-turns.js?v=20260917-5',
    'js/late-entry-turn-edit.js?v=20260920-audit-all-corrections',
    'js/noncompliance-x.js?v=20260915-1',
    'js/sync-attention.js?v=20260911-2',
    'js/remove-group-item-button.js?v=20260911-1',
    'js/remove-adjust-required.js?v=20260911-1',
    'js/remove-demo-evaluations.js?v=20260916-3',
    'js/save-return-group.js?v=20260911-1',
    'js/group-pagination.js?v=20260911-1',
    'js/week-lifecycle.js?v=20260912-1',
    'js/calendar-week-control.js?v=20260916-1',
    'js/analyst-conformity-calculations.js?v=20260916-1',
    'js/test-mode-week-control.js?v=20260918-5',
    'js/azure-participant-sync.js?v=20260917-2',
    'js/azure-participant-state.js?v=20260917-1',
    'js/azure-evaluation-sync.js?v=20260916-1'
  ];

  for (const src of scripts) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
      document.body.appendChild(script);
    });
  }
})().catch(error => {
  console.error('No fue posible iniciar la aplicación.', error);
  const app = document.querySelector('#app');
  if (app) app.innerHTML = '<main><section class="card"><h2>No fue posible iniciar la aplicación</h2><p>Actualice la página para volver a intentarlo.</p></section></main>';
});
