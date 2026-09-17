// MODO DE PRUEBAS: permite al Asegurador crear/activar cualquier semana sin depender de la fecha real.
// Este archivo se carga al final para sobreescribir únicamente el control calendario del prototipo.
(function(){
  const pad=n=>String(n).padStart(2,'0');
  const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const fmt=d=>`${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
  function firstSunday(year){let d=new Date(year,0,1);d.setDate(d.getDate()+((7-d.getDay())%7));return d}
  function datesForWeek(year,week){const start=firstSunday(year);start.setDate(start.getDate()+(week-1)*7);const end=new Date(start);end.setDate(end.getDate()+6);return {start,end}}

  window.newWeekModal=function(){
    const y=Number(state.currentYear)||new Date().getFullYear();
    modal(`<h3>Crear semana de prueba</h3><p class="muted">Modo de pruebas: el Asegurador puede abrir cualquier semana sin esperar a la fecha del calendario.</p><label>Año</label><input id="testWeekYear" class="input" type="number" min="2000" max="2200" value="${y}"><label style="display:block;margin-top:10px">Número de semana</label><input id="testWeekNumber" class="input" type="number" min="1" max="60" value="${Number(state.currentWeek)||1}"><div class="row" style="margin-top:14px"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="activateTestWeek()">Crear / usar semana</button></div>`);
  };

  window.activateTestWeek=async function(){
    const year=Number(document.querySelector('#testWeekYear')?.value);
    const week=Number(document.querySelector('#testWeekNumber')?.value);
    if(!Number.isInteger(year)||year<2000||year>2200||!Number.isInteger(week)||week<1||week>60)return toast('Ingrese un año y una semana válidos');
    const d=datesForWeek(year,week);

    let azureWeek, azureParticipants, operationalRows;
    try{
      if(!window.SiembraApi||typeof SiembraApi.ensureWeek!=='function'||typeof SiembraApi.getParticipants!=='function'||typeof SiembraApi.getOperationalState!=='function')throw new Error('API no disponible');
      azureWeek=await SiembraApi.ensureWeek({anio:year,numero:week,inicio:iso(d.start),fin:iso(d.end)});
      azureParticipants=await SiembraApi.getParticipants(azureWeek.IdSemana);
      operationalRows=await SiembraApi.getOperationalState(azureWeek.IdSemana);
    }catch(error){
      console.error('No fue posible abrir/sincronizar la semana con Azure.',error);
      return toast('No se pudo abrir la semana desde Azure. La semana local no fue modificada.');
    }

    const realCatalog=(typeof empleadosReales!=='undefined'&&Array.isArray(empleadosReales))
      ? empleadosReales.map(e=>({id:'emp-'+e.codigo,name:e.nombre,doc:e.codigo,area:e.area}))
      : [];
    const demoCatalog=seed.people.concat(seed.available);
    const catalog=[...realCatalog,...demoCatalog];
    const byDoc=new Map(catalog.map(p=>[String(p.doc),p]));
    const rowsByParticipation=new Map();
    for(const row of (operationalRows||[])){
      const key=Number(row.IdParticipacion);
      if(!rowsByParticipation.has(key))rowsByParticipation.set(key,[]);
      rowsByParticipation.get(key).push(row);
    }

    const people=[];
    const evals=[];
    for(const ap of azureParticipants){
      if(ap.Estado!=='EN_LA_SEMANA')continue;
      const source=byDoc.get(String(ap.SembradorCorporativoId));
      if(!source){
        console.warn('Participante Azure no encontrado en el catálogo de pruebas:',ap.SembradorCorporativoId);
        continue;
      }
      const personId=source.id+'w'+year+'-'+week;
      const rows=rowsByParticipation.get(Number(ap.IdParticipacion))||[];
      const resolvedTurns=[...new Set(rows.filter(r=>r.IdResolucion!=null).map(r=>Number(r.NumeroTurno)))];
      const evaluationIds=[...new Set(rows.filter(r=>r.IdEvaluacion!=null).map(r=>Number(r.IdEvaluacion)))];
      const person={
        id:personId,
        name:source.name,
        doc:source.doc,
        done:evaluationIds.length,
        required:30,
        sampleTurn:resolvedTurns.length ? Math.max(...resolvedTurns) : Math.max(0,Number(ap.TurnoInicio||1)-1),
        azureParticipationId:ap.IdParticipacion,
        turnoInicio:ap.TurnoInicio
      };
      people.push(person);

      for(const evaluationId of evaluationIds){
        const erows=rows.filter(r=>Number(r.IdEvaluacion)===evaluationId);
        const first=erows[0];
        const failed=[...new Set(erows.map(r=>r.CodigoItem).filter(Boolean))];
        evals.push({
          id:'azure-eval-'+evaluationId,
          person:personId,
          personId:personId,
          week:week,
          year:year,
          turn:Number(first.NumeroTurno),
          sampleTurn:Number(first.NumeroTurno),
          fails:failed,
          failed:failed,
          synced:true,
          azureEvaluationId:evaluationId,
          azureResolutionId:first.IdResolucion,
          at:first.ResueltoEn
        });
      }
    }
    const activeDocs=new Set(people.map(p=>String(p.doc)));

    state.lastAssurerWeek=state.currentWeek; state.lastAssurerYear=state.currentYear;
    state.currentYear=year; state.currentWeek=week; state.currentWeekStart=iso(d.start); state.currentWeekEnd=iso(d.end);
    state.currentAzureWeekId=azureWeek.IdSemana;
    state.people=people; state.evals=evals; state.pending=0; state.selectedPerson=null;
    state.available=realCatalog.filter(p=>!activeDocs.has(String(p.doc))).map(p=>({id:p.id+'w'+year+'-'+week,name:p.name,doc:p.doc,area:p.area}));
    if(!state.calendarWeeks)state.calendarWeeks={};
    state.calendarWeeks[`${year}-w${week}`]={status:'EVALUACION',start:iso(d.start),end:iso(d.end),testMode:true,azureWeekId:azureWeek.IdSemana};
    save(); closeModal(); render(); toast(`Semana ${week} de ${year} abierta y reconstruida desde Azure`);
  };

  function decorate(){
    if(state.role!=='monitor'||state.view!=='grupo')return;
    const hero=document.querySelector('.hero');if(!hero)return;
    const h2=hero.querySelector('h2');
    if(h2){const badge=h2.querySelector('.sample-turn-badge');h2.childNodes.forEach(n=>{if(n.nodeType===3)n.textContent=''});h2.insertAdjacentText('afterbegin',`Semana ${state.currentWeek} · ${state.currentYear||''} `);if(badge)h2.appendChild(badge)}
    let p=h2&&h2.nextElementSibling;if(p&&p.classList.contains('muted')){let d=datesForWeek(Number(state.currentYear)||new Date().getFullYear(),Number(state.currentWeek)||1);p.textContent=`${fmt(d.start)} al ${fmt(d.end)} · Modo de pruebas`}
    let btn=[...hero.querySelectorAll('button')].find(b=>/Ver semana actual|Nueva semana|Crear semana/i.test(b.textContent));
    if(btn){btn.textContent='+ Crear semana de prueba';btn.onclick=()=>newWeekModal()}
  }
  const obs=new MutationObserver(()=>{clearTimeout(window.__testWeekTimer);window.__testWeekTimer=setTimeout(decorate,0)});obs.observe(document.querySelector('#app'),{childList:true,subtree:true});setTimeout(decorate,0);
})();