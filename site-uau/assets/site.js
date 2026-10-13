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
  const imgs=[...slot.children], seg=document.getElementById('clseg'), idx=document.getElementById('clidx');
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
// funciona com e sem .html no endereço (no ar, /sobre e /sobre.html são a mesma página)
const here=(location.pathname.split('/').pop()||'index').replace(/\.html$/,'');
document.querySelectorAll('.menu a, .drawer a').forEach(a=>{ if((a.getAttribute('href')||'').replace(/\.html$/,'')===here) a.setAttribute('aria-current','page'); });

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

// reels, filmes e depoimentos: prévia sem som enquanto estão na tela; tocar no card abre o vídeo grande com som
(function(){
  const reels=[...document.querySelectorAll('.reel')]; if(!reels.length) return;
  reels.forEach(r=>{ const v=r.querySelector('video'); v.addEventListener('playing',()=>v.classList.add('live')); });
  // prévia sem som: no celular (iPhone/Android) o vídeo só toca sozinho se estiver mudo e "inline",
  // e o modo economia de energia pode bloquear; aí tentamos de novo no primeiro toque na tela
  const visible=new Set();
  const preview=r=>{ const v=r.querySelector('video'); if(document.body.classList.contains('lb-open')) return;
    v.muted=true; v.defaultMuted=true; v.playsInline=true; v.setAttribute('playsinline',''); v.setAttribute('webkit-playsinline','');
    if(v.preload==='none') v.preload='metadata';
    if(v.paused) v.play().catch(()=>{}); };
  if(!('IntersectionObserver' in window)) return;
  const io=new IntersectionObserver(es=>es.forEach(e=>{
    const r=e.target, v=r.querySelector('video');
    if(e.isIntersecting){ visible.add(r); preview(r); }
    else { visible.delete(r); v.pause(); }
  }),{threshold:.2});
  reels.forEach(r=>io.observe(r));
  const retry=()=>visible.forEach(preview);
  ['touchstart','pointerdown','scroll'].forEach(ev=>addEventListener(ev,retry,{passive:true,once:ev!=='scroll'}));
  setInterval(retry,2500);
})();

// time em cápsulas: as colunas trocam qual cápsula é grande, uma de cada vez, em onda
(function(){
  const box=document.getElementById('pills'); if(!box || reduce) return;
  const cols=[...box.querySelectorAll('.pcol')]; let k=0;
  setInterval(()=>{ const r=box.getBoundingClientRect(); if(r.bottom<0||r.top>innerHeight) return; cols[k%cols.length].classList.toggle('flip'); k++; },1400);
})();

// portfólio 3D: cada categoria (Criativos, Reels, Filmes) chega deitada e levanta de frente com a rolagem, uma depois da outra
(function(){
  const chs=[...document.querySelectorAll('.ch3d')]; if(!chs.length || reduce) return;
  const tick=()=>{
    const vh=innerHeight;
    chs.forEach((c,k)=>{
      const r=c.getBoundingClientRect();
      const raw=Math.min(1,Math.max(0,(vh-r.top)/(vh*.78))), p=raw*raw*(3-2*raw), q=1-p;
      c.style.setProperty('--rx',(q*62)+'deg');
      c.style.setProperty('--rz',(q*(k%2?5:-5))+'deg');
      c.style.setProperty('--ty',(q*90)+'px');
      c.style.setProperty('--sc',(1+q*.12).toFixed(3));
      c.style.setProperty('--op',(.25+p*.75).toFixed(2));
      c.style.setProperty('--gl',(Math.sin(p*Math.PI)*.9).toFixed(2));
    });
  };
  addEventListener('scroll',()=>requestAnimationFrame(tick),{passive:true}); addEventListener('resize',tick); tick();
})();

// faixas arrastáveis: passam sozinhas e dá para arrastar (mouse ou dedo) para adiantar ou voltar, com embalo
document.querySelectorAll('[data-drag]').forEach(box=>{
  const track=box.querySelector('.track'); if(!track) return;
  const secs=+box.dataset.drag||60, mob=matchMedia('(max-width:900px)');
  let x=0, half=1, v=0, down=false, lastX=0, lastT=0, hover=false, moved=0, prev=performance.now();
  const measure=()=>{ half=track.scrollWidth/2||1; };
  const wrap=()=>{ while(x<=-half) x+=half; while(x>0) x-=half; };
  const frame=t=>{
    const dt=Math.min(64,t-prev); prev=t;
    if(!down){
      const auto=reduce||hover||document.body.classList.contains('lb-open')||document.body.classList.contains('aj')||document.body.classList.contains('ajt')?0:-(half/((mob.matches?secs*.72:secs)*1000));
      v+= (auto - v)*0.04;            // embalo do arrasto volta aos poucos para a velocidade normal
      x+=v*dt; wrap();
    }
    track.style.transform=`translate3d(${x}px,0,0)`;
    requestAnimationFrame(frame);
  };
  box.addEventListener('pointerenter',e=>{ if(e.pointerType==='mouse') hover=true; });
  box.addEventListener('pointerleave',()=>{ hover=false; });
  box.addEventListener('pointerdown',e=>{ down=true; moved=0; lastX=e.clientX; lastT=performance.now(); v=0; box.classList.add('dragging'); });
  // só captura o ponteiro depois que vira arrasto, para os botões (Ouvir/Assistir) continuarem clicáveis
  box.addEventListener('pointermove',e=>{ if(!down) return; const dx=e.clientX-lastX, now=performance.now(); x+=dx; wrap(); moved+=Math.abs(dx); if(moved>10 && !box.hasPointerCapture(e.pointerId)) box.setPointerCapture(e.pointerId); v=dx/Math.max(1,now-lastT); lastX=e.clientX; lastT=now; });
  const up=()=>{ if(!down) return; down=false; box.classList.remove('dragging'); v=Math.max(-3,Math.min(3,v)); };
  box.addEventListener('pointerup',up); box.addEventListener('pointercancel',up);
  box.addEventListener('click',e=>{ if(moved>10){ e.preventDefault(); e.stopPropagation(); } },true);
  addEventListener('resize',measure); addEventListener('load',measure); measure();
  requestAnimationFrame(frame);
});

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

// janela grande: criativos e vídeos abrem saindo do lugar deles, com o fundo desfocado (e voltam para ele ao fechar)
(()=>{
  const lb=document.createElement('div'); lb.className='lb'; lb.setAttribute('role','dialog'); lb.setAttribute('aria-modal','true'); lb.hidden=true;
  const ico=d=>`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
  lb.innerHTML=`<div class="lb-bg"></div><div class="lb-m"></div><div class="lb-cap"><b></b><span></span><i></i></div>
    <button class="lb-x" aria-label="Fechar">${ico('M6 6l12 12M18 6L6 18')}</button>
    <button class="lb-nav lb-prev" aria-label="Anterior">${ico('M15 5l-7 7 7 7')}</button>
    <button class="lb-nav lb-next" aria-label="Próximo">${ico('M9 5l7 7-7 7')}</button>`;
  document.body.appendChild(lb);
  const m=lb.querySelector('.lb-m'), cap=lb.querySelector('.lb-cap'), ease='cubic-bezier(.2,.8,.2,1)';
  let list=[], cur=0, origin=null, busy=false, last=null;
  const box=it=>{ if(it.im&&it.im.naturalWidth){ it.w=it.im.naturalWidth; it.h=it.im.naturalHeight; } const mob=innerWidth<700, mw=innerWidth*(mob?.92:.8), mh=innerHeight*(mob?.7:.78), k=Math.min(mw/it.w,mh/it.h), W=it.w*k, H=it.h*k; return {W,H,L:(innerWidth-W)/2,T:(innerHeight-H)/2-(mob?24:20)}; };
  const place=()=>{ const b=box(list[cur]); Object.assign(m.style,{width:b.W+'px',height:b.H+'px',left:b.L+'px',top:b.T+'px'}); return b; };
  const from=(r,b)=>`translate(${r.left+r.width/2-(b.L+b.W/2)}px,${r.top+r.height/2-(b.T+b.H/2)}px) scale(${r.width/b.W},${r.height/b.H})`;
  const stop=()=>m.querySelectorAll('video').forEach(v=>{ v.pause(); v.removeAttribute('src'); v.load(); });
  // monta a mídia; o vídeo começa a tocar com som já no toque (exigência do iPhone/Android)
  const fill=i=>{
    stop(); cur=(i+list.length)%list.length; const it=list[cur];
    m.innerHTML=''; const im=new Image(); im.src=it.thumb; im.alt=it.alt||''; im.draggable=false; m.appendChild(im);
    if(it.video){ const v=document.createElement('video'); v.src=it.video; v.playsInline=true; v.setAttribute('playsinline',''); v.setAttribute('webkit-playsinline',''); v.controls=true; v.preload='auto';
      v.addEventListener('playing',()=>v.classList.add('live')); m.appendChild(v); m.classList.add('is-video');
      v.play().catch(()=>{ v.muted=true; v.play().catch(()=>{}); }); }
    else m.classList.remove('is-video');
    cap.querySelector('b').textContent=it.t; cap.querySelector('span').textContent=it.s; cap.querySelector('i').textContent=list.length>1?`${cur+1} / ${list.length}`:'';
    lb.setAttribute('aria-label',it.t);
  };
  const visible=()=>{ const it=list[cur]; return it.els.find(el=>{ const r=el.getBoundingClientRect(); return r.right>0&&r.left<innerWidth&&r.bottom>0&&r.top<innerHeight; }); };
  const open=(group,el)=>{
    if(busy||!lb.hidden) return; busy=true; last=document.activeElement; list=group;
    document.querySelectorAll('.reel video').forEach(v=>v.pause());
    fill(group.findIndex(it=>it.els.includes(el))); origin=el;
    lb.hidden=false; lb.classList.toggle('solo',list.length<2); document.body.classList.add('lb-open'); const b=place();
    m.style.transition='none'; m.style.transform=reduce?'scale(.96)':from(el.getBoundingClientRect(),b); m.style.borderRadius=getComputedStyle(el).borderRadius; el.style.visibility='hidden';
    lb.offsetWidth; lb.classList.add('on');
    m.style.transition=`transform .6s ${ease}, border-radius .6s ${ease}, opacity .3s`; m.style.transform='none'; m.style.borderRadius='14px';
    setTimeout(()=>{ busy=false; lb.querySelector('.lb-x').focus({preventScroll:true}); },600);
  };
  const close=()=>{
    if(busy||lb.hidden) return; busy=true; lb.classList.remove('on'); stop();
    const back=visible(), b=place();
    if(origin&&origin!==back) origin.style.visibility='';
    if(back&&!reduce){ back.style.visibility='hidden'; m.style.transform=from(back.getBoundingClientRect(),b); m.style.borderRadius=getComputedStyle(back).borderRadius; }
    else { m.style.opacity='0'; m.style.transform='scale(.92)'; }
    setTimeout(()=>{ lb.hidden=true; document.body.classList.remove('lb-open'); if(back) back.style.visibility=''; m.style.opacity=''; m.innerHTML=''; origin=null; busy=false; last&&last.focus&&last.focus({preventScroll:true}); },560);
  };
  const go=d=>{
    if(busy||list.length<2) return; busy=true;
    if(origin){ origin.style.visibility=''; origin=null; }
    const out=m.cloneNode(true); out.querySelectorAll('video').forEach(v=>v.remove()); out.classList.add('lb-out'); lb.insertBefore(out,m);
    fill(cur+d); place();
    m.style.transition='none'; m.style.opacity='0'; m.style.transform=`translateX(${d*60}px) scale(.96)`; m.offsetWidth;
    m.style.transition=`transform .5s ${ease}, opacity .4s`; m.style.opacity='1'; m.style.transform='none';
    out.style.transition=`transform .45s ${ease}, opacity .35s`; out.style.opacity='0'; out.style.transform=`translateX(${-d*60}px) scale(.96)`;
    setTimeout(()=>{ out.remove(); busy=false; },480);
  };
  lb.querySelector('.lb-bg').onclick=close; lb.querySelector('.lb-x').onclick=close;
  lb.querySelector('.lb-prev').onclick=()=>go(-1); lb.querySelector('.lb-next').onclick=()=>go(1);
  addEventListener('keydown',e=>{ if(lb.hidden) return; if(e.key==='Escape') close(); else if(e.key==='ArrowRight') go(1); else if(e.key==='ArrowLeft') go(-1); else if(e.key==='Tab'){ const bs=[...lb.querySelectorAll('button')].filter(x=>x.offsetParent), i=bs.indexOf(document.activeElement); e.preventDefault(); bs[(i+(e.shiftKey?-1:1)+bs.length)%bs.length].focus(); } });
  addEventListener('resize',()=>{ if(!lb.hidden&&!busy){ m.style.transition='none'; place(); } });
  // na foto: arrastar para o lado troca, para baixo fecha (no vídeo fica livre para a barra de controles)
  let sx=0, sy=0, st=false;
  m.addEventListener('pointerdown',e=>{ st=!list[cur]?.video; sx=e.clientX; sy=e.clientY; });
  m.addEventListener('pointerup',e=>{ if(!st) return; st=false; const dx=e.clientX-sx, dy=e.clientY-sy;
    if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)) go(dx<0?1:-1); else if(dy>80) close(); });
  // grupos: cada faixa navega entre as próprias peças (as cópias da faixa em loop contam como a mesma)
  const group=(cards,info)=>{ const g=[]; cards.forEach(el=>{ const it=info(el); let x=g.find(o=>o.key===it.key); if(!x){ x={...it,els:[]}; g.push(x); } x.els.push(el);
    el.addEventListener('click',()=>open(g,el)); if(el.tagName!=='BUTTON'&&!el.querySelector('button')){ el.tabIndex=el.getAttribute('aria-hidden')?-1:0; el.setAttribute('role','button'); el.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); open(g,el); } }); } }); };
  group(document.querySelectorAll('.cr-item'),f=>{ const im=f.querySelector('img'); return {key:im.getAttribute('src'),thumb:im.getAttribute('src'),alt:im.alt,im,w:900,h:1125,t:f.querySelector('b').textContent,s:f.querySelector('figcaption span').textContent}; });
  ['#pfreels','.inst-loop','#reels'].forEach(sel=>{ const wrap=document.querySelector(sel); if(!wrap) return;
    group(wrap.querySelectorAll('.reel'),r=>{ const v=r.querySelector('video'), wide=r.classList.contains('inst-card'), who=r.querySelector('.reel-who');
      return {key:v.getAttribute('src'),video:v.getAttribute('src'),thumb:v.getAttribute('poster'),w:wide?16:9,h:wide?9:16,t:who.querySelector('b').textContent,s:who.querySelector('span').textContent}; }); });
})();

// formulário "Falar com a UAU": todos os botões de contato abrem esta janela
// Para onde vão os pedidos: preencha o e-mail que recebe (via FormSubmit) e/ou o WhatsApp da UAU (só números, com 55 e DDD)
const CONTATO={ email:'uaucomunicacaodigital@gmail.com', whatsapp:'5599984344705',
  // 'whatsapp': os botões levam direto para o link abaixo | 'formulario': os botões abrem o formulário
  modo:'whatsapp',
  link:'https://api.whatsapp.com/send/?phone=5599984344705&text=Oi%2C+vi+o+trabalho+da+Uau+Digital+no+Instagram+e+gostaria+de+saber+como+voc%C3%AAs+podem+ajudar+meu+neg%C3%B3cio%21&type=phone_number&app_absent=0' };
(()=>{
  const opts=(l)=>l.map(o=>`<option>${o}</option>`).join('');
  const chips=['Posicionamento estratégico','Conteúdo e redes sociais','Produção de vídeo','Tráfego pago','Ainda não sei'];
  const m=document.createElement('div'); m.className='lead'; m.hidden=true; m.setAttribute('role','dialog'); m.setAttribute('aria-modal','true'); m.setAttribute('aria-labelledby','lead-t');
  m.innerHTML=`<div class="lead-bg"></div>
  <div class="lead-card">
    <button class="lead-x" type="button" aria-label="Fechar"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    <form class="lead-form" novalidate>
      <div class="lead-head"><span class="eyebrow">Vamos conversar</span><h2 id="lead-t">Conte sobre a <b class="grad-text">sua marca.</b></h2><p class="muted">Leva menos de um minuto. O nosso time responde em até 1 dia útil.</p></div>
      <div class="lead-grid">
        <label class="f"><span>Seu nome</span><input name="nome" autocomplete="name" required placeholder="Como podemos te chamar?"></label>
        <label class="f"><span>WhatsApp</span><input name="whatsapp" type="tel" inputmode="tel" autocomplete="tel" required placeholder="(99) 99999-9999"></label>
        <label class="f"><span>E-mail</span><input name="email" type="email" autocomplete="email" required placeholder="voce@empresa.com"></label>
        <label class="f"><span>Empresa ou profissão</span><input name="empresa" autocomplete="organization" required placeholder="Ex.: Clínica Sorriso, advogada"></label>
        <label class="f"><span>Segmento</span><select name="segmento" required><option value="">Selecione</option>${opts(['Saúde','Jurídico','Comércio e varejo','Alimentação','Indústria','Educação','Serviços','Imobiliário','Beleza e estética','Outro'])}</select></label>
        <label class="f"><span>Faturamento mensal</span><select name="faturamento" required><option value="">Selecione</option>${opts(['Até R$ 10 mil','R$ 10 mil a R$ 30 mil','R$ 30 mil a R$ 100 mil','R$ 100 mil a R$ 300 mil','Acima de R$ 300 mil','Prefiro não informar'])}</select></label>
        <label class="f f-full"><span>Instagram <em>(opcional)</em></span><input name="instagram" autocomplete="off" placeholder="@suamarca"></label>
        <fieldset class="f f-full"><legend>O que você procura? <em>(pode marcar mais de um)</em></legend><div class="chips">${chips.map(c=>`<label class="chip"><input type="checkbox" name="interesse" value="${c}"><span>${c}</span></label>`).join('')}</div></fieldset>
        <label class="f f-full"><span>Como está a sua marca hoje? <em>(opcional)</em></span><textarea name="mensagem" rows="3" placeholder="Seu momento, objetivos, o que já tentou..."></textarea></label>
        <input type="text" name="_honey" tabindex="-1" autocomplete="off" class="lead-hp" aria-hidden="true">
      </div>
      <p class="lead-err" role="alert"></p>
      <button class="btn btn-main lead-send" type="submit"><span>Enviar e falar com a UAU</span> <span class="arr">↗</span></button>
      <p class="lead-note">Seus dados ficam só com a UAU e são usados apenas para este contato.</p>
    </form>
    <div class="lead-ok" hidden>
      <div class="lead-check"><svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
      <h2>Recebemos, <b class="grad-text lead-name"></b></h2>
      <p class="muted">Em breve alguém do nosso time chama você no WhatsApp para marcar a conversa.</p>
      <a class="btn btn-main lead-wa" target="_blank" rel="noopener" hidden>Adiantar pelo WhatsApp <span class="arr">↗</span></a>
    </div>
  </div>`;
  document.body.appendChild(m);
  const f=m.querySelector('form'), err=m.querySelector('.lead-err'), send=m.querySelector('.lead-send'), ok=m.querySelector('.lead-ok');
  let last=null;
  const open=()=>{ last=document.activeElement; m.hidden=false; document.body.classList.add('lb-open'); m.offsetWidth; m.classList.add('on'); setTimeout(()=>f.querySelector('input').focus({preventScroll:true}),350); };
  const close=()=>{ m.classList.remove('on'); setTimeout(()=>{ m.hidden=true; document.body.classList.remove('lb-open'); last&&last.focus&&last.focus({preventScroll:true}); },400); };
  document.addEventListener('click',e=>{ const a=e.target.closest('a[href$="#contato"],a[data-lead]'); if(!a) return; e.preventDefault(); if(!drawer.hidden) setDrawer(false); if(CONTATO.modo==='whatsapp'){ const w=window.open(CONTATO.link,'_blank'); if(w) w.opener=null; else location.href=CONTATO.link; return; } open(); });
  m.querySelector('.lead-bg').onclick=close; m.querySelector('.lead-x').onclick=close;
  addEventListener('keydown',e=>{ if(m.hidden) return; if(e.key==='Escape') close();
    if(e.key==='Tab'){ const fs=[...m.querySelectorAll('button,input:not(.lead-hp),select,textarea,a[href]')].filter(x=>x.offsetParent); const i=fs.indexOf(document.activeElement);
      if(e.shiftKey&&i<=0){ e.preventDefault(); fs[fs.length-1].focus(); } else if(!e.shiftKey&&i===fs.length-1){ e.preventDefault(); fs[0].focus(); } } });
  // máscara do WhatsApp
  const tel=f.whatsapp; tel.addEventListener('input',()=>{ const d=tel.value.replace(/\D/g,'').slice(0,11); tel.value=d.length>6?`(${d.slice(0,2)}) ${d.slice(2,d.length-4)}-${d.slice(-4)}`:d.length>2?`(${d.slice(0,2)}) ${d.slice(2)}`:d; });
  f.addEventListener('input',e=>e.target.closest('.f')?.classList.remove('bad'));
  f.addEventListener('submit',async e=>{
    e.preventDefault(); err.textContent='';
    const bad=[...f.querySelectorAll('[required]')].filter(x=>!x.value.trim()||(x.type==='email'&&!/^\S+@\S+\.\S+$/.test(x.value))||(x.name==='whatsapp'&&x.value.replace(/\D/g,'').length<10));
    f.querySelectorAll('.f').forEach(x=>x.classList.remove('bad')); bad.forEach(x=>x.closest('.f').classList.add('bad'));
    if(bad.length){ err.textContent='Confira os campos destacados.'; bad[0].focus(); return; }
    if(f._honey.value) return;
    const d=Object.fromEntries(new FormData(f)); d.interesse=[...f.querySelectorAll('[name=interesse]:checked')].map(x=>x.value).join(', ')||'Não informado'; delete d._honey;
    if(!CONTATO.email&&!CONTATO.whatsapp){ err.textContent='O envio ainda não foi configurado.'; return; }
    send.disabled=true; send.firstElementChild.textContent='Enviando...';
    try{
      if(CONTATO.email){ const r=await fetch(`https://formsubmit.co/ajax/${CONTATO.email}`,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},
        body:JSON.stringify({_subject:`Novo contato pelo site: ${d.nome} (${d.empresa})`,_template:'table',_captcha:'false',...d,origem:location.href})}); const j=await r.json().catch(()=>({})); if(!r.ok||String(j.success)==='false') throw 0; }
      const nome=d.nome.trim().split(' ')[0];
      ok.querySelector('.lead-name').textContent=nome+'!';
      if(CONTATO.whatsapp){ const w=ok.querySelector('.lead-wa'); w.hidden=false;
        w.href=`https://wa.me/${CONTATO.whatsapp}?text=${encodeURIComponent(`Olá, UAU! Sou ${d.nome}, da ${d.empresa} (${d.segmento}). Acabei de preencher o formulário no site e quero conversar sobre: ${d.interesse}.`)}`; }
      f.hidden=true; ok.hidden=false;
    }catch(_){ err.textContent='Não conseguimos enviar agora. Tente de novo em instantes.'; }
    send.disabled=false; send.firstElementChild.textContent='Enviar e falar com a UAU';
  });
})();
