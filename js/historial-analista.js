// Historial avanzado exclusivo del Analista. Extensión aislada para preservar el historial del Asegurador.
const historialAseguradorOriginal=history;
function historialFallosTodos(){
  const personas=new Map();
  [...(seed.people||[]),...(seed.available||[]),...(typeof empleadosReales!=='undefined'?empleadosReales.map(e=>({id:'emp-'+e.codigo,name:e.nombre,doc:e.codigo})):[]),...(state.people||[]),...(state.available||[])].forEach(p=>{if(p&&p.id&&!personas.has(p.id))personas.set(p.id,p)});
  const filas=[];
  Object.entries(state.historyFailures||{}).forEach(([personId,fs])=>(fs||[]).forEach(f=>filas.push({...f,personId})));
  Object.entries(state.itemReviews||{}).forEach(([wk,reviews])=>{const m=String(wk).match(/^w(\d+)(?:s(\d+))?$/),week=m?Number(m[1]):NaN,sample=m&&m[2]?Number(m[2]):'-';Object.entries(reviews||{}).forEach(([criterion,r])=>(r.noncompliant||[]).forEach(personId=>filas.push({personId,week,criterion,sample:r.sample||sample})))});return {personas,filas};
}
function nombreCriterio(id){const azureIds=window.SiembraAzureItemIds||{};const codigo=Object.keys(azureIds).find(k=>Number(azureIds[k])===Number(id));return seed.criteria.find(c=>String(c[0])===String(id)||String(c[0])===String(codigo))?.[1]||id}
function semanasHistorial(){const {filas}=historialFallosTodos();return [...new Set(filas.map(f=>Number(f.week)).filter(Number.isFinite))].sort((a,b)=>b-a)}
function histModeChange(){const m=document.querySelector('#histMode')?.value;document.querySelector('#histToWrap')?.classList.toggle('hidden',m!=='range');aplicarHistorialAnalista()}
function historialAnalista(){app.innerHTML=layout(`<section class="grid two"><button class="card" style="text-align:left;cursor:pointer;border:1px solid #d8e1dc" onclick="historialFallosAnalista()"><h3 style="margin-top:0">Fallos de sembradores</h3><p class="muted" style="margin-bottom:0">Consulte los incumplimientos registrados por persona, semana, muestra e ítem.</p></button><button class="card" style="text-align:left;cursor:pointer;border:1px solid #d8e1dc" onclick="historialModificacionesAnalista()"><h3 style="margin-top:0">Modificaciones a evaluaciones de las últimas dos semanas</h3><p class="muted" style="margin-bottom:0">Auditoría de accesos a modificación y cambios realizados sobre información ya completada.</p></button></section>`,'historial')}
history=function(){return state.role==='analista'?historialAnalista():historialAseguradorOriginal()};
async function historialFallosAnalista(){
  app.innerHTML=layout(`<button class="back" onclick="go('historial')">← Volver a Historial</button><section class="card hero"><h2>Historial de incumplimientos</h2><p class="muted">Información real registrada en la base de datos.</p></section><section class="card muted">Cargando incumplimientos desde Azure…</section>`,'historial');
  try{
    const rows=await SiembraApi.getNoncomplianceHistory();
    window.__azureFailureHistory=Array.isArray(rows)?rows:[];
    const weeks=[...new Map(window.__azureFailureHistory.map(r=>[`${Number(r.AnioEvaluacion)}-${Number(r.NumeroSemana)}`,{year:Number(r.AnioEvaluacion),week:Number(r.NumeroSemana)}])).values()]
      .sort((a,b)=>b.year-a.year||b.week-a.week);
    const latest=weeks[0]||{year:Number(state.currentYear)||new Date().getFullYear(),week:Number(state.currentWeek)||1};
    window.__failureHistoryWeeks=weeks;
    app.innerHTML=layout(`<button class="back" onclick="go('historial')">← Volver a Historial</button><section class="card hero"><span class="badge">Última semana con incumplimientos · Semana ${latest.week}</span><h2 style="margin:8px 0 4px">Historial de incumplimientos</h2><p class="muted">Busque una persona o consulte los incumplimientos reales por semana.</p></section><section class="card"><div class="grid hist-filters"><div><label class="label">Buscar persona</label><input id="histPerson" class="input" placeholder="Nombre o código" oninput="aplicarHistorialAnalista()"></div><div><label class="label">Semana</label><select id="histStart" class="input" onchange="aplicarHistorialAnalista()">${weeks.map(w=>`<option value="${w.year}-${w.week}">${w.year} · Semana ${w.week}</option>`).join('')}</select></div></div></section><div id="histResults"></div>`,'historial');
    aplicarHistorialAnalista();
  }catch(error){
    console.error('No fue posible cargar el historial de incumplimientos desde Azure.',error);
    app.innerHTML=layout(`<button class="back" onclick="go('historial')">← Volver a Historial</button><section class="card hero"><h2>Historial de incumplimientos</h2></section><section class="card muted">No se pudo cargar el historial real. Verifique la conexión a Internet.</section>`,'historial');
  }
}
function aplicarHistorialAnalista(){
  const out=document.querySelector('#histResults');if(!out)return;
  const rows=window.__azureFailureHistory||[];
  const selected=(document.querySelector('#histStart')?.value||'').split('-');
  const year=Number(selected[0]),week=Number(selected[1]);
  const q=(document.querySelector('#histPerson')?.value||'').trim().toLowerCase();
  let filtered=rows.filter(r=>Number(r.AnioEvaluacion)===year&&Number(r.NumeroSemana)===week);
  const personName=id=>(typeof empleadosReales!=='undefined'?empleadosReales.find(e=>String(e.codigo)===String(id))?.nombre:null)||String(id||'Sembrador');
  if(q)filtered=filtered.filter(r=>personName(r.SembradorCorporativoId).toLowerCase().includes(q)||String(r.SembradorCorporativoId||'').toLowerCase().includes(q));
  const ids=[...new Set(filtered.map(r=>String(r.SembradorCorporativoId)))];
  if(!ids.length){out.innerHTML='<div class="card muted">No se encontraron incumplimientos con esos filtros.</div>';return}
  out.innerHTML=`<div class="row between wrap" style="margin:14px 0"><h3 style="margin:0">Personas con fallos</h3><span class="badge">${ids.length} persona(s) · ${filtered.length} fallo(s)</span></div>`+
    ids.map(id=>{const fs=filtered.filter(r=>String(r.SembradorCorporativoId)===id);return `<article class="card history-person" onclick="verHistorialCompletoAnalista('${id}')"><div class="row between"><div><b>${personName(id)}</b><div class="muted small">Código ${id}</div></div><span class="badge warn">${fs.length} fallo(s)</span></div><p class="muted small" style="margin:8px 0 0">Semana ${week} · ${year}</p></article>`}).join('');
}
function formatAuditDate(v){if(!v)return '-';try{return new Date(v).toLocaleString('es-CO')}catch{return v}}
async function historialModificacionesAnalista(){
  app.innerHTML=layout(`<button class="back" onclick="go('historial')">← Volver a Historial</button><section class="card hero"><h2>Modificaciones a evaluaciones de las últimas dos semanas</h2><p class="muted">Registro de auditoría de correcciones realizadas sobre evaluaciones ya completadas.</p></section><section class="card muted">Cargando auditoría desde Azure…</section>`,'historial');
  try{
    const [allRows,latestWeek]=await Promise.all([SiembraApi.getCorrectionAudit(),SiembraApi.getLatestWeek()]);
    const currentWeek=Number(latestWeek.NumeroSemana); const currentYear=Number(latestWeek.AnioEvaluacion);
    const previousWeek=currentWeek>1?currentWeek-1:53; const previousYear=currentWeek>1?currentYear:currentYear-1;
    const rows=(allRows||[]).filter(a=>(Number(a.NumeroSemana)===currentWeek&&Number(a.AnioEvaluacion)===currentYear)||(Number(a.NumeroSemana)===previousWeek&&Number(a.AnioEvaluacion)===previousYear));
    const cards=(rows||[]).map(a=>{let antes=[],despues=[];try{antes=JSON.parse(a.EstadoAntes||'[]')}catch{}try{despues=JSON.parse(a.EstadoDespues||'[]')}catch{}return `<article class="card"><div class="row between wrap"><div><b>Semana ${a.NumeroSemana} · ${a.AnioEvaluacion} · Turno ${a.NumeroTurno}</b><div class="muted small">Sembrador: ${(typeof empleadosReales!=='undefined'?empleadosReales.find(e=>String(e.codigo)===String(a.SembradorCorporativoId))?.nombre:null)||a.SembradorCorporativoId} · Usuario: ${a.UsuarioCorporativoId} · ${formatAuditDate(a.CorregidoEn)}</div></div><span class="badge">Corrección registrada</span></div><p class="small" style="margin-bottom:0"><b>Antes:</b> ${antes.length?antes.map(nombreCriterio).join(', '):'Todos los ítems cumplen'}<br><b>Después:</b> ${despues.length?despues.map(nombreCriterio).join(', '):'Todos los ítems cumplen'}</p></article>`}).join('');
    app.innerHTML=layout(`<button class="back" onclick="go('historial')">← Volver a Historial</button><section class="card hero"><h2>Modificaciones a evaluaciones de las últimas dos semanas</h2><p class="muted">Registro de auditoría de correcciones realizadas sobre evaluaciones ya completadas.</p></section><section class="card"><div class="row between wrap"><b>Registro de modificaciones</b><span class="badge">${(rows||[]).length} corrección(es)</span></div></section><div>${cards||'<section class="card muted">Todavía no hay correcciones registradas.</section>'}</div>`,'historial');
  }catch(e){app.innerHTML=layout(`<button class="back" onclick="go('historial')">← Volver a Historial</button><section class="card hero"><h2>Modificaciones a evaluaciones de las últimas dos semanas</h2></section><section class="card muted">No se pudo cargar la auditoría desde Azure.</section>`,'historial')}
}
function renderAuditoriaModificacion(a){if(a.type==='modification_started')return `<article class="card" style="border-left:4px solid #d97706"><div class="row between wrap"><div><b>Acceso a modificación · Semana ${a.week}</b><div class="muted small">Usuario: ${a.user||'-'} · ${formatAuditDate(a.startedAt)}</div></div><span class="badge warn">${a.syncStatus==='synced'?'Sincronizado':'Registrado'}</span></div><p class="muted small" style="margin-bottom:0">El usuario pulsó <b>Modificar</b>. Este evento se conserva incluso si no realizó cambios.</p></article>`;const changes=a.changes||[];return `<article class="card" style="border-left:4px solid ${changes.length?'#b42318':'#7b8a83'}"><div class="row between wrap"><div><b>${changes.length?'Modificación realizada':'Sesión sin cambios'} · Semana ${a.week}</b><div class="muted small">Usuario: ${a.user||'-'} · ${formatAuditDate(a.finishedAt||a.startedAt)}</div></div><span class="badge ${a.syncStatus==='synced'?'':'warn'}">${a.syncStatus==='synced'?'Sincronizado':'Pendiente de sincronizar'}</span></div>${changes.length?`<div class="table-scroll" style="margin-top:14px"><table class="failure-table"><thead><tr><th>Muestra</th><th>Ítem</th><th>Persona</th><th>Estado anterior</th><th>Estado nuevo</th></tr></thead><tbody>${changes.map(c=>`<tr><td>${c.sample??'-'}</td><td>${nombreCriterio(c.criterion)}</td><td><b>${c.person?.name||c.person?.id||'-'}</b><div class="muted small">${c.person?.doc?'Código '+c.person.doc:''}</div></td><td>${c.before||'-'}</td><td><b>${c.after||'-'}</b></td></tr>`).join('')}</tbody></table></div>`:'<p class="muted small" style="margin-bottom:0">El usuario terminó la sesión sin modificar el estado de ningún sembrador.</p>'}</article>`}
function verHistorialCompletoAnalista(id){state.historyPerson=id;state.view='historialPersonaAnalista';render()}
const renderAntesHistorialAnalista=render;
render=function(){if(state.role==='analista'&&state.view==='historialPersonaAnalista')return detalleHistorialAnalista();return renderAntesHistorialAnalista()};
function detalleHistorialAnalista(){
  const id=String(state.historyPerson||''),rows=(window.__azureFailureHistory||[]).filter(r=>String(r.SembradorCorporativoId)===id);
  const name=(typeof empleadosReales!=='undefined'?empleadosReales.find(e=>String(e.codigo)===id)?.nombre:null)||id;
  const grouped={};rows.forEach(r=>{const k=r.AnioEvaluacion+'-'+r.NumeroSemana;grouped[k]=(grouped[k]||0)+1});
  app.innerHTML=layout(`<button class="back" onclick="historialFallosAnalista()">← Volver al historial de fallos</button><section class="card hero"><h2>${name}</h2><p class="muted">Código ${id}</p><div class="row wrap"><span class="badge warn">${rows.length} fallos totales</span><span class="badge">${Object.keys(grouped).length} semana(s) con fallos</span></div></section><section class="card"><h3>Todos los fallos registrados</h3><div class="table-scroll"><table class="failure-table"><thead><tr><th>Ítem incumplido</th><th>Semana</th><th>Turno</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.NombreItem||nombreCriterio(r.CodigoItem)}</td><td>Semana ${r.NumeroSemana} · ${r.AnioEvaluacion}</td><td>${r.NumeroTurno}</td></tr>`).join('')}</tbody></table></div></section>`,'historial')
}
