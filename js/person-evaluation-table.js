// Vista compacta y paginada del historial de evaluaciones de una persona.
// Sustituye las tarjetas aisladas: toda la información necesaria para revisar
// una muestra queda visible en una sola fila, sin abrir cada evaluación.
(function(){
  const ROWS_PER_PAGE=6;

  function evaluationRows(p){
    return (state.evals||[])
      .filter(e=>e.person===p.id)
      .slice()
      .sort((a,b)=>{
        const ta=Number(a.turn)||0,tb=Number(b.turn)||0;
        if(tb!==ta)return tb-ta;
        return String(b.date||'').localeCompare(String(a.date||''));
      });
  }

  function failureNames(e){
    const failures=Array.isArray(e.failures)?e.failures:[];
    if(!failures.length)return '<span class="eval-ok-text">Todos los ítems cumplen</span>';
    return failures.map(id=>{
      const criterion=(seed.criteria||[]).find(c=>String(c[0])===String(id));
      return '<span class="eval-failure-chip">'+escapeEvaluationTableHtml(criterion?criterion[1]:id)+'</span>';
    }).join(' ');
  }

  function escapeEvaluationTableHtml(value){
    return String(value==null?'':value).replace(/[&<>"']/g,m=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }

  window.personEvaluationPage=function(page){
    const p=current();if(!p)return;
    const rows=evaluationRows(p);
    const pages=Math.max(1,Math.ceil(rows.length/ROWS_PER_PAGE));
    state.personEvaluationTablePage=Math.min(pages,Math.max(1,Number(page)||1));
    save();
    render();
  };

  window.follow=function(){
    const p=current();
    if(!p){state.selectedPerson=null;state.view='grupo';save();return group();}

    const pc=p.required?Math.round((Number(p.done)||0)/Number(p.required)*100):0;
    const rows=evaluationRows(p);
    const pages=Math.max(1,Math.ceil(rows.length/ROWS_PER_PAGE));
    let page=Math.min(pages,Math.max(1,Number(state.personEvaluationTablePage)||1));
    state.personEvaluationTablePage=page;
    const start=(page-1)*ROWS_PER_PAGE;
    const visible=rows.slice(start,start+ROWS_PER_PAGE);

    const body=visible.map((e,index)=>{
      const failures=Array.isArray(e.failures)?e.failures:[];
      const turn=Number(e.turn)||'—';
      const number=Math.max(1,rows.length-(start+index));
      return '<tr>'+
        '<td><b>'+number+'</b></td>'+
        '<td><b>'+turn+'</b></td>'+
        '<td class="eval-items-cell">'+failureNames(e)+'</td>'+
        '<td class="eval-count-cell"><b>'+failures.length+'</b></td>'+
        '<td><span class="badge '+(e.synced?'':'warn')+'">'+(e.synced?'Sincronizada':'Pendiente')+'</span></td>'+
      '</tr>';
    }).join('');

    const table=rows.length
      ? '<section class="card person-evaluation-table-card">'+
          '<div class="row between wrap eval-table-heading"><div><h3>Evaluaciones registradas</h3><p class="muted small">Cada fila corresponde a una muestra real. Los ítems incumplidos se muestran directamente, sin abrir la evaluación.</p></div><span class="badge">'+rows.length+' muestra'+(rows.length===1?'':'s')+' real'+(rows.length===1?'':'es')+'</span></div>'+
          '<div class="table-scroll"><table class="person-evaluation-table"><thead><tr><th>Evaluación</th><th>Turno</th><th>Ítems incumplidos</th><th>Cantidad</th><th>Estado</th></tr></thead><tbody>'+body+'</tbody></table></div>'+
          '<div class="eval-pagination">'+
            '<button class="btn ghost small" onclick="personEvaluationPage('+(page-1)+')" '+(page<=1?'disabled':'')+'>← Anterior</button>'+
            '<span><b>Página '+page+' de '+pages+'</b><small> · '+(start+1)+'–'+Math.min(start+ROWS_PER_PAGE,rows.length)+' de '+rows.length+'</small></span>'+
            '<button class="btn ghost small" onclick="personEvaluationPage('+(page+1)+')" '+(page>=pages?'disabled':'')+'>Siguiente →</button>'+
          '</div>'+
        '</section>'
      : '<section class="card muted"><h3>Evaluaciones registradas</h3><p style="margin-bottom:0">Todavía no hay muestras evaluadas para esta persona.</p></section>';

    app.innerHTML=layout(
      '<button class="back" onclick="go(\'grupo\')">← Volver al grupo</button>'+
      '<section class="card hero"><h2>'+escapeEvaluationTableHtml(p.name)+'</h2><p class="muted">ID '+escapeEvaluationTableHtml(p.doc)+'</p>'+
      '<div class="row between"><b>Avance del seguimiento</b><strong>'+p.done+' / '+p.required+'</strong></div>'+
      '<div class="progress"><span style="width:'+pc+'%"></span></div>'+
      '<p><b>'+pc+'% completado</b> <span class="muted">(no es desempeño)</span></p>'+
      '<button class="btn primary block" onclick="go(\'nueva\')">+ Nueva evaluación</button>'+
      '<button class="btn ghost block" style="margin-top:8px" onclick="adjustRequired()">Ajustar evaluaciones requeridas</button></section>'+
      table,
      state.role==='analista'?'gestion':'grupo'
    );
  };

  const style=document.createElement('style');
  style.textContent=`
    .person-evaluation-table-card{padding:14px}
    .eval-table-heading h3{margin:0 0 4px}
    .eval-table-heading p{margin:0}
    .person-evaluation-table{width:100%;border-collapse:collapse;min-width:760px;margin-top:10px}
    .person-evaluation-table th,.person-evaluation-table td{border:1px solid #d8dee4;padding:10px 9px;text-align:left;vertical-align:middle}
    .person-evaluation-table th{background:#f5f7f8;font-size:.82rem;white-space:nowrap}
    .person-evaluation-table tbody tr:nth-child(even){background:#fafbfb}
    .person-evaluation-table th:nth-child(1),.person-evaluation-table td:nth-child(1),
    .person-evaluation-table th:nth-child(2),.person-evaluation-table td:nth-child(2),
    .person-evaluation-table th:nth-child(4),.person-evaluation-table td:nth-child(4){text-align:center;width:88px}
    .person-evaluation-table th:nth-child(5),.person-evaluation-table td:nth-child(5){width:120px;text-align:center}
    .eval-items-cell{min-width:280px;line-height:1.9}
    .eval-failure-chip{display:inline-block;background:#fae8e8;color:var(--danger);border:1px solid #efcaca;border-radius:999px;padding:2px 8px;margin:2px 3px 2px 0;font-size:.82rem;font-weight:750}
    .eval-ok-text{color:var(--brand);font-weight:750}
    .eval-pagination{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;margin-top:12px}
    .eval-pagination>span{text-align:center}
    .eval-pagination small{color:var(--muted)}
    @media (min-width:760px) and (max-width:1200px){
      .person-evaluation-table th,.person-evaluation-table td{padding:8px 7px}
      .person-evaluation-table-card{padding:12px}
    }
    @media (max-width:759px){
      .eval-pagination{grid-template-columns:1fr 1fr}
      .eval-pagination>span{grid-column:1/-1;grid-row:1}
      .eval-pagination button{width:100%}
    }
  `;
  document.head.appendChild(style);

  if(state.view==='seguimiento')render();
})();