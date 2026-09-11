// Aviso visual de sincronización pendiente al recuperar conexión.
// Comprueba conectividad cada 30 segundos (2 veces por minuto) y también escucha el evento online.
let __syncWasOnline=navigator.onLine;
let __syncAcknowledged=false;
function syncHasPending(){
  if(Number(state.pending)>0)return true;
  if(state.historicalPending&&Object.keys(state.historicalPending).length)return true;
  return false;
}
function syncButton(){return [...document.querySelectorAll('button')].find(b=>(b.textContent||'').trim().toLowerCase()==='sincronizar')}
function ensureSyncAttentionStyle(){
  if(document.querySelector('#sync-attention-style'))return;
  let s=document.createElement('style');s.id='sync-attention-style';
  s.textContent='@keyframes syncAttentionPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}.sync-attention-pending{background:#1976d2!important;color:#fff!important;border-color:#1976d2!important;box-shadow:0 5px 16px rgba(25,118,210,.28)}.sync-attention{animation:syncAttentionPulse .75s ease-in-out 5;position:relative;z-index:3}';document.head.appendChild(s);
}
function clearSyncAttention(){
  let b=syncButton();if(b)b.classList.remove('sync-attention-pending','sync-attention');
}
function updateSyncButtonAttention(){
  ensureSyncAttentionStyle();let b=syncButton();if(!b)return;
  if(!syncHasPending())__syncAcknowledged=false;
  if(navigator.onLine&&syncHasPending()&&!__syncAcknowledged)b.classList.add('sync-attention-pending');
  else b.classList.remove('sync-attention-pending','sync-attention');
}
function pulseSyncButton(){
  updateSyncButtonAttention();if(!navigator.onLine||!syncHasPending()||__syncAcknowledged)return;
  let b=syncButton();if(!b)return;b.classList.remove('sync-attention');void b.offsetWidth;b.classList.add('sync-attention');setTimeout(()=>b.classList.remove('sync-attention'),4000);
}
function checkSyncConnectivity(){let online=navigator.onLine;updateSyncButtonAttention();if(online&&syncHasPending()&&!__syncAcknowledged)pulseSyncButton();__syncWasOnline=online}
window.addEventListener('online',()=>{__syncWasOnline=true;__syncAcknowledged=false;setTimeout(pulseSyncButton,250)});
window.addEventListener('offline',()=>{__syncWasOnline=false;__syncAcknowledged=false;updateSyncButtonAttention()});
// El clic reconoce el aviso inmediatamente: el botón recupera su color normal y pierde la animación.
// No vuelve a ponerse azul por los chequeos de 30 s mientras sean los mismos pendientes.
document.addEventListener('click',e=>{
  let b=e.target.closest&&e.target.closest('button');if(!b)return;
  if((b.textContent||'').trim().toLowerCase()==='sincronizar'){
    __syncAcknowledged=true;clearSyncAttention();
  }
});
const syncAttentionObserver=new MutationObserver(()=>{clearTimeout(window.__syncAttentionRenderTimer);window.__syncAttentionRenderTimer=setTimeout(updateSyncButtonAttention,40)});
syncAttentionObserver.observe(document.querySelector('#app'),{childList:true,subtree:true});
setInterval(checkSyncConnectivity,30000);setTimeout(checkSyncConnectivity,1200);
