const CACHE='evaluacion-siembra-shell-v4';
const APP_SHELL=[
  './','./index.html','./css/styles.css?v=20260915-2','./js/data.js?v=20260923-eleven-items','./js/api-client.js?v=20260923-offline3','./js/bootstrap.js?v=20260923-items11',
  './js/app.js?v=20260923-offline-save','./js/monitor-current-ui.js?v=20260916-2','./js/offline-storage.js?v=20260923-3','./js/offline-bootstrap.js?v=20260923-3','./js/offline-readiness.js?v=20260923-1','./js/week-options.js','./js/empleados-reales.js',
  './js/historial-analista.js?v=20260923-real-azure-history','./js/item-review-quick.js?v=20260918-2','./js/weekly-sample-closure.js?v=20260911-1',
  './js/group-week-close.js?v=20260918-2','./js/person-sample-turns.js?v=20260921-closed-turn-lock','./js/late-entry-turn-edit.js?v=20260920-audit-all-corrections',
  './js/noncompliance-x.js?v=20260915-1','./js/sync-attention.js?v=20260911-2','./js/remove-group-item-button.js?v=20260911-1',
  './js/remove-adjust-required.js?v=20260911-1','./js/remove-demo-evaluations.js?v=20260916-3','./js/save-return-group.js?v=20260911-1',
  './js/group-pagination.js?v=20260911-1','./js/week-lifecycle.js?v=20260912-1','./js/calendar-week-control.js?v=20260916-1',
  './js/analyst-conformity-calculations.js?v=20260923-eleven-items','./js/test-mode-week-control.js?v=20260918-5',
  './js/azure-participant-sync.js?v=20260921-new-worker-full-target','./js/azure-participant-state.js?v=20260917-1','./js/azure-evaluation-sync.js?v=20260916-1',
  './js/person-evaluation-table.js?v=20260923-1','./js/authorization-by-person.js?v=20260923-1','./js/week-calendar-expiry.js?v=20260923-1','./js/offline-sync.js?v=20260923-3'
];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const req=event.request;if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin===location.origin){
    event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(res=>{const copy=res.clone();caches.open(CACHE).then(cache=>cache.put(req,copy));return res;})));
  }
});