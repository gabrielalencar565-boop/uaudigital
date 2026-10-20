// Página de anúncios (/analise) e página de obrigado (/analise-obrigado).
// CONFIGURAR: ID do Pixel da Meta e WhatsApp do SDR (só números, com 55 e DDD).
const LP={ pixel:'', sdr:'5599984344705', email:'uaucomunicacaodigital@gmail.com' };

// Pixel da Meta: PageView nas duas páginas; Lead só na página de obrigado, uma vez por envio
(()=>{
  if(!LP.pixel) return;
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  fbq('init',LP.pixel); fbq('track','PageView');
})();

const lpGet=k=>{ try{ return JSON.parse(sessionStorage.getItem(k)||'null'); }catch(_){ return null; } };
const lpSet=(k,v)=>{ try{ sessionStorage.setItem(k,JSON.stringify(v)); }catch(_){} };

// guarda as UTMs do anúncio para mandar junto com o lead
(()=>{ const q=new URLSearchParams(location.search), u={};
  ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid'].forEach(k=>{ if(q.get(k)) u[k]=q.get(k); });
  if(Object.keys(u).length) lpSet('lp_utm',u); })();

// vídeo do Ayrton: toca com som ao clicar
(()=>{ const v=document.getElementById('lpvideo'); if(!v) return; const box=v.closest('.lp-video'), b=box.querySelector('.lp-play');
  const go=()=>{ v.controls=true; box.classList.add('on'); v.play().catch(()=>{ box.classList.remove('on'); v.controls=false; }); };
  b.addEventListener('click',go);
  v.addEventListener('error',()=>box.classList.add('sem-video')); })();

// formulário qualificador
(()=>{ const f=document.getElementById('lpform'); if(!f) return;
  const err=f.querySelector('.lead-err'), send=f.querySelector('.lead-send');
  const tel=f.whatsapp; tel.addEventListener('input',()=>{ const d=tel.value.replace(/\D/g,'').slice(0,11); tel.value=d.length>6?`(${d.slice(0,2)}) ${d.slice(2,d.length-4)}-${d.slice(-4)}`:d.length>2?`(${d.slice(0,2)}) ${d.slice(2)}`:d; });
  f.addEventListener('input',e=>e.target.closest('.f')?.classList.remove('bad'));
  f.addEventListener('change',e=>e.target.closest('.f')?.classList.remove('bad'));
  f.addEventListener('submit',async e=>{
    e.preventDefault(); err.textContent='';
    const bad=[];
    f.querySelectorAll('input[required]:not([type=radio]),select[required]').forEach(x=>{ if(!x.value.trim()||(x.name==='whatsapp'&&x.value.replace(/\D/g,'').length<10)) bad.push(x); });
    ['quem_cuida','previsao'].forEach(n=>{ if(!f.querySelector(`[name=${n}]:checked`)) bad.push(f.querySelector(`[name=${n}]`)); });
    f.querySelectorAll('.f').forEach(x=>x.classList.remove('bad')); bad.forEach(x=>x.closest('.f').classList.add('bad'));
    if(bad.length){ err.textContent='Confira os campos destacados.'; bad[0].focus(); return; }
    if(f._honey.value) return;
    const d=Object.fromEntries(new FormData(f)); delete d._honey;
    const lead={...d, ...(lpGet('lp_utm')||{}), pagina:location.href.split('?')[0], id:'lead_'+Date.now()};
    lpSet('lp_lead',lead);
    send.disabled=true; send.firstElementChild.textContent='Enviando...';
    try{ await Promise.race([
      fetch(`https://formsubmit.co/ajax/${LP.email}`,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},
        body:JSON.stringify({_subject:`Lead anúncio: ${d.nome} (${d.segmento}, ${d.previsao})`,_template:'table',_captcha:'false',...lead})}),
      new Promise(r=>setTimeout(r,6000)) ]); }catch(_){}
    // segue para o obrigado mesmo se o e-mail falhar: o botão de WhatsApp leva os dados
    location.href='analise-obrigado.html';
  });
})();

// página de obrigado: evento Lead (uma vez) e botão do WhatsApp com a mensagem pronta
(()=>{ const wa=document.getElementById('tywa'); if(!wa) return;
  const l=lpGet('lp_lead')||{};
  if(l.nome){ document.getElementById('tyname').textContent=l.nome.trim().split(' ')[0]+'!'; }
  if(l.id && window.fbq && !lpGet('lp_lead_sent_'+l.id)){ fbq('track','Lead',{content_name:'Análise gratuita',content_category:l.segmento||''},{eventID:l.id}); lpSet('lp_lead_sent_'+l.id,true); }
  const msg=l.nome
    ? ['Olá, UAU! Acabei de pedir a análise gratuita pelo site.','',`*Nome:* ${l.nome}`,`*Segmento:* ${l.segmento}`,`*Cidade:* ${l.cidade}`,`*Instagram:* ${l.instagram}`,`*Quem cuida do marketing:* ${l.quem_cuida}`,`*Quando pretendo contratar:* ${l.previsao}`].join('\n')
    : 'Olá, UAU! Quero minha análise gratuita.';
  wa.href=`https://wa.me/${LP.sdr}?text=${encodeURIComponent(msg)}`;
})();
