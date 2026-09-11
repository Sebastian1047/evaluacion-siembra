// Aviso visual de sincronización pendiente al recuperar conexión.
// Comprueba conectividad cada 30 segundos (2 veces por minuto) y también escucha el evento online.
let __syncWasOnline=navigator.onLine;
function syncHasPending(){
  if(Number(state.pending)>0)return true;
  if(state.historicalPending&&Object.keys(state.historicalPending).length)return true;
  return false;
}
function syncButton(){
  return [...document.querySelectorAll('button')].find(b=>(b.textContent||'').trim().toLowerCase()==='sincronizar');
}
function ensureSyncAttentionStyle(){
  if(document.querySelector('#sync-attention-style'))return;
  let s=document.createElement('style');s.id='sync-attention-style';
  s.textContent='@keyframes syncAttentionPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}.sync-attention-pending{background:#1976d2!important;color:#fff!important;border-color:#1976d2!important;box-shadow:0 5px 16px rgba(25,118,210,.28)}.sync-attention{animation:syncAttentionPulse .75s ease-in-out 5;position:relative;z-index:3}';
  document.head.appendChild(s);
}
function updateSyncButtonAttention(){
  ensureSyncAttentionStyle();
  let b=syncButton();if(!b)return;
  if(navigator.onLine&&syncHasPending())b.classList.add('sync-attention-pending');
  else {b.classList.remove('sync-attention-pending','sync-attention')}
}
function pulseSyncButton(){
  updateSyncButtonAttention();
  if(!navigator.onLine||!syncHasPending())return;
  let b=syncButton();if(!b)return;
  b.classList.remove('sync-attention');void b.offsetWidth;b.classList.add('sync-attention');
  setTimeout(()=>b.classList.remove('sync-attention'),4000);
}
function checkSyncConnectivity(){
  let online=navigator.onLine;
  updateSyncButtonAttention();
  if(online&&syncHasPending())pulseSyncButton();
  __syncWasOnline=online;
}
window.addEventListener('online',()=>{__syncWasOnline=true;setTimeout(pulseSyncButton,250)});
window.addEventListener('offline',()=>{__syncWasOnline=false;updateSyncButtonAttention()});
// Cuando el usuario pulsa Sincronizar, esperamos a que la lógica existente actualice los pendientes
// y devolvemos el botón a su apariencia normal cuando ya no queda nada por sincronizar.
document.addEventListener('click',e=>{
  let b=e.target.closest&&e.target.closest('button');if(!b)return;
  if((b.textContent||'').trim().toLowerCase()==='sincronizar'){
    setTimeout(updateSyncButtonAttention,100);setTimeout(updateSyncButtonAttention,700);setTimeout(updateSyncButtonAttention,1600);
  }
});
// Las vistas se vuelven a renderizar; este observador conserva el azul mientras siga pendiente.
const syncAttentionObserver=new MutationObserver(()=>{clearTimeout(window.__syncAttentionRenderTimer);window.__syncAttentionRenderTimer=setTimeout(updateSyncButtonAttention,40)});
syncAttentionObserver.observe(document.querySelector('#app'),{childList:true,subtree:true});
setInterval(checkSyncConnectivity,30000);
setTimeout(checkSyncConnectivity,1200);
