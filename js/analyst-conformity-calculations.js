// Cálculos reales de conformidad individual para el informe del Analista.
// Fuente estadística: únicamente evaluaciones realmente registradas (state.evals).
// Los turnos "No realizar muestra" no están en state.evals y por tanto no entran al denominador.
(function(){
  function evaluationWeek(e){
    return Number(e.week ?? e.weekNumber ?? state.currentWeek);
  }

  function actualEvaluations(personId, week){
    return (state.evals || []).filter(e => e.person === personId && evaluationWeek(e) === Number(week));
  }

  function personConformity(personId, week){
    const evals = actualEvaluations(personId, week);
    const M = evals.length;
    const failuresByCriterion = {};

    seed.criteria.forEach(c => failuresByCriterion[c[0]] = 0);
    evals.forEach(e => {
      // Set evita contar dos veces el mismo ítem dentro de una misma muestra.
      new Set(e.failures || []).forEach(id => {
        if(Object.prototype.hasOwnProperty.call(failuresByCriterion,id)) failuresByCriterion[id]++;
      });
    });

    const itemPercent = {};
    seed.criteria.forEach(c => {
      const Fi = failuresByCriterion[c[0]] || 0;
      itemPercent[c[0]] = M ? ((M - Fi) / M) * 100 : null;
    });

    const MC = evals.filter(e => !(e.failures || []).length).length;
    const totalPercent = M ? (MC / M) * 100 : null;
    return {M, MC, failuresByCriterion, itemPercent, totalPercent};
  }

  function pct(v){ return v === null ? '—' : Math.round(v) + '%'; }

  // Se conserva exactamente la estructura de columnas que ya tenía el informe.
  // Dos columnas existentes apuntan hoy a c10; no se cambia ese mapeo hasta validar el ítem corporativo correcto.
  window.weeklyTable = function(){
    const week = state.tableWeek || state.currentWeek;
    const people = state.people.length ? state.people : seed.people;
    const cols = [['c7','Aseo sitio de trabajo'],['c2','Densidad y distribución'],['c3','Estado de la planta'],['c1','Planta inclinada'],['c4','Profundidad de la planta'],['c5','Selección de esquejes'],['c9','Siembra con marcador'],['c10','Conteo de líneas'],['c10','Ubicación mangueras']];

    const rows = people.map(p => {
      const r = personConformity(p.id,week);
      const vals = cols.map(c => pct(r.itemPercent[c[0]]));
      return `<tr><td class="namecell">${p.name}<div class="muted small">${r.M} muestra(s) real(es)</div></td>${vals.map(v=>`<td>${v}</td>`).join('')}<td><b>${pct(r.totalPercent)}</b></td></tr>`;
    }).join('');

    // El resumen grupal se deja como demostrativo: este cambio solo implementa cálculos por sembrador.
    const weekly=[week-3,week-2,week-1,week].filter(w=>w>0).map((w,i)=>[w,91+((w*5+i*2)%7)]);
    const mini=weekly.map(x=>`<tr><td>SEMANA ${x[0]}</td><td>${x[1]}%</td></tr>`).join('');
    const bars=weekly.map(x=>`<div class="print-bar-item"><b>${x[1]}%</b><div class="print-bar" style="height:${Math.max(25,x[1]-55)*3}px"></div><span>SEMANA ${x[0]}</span></div>`).join('');

    app.innerHTML=layout(`<div class="no-print"><button class="back" onclick="go('analisis')">← Volver a análisis</button><div class="row between wrap"><div><h2>Conformidad individual · Semana ${week}</h2><p class="muted">Calculada con las muestras reales registradas. “No realizar muestra” no entra al denominador.</p></div><div class="row wrap"><button class="btn secondary" onclick="openEmailReport()">✉ Enviar por correo</button><button class="btn secondary" onclick="downloadReportPdf()">⬇ PDF</button><button class="btn primary" onclick="window.print()">🖨 Imprimir</button></div></div></div><section class="report-sheet"><div class="report-head"><div><b>JARDINES DE SAN NICOLÁS S.A.S.</b></div><div><b>RUTA DE APRENDIZAJE</b></div><div class="assurance"><b>ASEGURAMIENTO</b></div><div>INDICADOR</div><div>METEORO</div><div></div><div>ÁREA</div><div>SIEMBRA EN CAMPO</div><div></div><div>RESPONSABLE</div><div>ERASMO GOMEZ</div><div></div></div><h3 class="table-title">RESULTADOS CONFORMIDAD INDIVIDUAL SEMANA ${week}</h3><div class="table-scroll"><table class="conformity-table"><thead><tr><th>NOMBRE DEL COLABORADOR</th>${cols.map(c=>`<th>${c[1]}</th>`).join('')}<th>Conformidad Total</th></tr></thead><tbody>${rows}</tbody></table></div><div class="weekly-summary"><table class="mini-table"><thead><tr><th>SEMANAS</th><th>CONFORMIDAD GRUPAL</th></tr></thead><tbody>${mini}</tbody></table><div class="print-chart"><h3>METEORO · CONFORMIDAD GRUPAL (SEMANAL)</h3><div class="print-bars">${bars}</div></div></div><div class="signature-grid"><div>JEFE PRODUCCIÓN</div><div>SUPERVISOR (J)</div><div>SUPERVISOR (M)</div><div>JEFE SAVIA - METEORO</div></div></section><div class="no-print action-stack"><button class="btn secondary block" onclick="openEmailReport()">✉ Enviar tabla en PDF por correo</button><button class="btn secondary block" onclick="downloadReportPdf()">⬇ Descargar informe en PDF</button><button class="btn primary block" onclick="window.print()">🖨 Mandar a imprimir</button></div>`,'tablaSemanal');
  };

  // Disponible para comprobar cálculos desde otras vistas sin duplicar fórmulas.
  window.personConformity = personConformity;
})();
