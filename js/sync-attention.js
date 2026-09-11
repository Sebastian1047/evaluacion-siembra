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
function pulseSyncButton(){
  if(!navigator.onLine||!syncHasPending())return;
  let b=syncButton();if(!b)return;
  if(!document.querySelector('#sync-attention-style')){
    let s=document.createElement('style');s.id='sync-attention-style';
    s.textContent='@keyframes syncAttentionPulse{0%,100%{transform:scale(1);box-shadow:none}45%{transform:scale(1.13);box-shadow:0 8px 22px rgba(0,0,0,.22)}70%{transform:scale(1.06)}}.sync-attention{animation:syncAttentionPulse 1.35s ease-in-out 2;position:relative;z-index:3}';document.head.appendChild(s);
  }
  b.classList.remove('sync-attention');void b.offsetWidth;b.classList.add('sync-attention');
  setTimeout(()=>b.classList.remove('sync-attention'),3000);
}
function checkSyncConnectivity(){
  let online=navigator.onLine;
  if(online&&syncHasPending())pulseSyncButton();
  __syncWasOnline=online;
}
window.addEventListener('online',()=>{__syncWasOnline=true;setTimeout(pulseSyncButton,250)});
window.addEventListener('offline',()=>{__syncWasOnline=false});
setInterval(checkSyncConnectivity,30000);
// Primera comprobación después de cargar la interfaz.
setTimeout(checkSyncConnectivity,1200);
