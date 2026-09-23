// Persistencia local robusta. IndexedDB es la copia durable; localStorage se mantiene por compatibilidad.
(function(){
  const DB='EvaluacionSiembraOffline',STORE='snapshots',KEY='state';
  function open(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
  async function put(value){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(value,KEY);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}})}
  async function get(){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get(KEY);r.onsuccess=()=>{db.close();resolve(r.result||null)};r.onerror=()=>{db.close();reject(r.error)}})}
  async function restore(){
    try{
      const durable=await get();if(!durable)return false;
      const localRaw=localStorage.getItem('siembraProto');
      if(!localRaw){localStorage.setItem('siembraProto',JSON.stringify(durable));return true}
      let local=null;try{local=JSON.parse(localRaw)}catch(_){}
      const localStamp=local&&local.localSavedAt?Date.parse(local.localSavedAt):0;
      const durableStamp=durable&&durable.localSavedAt?Date.parse(durable.localSavedAt):0;
      if(durableStamp>localStamp)localStorage.setItem('siembraProto',JSON.stringify(durable));
      return durableStamp>localStamp;
    }catch(e){console.warn('No se pudo restaurar el estado durable.',e);return false}
  }
  window.SiembraOfflineStore={put,get,restore};
  window.SiembraInstallOfflinePersistence=function(){
    if(window.__siembraOfflinePersistenceInstalled)return;
    window.__siembraOfflinePersistenceInstalled=true;
    const originalSave=window.save||save;
    window.save=save=function(){
      state.localSavedAt=new Date().toISOString();
      originalSave();
      put(JSON.parse(JSON.stringify(state))).catch(e=>console.warn('No se pudo replicar estado en IndexedDB',e));
    };
    put(JSON.parse(JSON.stringify(state))).catch(()=>{});
  };
})();