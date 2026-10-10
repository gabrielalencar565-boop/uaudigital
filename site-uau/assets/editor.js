// Modo de edição dos textos. Só aparece na prévia publicada (quando quem vê pode salvar).
// Os textos alterados ficam em edits.json, por página: { "index": { "12": "<b>novo</b> texto" } }.
// A página em si não muda; ao carregar, ela aplica o que estiver em edits.json.
(function(){
  const page=document.body.dataset.page||'index';
  const SEL='main h2, main h3, main p, main .eyebrow, main .hero-label, main .btn, main q, main li, main .cmp-label, main .cmp-other, main .cmp-uau, main .stat > span, main small, main .person b, footer p, footer li';
  const SKIP='.track, h1, #quote-grid, .sr-only, [aria-hidden="true"], .drawer';
  let all={}, edits={}, els=[];

  function targets(){
    const c=[...document.querySelectorAll(SEL)].filter(el=>!el.closest(SKIP));
    // um texto dentro de outro editável fica com o de fora
    return c.filter(el=>!c.some(o=>o!==el && o.contains(el)));
  }
  // só formatação simples sobrevive: negrito, itálico, quebra de linha e spans com classe
  function clean(html){
    const t=document.createElement('template'); t.innerHTML=html;
    const walk=n=>[...n.childNodes].forEach(c=>{
      if(c.nodeType===3) return;
      if(c.nodeType!==1 || !/^(B|STRONG|I|EM|BR|SPAN)$/.test(c.tagName)){ c.replaceWith(document.createTextNode(c.textContent)); return; }
      [...c.attributes].forEach(a=>{ if(!(c.tagName==='SPAN' && a.name==='class')) c.removeAttribute(a.name); });
      walk(c);
    });
    walk(t.content); return t.innerHTML.trim();
  }
  function apply(){
    els=targets();
    Object.entries(edits).forEach(([k,html])=>{ const el=els[+k]; if(el) el.innerHTML=clean(html); });
  }

  fetch('edits.json',{cache:'no-store'}).then(r=>r.ok?r.json():{}).catch(()=>({})).then(j=>{
    all=j&&typeof j==='object'?j:{}; edits=Object.assign({},all[page]); apply();
  }).then(start);

  async function start(){
    if(!window.claude || typeof claude.use!=='function') return;
    const artifact=await claude.use('artifact');
    if(!artifact) return;

    const css=document.createElement('style');
    css.textContent=`
.ed-fab{position:fixed;left:16px;bottom:20px;z-index:60;display:flex;gap:8px;align-items:center;font:600 14px var(--display);background:#fff;color:#141217;border:0;border-radius:999px;padding:12px 18px;box-shadow:0 10px 30px rgba(0,0,0,.4);cursor:pointer}
.ed-bar{position:fixed;left:50%;bottom:20px;translate:-50% 0;z-index:60;display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:center;background:#fff;color:#141217;border-radius:20px;padding:10px 12px 10px 18px;box-shadow:0 14px 40px rgba(0,0,0,.5);font:500 14px var(--display);max-width:calc(100vw - 32px)}
.ed-bar button{font:600 14px var(--display);border-radius:999px;padding:10px 16px;border:1px solid #CFC9DA;background:#fff;color:#141217;cursor:pointer}
.ed-bar .save{background:var(--grad);color:#fff;border:0}
.ed-bar button:disabled{opacity:.5;cursor:default}
body.editing [data-ed]{outline:1.5px dashed rgba(242,160,74,.85);outline-offset:3px;border-radius:4px;cursor:text}
body.editing [data-ed]:focus{outline:2px solid #F2A04A;background:rgba(242,160,74,.08)}
body.editing [data-ed].changed{outline-color:#7FE0A7}
body.editing .wa, body.editing .sticky{display:none}
.ed-fab[hidden],.ed-bar[hidden]{display:none}
@media (max-width:900px){.ed-fab{bottom:90px}}`;
    document.head.appendChild(css);

    const fab=document.createElement('button');
    fab.className='ed-fab'; fab.type='button'; fab.textContent='✎ Editar textos';
    const bar=document.createElement('div');
    bar.className='ed-bar'; bar.hidden=true;
    bar.innerHTML='<span class="msg">Clique em qualquer texto para mudar.</span><button type="button" class="cancel">Cancelar</button><button type="button" class="save">Salvar</button>';
    document.body.append(fab,bar);
    const msg=bar.querySelector('.msg'), save=bar.querySelector('.save'), cancel=bar.querySelector('.cancel');
    let before=[];

    // no modo de edição, clicar num botão ou link edita o texto em vez de navegar
    document.addEventListener('click',e=>{ if(document.body.classList.contains('editing') && e.target.closest('a') && !e.target.closest('.ed-bar')) e.preventDefault(); },true);

    fab.onclick=()=>{
      els=targets(); before=els.map(el=>el.innerHTML);
      els.forEach((el,i)=>{ el.dataset.ed=i; el.contentEditable='true'; el.spellcheck=true;
        el.addEventListener('input',onInput); });
      document.body.classList.add('editing'); fab.hidden=true; bar.hidden=false;
      msg.textContent='Clique em qualquer texto para mudar.'; save.disabled=true;
    };
    function onInput(e){ e.currentTarget.classList.add('changed'); save.disabled=false; msg.textContent='Alterações não salvas.'; }
    function stop(){
      els.forEach(el=>{ el.removeAttribute('contenteditable'); el.removeAttribute('data-ed'); el.classList.remove('changed'); el.removeEventListener('input',onInput); });
      document.body.classList.remove('editing'); bar.hidden=true; fab.hidden=false;
    }
    cancel.onclick=()=>{ els.forEach((el,i)=>{ el.innerHTML=before[i]; }); stop(); };
    // Enter fecha a linha em vez de criar parágrafo novo dentro do texto
    document.addEventListener('keydown',e=>{ if(e.key==='Enter' && e.target.dataset && e.target.dataset.ed!==undefined){ e.preventDefault(); e.target.blur(); } });

    save.onclick=async()=>{
      els.forEach((el,i)=>{ if(el.classList.contains('changed')) edits[i]=clean(el.innerHTML); });
      const next=Object.assign({},all,{[page]:edits});
      save.disabled=true; cancel.disabled=true; msg.textContent='Salvando…';
      try{
        await artifact.publish({'edits.json':{content:JSON.stringify(next,null,2),contentType:'application/json'}});
        all=next; stop(); msg.textContent=''; flash('Salvo ✓');
      }catch(err){
        const code=err&&err.code;
        cancel.disabled=false;
        if(code==='conflict'){ msg.textContent='Alguém salvou antes; a página vai recarregar.'; return; }
        if(code==='not_writer'||code==='not_granted'||code==='not_declared'||code==='consent_required'){ msg.textContent='Esta visualização é só de leitura.'; fab.remove(); return; }
        if(code==='capability_disabled'||code==='capability_removed'){ msg.textContent='Salvar não está disponível aqui. Suas mudanças continuam na tela.'; return; }
        if(code==='rate_limited'){ msg.textContent='Muitos salvamentos seguidos. Espere um pouco e tente de novo.'; save.disabled=false; return; }
        msg.textContent='Não deu para salvar agora. Tente de novo.'; save.disabled=false;
      }
    };
    function flash(t){ const f=document.createElement('div'); f.className='ed-bar'; f.textContent=t; document.body.appendChild(f); setTimeout(()=>f.remove(),2200); }
  }
})();
