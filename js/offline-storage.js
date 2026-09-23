// Persistencia local robusta. Mantiene localStorage por compatibilidad y replica el estado en IndexedDB.
(function(){
  const DB='EvaluacionSiembraOffline',STORE='snapshots',KEY='state';
  function open(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
  async function put(value){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(value,KEY);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}})}
  async function get(){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get(KEY);r.onsuccess=()=>{db.close();resolve(r.result||null)};r.onerror=()=>{db.close();reject(r.error)}})}
  window.SiembraOfflineStore={put,get};
  const originalSave=window.save||save;
  window.save=save=function(){originalSave();put(JSON.parse(JSON.stringify(state))).catch(e=>console.warn('No se pudo replicar estado en IndexedDB',e))};
  // La primera ejecución migra el estado actual. En las siguientes, si localStorage
  // fue limpiado accidentalmente durante la sesión, queda disponible el respaldo.
  put(JSON.parse(JSON.stringify(state))).catch(()=>{});
})();