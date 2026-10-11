// Comportamento compartilhado por todas as páginas do site. Cada bloco só roda se a página tiver o elemento.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// preenche as faixas em loop (conteúdo duplicado para o loop infinito)
function loop(id, html){ const el=document.getElementById(id); if(el) el.innerHTML = html + html; }
const v=['','v2','v3','v4'];
loop('band', ['Posicionamento','Conteúdo','Audiovisual','Tráfego pago','Design','Estratégia','Gestão com o Fluxo'].map(t=>`<span>${t}</span>`).join(''));
// método: a etapa ativa avança sozinha (só com a seção na tela); mouse ou clique escolhem a etapa
(function(){
  const box=document.getElementById('vleflow'); if(!box) return;
  const steps=[...box.querySelectorAll('.vr-step')], rings=[...box.querySelectorAll('.ring')];
  let i=0, hold=0;
  const go=k=>{ i=k; steps.forEach((s,j)=>{ s.classList.toggle('on',j===k); s.setAttribute('aria-pressed',j===k); }); rings.forEach((r,j)=>r.classList.toggle('on',j===k)); };
  steps.forEach((s,k)=>{ s.addEventListener('mouseenter',()=>{ hold=Date.now(); go(k); }); s.addEventListener('click',()=>{ hold=Date.now(); go(k); }); });
  go(0);
  if(reduce) return;
  setInterval(()=>{ if(Date.now()-hold<6000) return; const r=box.getBoundingClientRect(); if(r.bottom<0||r.top>innerHeight) return; go((i+1)%steps.length); },3200);
})();

// clientes: o logo troca dentro da frase "Marcas como [logo] confiam na UAU."
(function(){
  const slot=document.getElementById('clslot'); if(!slot) return;
  const imgs=[...slot.querySelectorAll('img')], seg=document.getElementById('clseg'), idx=document.getElementById('clidx');
  let i=0;
  setInterval(()=>{
    const cur=imgs[i]; i=(i+1)%imgs.length; const nxt=imgs[i];
    cur.classList.remove('on'); cur.classList.add('out');
    nxt.classList.remove('out'); void nxt.offsetWidth; nxt.classList.add('on');
    setTimeout(()=>cur.classList.remove('out'),750);
    seg.style.opacity=0; setTimeout(()=>{ seg.textContent=nxt.dataset.seg; seg.style.opacity=1; },300);
    idx.textContent=String(i+1).padStart(2,'0');
  }, reduce?3500:2600);
})();
const q='<div class="quote"><span class="stars">★★★★★</span><p class="fill">“[Depoimento do cliente em 2 a 3 linhas, tirado do Google ou do WhatsApp com autorização.]”</p><div class="who"><span class="avatar"></span><span><b>Nome</b><br><span style="color:#5A5563">Profissão ou empresa</span></span></div></div>';
loop('quotes', q.repeat(5));
const quoteGrid=document.getElementById('quote-grid'); if(quoteGrid) quoteGrid.innerHTML=q.repeat(6);

// marca no menu a página atual
const here=location.pathname.split('/').pop()||'index.html';
document.querySelectorAll('.menu a, .drawer a').forEach(a=>{ if(a.getAttribute('href')===here) a.setAttribute('aria-current','page'); });

// nav fica sólida ao rolar
const nav=document.getElementById('nav');
const onScroll=()=>nav.classList.toggle('solid', scrollY>40);
addEventListener('scroll', onScroll, {passive:true}); onScroll();

// menu mobile
const drawer=document.getElementById('drawer'), burger=document.getElementById('burger');
const setDrawer=open=>{ drawer.hidden=!open; burger.setAttribute('aria-expanded',open); document.body.classList.toggle('locked',open); (open?document.getElementById('close'):burger).focus(); };
burger.onclick=()=>setDrawer(true);
document.getElementById('close').onclick=()=>setDrawer(false);
drawer.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setDrawer(false)));
addEventListener('keydown',e=>{ if(e.key==='Escape' && !drawer.hidden) setDrawer(false); });

// carrossel de vídeos
const vids=document.getElementById('videos');
if(vids){
  document.getElementById('next').onclick=()=>vids.scrollBy({left:320,behavior:reduce?'auto':'smooth'});
  document.getElementById('prev').onclick=()=>vids.scrollBy({left:-320,behavior:reduce?'auto':'smooth'});
}

// depoimentos em vídeo: tocam no clique, com som e controles; só um toca por vez
document.querySelectorAll('.vplayer').forEach(box=>{
  const v=box.querySelector('video'), btn=box.querySelector('.play');
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.vplayer video').forEach(o=>{ if(o!==v) o.pause(); });
    v.controls=true; box.classList.add('playing');
    v.play().catch(()=>{ box.classList.remove('playing'); v.controls=false; });
  });
  v.addEventListener('pause',()=>{ if(v.ended||v.currentTime===0) { box.classList.remove('playing'); v.controls=false; } });
  v.addEventListener('ended',()=>{ box.classList.remove('playing'); v.controls=false; v.currentTime=0; v.load(); });
  v.addEventListener('play',()=>{ document.querySelectorAll('.vplayer video').forEach(o=>{ if(o!==v) o.pause(); }); });
});

// depoimentos (reels): prévia sem som enquanto estão na tela; o botão toca do começo com som
(function(){
  const reels=[...document.querySelectorAll('.reel')]; if(!reels.length) return;
  const stopSound=r=>{ const v=r.querySelector('video'); r.classList.remove('sound'); v.muted=true; v.controls=false; };
  reels.forEach(r=>{
    const v=r.querySelector('video');
    r.querySelector('.reel-btn').addEventListener('click',()=>{
      reels.forEach(o=>{ if(o!==r){ stopSound(o); if(reduce) o.querySelector('video').pause(); } });
      r.classList.add('sound'); v.muted=false; v.controls=true; v.loop=false; v.currentTime=0; v.play().catch(()=>stopSound(r));
    });
    v.addEventListener('ended',()=>{ stopSound(r); v.loop=true; if(!reduce) v.play().catch(()=>{}); });
    v.addEventListener('volumechange',()=>{ if(v.muted && r.classList.contains('sound')) stopSound(r); });
  });
  if(reduce || !('IntersectionObserver' in window)) return;
  const io=new IntersectionObserver(es=>es.forEach(e=>{
    const r=e.target, v=r.querySelector('video');
    if(e.isIntersecting){ if(v.paused) v.play().catch(()=>{}); }
    else { v.pause(); stopSound(r); v.loop=true; }
  }),{threshold:.35});
  reels.forEach(r=>io.observe(r));
})();

// time em cápsulas: as colunas trocam qual cápsula é grande, uma de cada vez, em onda
(function(){
  const box=document.getElementById('pills'); if(!box || reduce) return;
  const cols=[...box.querySelectorAll('.pcol')]; let k=0;
  setInterval(()=>{ const r=box.getBoundingClientRect(); if(r.bottom<0||r.top>innerHeight) return; cols[k%cols.length].classList.toggle('flip'); k++; },1400);
})();

// filtro de clientes por segmento
const filters=document.getElementById('filters');
if(filters){
  filters.addEventListener('click',e=>{
    const b=e.target.closest('button'); if(!b) return;
    filters.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));
    const seg=b.dataset.seg;
    document.querySelectorAll('#logo-grid [data-seg]').forEach(t=>{ t.hidden = seg!=='todos' && t.dataset.seg!==seg; });
  });
}

// hero: fotos dos bastidores trocando no fundo, uma por vez
(function(){
  const box=document.getElementById('slides'); if(!box) return;
  const imgs=['bastidores','gravacao-1','camera','gravacao-2','equipe','camiseta'];
  box.innerHTML=imgs.map((n,k)=>`<div class="slide${k?'':' on'}" style="background-image:url(img/${n}.jpg)"></div>`).join('');
  if(reduce) return;
  const slides=[...box.children]; let k=0;
  setInterval(()=>{ slides[k].classList.remove('on'); k=(k+1)%slides.length; slides[k].classList.add('on'); },5000);
})();

// hero: palavra que troca
(function(){
  const words=[...document.querySelectorAll('#rotator span')];
  if(reduce||!words.length) return;
  let i=0;
  setInterval(()=>{
    const cur=words[i], nxt=words[(i+1)%words.length];
    cur.className='out';
    nxt.className='in'; void nxt.offsetWidth; nxt.className='';
    setTimeout(()=>{ if(cur.className==='out') cur.className='in'; },750);
    i=(i+1)%words.length;
  },2400);
})();

// animações de entrada e contadores (o conteúdo já nasce visível)
if(!reduce && 'IntersectionObserver' in window){
  const io=new IntersectionObserver(es=>es.forEach(e=>{
    if(e.isIntersecting){ e.target.classList.remove('pre'); io.unobserve(e.target); }
  }),{threshold:.15});
  document.querySelectorAll('.reveal').forEach(el=>{
    const r=el.getBoundingClientRect();
    if(r.top>innerHeight){ el.classList.add('pre'); io.observe(el); }
  });
  const co=new IntersectionObserver(es=>es.forEach(e=>{
    if(!e.isIntersecting) return;
    const el=e.target, end=+el.dataset.count, pre=el.dataset.prefix||'', suf=el.dataset.suffix||'';
    const t0=performance.now(), dur=1400;
    const step=t=>{ const k=Math.min(1,(t-t0)/dur), val=Math.round(end*(1-Math.pow(1-k,3))); el.textContent=pre+val+suf; if(k<1) requestAnimationFrame(step); };
    requestAnimationFrame(step); co.unobserve(el);
  }),{threshold:.6});
  document.querySelectorAll('[data-count]').forEach(el=>co.observe(el));
}

// mosaico de números: os blocos entram em sequência quando a seção aparece
const bento=document.querySelector('.bento');
if(bento && !reduce && 'IntersectionObserver' in window && bento.getBoundingClientRect().top>innerHeight){
  const tiles=[...bento.children];
  tiles.forEach(t=>t.classList.add('pre'));
  const bo=new IntersectionObserver(es=>{ if(!es[0].isIntersecting) return; bo.disconnect();
    tiles.forEach((t,k)=>{ t.classList.add('in'); t.style.transitionDelay=(k*.12)+'s'; requestAnimationFrame(()=>t.classList.remove('pre'));
      setTimeout(()=>{ t.style.transitionDelay=''; },1200+k*120); });
  },{threshold:.2});
  bo.observe(bento);
}
