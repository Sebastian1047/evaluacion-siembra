// Descarga preventiva: conserva en la tablet un paquete amplio de datos para trabajar sin cobertura.
(function(){
  const DB='EvaluacionSiembraOffline',STORE='snapshots',KEY='server-bootstrap';
  function open(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
  async function put(value){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(value,KEY);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}})}
  async function get(){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get(KEY);r.onsuccess=()=>{db.close();resolve(r.result||null)};r.onerror=()=>{db.close();reject(r.error)}})}
  function applyItems(data){
    const items=(data&&data.items)||[];if(!items.length)return;
    window.SiembraAzureItemIds=Object.fromEntries(items.map(i=>[String(i.codigo),Number(i.id)]));
    seed.criteria=items.map(i=>[i.codigo,i.nombre,Boolean(i.esCritico)]);
  }
  window.SiembraOfflineBootstrap={
    async refresh(){
      if(!window.SiembraApi||typeof SiembraApi.getOfflineBootstrap!=='function')return null;
      const data=await SiembraApi.getOfflineBootstrap();await put(data);applyItems(data);
      state.offlineDataUpdatedAt=data.generatedAt||new Date().toISOString();save();return data;
    },
    async get(){return get()},
    async applyCached(){const data=await get();if(data){applyItems(data);window.SiembraOfflineServerData=data}return data}
  };
  // Primero deja disponible cualquier paquete anterior. Si hay red, luego lo renueva.
  SiembraOfflineBootstrap.applyCached().finally(()=>{
    if(navigator.onLine)SiembraOfflineBootstrap.refresh().catch(e=>console.warn('Se conserva el paquete offline anterior.',e));
  });
})();