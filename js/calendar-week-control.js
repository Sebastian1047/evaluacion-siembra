// Control calendario del prototipo.
// La semana de evaluacion va de domingo a sabado y pertenece al anio del domingo que la inicia.
// El calendario determina anio, consecutivo y fechas; el Asegurador no puede adelantar semanas manualmente.
(function(){
  const DAY=86400000;
  const pad=n=>String(n).padStart(2,'0');
  const dateOnly=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
  const fmt=d=>`${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
  const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

  function sundayOf(d){
    d=dateOnly(d);
    d.setDate(d.getDate()-d.getDay());
    return d;
  }
  function firstSunday(year){
    let d=new Date(year,0,1);
    d.setDate(d.getDate()+((7-d.getDay())%7));
    return d;
  }
  function calendarWeekFor(d){
    const start=sundayOf(d), year=start.getFullYear(), first=firstSunday(year);
    // Los dias previos al primer domingo pertenecen a la ultima semana iniciada en el anio anterior.
    if(start<first)return calendarWeekFor(new Date(year-1,11,31));
    const number=Math.floor((start-first)/(7*DAY))+1;
    const end=new Date(start); end.setDate(end.getDate()+6);
    return {year,number,start,end};
  }
  function currentCalendarWeek(){return calendarWeekFor(new Date())}

  function ensureCalendarState(){
    const c=currentCalendarWeek();
    if(!state.currentYear)state.currentYear=c.year;
    if(!state.currentWeekStart)state.currentWeekStart=iso(c.start);
    if(!state.currentWeekEnd)state.currentWeekEnd=iso(c.end);
    if(!state.calendarWeeks)state.calendarWeeks={};
    if(!state.calendarWeeks[`${state.currentYear}-w${state.currentWeek}`]){
      state.calendarWeeks[`${state.currentYear}-w${state.currentWeek}`]={status:'EVALUACION'};
    }
    save();
  }
  ensureCalendarState();

  window.calendarWeekFor=calendarWeekFor;
  window.currentCalendarWeek=currentCalendarWeek;

  // Sustituye el antiguo modal que permitia crear consecutivos o semanas manuales.
  newWeekModal=function(){
    const c=currentCalendarWeek();
    const storedYear=Number(state.currentYear)||c.year;
    const storedWeek=Number(state.currentWeek)||c.number;
    const same=storedYear===c.year&&storedWeek===c.number;
    if(same){
      return modal(`<h3>Semana ${c.number} de ${c.year}</h3><p><b>${fmt(c.start)} al ${fmt(c.end)}</b></p><p>Esta es la semana que corresponde a la fecha actual.</p><p class="muted">Las semanas ya no se crean manualmente ni se puede adelantar su consecutivo. El calendario determina automaticamente la semana disponible.</p><button class="btn primary block" onclick="closeModal()">Entendido</button>`);
    }
    modal(`<h3>Semana calendario disponible</h3><p>La fecha actual corresponde a la <b>Semana ${c.number} de ${c.year}</b>.</p><p><b>${fmt(c.start)} al ${fmt(c.end)}</b></p><p class="muted">Para comenzar este periodo, la semana operativa anterior debe estar cerrada o marcada como no evaluada.</p><button class="btn primary block" onclick="activateCalendarWeek()">Usar Semana ${c.number}</button><button class="btn ghost block" style="margin-top:8px" onclick="closeModal()">Cancelar</button>`);
  };

  window.activateCalendarWeek=function(){
    const c=currentCalendarWeek();
    if(typeof currentWeekClosedForCreation==='function'&&!currentWeekClosedForCreation()){
      return modal(`<h3>Semana anterior pendiente</h3><p>No puede comenzar la Semana ${c.number} de ${c.year} mientras la semana operativa anterior siga abierta.</p><p class="muted">Ciérrela correctamente o márquela como semana no evaluada cuando corresponda.</p><button class="btn primary block" onclick="closeModal()">Entendido</button>`);
    }
    const previousWeek=state.currentWeek, previousYear=state.currentYear;
    let r=state.closedGroupWeeks&&state.closedGroupWeeks['w'+previousWeek];
    if(r){r.editEnabled=false;r.permanentlyLocked=true;r.lockedAt=new Date().toISOString()}
    state.lastAssurerWeek=previousWeek;
    state.lastAssurerYear=previousYear;
    state.currentYear=c.year;
    state.currentWeek=c.number;
    state.currentWeekStart=iso(c.start);
    state.currentWeekEnd=iso(c.end);
    state.people=[];state.evals=[];state.pending=0;state.selectedPerson=null;
    state.available=seed.people.concat(seed.available).map(p=>({id:p.id+'w'+c.year+'-'+c.number,name:p.name,doc:p.doc}));
    if(!state.calendarWeeks)state.calendarWeeks={};
    state.calendarWeeks[`${c.year}-w${c.number}`]={status:'EVALUACION',start:iso(c.start),end:iso(c.end)};
    save();closeModal();render();toast(`Semana ${c.number} de ${c.year} disponible`);
  };

  // Una semana que no se trabajara conserva su lugar calendario; no se salta ni consume otro consecutivo.
  window.markCurrentWeekNotEvaluated=function(){
    const c=currentCalendarWeek();
    if((state.people||[]).length||(state.evals||[]).length){
      return modal('<h3>No se puede inactivar esta semana</h3><p>Ya tiene actividad registrada. Primero debe resolver la informacion existente.</p><button class="btn primary block" onclick="closeModal()">Entendido</button>');
    }
    modal(`<h3>Marcar semana como no evaluada</h3><p>La Semana ${c.number} de ${c.year} (${fmt(c.start)} al ${fmt(c.end)}) quedará registrada como <b>NO EVALUADA</b>.</p><p class="muted">Esto no adelanta el calendario. La siguiente semana solo estará disponible cuando lleguen sus fechas.</p><div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn danger" onclick="confirmWeekNotEvaluated()">Confirmar</button></div>`);
  };
  window.confirmWeekNotEvaluated=function(){
    const c=currentCalendarWeek();
    if(!state.calendarWeeks)state.calendarWeeks={};
    state.currentYear=c.year;state.currentWeek=c.number;state.currentWeekStart=iso(c.start);state.currentWeekEnd=iso(c.end);
    state.calendarWeeks[`${c.year}-w${c.number}`]={status:'NO_EVALUADA',start:iso(c.start),end:iso(c.end)};
    save();closeModal();render();toast(`Semana ${c.number} marcada como no evaluada`);
  };

  function decorateCalendarWeek(){
    if(state.role!=='monitor'||state.view!=='grupo')return;
    const hero=document.querySelector('.hero'); if(!hero)return;
    const c=currentCalendarWeek();
    let h2=hero.querySelector('h2');
    if(h2&&h2.dataset.calendarDecorated!=='1'){
      h2.dataset.calendarDecorated='1';
      // Conserva cualquier insignia de turno agregada por otros scripts.
      const badge=h2.querySelector('.sample-turn-badge');
      h2.childNodes.forEach(n=>{if(n.nodeType===3)n.textContent=''});
      h2.insertAdjacentText('afterbegin',`Semana ${c.number} · ${c.year} `);
      if(badge)h2.appendChild(badge);
    }
    let p=h2&&h2.nextElementSibling;
    if(p&&p.classList.contains('muted'))p.textContent=`${fmt(c.start)} al ${fmt(c.end)} · Semana determinada por calendario`;
    let old=[...hero.querySelectorAll('button')].find(b=>/Nueva semana/i.test(b.textContent));
    if(old){old.textContent='Ver semana actual';old.onclick=()=>newWeekModal()}
    if(!hero.querySelector('#calendar-week-action')){
      let box=document.createElement('div');box.id='calendar-week-action';box.className='row';box.style.cssText='margin-top:10px;gap:8px;flex-wrap:wrap';
      box.innerHTML='<button class="btn ghost small" onclick="markCurrentWeekNotEvaluated()">Marcar semana no evaluada</button>';
      hero.appendChild(box);
    }
  }
  const observer=new MutationObserver(()=>{clearTimeout(window.__calendarWeekTimer);window.__calendarWeekTimer=setTimeout(decorateCalendarWeek,0)});
  observer.observe(document.querySelector('#app'),{childList:true,subtree:true});
  setTimeout(decorateCalendarWeek,0);
})();
