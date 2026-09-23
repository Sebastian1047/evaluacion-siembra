// Autorizaciones agrupadas por sembrador.
// Primero se elige la persona y luego se muestran únicamente sus evaluaciones
// protegidas, paginadas para revisión cómoda en tablet y pantallas pequeñas.
(function(){
  const ROWS_PER_PAGE=6;
  let cache=null;

  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}

  async function authorizationData(force){
    if(cache&&!force)return cache;
    if(!window.SiembraApi)throw new Error('API no disponible');
    const week=await SiembraApi.getLatestWeek();
    const weekId=Number(week.IdSemana)||0;
    if(!weekId)throw new Error('Semana Azure no disponible');
    const [operational,authorizations]=await Promise.all([
      SiembraApi.getOperationalState(weekId),
      SiembraApi.getCorrectionAuthorizations(weekId)
    ]);
    const unavailable=new Set((Array.isArray(authorizations)?authorizations:[])
      .filter(a=>a.Estado==='AUTORIZADA').map(a=>Number(a.IdResolucion)));
    const byParticipation=new Map();
    (Array.isArray(operational)?operational:[]).forEach(r=>{
      const id=Number(r.IdParticipacion);
      if(!byParticipation.has(id))byParticipation.set(id,[]);
      byParticipation.get(id).push(r);
    });
    const rows=[];
    for(const participantRows of byParticipation.values()){
      const first=participantRows[0]||{};
      const evaluated=participantRows.filter(r=>r.Tipo==='EVALUACION'&&r.IdEvaluacion&&Number(r.NumeroTurno)>0);
      const turns=[...new Set(evaluated.map(r=>Number(r.NumeroTurno)))].sort((a,b)=>b-a);
      const direct=String(week.Estado||'').toUpperCase()==='CERRADA'?new Set():new Set(turns.slice(0,2));
      for(const turn of turns){
        if(direct.has(turn))continue;
        const row=evaluated.find(r=>Number(r.NumeroTurno)===turn);
        if(!row||unavailable.has(Number(row.IdResolucion)))continue;
        const personId=String(first.SembradorCorporativoId||'');
        const personName=(typeof empleadosReales!=='undefined'?empleadosReales.find(e=>String(e.codigo)===personId)?.nombre:null)||personId||'Sembrador';
        rows.push({resolutionId:Number(row.IdResolucion),personId,personName,turn});
      }
    }
    rows.sort((a,b)=>a.personName.localeCompare(b.personName,'es')||b.turn-a.turn);
    cache={week,rows};
    return cache;
  }

  function renderPeople(data){
    const groups=new Map();
    data.rows.forEach(r=>{
      if(!groups.has(r.personId))groups.set(r.personId,{id:r.personId,name:r.personName,count:0});
      groups.get(r.personId).count++;
    });
    const people=[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,'es'));
    const cards=people.map(p=>`<button type="button" class="card authorization-person-card" onclick="openAuthorizationPerson('${esc(p.id)}')"><div><b>${esc(p.name)}</b><div class="muted small">ID: ${esc(p.id)}</div></div><div class="authorization-person-meta"><span class="badge">${p.count} muestra${p.count===1?'':'s'}</span><span class="authorization-arrow">→</span></div></button>`).join('');
    app.innerHTML=layout(`<section class="authorization-shell"><section class="card hero"><span class="badge">Semana ${data.week.NumeroSemana} · ${data.week.AnioEvaluacion}</span><h2 style="margin:8px 0 4px">Autorizaciones</h2><p class="muted" style="margin-bottom:0">Seleccione un sembrador para consultar las muestras que pueden habilitarse.</p></section><h3>Sembradores</h3><div class="authorization-people-grid">${cards||'<div class="card muted">No hay evaluaciones disponibles para habilitar.</div>'}</div></section>`,'gestion');
  }

  function renderPerson(data,personId,page){
    const rows=data.rows.filter(r=>r.personId===personId);
    if(!rows.length)return renderPeople(data);
    const pages=Math.max(1,Math.ceil(rows.length/ROWS_PER_PAGE));
    page=Math.min(pages,Math.max(1,Number(page)||1));
    const start=(page-1)*ROWS_PER_PAGE,visible=rows.slice(start,start+ROWS_PER_PAGE);
    const name=rows[0].personName;
    window.__azureAuthorizationRows=rows;
    const cards=visible.map((r,i)=>{
      const realIndex=start+i;
      return `<article class="card authorization-sample-card"><div><b>Turno ${r.turn}</b><div class="muted small">Semana ${data.week.NumeroSemana} · ${data.week.AnioEvaluacion}</div></div><button class="btn primary authorization-enable" onclick="enableAzureEvaluation(${realIndex})">Habilitar</button></article>`;
    }).join('');
    app.innerHTML=layout(`<section class="authorization-shell"><button class="back" onclick="showAuthorizationPeople()">← Volver a sembradores</button><section class="card hero"><span class="badge">Autorizaciones</span><h2 style="margin:8px 0 4px">${esc(name)}</h2><p class="muted">ID: ${esc(personId)} · ${rows.length} muestra${rows.length===1?'':'s'} disponible${rows.length===1?'':'s'} para habilitar</p></section><div class="authorization-sample-list">${cards}</div><div class="authorization-pagination"><button class="btn ghost" onclick="authorizationPersonPage(${page-1})" ${page<=1?'disabled':''}>← Anterior</button><span><b>Página ${page} de ${pages}</b><small> · ${start+1}–${Math.min(start+ROWS_PER_PAGE,rows.length)} de ${rows.length}</small></span><button class="btn ghost" onclick="authorizationPersonPage(${page+1})" ${page>=pages?'disabled':''}>Siguiente →</button></div></section>`,'gestion');
    state.authorizationPersonId=personId;
    state.authorizationPage=page;
    save();
  }

  window.loadAzureAuthorizationsView=async function(force){
    try{
      app.innerHTML=layout('<section class="authorization-shell"><div class="card muted">Cargando autorizaciones...</div></section>','gestion');
      const data=await authorizationData(force);
      if(state.authorizationPersonId&&data.rows.some(r=>r.personId===state.authorizationPersonId)){
        renderPerson(data,state.authorizationPersonId,state.authorizationPage||1);
      }else{
        state.authorizationPersonId=null;state.authorizationPage=1;save();renderPeople(data);
      }
    }catch(error){
      console.error('No fue posible cargar Autorizaciones desde Azure.',error);
      app.innerHTML=layout('<section class="authorization-shell"><div class="card muted">No se pudieron cargar las autorizaciones. Verifique la conexión a Internet.</div></section>','gestion');
    }
  };

  window.openAuthorizationPerson=async function(personId){
    const data=await authorizationData(false);
    state.authorizationPersonId=String(personId);state.authorizationPage=1;save();
    renderPerson(data,String(personId),1);
  };
  window.showAuthorizationPeople=async function(){
    const data=await authorizationData(false);
    state.authorizationPersonId=null;state.authorizationPage=1;save();renderPeople(data);
  };
  window.authorizationPersonPage=async function(page){
    const data=await authorizationData(false);
    if(!state.authorizationPersonId)return renderPeople(data);
    renderPerson(data,state.authorizationPersonId,page);
  };

  // Conserva la lógica existente de habilitación; después refresca la fuente
  // para que la muestra habilitada desaparezca inmediatamente de la lista.
  const oldEnable=window.enableAzureEvaluation;
  window.enableAzureEvaluation=async function(index){
    const row=(window.__azureAuthorizationRows||[])[Number(index)];
    if(!row)return toast('Evaluación no encontrada');
    try{
      await SiembraApi.authorizeCorrection(row.resolutionId,{solicitadaPor:'asegurador-prueba',aprobadaPor:'analista-prueba'});
      toast('Evaluación habilitada y sincronizada con Azure');
      cache=null;
      await loadAzureAuthorizationsView(true);
    }catch(error){
      console.error('No fue posible habilitar la evaluación en Azure.',error);
      toast('No se pudo habilitar la evaluación. Verifique la conexión a Internet.');
    }
  };

  const style=document.createElement('style');
  style.textContent=`
    .authorization-shell{max-width:820px;margin:0 auto}
    .authorization-people-grid{display:grid;grid-template-columns:1fr;gap:10px}
    .authorization-person-card{width:100%;display:flex;align-items:center;justify-content:space-between;text-align:left;cursor:pointer;color:var(--text);font:inherit}
    .authorization-person-meta{display:flex;align-items:center;gap:10px}
    .authorization-arrow{font-size:1.3rem;font-weight:800;color:var(--brand)}
    .authorization-sample-list{display:grid;gap:9px}
    .authorization-sample-card{display:grid;grid-template-columns:1fr auto;align-items:center;gap:14px;margin-bottom:0;padding:13px 15px}
    .authorization-enable{min-width:120px}
    .authorization-pagination{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;margin:16px 0}
    .authorization-pagination>span{text-align:center}
    .authorization-pagination small{color:var(--muted)}
    @media(min-width:760px){.authorization-people-grid{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:600px){
      .authorization-sample-card{grid-template-columns:1fr}
      .authorization-enable{width:100%}
      .authorization-pagination{grid-template-columns:1fr 1fr}
      .authorization-pagination>span{grid-column:1/-1;grid-row:1}
      .authorization-pagination button{width:100%}
    }
  `;
  document.head.appendChild(style);
})();