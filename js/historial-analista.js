// Historial avanzado exclusivo del Analista. Se añade como extensión para no alterar app.js.
function historialFallosTodos(){
  const personas=new Map();
  [...(seed.people||[]),...(seed.available||[]),...(typeof empleadosReales!=='undefined'?empleadosReales.map(e=>({id:'emp-'+e.codigo,name:e.nombre,doc:e.codigo})):[]),...(state.people||[]),...(state.available||[])].forEach(p=>{
    if(p&&p.id&&!personas.has(p.id))personas.set(p.id,p);
  });
  const filas=[];
  Object.entries(state.historyFailures||{}).forEach(([personId,fs])=>(fs||[]).forEach(f=>filas.push({...f,personId})));
  // Incumplimientos registrados realmente en la evaluación por ítems del prototipo.
  Object.entries(state.itemReviews||{}).forEach(([wk,reviews])=>{
    const week=Number(String(wk).replace(/^w/,''));
    Object.entries(reviews||{}).forEach(([criterion,r])=>(r.noncompliant||[]).forEach(personId=>filas.push({personId,week,criterion,sample:r.sample||'-'})));
  });
  return {personas,filas};
}
function nombreCriterio(id){return seed.criteria.find(c=>c[0]===id)?.[1]||id}
function semanasHistorial(){const {filas}=historialFallosTodos();return [...new Set(filas.map(f=>Number(f.week)).filter(Number.isFinite))].sort((a,b)=>b-a)}
function histModeChange(){const m=document.querySelector('#histMode')?.value;document.querySelector('#histToWrap')?.classList.toggle('hidden',m!=='range');aplicarHistorialAnalista()}
function history(){
  if(state.role!=='analista')return historialAseguradorOriginal();
  const weeks=semanasHistorial(),start=state.histStart||weeks[0]||state.currentWeek;
  app.innerHTML=layout(`<section class="card hero"><h2>Historial de incumplimientos</h2><p class="muted">Busque una persona o consulte los fallos por semana y rango histórico.</p></section>
  <section class="card"><div class="grid hist-filters">
    <div><label class="label">Buscar persona</label><input id="histPerson" class="input" placeholder="Nombre o código" value="${state.histPerson||''}" oninput="aplicarHistorialAnalista()"></div>
    <div><label class="label">Semana inicial</label><select id="histStart" class="input" onchange="aplicarHistorialAnalista()">${weeks.map(w=>`<option value="${w}" ${w==start?'selected':''}>Semana ${w}</option>`).join('')}</select></div>
    <div><label class="label">Consulta</label><select id="histMode" class="input" onchange="histModeChange()"><option value="one">Solo esa semana</option><option value="back">Desde esa semana hacia atrás</option><option value="range">Hasta una semana específica</option></select></div>
    <div id="histToWrap" class="hidden"><label class="label">Hasta semana</label><select id="histTo" class="input" onchange="aplicarHistorialAnalista()">${weeks.map(w=>`<option value="${w}">Semana ${w}</option>`).join('')}</select></div>
  </div></section><div id="histResults"></div>`,'historial');
  aplicarHistorialAnalista();
}
const historialAseguradorOriginal=history;

function aplicarHistorialAnalista(){
  const out=document.querySelector('#histResults'); if(!out)return;
  const {personas,filas}=historialFallosTodos();
  const q=(document.querySelector('#histPerson')?.value||'').trim().toLowerCase();
  const start=Number(document.querySelector('#histStart')?.value||state.currentWeek);
  const mode=document.querySelector('#histMode')?.value||'one';
  const to=Number(document.querySelector('#histTo')?.value||start);
  let filtered=filas.filter(f=>mode==='one'?Number(f.week)===start:mode==='back'?Number(f.week)<=start:Number(f.week)<=start&&Number(f.week)>=Math.min(start,to));
  if(mode==='range'&&to>start)filtered=filas.filter(f=>Number(f.week)<=to&&Number(f.week)>=start);
  if(q)filtered=filtered.filter(f=>{const p=personas.get(f.personId);return (p?.name||'').toLowerCase().includes(q)||String(p?.doc||'').toLowerCase().includes(q)});
  const ids=[...new Set(filtered.map(f=>f.personId))];
  if(!ids.length){out.innerHTML='<div class="card muted">No se encontraron incumplimientos con esos filtros.</div>';return}
  out.innerHTML=`<div class="row between wrap" style="margin:14px 0"><h3 style="margin:0">Personas con fallos</h3><span class="badge">${ids.length} persona(s) · ${filtered.length} fallo(s)</span></div>`+ids.map(id=>{
    const p=personas.get(id)||{name:'Trabajador '+id,doc:id}, fs=filtered.filter(f=>f.personId===id);
    return `<article class="card history-person" onclick="verHistorialCompletoAnalista('${id}')"><div class="row between"><div><b>${p.name}</b><div class="muted small">Código ${p.doc||'-'}</div></div><span class="badge warn">${fs.length} fallo(s)</span></div><p class="muted small" style="margin:8px 0 0">Semanas: ${[...new Set(fs.map(f=>f.week))].sort((a,b)=>b-a).join(', ')}</p></article>`;
  }).join('');
}
function verHistorialCompletoAnalista(id){state.historyPerson=id;state.view='historialPersonaAnalista';render()}
const renderAntesHistorialAnalista=render;
render=function(){if(state.role==='analista'&&state.view==='historialPersonaAnalista')return detalleHistorialAnalista();return renderAntesHistorialAnalista()}
function detalleHistorialAnalista(){
  const {personas,filas}=historialFallosTodos(),p=personas.get(state.historyPerson)||{name:'Trabajador',doc:'-'},fs=filas.filter(f=>f.personId===state.historyPerson).sort((a,b)=>b.week-a.week);
  const porSemana={};fs.forEach(f=>porSemana[f.week]=(porSemana[f.week]||0)+1);
  app.innerHTML=layout(`<button class="back" onclick="go('historial')">← Volver al historial</button><section class="card hero"><h2>${p.name}</h2><p class="muted">Código ${p.doc||'-'}</p><div class="row wrap"><span class="badge warn">${fs.length} fallos totales</span><span class="badge">${Object.keys(porSemana).length} semana(s) con fallos</span></div></section>
  <section class="card"><h3>Resumen por semana</h3><div class="chips">${Object.entries(porSemana).sort((a,b)=>b[0]-a[0]).map(([w,n])=>`<span class="chip">Semana ${w}: ${n}</span>`).join('')}</div></section>
  <section class="card"><h3>Todos los fallos registrados</h3><div class="table-scroll"><table class="failure-table"><thead><tr><th>Ítem incumplido</th><th>Semana</th><th>Muestra</th></tr></thead><tbody>${fs.map(f=>`<tr><td>${nombreCriterio(f.criterion)}</td><td>Semana ${f.week}</td><td>${f.sample??'-'}</td></tr>`).join('')}</tbody></table></div></section>`,'historial');
}
