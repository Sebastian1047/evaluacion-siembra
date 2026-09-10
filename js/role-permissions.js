// Permisos de navegación por rol.
// La gestión del grupo pertenece exclusivamente al Asegurador de calidad.
const baseGoByRole = go;

nav = function(active){
  const items = state.role === 'monitor'
    ? [['grupo','Grupo'],['evaluarItems','Evaluar'],['historial','Historial']]
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
  return baseGoByRole(v);
};

// Si una sesión antigua del analista quedó guardada en una vista de grupo,
// la devolvemos a Análisis al cargar el prototipo.
if(state.role === 'analista' && ['grupo','gestion','agregar','seguimiento','nueva','detalle','evaluarItems'].includes(state.view)){
  state.view = 'analisis';
  save();
  render();
}
