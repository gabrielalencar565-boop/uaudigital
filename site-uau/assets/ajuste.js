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

// Modo "Editar textos": clique num texto para reescrever e use A−/A+ para o tamanho; "Salvar textos" guarda para o Claude aplicar no site.
(async()=>{
  if(!window.claude||!claude.use) return;
  const db=await claude.use('db'); if(!db) return;
  const col=db.collection('textos');
  const page=(location.pathname.split('/').pop()||'index').replace(/\.html$/,'')||'index';
  const pathOf=el=>{ const p=[]; for(let n=el;n&&n!==document.body;n=n.parentElement){ const i=[...n.parentElement.children].indexOf(n)+1; p.unshift(n.tagName.toLowerCase()+':nth-child('+i+')'); } return 'body>'+p.join('>'); };
  const idOf=path=>(page+'_'+path).replace(/[^a-z0-9]+/gi,'_').slice(-190);
  const SEL='main h1,main h2,main h3,main h4,main p,main li,main q,main figcaption,main .btn,main .eyebrow,main .cl-kicker,main .cb-t,main .reel-who b,main .reel-who span,main .team-cap span,main .seg-chips span,main .vs-t,main .vs-x,main .cap b,main .cap span,footer p,footer li,footer h4';
  const ok=el=>!el.closest('.track [aria-hidden="true"],.rotator,.aj-pan,.aj-tpan,.lb,.lead')&&el.textContent.trim();
  const edits={};
  try{ (await col.get()).docs.forEach(d=>{ const v=d.data(); if(!v||v.pagina!==page) return; const el=document.querySelector(v.caminho); if(!el) return;
    edits[v.caminho]={...v}; if(v.novo!=null&&v.novo!==v.original) el.innerHTML=v.novo; if(v.tamanho&&v.tamanho!==100) el.style.fontSize=v.tamanho+'%'; }); }catch(_){}

  const css=document.createElement('style'); css.textContent=`
  .aj-tbtn{position:fixed;left:20px;bottom:76px;z-index:300;font:600 14px/1 'Bricolage Grotesque',system-ui;color:#fff;background:#141217;border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:13px 18px;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.4)}
  body.aj .aj-tbtn{display:none} body.ajt .aj-btn{display:none}
  body.ajt .aj-tbtn{background:#C9307A;border-color:#C9307A;bottom:20px}
  body.ajt .track,body.ajt .cap,body.ajt .pcol{animation-play-state:paused!important}
  body.ajt .aj-ed{outline:1px dashed rgba(242,160,74,.7);outline-offset:3px;cursor:text}
  body.ajt .aj-ed:focus{outline:2px solid #F2A04A;background:rgba(242,160,74,.08)}
  .aj-tpan{position:fixed;left:20px;bottom:76px;z-index:300;width:300px;background:#141217;color:#F4F2F7;border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:16px;font:14px/1.4 'Bricolage Grotesque',system-ui;box-shadow:0 20px 60px rgba(0,0,0,.5);display:none}
  body.ajt .aj-tpan{display:block}
  .aj-tpan b{display:block;font-size:13px}.aj-tpan small{color:#8C8796;display:block;margin:2px 0 12px}
  .aj-sz{display:flex;align-items:center;gap:8px;margin-bottom:12px}.aj-sz button{width:40px;height:34px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:transparent;color:#fff;font:700 14px system-ui;cursor:pointer}.aj-sz span{flex:1;text-align:center;font-size:13px}
  .aj-tpan .aj-row{display:flex;gap:8px}.aj-tpan .aj-row button{flex:1;font:600 13px 'Bricolage Grotesque',system-ui;border-radius:999px;padding:10px;cursor:pointer;border:1px solid rgba(255,255,255,.18);background:transparent;color:#fff}
  .aj-tpan .aj-tsave{background:linear-gradient(90deg,#7B2FE0,#C9307A 60%,#F2A04A);border:0!important}
  .aj-tmsg{font-size:12px;color:#B9B4C4;margin-top:8px;min-height:16px}`;
  document.head.appendChild(css);
  const btn=document.createElement('button'); btn.className='aj-tbtn'; btn.textContent='Editar textos';
  const pan=document.createElement('div'); pan.className='aj-tpan';
  pan.innerHTML=`<b>Clique num texto para editar</b><small>Digite direto na página. Para negrito: selecione e Ctrl/Cmd+B.</small>
    <div class="aj-sz"><button type="button" data-d="-5">A−</button><span>Tamanho: 100%</span><button type="button" data-d="5">A+</button></div>
    <div class="aj-row"><button class="aj-tundo" type="button">Desfazer este</button><button class="aj-tsave" type="button">Salvar textos</button></div><div class="aj-tmsg"></div>`;
  document.body.append(btn,pan);
  const msg=pan.querySelector('.aj-tmsg'), szl=pan.querySelector('.aj-sz span');
  const els=()=>[...document.querySelectorAll(SEL)].filter(ok);
  const orig=new Map(); let cur=null; const dirty=new Set();
  const rec=el=>{ const c=pathOf(el); if(!edits[c]) edits[c]={pagina:page,caminho:c,original:orig.get(el),novo:orig.get(el),tamanho:100}; return edits[c]; };
  const showSz=()=>{ szl.textContent='Tamanho: '+(cur?rec(cur).tamanho:100)+'%'; };
  btn.onclick=()=>{ const on=!document.body.classList.toggle('ajt')?false:true; btn.textContent=on?'Concluir textos':'Editar textos';
    els().forEach(el=>{ if(on){ if(!orig.has(el)) orig.set(el,edits[pathOf(el)]?.original??el.innerHTML); el.contentEditable='true'; el.classList.add('aj-ed'); } else { el.removeAttribute('contenteditable'); el.classList.remove('aj-ed'); } }); };
  document.addEventListener('focusin',e=>{ const el=e.target.closest&&e.target.closest('.aj-ed'); if(el){ cur=el; pan.querySelector('b').textContent='Texto selecionado'; showSz(); } });
  document.addEventListener('input',e=>{ const el=e.target.closest&&e.target.closest('.aj-ed'); if(!el) return; rec(el).novo=el.innerHTML; dirty.add(pathOf(el)); msg.textContent='Alterações ainda não salvas.'; });
  document.addEventListener('click',e=>{ if(document.body.classList.contains('ajt')&&e.target.closest('.aj-ed')){ e.preventDefault(); e.stopPropagation(); } },true);
  pan.querySelectorAll('.aj-sz button').forEach(b=>b.onclick=()=>{ if(!cur) return; const r=rec(cur); r.tamanho=Math.max(50,Math.min(200,r.tamanho+ +b.dataset.d)); cur.style.fontSize=r.tamanho===100?'':r.tamanho+'%'; dirty.add(r.caminho); showSz(); msg.textContent='Alterações ainda não salvas.'; });
  pan.querySelector('.aj-tundo').onclick=()=>{ if(!cur) return; const r=rec(cur); cur.innerHTML=r.original; cur.style.fontSize=''; r.novo=r.original; r.tamanho=100; dirty.add(r.caminho); showSz(); msg.textContent='Voltou ao original. Clique em Salvar textos.'; };
  pan.querySelector('.aj-tsave').onclick=async()=>{ if(!dirty.size){ msg.textContent='Nada para salvar.'; return; } msg.textContent='Salvando...';
    try{ for(const c of [...dirty]){ await col.doc(idOf(c)).set(edits[c]); dirty.delete(c); } msg.textContent='Salvo! Avise o Claude para aplicar no site.'; }
    catch(e){ msg.textContent='Não deu para salvar ('+(e&&e.code||'erro')+').'; } };
})();

// Modo "Mover blocos": arraste fotos, selos, títulos e botões para outra posição; "Salvar posições" guarda para o Claude aplicar no site.
(async()=>{
  if(!window.claude||!claude.use) return;
  const db=await claude.use('db'); if(!db) return;
  const col=db.collection('posicoes');
  const page=(location.pathname.split('/').pop()||'index').replace(/\.html$/,'')||'index';
  const pathOf=el=>{ const p=[]; for(let n=el;n&&n!==document.body;n=n.parentElement){ const i=[...n.parentElement.children].indexOf(n)+1; p.unshift(n.tagName.toLowerCase()+':nth-child('+i+')'); } return 'body>'+p.join('>'); };
  const idOf=path=>('mv_'+page+'_'+path).replace(/[^a-z0-9]+/gi,'_').slice(-190);
  const SEL='main h1,main h2,main .eyebrow,main p,main .btn,main ul,main .lp-duo,main .lp-duo img,main .lp-badges,main .lp-badges span,main .lp-photo,main .img,main .tile,main .case,main .reel,main .vs-card,main figure,main .dep-badge';
  const pos={};
  const put=(el,v)=>{ el.style.translate=(v.x||v.y)?`${v.x}px ${v.y}px`:''; el.style.scale=v.s&&v.s!==1?String(v.s):''; };
  try{ (await col.get()).docs.forEach(d=>{ const v=d.data(); if(!v||v.pagina!==page) return; const el=document.querySelector(v.caminho); if(el){ pos[v.caminho]={...v}; put(el,v); } }); }catch(_){}
  const css=document.createElement('style'); css.textContent=`
  .aj-mbtn{position:fixed;left:20px;bottom:132px;z-index:300;font:600 14px/1 'Bricolage Grotesque',system-ui;color:#fff;background:#141217;border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:13px 18px;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.4)}
  body.aj .aj-mbtn,body.ajt .aj-mbtn{display:none} body.ajm .aj-btn,body.ajm .aj-tbtn{display:none}
  body.ajm .aj-mbtn{background:#F2A04A;border-color:#F2A04A;color:#141217;bottom:20px}
  body.ajm .track,body.ajm .lp-float,body.ajm .cap{animation-play-state:paused!important}
  body.ajm .aj-mv{outline:1px dashed rgba(242,160,74,.6);outline-offset:2px;cursor:move}
  body.ajm .aj-mv:hover{outline:2px dashed #F2A04A}
  .aj-msel{outline:2px solid #F2A04A!important}
  .aj-mpan{position:fixed;left:20px;bottom:76px;z-index:300;width:300px;background:#141217;color:#F4F2F7;border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:16px;font:14px/1.4 'Bricolage Grotesque',system-ui;box-shadow:0 20px 60px rgba(0,0,0,.5);display:none}
  body.ajm .aj-mpan{display:block}
  .aj-mpan b{display:block;font-size:13px}.aj-mpan small{color:#8C8796;display:block;margin:2px 0 12px}
  .aj-mpan .aj-sz{display:flex;align-items:center;gap:8px;margin-bottom:12px}.aj-mpan .aj-sz button{width:40px;height:34px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:transparent;color:#fff;font:700 14px system-ui;cursor:pointer}.aj-mpan .aj-sz span{flex:1;text-align:center;font-size:13px}
  .aj-mpan .aj-row{display:flex;gap:8px}.aj-mpan .aj-row button{flex:1;font:600 13px 'Bricolage Grotesque',system-ui;border-radius:999px;padding:10px;cursor:pointer;border:1px solid rgba(255,255,255,.18);background:transparent;color:#fff}
  .aj-mpan .aj-msave{background:linear-gradient(90deg,#7B2FE0,#C9307A 60%,#F2A04A);border:0!important}
  .aj-mmsg{font-size:12px;color:#B9B4C4;margin-top:8px;min-height:16px}`;
  document.head.appendChild(css);
  const btn=document.createElement('button'); btn.className='aj-mbtn'; btn.textContent='Mover blocos';
  const pan=document.createElement('div'); pan.className='aj-mpan';
  pan.innerHTML=`<b>Arraste um bloco para mudar de lugar</b><small>Foto, selos, títulos, textos e botões. Use as setas do teclado para ajuste fino.</small>
    <div class="aj-sz"><button type="button" data-d="-0.05">−</button><span>Tamanho: 100%</span><button type="button" data-d="0.05">+</button></div>
    <div class="aj-row"><button class="aj-mundo" type="button">Voltar ao lugar</button><button class="aj-msave" type="button">Salvar posições</button></div><div class="aj-mmsg"></div>`;
  document.body.append(btn,pan);
  const msg=pan.querySelector('.aj-mmsg'), szl=pan.querySelector('.aj-sz span'); const dirty=new Set(); let cur=null, drag=null;
  const rec=el=>{ const c=pathOf(el); if(!pos[c]) pos[c]={pagina:page,caminho:c,x:0,y:0,s:1}; return pos[c]; };
  const els=()=>[...document.querySelectorAll(SEL)].filter(el=>!el.closest('.aj-pan,.aj-tpan,.aj-mpan,.track [aria-hidden="true"]'));
  const pick=t=>{ const all=els(); for(let n=t;n&&n!==document.body;n=n.parentElement){ if(all.includes(n)) return n; } return null; };
  const sel=el=>{ document.querySelectorAll('.aj-msel').forEach(x=>x.classList.remove('aj-msel')); cur=el; el.classList.add('aj-msel'); szl.textContent='Tamanho: '+Math.round(rec(el).s*100)+'%'; pan.querySelector('b').textContent='Bloco selecionado'; };
  const changed=r=>{ dirty.add(r.caminho); msg.textContent='Posições ainda não salvas.'; };
  btn.onclick=()=>{ const on=document.body.classList.toggle('ajm'); btn.textContent=on?'Concluir':'Mover blocos'; els().forEach(el=>el.classList.toggle('aj-mv',on)); if(!on) document.querySelectorAll('.aj-msel').forEach(x=>x.classList.remove('aj-msel')); };
  document.addEventListener('pointerdown',e=>{ if(!document.body.classList.contains('ajm')||e.target.closest('.aj-mpan,.aj-mbtn')) return; const el=pick(e.target); if(!el) return;
    e.preventDefault(); e.stopPropagation(); sel(el); const r=rec(el); drag={x:e.clientX,y:e.clientY,ox:r.x,oy:r.y,el}; },true);
  document.addEventListener('pointermove',e=>{ if(!drag) return; e.preventDefault(); const r=rec(drag.el); r.x=Math.round(drag.ox+e.clientX-drag.x); r.y=Math.round(drag.oy+e.clientY-drag.y); put(drag.el,r); changed(r); },true);
  document.addEventListener('pointerup',()=>{ drag=null; },true);
  ['click','dragstart'].forEach(t=>document.addEventListener(t,e=>{ if(document.body.classList.contains('ajm')&&!e.target.closest('.aj-mpan,.aj-mbtn')&&pick(e.target)){ e.preventDefault(); e.stopPropagation(); } },true));
  addEventListener('keydown',e=>{ if(!cur||!document.body.classList.contains('ajm')) return; const k={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key]; if(!k) return; e.preventDefault(); const r=rec(cur), m=e.shiftKey?10:1; r.x+=k[0]*m; r.y+=k[1]*m; put(cur,r); changed(r); });
  pan.querySelectorAll('.aj-sz button').forEach(b=>b.onclick=()=>{ if(!cur) return; const r=rec(cur); r.s=Math.max(.5,Math.min(2,Math.round((r.s+ +b.dataset.d)*100)/100)); put(cur,r); szl.textContent='Tamanho: '+Math.round(r.s*100)+'%'; changed(r); });
  pan.querySelector('.aj-mundo').onclick=()=>{ if(!cur) return; const r=rec(cur); r.x=0; r.y=0; r.s=1; put(cur,r); szl.textContent='Tamanho: 100%'; changed(r); };
  pan.querySelector('.aj-msave').onclick=async()=>{ if(!dirty.size){ msg.textContent='Nada para salvar.'; return; } msg.textContent='Salvando...';
    try{ for(const c of [...dirty]){ await col.doc(idOf(c)).set(pos[c]); dirty.delete(c); } msg.textContent='Salvo! Avise o Claude para aplicar no site.'; }
    catch(e){ msg.textContent='Não deu para salvar ('+(e&&e.code||'erro')+').'; } };
})();
