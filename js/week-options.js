// Opciones de creación de semana añadidas sin alterar el flujo existente.
function newWeekModal(){
  const next=state.currentWeek+1;
  modal(`<h3>Crear nueva semana</h3>
    <p class="muted">Elija cómo desea definir el número de la nueva semana.</p>
    <section class="card" style="margin:12px 0">
      <h4 style="margin-top:0">Consecutivo automático</h4>
      <p>Crear la <b>Semana ${next}</b>, continuando desde la Semana ${state.currentWeek}.</p>
      <button class="btn primary block" onclick="createWeek(${next})">Crear Semana ${next}</button>
    </section>
    <section class="card" style="margin:12px 0">
      <h4 style="margin-top:0">Número de semana manual</h4>
      <p class="muted small">Úselo si hubo semanas sin evaluación y necesita continuar en la semana real correspondiente.</p>
      <label class="label">Número de semana</label>
      <input id="manualWeek" class="input" type="number" min="1" max="53" placeholder="Ej. 39">
      <button class="btn secondary block" style="margin-top:10px" onclick="createManualWeek()">Crear semana indicada</button>
    </section>
    <button class="btn ghost block" onclick="closeModal()">Cancelar</button>`);
}

function createNextWeek(){createWeek(state.currentWeek+1)}

function createManualWeek(){
  const input=document.querySelector('#manualWeek');
  const week=Number(input?.value);
  if(!Number.isInteger(week)||week<1||week>53)return toast('Ingrese un número de semana entre 1 y 53');
  if(week===state.currentWeek)return toast('Esa semana ya es la semana activa');
  createWeek(week);
}

function createWeek(week){
  state.currentWeek=week;
  state.people=[];
  state.evals=[];
  state.pending=0;
  state.selectedPerson=null;
  state.available=seed.people.concat(seed.available).map(p=>({id:p.id+'w'+state.currentWeek,name:p.name,doc:p.doc}));
  save();
  closeModal();
  render();
  toast('Semana '+state.currentWeek+' creada. Agregue los sembradores del grupo');
}
