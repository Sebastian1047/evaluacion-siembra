// Punto único de comunicación entre el frontend y el backend de Evaluación de Siembra.
(function () {
  const API_BASE_URL = 'https://evaluacion-siembra-api-dev-gcfcawa0fmfgdcas.centralus-01.azurewebsites.net';
  async function request(path, options = {}) {const response=await fetch(`${API_BASE_URL}${path}`,{...options,headers:{Accept:'application/json',...(options.headers||{})}});if(!response.ok){let detail='';try{const body=await response.json();detail=body.detail||body.error||'';}catch(_){}throw new Error(detail||`Error HTTP ${response.status}`);}return response.json();}
  const getItems=()=>request('/api/items');
  const getLatestWeek=()=>request('/api/semanas/ultima');
  const getWeek=(year,number)=>request(`/api/semanas/${year}/${number}`);
  const ensureWeek=({anio,numero,inicio,fin})=>request('/api/semanas/asegurar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({anio,numero,inicio,fin})});
  const closeWeek=(semanaId,{usuarioCorporativoId=null}={})=>request('/api/semanas/'+semanaId+'/cerrar',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({usuarioCorporativoId})});
  const getParticipants=semanaId=>request(`/api/semanas/${semanaId}/participantes`);
  const getOperationalState=semanaId=>request(`/api/semanas/${semanaId}/estado-operativo`);
  const addParticipant=(semanaId,{sembradorId,turnoInicio})=>request(`/api/semanas/${semanaId}/participantes`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sembradorId,turnoInicio})});
  const changeParticipantState=(participacionId,estado,turnoOperativo)=>request(`/api/participaciones/${participacionId}/estado`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({estado,turnoOperativo})});
  const resolveTurn=(participacionId,turno,{tipo,incumplimientos=[],usuarioCorporativoId})=>request(`/api/participaciones/${participacionId}/turnos/${turno}/resolver`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tipo,incumplimientos,usuarioCorporativoId})});
  const getCorrectionAuthorizations=semanaId=>request('/api/semanas/'+semanaId+'/autorizaciones-correccion');
  const authorizeCorrection=(resolucionId,data)=>request('/api/resoluciones/'+resolucionId+'/autorizaciones-correccion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const saveAuthorizedCorrection=(resolucionId,{incumplimientos=[],usuarioCorporativoId})=>request('/api/resoluciones/'+resolucionId+'/correccion',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({incumplimientos,usuarioCorporativoId})});
  async function getCorrectionAudit(){return request('/api/auditoria-correcciones');}
  async function loadCriteriaIntoSeed(){if(typeof seed==='undefined'||!Array.isArray(seed.criteria))throw new Error('seed.criteria no está disponible');const localFallback=seed.criteria.map(c=>[...c]);try{const items=await getItems();const activeItems=Array.isArray(items)?items.filter(item=>item.activo!==false):[];if(!activeItems.length)throw new Error('La API no devolvió ítems activos');window.SiembraAzureItemIds=Object.fromEntries(activeItems.map(item=>[String(item.codigo),Number(item.id)]));seed.criteria=activeItems.map(item=>[item.codigo,item.nombre,Boolean(item.esCritico)]);window.SiembraCriteriaSource='azure';return seed.criteria;}catch(error){seed.criteria=localFallback;window.SiembraAzureItemIds={};window.SiembraCriteriaSource='local-fallback';console.warn('No fue posible cargar los ítems desde Azure; se usan los criterios locales.',error);return seed.criteria;}}
  window.SiembraApi=Object.freeze({baseUrl:API_BASE_URL,getItems,getLatestWeek,getWeek,ensureWeek,closeWeek,getParticipants,getOperationalState,addParticipant,changeParticipantState,resolveTurn,getCorrectionAuthorizations,authorizeCorrection,saveAuthorizedCorrection,getCorrectionAudit,loadCriteriaIntoSeed});
})();