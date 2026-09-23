// Informe de conformidad del Analista.
// Las semanas y los datos individuales se consultan desde Azure.
// Solo se ofrecen semanas CERRADAS que contienen evaluaciones reales.
(function(){
  const cols=[['c7','Aseo sitio de trabajo'],['c2','Distribución'],['c3','Estado de planta'],['c1','Planta inclinada'],['c4','Profundidad de la planta'],['c5','Selección de esquejes'],['c6','EPPS'],['c8','Acuerdos de oro'],['c9','Siembra con marcador'],['c10','Ubicación de mangueras'],['c11','Conteo de líneas']];
  let reportableWeeks=[];
  let reportRows=[];
  let loading=false;
  let loadError='';
  let weeklyConformity=[];

  function pct(v){return v==null?'—':Math.round(Number(v))+'%';}
  function workerName(id){
    const key=String(id);
    const real=(typeof empleadosReales!=='undefined'&&Array.isArray(empleadosReales))?empleadosReales.find(e=>String(e.codigo)===key):null;
    return real?.nombre||key;
  }
  function selectedWeek(){
    return reportableWeeks.find(x=>Number(x.AnioEvaluacion)===Number(state.tableYear)&&Number(x.NumeroSemana)===Number(state.tableWeek));
  }
  async function loadWeekCatalog(){
    reportableWeeks=await SiembraApi.getReportableWeeks();
    if(!Array.isArray(reportableWeeks))reportableWeeks=[];
    // Al abrir el informe siempre se muestra la semana cerrada reportable más reciente.
    // El selector sigue permitiendo consultar cualquier semana histórica disponible.
    if(reportableWeeks.length){
      const latest=[...reportableWeeks].sort((a,b)=>
        Number(b.AnioEvaluacion)-Number(a.AnioEvaluacion) ||
        Number(b.NumeroSemana)-Number(a.NumeroSemana)
      )[0];
      state.tableYear=Number(latest.AnioEvaluacion);
      state.tableWeek=Number(latest.NumeroSemana);
      save();
    }
  }
  async function loadSelectedReport(){
    const sw=selectedWeek();
    reportRows=sw?await SiembraApi.getConformityReport(sw.IdSemana):[];
    if(!Array.isArray(reportRows))reportRows=[];
    // Resumen grupal: últimas 4 semanas CERRADAS con evaluaciones reales.
    // No exige consecutividad: las semanas NO_EVALUADA no pertenecen al
    // catálogo reportable y, por tanto, se saltan naturalmente.
    // Se deduplica por año+semana para impedir filas/barras repetidas.
    const uniqueReportable=[...new Map(reportableWeeks.map(w=>[
      Number(w.AnioEvaluacion)+'-'+Number(w.NumeroSemana),w
    ])).values()];
    const selectedKey=Number(state.tableYear)*100+Number(state.tableWeek);
    const eligible=uniqueReportable
      .filter(w=>Number(w.AnioEvaluacion)*100+Number(w.NumeroSemana)<=selectedKey)
      .sort((a,b)=>Number(b.AnioEvaluacion)-Number(a.AnioEvaluacion)||Number(b.NumeroSemana)-Number(a.NumeroSemana))
      .slice(0,4)
      .reverse();
    weeklyConformity=[];
    for(const w of eligible){
      const rows=Number(w.IdSemana)===Number(sw?.IdSemana)?reportRows:await SiembraApi.getConformityReport(w.IdSemana);
      const workers=new Map();
      (rows||[]).forEach(r=>{
        const id=String(r.SembradorCorporativoId);
        if(!workers.has(id))workers.set(id,{mt:Number(r.MuestrasReales)||0,mc:Number(r.MuestrasConformes)||0});
      });
      let mt=0,mc=0;workers.forEach(v=>{mt+=v.mt;mc+=v.mc;});
      weeklyConformity.push([Number(w.NumeroSemana),mt?mc/mt*100:null]);
    }
  }
  window.changeConformityReportYear=async function(value){
    state.tableYear=Number(value);
    const first=reportableWeeks.find(x=>Number(x.AnioEvaluacion)===state.tableYear);
    state.tableWeek=first?Number(first.NumeroSemana):null;save();
    await refreshReport();
  };
  window.changeConformityReportWeek=async function(value){
    state.tableWeek=Number(value);save();await refreshReport();
  };
  async function refreshReport(){
    loading=true;loadError='';renderReport();
    try{await loadSelectedReport();}catch(e){console.error(e);loadError='No fue posible cargar el informe seleccionado desde Azure.';}
    loading=false;renderReport();
  }
  function individualRows(){
    const byWorker=new Map();
    reportRows.forEach(r=>{
      const id=String(r.SembradorCorporativoId);
      if(!byWorker.has(id))byWorker.set(id,{id,name:workerName(id),M:Number(r.MuestrasReales)||0,total:r.ConformidadTotal,items:{}});
      byWorker.get(id).items[String(r.Codigo)]=r.ConformidadItem;
    });
    return [...byWorker.values()].map(p=>`<tr><td class="namecell">${p.name}<div class="muted small">${p.M} muestra(s) real(es)</div></td>${cols.map(col=>`<td>${pct(p.items[col[0]])}</td>`).join('')}<td><b>${pct(p.total)}</b></td></tr>`).join('');
  }
  function renderReport(){
    const year=Number(state.tableYear||new Date().getFullYear());
    const week=Number(state.tableWeek||state.currentWeek);
    const years=[...new Set(reportableWeeks.map(x=>Number(x.AnioEvaluacion)))];
    const weeks=reportableWeeks.filter(x=>Number(x.AnioEvaluacion)===year);
    const rows=individualRows();
    const weekly=weeklyConformity;
    const mini=weekly.map(x=>`<tr><td>SEMANA ${x[0]}</td><td>${pct(x[1])}</td></tr>`).join('');
    const bars=weekly.map(x=>`<div class="print-bar-item"><b>${pct(x[1])}</b><div class="print-bar" style="height:${x[1]==null?25:Math.max(25,x[1]-55)*3}px"></div><span>SEMANA ${x[0]}</span></div>`).join('');
    const status=loading?'<p class="muted">Cargando informe desde Azure…</p>':(loadError?`<p class="muted">${loadError}</p>`:(!reportableWeeks.length?'<p class="muted">No hay semanas cerradas con evaluaciones reales disponibles para informe.</p>':''));
    app.innerHTML=layout(`<div class="no-print"><div class="row between wrap"><div><h2>Conformidad individual · Semana ${week}</h2><p class="muted">Calculada con las muestras reales registradas. “No realizar muestra” no entra al denominador.</p><div class="row wrap" style="margin-top:12px"><label><b>Año</b><select class="input" style="margin-left:6px;width:auto" onchange="changeConformityReportYear(this.value)" ${loading?'disabled':''}>${years.map(y=>`<option value="${y}" ${y===year?'selected':''}>${y}</option>`).join('')}</select></label><label><b>Semana</b><select class="input" style="margin-left:6px;width:auto" onchange="changeConformityReportWeek(this.value)" ${loading?'disabled':''}>${weeks.map(x=>`<option value="${x.NumeroSemana}" ${Number(x.NumeroSemana)===week?'selected':''}>Semana ${x.NumeroSemana}</option>`).join('')}</select></label></div>${status}</div><div class="row wrap"><button class="btn secondary" onclick="openEmailReport()" ${!rows?'disabled':''}>✉ Enviar por correo</button><button class="btn secondary" onclick="downloadReportPdf()" ${!rows?'disabled':''}>⬇ PDF</button><button class="btn primary" onclick="window.print()" ${!rows?'disabled':''}>🖨 Imprimir</button></div></div></div><section class="report-sheet"><div class="report-head"><div><b>JARDINES DE SAN NICOLÁS S.A.S.</b></div><div><b>RUTA DE APRENDIZAJE</b></div><div class="assurance"><b>ASEGURAMIENTO</b></div><div>INDICADOR</div><div>METEORO</div><div></div><div>ÁREA</div><div>SIEMBRA EN CAMPO</div><div></div><div>RESPONSABLE</div><div>ERASMO GOMEZ</div><div></div></div><h3 class="table-title">RESULTADOS CONFORMIDAD INDIVIDUAL SEMANA ${week}</h3><div class="table-scroll"><table class="conformity-table"><thead><tr><th>NOMBRE DEL COLABORADOR</th>${cols.map(c=>`<th>${c[1]}</th>`).join('')}<th>Conformidad Total</th></tr></thead><tbody>${rows||'<tr><td colspan="13" class="muted">Sin datos para mostrar</td></tr>'}</tbody></table></div><div class="weekly-summary"><table class="mini-table"><thead><tr><th>SEMANAS</th><th>CONFORMIDAD GRUPAL</th></tr></thead><tbody>${mini}</tbody></table><div class="print-chart"><h3>METEORO · CONFORMIDAD GRUPAL (SEMANAL)</h3><div class="print-bars">${bars}</div></div></div><div class="signature-grid"><div>JEFE PRODUCCIÓN</div><div>SUPERVISOR (J)</div><div>SUPERVISOR (M)</div><div>JEFE SAVIA - METEORO</div></div></section><div class="no-print action-stack"><button class="btn secondary block" onclick="openEmailReport()" ${!rows?'disabled':''}>✉ Enviar tabla en PDF por correo</button><button class="btn secondary block" onclick="downloadReportPdf()" ${!rows?'disabled':''}>⬇ Descargar informe en PDF</button><button class="btn primary block" onclick="window.print()" ${!rows?'disabled':''}>🖨 Mandar a imprimir</button></div>`,'tablaSemanal');
  }
  window.weeklyTable=async function(){
    loading=true;loadError='';renderReport();
    try{await loadWeekCatalog();await loadSelectedReport();}catch(e){console.error(e);loadError='No fue posible cargar las semanas de informe desde Azure.';}
    loading=false;renderReport();
  };

  // app.js puede restaurar tablaSemanal antes de que este módulo termine de cargar.
  // Si el usuario recarga estando en el informe, ejecutar inmediatamente la
  // implementación vigente para sustituir la pantalla transitoria sin exigir
  // otro clic en la navegación.
  if(state.view==='tablaSemanal') window.weeklyTable();
})();