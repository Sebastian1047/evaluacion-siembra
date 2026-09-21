// MODO DE PRUEBAS: permite al Asegurador crear/activar cualquier semana sin depender de la fecha real.
// Este archivo se carga al final para sobreescribir únicamente el control calendario del prototipo.
(function(){
  const pad=n=>String(n).padStart(2,'0');
  const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1,'0')}-${pad(d.getDate(),'0')}`;
  const fmt=d=>`${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
  function firstSunday(year){let d=new Date(year,0,1);d.setDate(d.getDate()+((7-d.getDay())%7));return d}
  function datesForWeek(year,week){const start=firstSunday(year);start.setDate(start.getDate()+(week-1)*7);const end=new Date(start);end.setDate(end.getDate()+6);return {start,end}}

  window.newWeekModal=function(){
    const currentYear=Number(state.currentYear)||new Date().getFullYear();
    const currentWeek=Number(state.currentWeek)||1;
    if(typeof currentWeekClosedForCreation==='function'&&!currentWeekClosedForCreation()){
      return modal(`<h3>Primero debe cerrar la Semana ${currentWeek}</h3><p>No puede crear la siguiente semana mientras la actual permanezca abierta.</p><button class="btn primary block" onclick="closeModal()">Entendido</button>`);
    }
    // En el modo de pruebas también se respeta estrictamente el consecutivo.
    // No se permite escribir ni saltar manualmente números de semana.
    let nextYear=currentYear;
    let nextWeek=currentWeek+1;
    const nextYearFirstSunday=firstSunday(currentYear+1);
    const currentYearLastSunday=new Date(nextYearFirstSunday);
    currentYearLastSunday.setDate(currentYearLastSunday.getDate()-7);
    const lastWeekOfYear=Math.floor((currentYearLastSunday-firstSunday(currentYear))/(7*86400000))+1;
    if(nextWeek>lastWeekOfYear){nextYear=currentYear+1;nextWeek=1}
    const d=datesForWeek(nextYear,nextWeek);
    modal(`<h3>Crear Semana ${nextWeek} de ${nextYear}</h3><p>La Semana ${currentWeek} ya está terminada.</p><p>La siguiente semana disponible es <b>Semana ${nextWeek} de ${nextYear}</b> (${fmt(d.start)} al ${fmt(d.end)}).</p><p class="muted">El consecutivo es automático y no puede adelantarse ni saltarse semanas.</p><div class="row" style="margin-top:14px"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="activateTestWeek(${nextYear},${nextWeek})">Crear Semana ${nextWeek}</button></div>`);
  };

  // En modo de pruebas, "Marcar semana no evaluada" debe actuar sobre la semana
  // operativa activa, no sobre la semana correspondiente a la fecha real.
  window.markCurrentWeekNotEvaluated=function(){
    const year=Number(state.currentYear);
    const week=Number(state.currentWeek);
    const d=datesForWeek(year,week);
    if((state.people||[]).length||(state.evals||[]).length){
      return modal('<h3>No se puede inactivar esta semana</h3><p>Ya tiene actividad registrada. Primero debe resolver la información existente.</p><button class="btn primary block" onclick="closeModal()">Entendido</button>');
    }
    modal(`<h3>Marcar semana como no evaluada</h3><p>La Semana ${week} de ${year} (${fmt(d.start)} al ${fmt(d.end)}) quedará registrada como <b>NO EVALUADA</b>.</p><p class="muted">En modo de pruebas se cerrará únicamente este período operativo, sin crear evaluaciones ni resoluciones ficticias.</p><div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn danger" onclick="confirmWeekNotEvaluated()">Confirmar</button></div>`);
  };

  window.confirmWeekNotEvaluated=function(){
    const year=Number(state.currentYear);
    const week=Number(state.currentWeek);
    const d=datesForWeek(year,week);
    if(!state.calendarWeeks)state.calendarWeeks={};
    state.calendarWeeks[`${year}-w${week}`]={...(state.calendarWeeks[`${year}-w${week}`]||{}),status:'NO_EVALUADA',start:iso(d.start),end:iso(d.end),testMode:true};
    if(!state.closedGroupWeeks)state.closedGroupWeeks={};
    state.closedGroupWeeks['w'+week]={closed:true,noEvaluada:true,closedAt:new Date().toISOString(),editEnabled:false,permanentlyLocked:false};
    state.lastAssurerWeek=week;
    state.lastAssurerYear=year;
    save();closeModal();render();toast(`Semana ${week} marcada como no evaluada`);
  };

  window.activateTestWeek=async function(yearOverride,weekOverride){
    const year=Number(yearOverride ?? document.querySelector('#testWeekYear')?.value);
    const week=Number(weekOverride ?? document.querySelector('#testWeekNumber')?.value);
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
    const removedPeople=[];
    const evals=[];
    const omissions=[];
    for(const ap of azureParticipants){
      const source=byDoc.get(String(ap.SembradorCorporativoId));
      if(!source){
        console.warn('Participante Azure no encontrado en el catálogo de pruebas:',ap.SembradorCorporativoId);
        continue;
      }
      const personId=source.id+'w'+year+'-'+week;
      const rows=rowsByParticipation.get(Number(ap.IdParticipacion))||[];
      const resolutionRows=[];
      const seenResolutions=new Set();
      for(const row of rows){
        if(row.IdResolucion==null)continue;
        const rid=Number(row.IdResolucion);
        if(seenResolutions.has(rid))continue;
        seenResolutions.add(rid);resolutionRows.push(row);
      }
      const resolvedTurns=[...new Set(resolutionRows.map(r=>Number(r.NumeroTurno)))];
      const omittedRows=resolutionRows.filter(r=>r.Tipo==='NO_REALIZADA');
      const evaluationIds=[...new Set(rows.filter(r=>r.IdEvaluacion!=null).map(r=>Number(r.IdEvaluacion)))];
      const ultimoTurnoIncorporacion=rows.length?Math.max(...rows.map(r=>Number(r.UltimoTurnoIncorporacion)||0)):0;
      const ultimoTurnoResuelto=resolvedTurns.length?Math.max(...resolvedTurns):0;
      const cursorReincorporacion=Math.max(0,ultimoTurnoIncorporacion-1);
      const sampleTurn=Math.max(ultimoTurnoResuelto,cursorReincorporacion,Math.max(0,Number(ap.TurnoInicio||1)-1));
      const done=evaluationIds.length;
      const person={
        id:personId,
        name:source.name,
        doc:source.doc,
        area:source.area,
        done,
        // La meta efectiva no es el total de turnos. Los turnos siguen siendo hasta 30.
        // Aquí solo contamos cuántas evaluaciones reales todavía puede alcanzar:
        // 30 - rondas ya pasadas sin evaluación. Esto incluye NO_REALIZADA,
        // ingreso tardío y rondas transcurridas durante un retiro.
        required:Math.max(done,Math.min(30,30-sampleTurn+done)),
        originalRequired:30,
        // El cursor operativo puede estar por delante del último turno realmente resuelto
        // cuando hubo retiro y reincorporación. No inventa una resolución intermedia.
        sampleTurn,
        azureParticipationId:ap.IdParticipacion,
        turnoInicio:ap.TurnoInicio,
        ultimoTurnoIncorporacion:ultimoTurnoIncorporacion||Number(ap.TurnoInicio)||1
      };

      if(ap.Estado==='EN_LA_SEMANA'){
        people.push(person);
      }else if(ap.Estado==='QUITADO_TEMPORALMENTE'){
        removedPeople.push({...person,removedFromWeek:true});
      }

      // El historial pertenece a la semana aunque la persona esté retirada temporalmente.
      for(const omitted of omittedRows){
        omissions.push({week:week,year:year,person:personId,turn:Number(omitted.NumeroTurno),date:omitted.ResueltoEn,synced:true,azureResolutionId:omitted.IdResolucion});
      }
      for(const evaluationId of evaluationIds){
        const erows=rows.filter(r=>Number(r.IdEvaluacion)===evaluationId);
        const first=erows[0];
        const failed=[...new Set(erows.map(r=>r.CodigoItem).filter(Boolean))];
        evals.push({id:'azure-eval-'+evaluationId,person:personId,personId:personId,week:week,year:year,turn:Number(first.NumeroTurno),sampleTurn:Number(first.NumeroTurno),failures:failed,fails:failed,failed:failed,score:Math.max(0,100-failed.length*8),synced:true,azureEvaluationId:evaluationId,azureResolutionId:first.IdResolucion,at:first.ResueltoEn,date:first.ResueltoEn?new Date(first.ResueltoEn).toLocaleString('es-CO'):''});
      }
    }
    const activeDocs=new Set(people.map(p=>String(p.doc)));
    const removedByDoc=new Map(removedPeople.map(p=>[String(p.doc),p]));
    const allWeeklyParticipants=[...people,...removedPeople];
    const maxResolvedTurn=allWeeklyParticipants.length?Math.max(...allWeeklyParticipants.map(p=>Number(p.sampleTurn)||0)):0;
    const activeMinTurn=people.length?Math.min(...people.map(p=>Number(p.sampleTurn)||0)):null;
    const operationalTurn=activeMinTurn!==null?activeMinTurn+1:Math.max(1,maxResolvedTurn+1);

    state.lastAssurerWeek=state.currentWeek; state.lastAssurerYear=state.currentYear;
    state.currentYear=year; state.currentWeek=week; state.currentWeekStart=iso(d.start); state.currentWeekEnd=iso(d.end);
    state.currentAzureWeekId=azureWeek.IdSemana;
    state.weekOperationalSampleTurn=operationalTurn;
    state.people=people; state.evals=evals; state.sampleTurnOmissions=omissions; state.pending=0; state.selectedPerson=null;
    state.available=realCatalog.filter(p=>!activeDocs.has(String(p.doc))).map(p=>{
      const removed=removedByDoc.get(String(p.doc));
      return removed || {id:p.id+'w'+year+'-'+week,name:p.name,doc:p.doc,area:p.area};
    });
    if(!state.calendarWeeks)state.calendarWeeks={};
    const weekKey=`${year}-w${week}`;
    const previousCalendarRecord=state.calendarWeeks[weekKey]||{};
    const localNoEvaluada=previousCalendarRecord.status==='NO_EVALUADA'||!!(state.closedGroupWeeks&&state.closedGroupWeeks['w'+week]?.noEvaluada);
    const azureClosed=String(azureWeek.Estado||'').toUpperCase()==='CERRADA';
    // NO_EVALUADA es un estado operativo local deliberado: no genera cierre ni
    // evaluaciones ficticias en Azure, por lo que no debe perderse al reconstruir.
    state.calendarWeeks[weekKey]={...previousCalendarRecord,status:localNoEvaluada?'NO_EVALUADA':(azureClosed?'CERRADA':'EVALUACION'),start:iso(d.start),end:iso(d.end),testMode:true,azureWeekId:azureWeek.IdSemana};
    if(!state.closedGroupWeeks)state.closedGroupWeeks={};
    if(localNoEvaluada){
      state.closedGroupWeeks['w'+week]={...(state.closedGroupWeeks['w'+week]||{}),closed:true,noEvaluada:true,editEnabled:false,permanentlyLocked:false};
    }else if(azureClosed){
      state.closedGroupWeeks['w'+week]={...(state.closedGroupWeeks['w'+week]||{}),closed:true,azureClosed:true,closedAt:azureWeek.FechaCierre||state.closedGroupWeeks['w'+week]?.closedAt||new Date().toISOString()};
    }else{
      delete state.closedGroupWeeks['w'+week];
    }
    save(); closeModal(); render(); toast(`Semana ${week} de ${year} ${azureClosed?'cerrada':'abierta'} y reconstruida desde Azure`);
  };

  async function openLatestAzureWeek(){
    if(window.__latestAzureWeekOpening||window.__latestAzureWeekOpened)return;
    if(state.role!=='monitor'||state.view!=='grupo')return;
    if(!window.SiembraApi||typeof SiembraApi.getLatestWeek!=='function')return;
    window.__latestAzureWeekOpening=true;
    try{
      const latest=await SiembraApi.getLatestWeek();
      const year=Number(latest.AnioEvaluacion);
      const week=Number(latest.NumeroSemana);
      if(!Number.isInteger(year)||!Number.isInteger(week))throw new Error('Semana Azure inválida');
      window.__latestAzureWeekOpened=true;
      await window.activateTestWeek(year,week);
    }catch(error){window.__latestAzureWeekOpened=false;console.error('No fue posible recuperar automáticamente la última semana de Azure.',error);}finally{window.__latestAzureWeekOpening=false;}
  }

  function decorate(){
    if(state.role!=='monitor'||state.view!=='grupo')return;
    openLatestAzureWeek();
    const hero=document.querySelector('.hero');if(!hero)return;
    const h2=hero.querySelector('h2');
    if(h2){const badge=h2.querySelector('.sample-turn-badge');h2.childNodes.forEach(n=>{if(n.nodeType===3)n.textContent=''});h2.insertAdjacentText('afterbegin',`Semana ${state.currentWeek} · ${state.currentYear||''} `);if(badge)h2.appendChild(badge)}
    let p=h2&&h2.nextElementSibling;if(p&&p.classList.contains('muted')){let d=datesForWeek(Number(state.currentYear)||new Date().getFullYear(),Number(state.currentWeek)||1);p.textContent=`${fmt(d.start)} al ${fmt(d.end)} · Modo de pruebas`}
    let btn=[...hero.querySelectorAll('button')].find(b=>/Ver semana actual|Nueva semana|Crear semana/i.test(b.textContent));
    if(btn){btn.textContent='+ Crear semana de prueba';btn.onclick=()=>newWeekModal()}
  }
  const obs=new MutationObserver(()=>{clearTimeout(window.__testWeekTimer);window.__testWeekTimer=setTimeout(decorate,0)});obs.observe(document.querySelector('#app'),{childList:true,subtree:true});setTimeout(decorate,0);
})();