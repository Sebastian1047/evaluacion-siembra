// Permisos de navegación por rol.
// La gestión del grupo pertenece exclusivamente al Asegurador de calidad.
const baseGoByRole = go;

nav = function(active){
  const items = state.role === 'monitor'
    ? [['grupo','Grupo'],['historial','Historial']]
    : [['analisis','Análisis'],['historial','Historial']];
  return `<nav class="bottom">${items.map(([v,n])=>`<button class="${active===v?'active':''}" onclick="go('${v}')">${n}</button>`).join('')}</nav>`;
};

go = function(v){
  if(state.role === 'analista' && ['grupo','gestion','agregar','seguimiento','nueva','detalle','evaluarItems'].includes(v)){
    state.view = 'analisis';
    save();
    render();
    return toast('La gestión del grupo corresponde al Asegurador de calidad');
  }
  if(state.role === 'monitor' && v === 'evaluarItems'){
    state.view = 'grupo';
    save();
    render();
    return toast('La opción Evaluar ya no pertenece al Asegurador de calidad');
  }
  return baseGoByRole(v);
};

// Si una sesión guardada quedó en una vista que ya no corresponde al rol,
// la devolvemos a una vista permitida al cargar el prototipo.
if(state.role === 'analista' && ['grupo','gestion','agregar','seguimiento','nueva','detalle','evaluarItems'].includes(state.view)){
  state.view = 'analisis';
  save();
  render();
}else if(state.role === 'monitor' && state.view === 'evaluarItems'){
  state.view = 'grupo';
  save();
  render();
}
