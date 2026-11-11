(() => {
  const art=document.querySelector('.direction-art');if(!art)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(pointer: fine)');let frame;
  const reset=()=>{cancelAnimationFrame(frame);art.style.setProperty('--mx','0px');art.style.setProperty('--my','0px');};
  art.addEventListener('pointermove',event=>{
    if(reduced.matches||!fine.matches)return;cancelAnimationFrame(frame);
    frame=requestAnimationFrame(()=>{const rect=art.getBoundingClientRect();art.style.setProperty('--mx',`${(event.clientX-rect.left-rect.width/2)*.035}px`);art.style.setProperty('--my',`${(event.clientY-rect.top-rect.height/2)*.025}px`);});
  });
  art.addEventListener('pointerleave',reset);reduced.addEventListener('change',reset);fine.addEventListener('change',reset);
})();
