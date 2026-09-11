// Permisos de navegación por rol.
// El Asegurador de calidad se limita a gestionar el grupo y recoger la información.
// Como ya no tiene otras secciones de navegación, no necesita mostrar el ítem "Grupo".
// Historial, análisis y estadísticas pertenecen al Analista.
const baseGoByRole = go;

nav = function(active){
  if(state.role === 'monitor') return '';
  const items = [['analisis','Análisis'],['historial','Historial']];
  return `<nav class="bottom">${items.map(([v,n])=>`<button class="${active===v?'active':''}" onclick="go('${v}')">${n}</button>`).join('')}</nav>`;
};

go = function(v){
  if(state.role === 'analista' && ['grupo','gestion','agregar','seguimiento','nueva','detalle','evaluarItems'].includes(v)){
    state.view = 'analisis';
    save();
    render();
    return toast('La gestión del grupo corresponde al Asegurador de calidad');
  }
  if(state.role === 'monitor' && ['evaluarItems','historial','analisis','resultados','informe','tablaSemanal','correoInforme','historialPersona'].includes(v)){
    state.view = 'grupo';
    save();
    render();
    return toast(v==='historial'?'El historial corresponde al Analista':'Esta opción corresponde al Analista');
  }
  return baseGoByRole(v);
};

// Si una sesión guardada quedó en una vista que ya no corresponde al rol,
// la devolvemos a una vista permitida al cargar el prototipo.
if(state.role === 'analista' && ['grupo','gestion','agregar','seguimiento','nueva','detalle','evaluarItems'].includes(state.view)){
  state.view = 'analisis';
  save();
  render();
}else if(state.role === 'monitor' && ['evaluarItems','historial','analisis','resultados','informe','tablaSemanal','correoInforme','historialPersona'].includes(state.view)){
  state.view = 'grupo';
  save();
  render();
}
