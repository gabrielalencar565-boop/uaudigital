// Comportamento compartilhado por todas as páginas do site. Cada bloco só roda se a página tiver o elemento.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// preenche as faixas em loop (conteúdo duplicado para o loop infinito)
function loop(id, html){ const el=document.getElementById(id); if(el) el.innerHTML = html + html; }
const v=['','v2','v3','v4'];
loop('band', ['Posicionamento','Conteúdo','Audiovisual','Tráfego pago','Design','Estratégia','Gestão com o Fluxo'].map(t=>`<span>${t}</span>`).join(''));
loop('logos', Array.from({length:10},(_,i)=>`<div class="logo-tile">LOGO ${String(i+1).padStart(2,'0')}</div>`).join(''));
const q='<div class="quote"><span class="stars">★★★★★</span><p class="fill">“[Depoimento do cliente em 2 a 3 linhas, tirado do Google ou do WhatsApp com autorização.]”</p><div class="who"><span class="avatar"></span><span><b>Nome</b><br><span style="color:#5A5563">Profissão ou empresa</span></span></div></div>';
loop('quotes', q.repeat(5));
const quoteGrid=document.getElementById('quote-grid'); if(quoteGrid) quoteGrid.innerHTML=q.repeat(6);
loop('textband', ['Vista.','Lembrada.','Escolhida.'].map(t=>`<span>${t}</span>`).join('').repeat(2));
const port=['Vídeo','Post','Foto','Design','Reels','Campanha','Carrossel','Ensaio'];
loop('p1', port.map((t,i)=>`<div class="img ${v[i%4]} ${i%3===1?'w':''}"><span>${t}</span></div>`).join(''));
loop('p2', port.slice().reverse().map((t,i)=>`<div class="img ${v[(i+1)%4]} ${i%3===0?'w':''}"><span>${t}</span></div>`).join(''));

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

// hero: palavra que troca
(function(){
  const words=[...document.querySelectorAll('#rotator span')];
  const steps=[...document.querySelectorAll('#vlesteps b')];
  if(reduce||!words.length) return;
  // a largura acompanha a palavra atual, para a linha do título ficar sempre centralizada
  const rot=document.getElementById('rotator');
  const fit=w=>{ rot.style.width=w.offsetWidth+'px'; };
  fit(words[0]); addEventListener('resize',()=>fit(words[i]));
  let i=0;
  setInterval(()=>{
    const cur=words[i], nxt=words[(i+1)%words.length];
    cur.className='out';
    nxt.className='in'; void nxt.offsetWidth; nxt.className=''; fit(nxt);
    setTimeout(()=>{ if(cur.className==='out') cur.className='in'; },750);
    i=(i+1)%words.length;
    steps.forEach((b,k)=>b.classList.toggle('on',k===i));
  },2400);
})();

// hero: foto segue o mouse de leve
(function(){
  const col=document.getElementById('collage');
  if(reduce||!col||matchMedia('(hover: none)').matches) return;
  const items=[...col.querySelectorAll('[data-depth]')];
  addEventListener('mousemove',e=>{
    const x=e.clientX/innerWidth-.5, y=e.clientY/innerHeight-.5;
    items.forEach(el=>{ const d=+el.dataset.depth; el.style.transform=`translate(${-x*d}px,${-y*d}px)`; });
  },{passive:true});
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
