// Pagina la lista de sembradores del grupo cuando supera 10 personas.
// Solo afecta la presentación: las reglas del grupo siguen trabajando con state.people completo.
let groupPeoplePage=1;
const GROUP_PEOPLE_PER_PAGE=10;

function decorateGroupPagination(){
  if(state.role!=='monitor'||state.view!=='grupo')return;
  const cards=[...document.querySelectorAll('.person')];
  if(!cards.length)return;

  const totalPages=Math.ceil(cards.length/GROUP_PEOPLE_PER_PAGE);
  if(groupPeoplePage>totalPages)groupPeoplePage=totalPages||1;
  if(groupPeoplePage<1)groupPeoplePage=1;

  cards.forEach((card,index)=>{
    const page=Math.floor(index/GROUP_PEOPLE_PER_PAGE)+1;
    card.style.display=page===groupPeoplePage?'':'none';
  });

  document.querySelector('#group-pagination')?.remove();
  if(totalPages<=1)return;

  const lastCard=cards[cards.length-1];
  const pager=document.createElement('div');
  pager.id='group-pagination';
  pager.className='row';
  pager.style.cssText='justify-content:center;align-items:center;gap:6px;margin:10px 0 4px;flex-wrap:wrap';

  let html=`<button class="btn ghost small" style="padding:5px 9px" ${groupPeoplePage===1?'disabled':''} onclick="changeGroupPeoplePage(${groupPeoplePage-1})">‹</button>`;
  for(let i=1;i<=totalPages;i++){
    html+=`<button class="btn ${i===groupPeoplePage?'primary':'ghost'} small" style="padding:5px 9px;min-width:32px" onclick="changeGroupPeoplePage(${i})">${i}</button>`;
  }
  html+=`<button class="btn ghost small" style="padding:5px 9px" ${groupPeoplePage===totalPages?'disabled':''} onclick="changeGroupPeoplePage(${groupPeoplePage+1})">›</button>`;
  pager.innerHTML=html;
  lastCard.parentNode.insertBefore(pager,lastCard.nextSibling);
}

function changeGroupPeoplePage(page){
  const totalPages=Math.max(1,Math.ceil((state.people||[]).length/GROUP_PEOPLE_PER_PAGE));
  groupPeoplePage=Math.max(1,Math.min(page,totalPages));
  decorateGroupPagination();
}

const groupPaginationObserver=new MutationObserver(()=>{
  clearTimeout(window.__groupPaginationTimer);
  window.__groupPaginationTimer=setTimeout(decorateGroupPagination,20);
});
groupPaginationObserver.observe(document.querySelector('#app'),{childList:true,subtree:true});
setTimeout(decorateGroupPagination,50);
