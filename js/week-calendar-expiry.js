// Vigencia calendario de la semana operativa.
// Se carga al final para aplicar la regla incluso sobre el modo de pruebas:
// una semana vencida puede consultarse/cerrarse, pero no seguir operándose.
(function(){
  const DAY=86400000;
  const parseDate=v=>{if(!v)return null;const [y,m,d]=String(v).slice(0,10).split('-').map(Number);return new Date(y,m-1,d)};
  const today=()=>{const d=new Date();return new Date(d.getFullYear(),d.getMonth(),d.getDate())};
  const endDate=()=>parseDate(state.currentWeekEnd);
  const expired=()=>{const e=endDate();return !!e&&today()>e};
  const lastDay=()=>{const e=endDate();return !!e&&today().getTime()===e.getTime()};
  const fmt=d=>d?d.toLocaleDateString('es-CO'):'';

  window.operationalWeekExpired=expired;

  function expiredModal(){
    const hasReal=(state.evals||[]).length>0||(state.people||[]).some(p=>Number(p.done)>0);
    return modal(`<h3>Semana ${state.currentWeek} vencida</h3><p>El tiempo calendario de esta semana terminó el <b>${fmt(endDate())}</b>.</p><p><b>Ya no es posible agregar sembradores, registrar evaluaciones, avanzar turnos ni registrar muestras no realizadas.</b></p><p class="muted">${hasReal?'Esta semana tiene evaluaciones reales. Debe cerrarla para poder continuar con la siguiente semana.':'Esta semana no tiene evaluaciones. Márquela como <b>Semana no evaluada</b> para inactivarla y poder crear la siguiente.'}</p><div class="row"><button class="btn ghost" onclick="closeModal()">Entendido</button>${hasReal?'<button class="btn danger" onclick="closeModal();askCloseGroupWeek()">Cerrar semana</button>':'<button class="btn danger" onclick="closeModal();markCurrentWeekNotEvaluated()">Marcar no evaluada</button>'}</div>`);
  }
  window.showExpiredWeekCalendarAlert=expiredModal;

  if(typeof go==='function'){
    const before=go;
    go=function(v){if(expired()&&['nueva','agregar','evaluarItems'].includes(v))return expiredModal();return before(v)};
  }
  for(const name of ['addWorker','saveEval','commitEval','omitCurrentSample','advanceGroupSampleTurn','confirmRemoveFromGroup']){
    const f=window[name];
    if(typeof f==='function')window[name]=function(){if(expired())return expiredModal();return f.apply(this,arguments)};
  }

  // Persistir NO_EVALUADA en Azure. No crea evaluaciones ni resoluciones.
  const localConfirm=window.confirmWeekNotEvaluated;
  window.confirmWeekNotEvaluated=async function(){
    try{
      let weekId=Number(state.currentAzureWeekId)||0;
      if(!weekId){
        const w=await SiembraApi.getWeek(Number(state.currentYear),Number(state.currentWeek));
        weekId=Number(w.IdSemana)||0;
      }
      if(!weekId)throw new Error('Semana Azure no identificada');
      await SiembraApi.markWeekNotEvaluated(weekId);
      state.currentAzureWeekId=weekId;
      if(!state.calendarWeeks)state.calendarWeeks={};
      const key=state.currentYear+'-w'+state.currentWeek;
      state.calendarWeeks[key]={...(state.calendarWeeks[key]||{}),status:'NO_EVALUADA',start:state.currentWeekStart,end:state.currentWeekEnd};
      if(!state.closedGroupWeeks)state.closedGroupWeeks={};
      state.closedGroupWeeks['w'+state.currentWeek]={closed:true,noEvaluada:true,closedAt:new Date().toISOString(),editEnabled:false,permanentlyLocked:false};
      state.lastAssurerWeek=state.currentWeek;state.lastAssurerYear=state.currentYear;
      save();closeModal();render();toast('Semana '+state.currentWeek+' marcada como no evaluada');
    }catch(error){
      console.error('No fue posible marcar la semana como no evaluada.',error);
      toast(error.message||'No se pudo inactivar la semana');
    }
  };

  function decorate(){
    if(state.role!=='monitor'||state.view!=='grupo'||groupWeekIsClosed?.())return;
    const hero=document.querySelector('.hero');if(!hero)return;
    let notice=hero.querySelector('#calendar-expiry-notice');
    if(!expired()&&!lastDay()){if(notice)notice.remove();return}
    if(!notice){notice=document.createElement('div');notice.id='calendar-expiry-notice';notice.className='card';notice.style.cssText='margin-top:12px;border-left:4px solid #d97706';hero.appendChild(notice)}
    if(expired()){
      notice.innerHTML=`<b>Semana calendario vencida</b><p style="margin:5px 0 0">Finalizó el ${fmt(endDate())}. No admite nuevas operaciones. Debe cerrarla o marcarla como no evaluada antes de continuar.</p>`;
      document.querySelectorAll('button').forEach(b=>{const t=(b.textContent||'').toLowerCase();if(t.includes('nueva evaluación')||t.includes('agregar')||t.includes('pasar al siguiente turno')||t.includes('no realizar muestra')){b.disabled=true;b.title='Semana calendario vencida'}});
    }else if(lastDay()){
      notice.innerHTML='<b>Último día calendario de esta semana</b><p style="margin:5px 0 0">Puede evaluar durante el día de hoy. A partir de mañana no podrá agregar sembradores ni registrar más evaluaciones; deberá cerrar la semana para continuar.</p>';
    }
  }
  const obs=new MutationObserver(()=>{clearTimeout(window.__calendarExpiryTimer);window.__calendarExpiryTimer=setTimeout(decorate,0)});
  obs.observe(document.querySelector('#app'),{childList:true,subtree:true});setTimeout(decorate,0);
})();