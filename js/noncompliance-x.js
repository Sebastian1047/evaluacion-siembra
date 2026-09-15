// Hace explícito que marcar un ítem significa NO CUMPLE: muestra una X en lugar del chulo nativo.
(function(){
  function decorate(){
    document.querySelectorAll('input[type="checkbox"][name="crit"], input[type="checkbox"][name="edit-turn-crit"]').forEach(input=>{
      if(input.dataset.nonComplianceX)return;
      input.dataset.nonComplianceX='1';
      input.classList.add('noncompliance-x');
    });
  }
  const observer=new MutationObserver(decorate);
  observer.observe(document.body,{childList:true,subtree:true});
  decorate();
})();
