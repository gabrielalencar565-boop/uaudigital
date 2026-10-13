// Modo "Ajustar imagens": só aparece na prévia do Claude (fora dela não existe window.claude e nada acontece).
// Clique numa foto, arraste para mudar o enquadramento e use o zoom; "Salvar" guarda os ajustes para o Claude aplicar no site.
(async()=>{
  if(!window.claude||!claude.use) return;
  const db=await claude.use('db'); if(!db) return;
  const col=db.collection('ajustes');
  const keyOf=s=>s.replace(/[^a-z0-9]+/gi,'_').slice(0,120);
  const srcOf=el=>{ if(el.tagName==='IMG') return el.getAttribute('src'); const m=(el.style.backgroundImage||getComputedStyle(el).backgroundImage).match(/url\(["']?([^"')]+)["']?\)/); return m?m[1].replace(location.origin+'/',''):null; };
  const all=()=>[...document.querySelectorAll('main img, .hero-slides .slide, main [style*="background-image"]')].filter(el=>srcOf(el)&&!el.closest('.lb,.lead'));
  const saved={};
  const apply=(src,v)=>all().forEach(el=>{ if(srcOf(el)!==src) return;
    if(el.tagName==='IMG'){ el.style.objectPosition=`${v.x}% ${v.y}%`; el.style.scale=v.z>1?String(v.z):''; el.style.transformOrigin=`${v.x}% ${v.y}%`; }
    else { el.style.backgroundPosition=`${v.x}% ${v.y}%`; bgZoom(el,src,v.z); } });
  // fundo (background-image): o zoom vira um background-size maior que o "cover"
  const nat={};
  function bgZoom(el,src,z){ if(!(z>1)){ el.style.backgroundSize=''; return; }
    const go=()=>{ const n=nat[src], r=el.getBoundingClientRect(); if(!n||!r.width) return; const cover=Math.max(1,(r.height*n)/r.width); el.style.backgroundSize=(cover*z*100).toFixed(1)+'% auto'; };
    if(nat[src]) go(); else { const i=new Image(); i.onload=()=>{ nat[src]=i.naturalWidth/i.naturalHeight; go(); }; i.src=src; } }
  try{ (await col.get()).docs.forEach(d=>{ const v=d.data(); if(v&&v.src){ saved[v.src]=v; apply(v.src,v); } }); }catch(_){}

  const css=document.createElement('style'); css.textContent=`
  .aj-btn{position:fixed;left:20px;bottom:20px;z-index:300;font:600 14px/1 'Bricolage Grotesque',system-ui;color:#fff;background:#141217;border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:13px 18px;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.4)}
  body.aj .aj-btn{background:#7B2FE0;border-color:#7B2FE0}
  body.aj .track,body.aj .slide,body.aj [class*="pill"],body.aj .cap{animation-play-state:paused!important;transition:none!important}
  body.aj main img,body.aj .hero-slides .slide,body.aj main [style*="background-image"]{pointer-events:auto!important;cursor:crosshair}
  body.aj main img:hover,body.aj main [style*="background-image"]:hover{outline:2px dashed #F2A04A;outline-offset:-2px}
  .aj-sel{outline:3px solid #F2A04A!important;outline-offset:-3px!important;cursor:grab!important}
  .aj-pan{position:fixed;left:20px;bottom:76px;z-index:300;width:300px;background:#141217;color:#F4F2F7;border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:16px;font:14px/1.4 'Bricolage Grotesque',system-ui;box-shadow:0 20px 60px rgba(0,0,0,.5);display:none}
  body.aj .aj-pan{display:block}
  .aj-pan b{display:block;font-size:13px;margin-bottom:2px}.aj-pan small{color:#8C8796;display:block;margin-bottom:12px;word-break:break-all}
  .aj-pan label{display:grid;grid-template-columns:70px 1fr 42px;align-items:center;gap:8px;font-size:12.5px;margin:6px 0}
  .aj-pan input{width:100%;accent-color:#C9307A}
  .aj-row{display:flex;gap:8px;margin-top:12px}.aj-row button{flex:1;font:600 13px 'Bricolage Grotesque',system-ui;border-radius:999px;padding:10px;cursor:pointer;border:1px solid rgba(255,255,255,.18);background:transparent;color:#fff}
  .aj-row .aj-save{background:linear-gradient(90deg,#7B2FE0,#C9307A 60%,#F2A04A);border:0}
  .aj-msg{font-size:12px;color:#B9B4C4;margin-top:8px;min-height:16px}`;
  document.head.appendChild(css);
  const btn=document.createElement('button'); btn.className='aj-btn'; btn.textContent='Ajustar imagens';
  const pan=document.createElement('div'); pan.className='aj-pan';
  pan.innerHTML=`<b>Clique numa foto</b><small>Depois arraste nela para enquadrar ou use os controles.</small>
    <label>Horizontal<input type="range" min="0" max="100" data-k="x"><span></span></label>
    <label>Vertical<input type="range" min="0" max="100" data-k="y"><span></span></label>
    <label>Zoom<input type="range" min="100" max="250" data-k="z"><span></span></label>
    <div class="aj-row"><button class="aj-reset" type="button">Restaurar</button><button class="aj-save" type="button">Salvar</button></div><div class="aj-msg"></div>`;
  document.body.append(btn,pan);
  const ins=[...pan.querySelectorAll('input')], msg=pan.querySelector('.aj-msg');
  let sel=null, cur=null;
  const show=()=>{ ins.forEach(i=>{ const k=i.dataset.k; i.value=k==='z'?Math.round(cur.z*100):cur[k]; i.nextElementSibling.textContent=k==='z'?Math.round(cur.z*100)+'%':Math.round(cur[k])+'%';  }); };
  const choose=el=>{ document.querySelectorAll('.aj-sel').forEach(x=>x.classList.remove('aj-sel')); sel=el; el.classList.add('aj-sel');
    const src=srcOf(el); const p=(el.tagName==='IMG'?getComputedStyle(el).objectPosition:getComputedStyle(el).backgroundPosition).split(' ').map(v=>v.endsWith('%')?parseFloat(v):50);
    cur=saved[src]?{...saved[src]}:{src,x:p[0],y:p[1],z:parseFloat(el.style.scale)||1};
    pan.querySelector('b').textContent='Foto selecionada'; pan.querySelector('small').textContent=src; msg.textContent=''; show(); };
  const set=(k,v)=>{ if(!cur) return; cur[k]=k==='z'?Math.max(1,Math.min(2.5,v)):Math.max(0,Math.min(100,v)); apply(cur.src,cur); show(); msg.textContent='Ajuste ainda não salvo.'; };
  ins.forEach(i=>i.addEventListener('input',()=>set(i.dataset.k,i.dataset.k==='z'?i.value/100:+i.value)));
  btn.onclick=()=>{ document.body.classList.toggle('aj'); btn.textContent=document.body.classList.contains('aj')?'Concluir ajustes':'Ajustar imagens'; if(!document.body.classList.contains('aj')) document.querySelectorAll('.aj-sel').forEach(x=>x.classList.remove('aj-sel')); };
  pan.querySelector('.aj-reset').onclick=()=>{ if(!cur) return; cur={src:cur.src,x:50,y:50,z:1}; apply(cur.src,cur); show(); msg.textContent='Voltou ao centro. Clique em Salvar para guardar.'; };
  pan.querySelector('.aj-save').onclick=async()=>{ if(!cur) return; msg.textContent='Salvando...';
    try{ await col.doc(keyOf(cur.src)).set({src:cur.src,x:Math.round(cur.x),y:Math.round(cur.y),z:Math.round(cur.z*100)/100}); saved[cur.src]={...cur}; msg.textContent='Salvo! Avise o Claude para aplicar no site.'; }
    catch(e){ msg.textContent='Não deu para salvar ('+(e&&e.code||'erro')+').'; } };
  // no modo de ajuste, cliques nas fotos selecionam em vez de abrir/navegar; arrastar move o enquadramento
  const pick=e=>document.elementsFromPoint(e.clientX,e.clientY).find(el=>all().includes(el));
  let drag=null;
  document.addEventListener('pointerdown',e=>{ if(!document.body.classList.contains('aj')||e.target.closest('.aj-pan,.aj-btn')) return;
    const el=pick(e); if(!el) return; e.preventDefault(); e.stopPropagation(); if(el!==sel) choose(el);
    const r=el.getBoundingClientRect(); drag={x:e.clientX,y:e.clientY,ox:cur.x,oy:cur.y,w:r.width,h:r.height}; },true);
  document.addEventListener('pointermove',e=>{ if(!drag) return; e.preventDefault(); e.stopPropagation();
    cur.x=Math.max(0,Math.min(100,drag.ox-(e.clientX-drag.x)/drag.w*60)); cur.y=Math.max(0,Math.min(100,drag.oy-(e.clientY-drag.y)/drag.h*60)); apply(cur.src,cur); show(); msg.textContent='Ajuste ainda não salvo.'; },true);
  document.addEventListener('pointerup',e=>{ if(drag){ drag=null; e.stopPropagation(); } },true);
  ['click','dragstart'].forEach(t=>document.addEventListener(t,e=>{ if(document.body.classList.contains('aj')&&!e.target.closest('.aj-pan,.aj-btn')&&pick(e)){ e.preventDefault(); e.stopPropagation(); } },true));
  document.addEventListener('wheel',e=>{ if(!sel||!document.body.classList.contains('aj')||pick(e)!==sel) return; e.preventDefault(); set('z',cur.z-e.deltaY/600); },{passive:false});
})();
