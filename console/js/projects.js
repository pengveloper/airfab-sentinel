/* 프로젝트 화면: projects/*.json에서 만든 window.PROJECTS를 보여 주고, 부품과 단계 체크를 이 PC에 저장합니다.
   프로젝트 내용은 한국어와 영어를 모두 담고 있어서 L()을 거치지 않고 I18N.lang으로 고릅니다.
   모든 글은 textContent로만 넣습니다. */
window.Projects=(()=>{'use strict';
const $=s=>document.querySelector(s);
const P=window.PROJECTS||[],PARTS=window.PARTS||{};
const lang=()=>window.I18N&&I18N.lang==='en'?'en':'ko';
const LEVEL=()=>['',L('쉬움'),L('보통'),L('도전')];
function st(){const c=Lab.cfg;if(!c.lab||typeof c.lab!=='object')c.lab={};const s=c.lab;
  if(!s.have||typeof s.have!=='object')s.have={};if(!s.done||typeof s.done!=='object')s.done={};
  if(!P.some(p=>p.id===s.sel))s.sel=P.length?P[0].id:null;return s;}
const done=p=>{const d=st().done[p.id];return Array.isArray(d)?d.filter(i=>Number.isInteger(i)&&i>=0&&i<p.steps.length):[];};
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;};

function drawList(){const ol=$('#pj-list');ol.textContent='';const s=st();
  for(const p of P){const li=el('li'),b=el('button','pj-item'+(p.id===s.sel?' on':''));b.type='button';b.dataset.id=p.id;
    b.setAttribute('aria-current',p.id===s.sel?'true':'false');
    b.append(el('b',null,p.title[lang()]));
    const n=done(p).length;b.append(el('span','kv',L`${LEVEL()[p.level]} · ${n}/${p.steps.length} 단계`));
    if(n===p.steps.length)b.classList.add('fin');
    li.append(b);ol.append(li);}
  $('#pj-count').textContent=L`${P.length}개`;}

function drawDetail(){const box=$('#pj-detail');box.textContent='';const p=P.find(x=>x.id===st().sel);if(!p)return;const lg=lang();
  const head=el('div','ph');head.append(el('h2',null,p.title[lg]));
  head.append(el('span','chip',p.status==='HARDWARE_VERIFIED'?L('실기 검증됨'):L('실기 검증 전')));box.append(head);
  const body=el('div','pb pj-body');box.append(body);
  const meta=el('p','kv',L`${LEVEL()[p.level]} · 약 ${p.minutes}분`);body.append(meta,el('p','pj-sum',p.summary[lg]));
  if(p.demo&&Lab.S.source!=='demo'){const b=el('button','btn',L('데모로 해 보기'));b.type='button';b.id='pj-demo';b.addEventListener('click',()=>{if(Lab.S.source!=='demo')Lab.demo();});body.append(b);}

  const grid=el('div','pj-grid');body.append(grid);
  const left=el('section');grid.append(left);
  left.append(el('h3',null,L('배우는 것')));const ul=el('ul','pj-dots');for(const t of p.learn[lg])ul.append(el('li',null,t));left.append(ul);
  const have=st().have,ready=p.parts.filter(id=>have[id]).length;
  left.append(el('h3',null,L`부품 ${ready}/${p.parts.length} 준비`));
  const pl=el('ul','pj-checks');for(const id of p.parts){const li=el('li'),lab=el('label'),cb=el('input');cb.type='checkbox';cb.checked=!!have[id];cb.dataset.part=id;
    lab.append(cb,document.createTextNode((PARTS[id]||{})[lg]||id));li.append(lab);pl.append(li);}
  left.append(pl);
  left.append(el('h3',null,L('펌웨어와 도구')));const fl=el('ul','pj-dots');
  for(const f of p.firmware){const li=el('li'),a=el('a',null,f.name);a.href=f.url;a.rel='noopener';li.append(a);fl.append(li);}left.append(fl);

  const mid=el('section');grid.append(mid);const d=new Set(done(p));
  mid.append(el('h3',null,L`순서 ${d.size}/${p.steps.length}`));
  const sl=el('ol','pj-checks pj-steps');p.steps.forEach((s,i)=>{const li=el('li'),lab=el('label'),cb=el('input');cb.type='checkbox';cb.checked=d.has(i);cb.dataset.step=i;
    lab.append(cb,document.createTextNode(s[lg]));li.append(lab);
    if(s.view){const go=el('button','btn sm',L('열기'));go.type='button';go.dataset.view=s.view;go.setAttribute('aria-label',L`${i+1}단계 화면 열기`);li.append(go);}
    sl.append(li);});mid.append(sl);

  const right=el('section');grid.append(right);right.append(el('h3',null,L('성공 기준')));
  const ok=el('ul','pj-dots ok');for(const t of p.success[lg])ok.append(el('li',null,t));right.append(ok);
  right.append(el('p','muted',L('성공 기준은 직접 보고 판단합니다. 실기에서 확인한 결과는 기록 화면의 세션과 함께 남겨 두세요.')));}

function draw(){drawList();drawDetail();}

function wire(){
  $('#pj-list').addEventListener('click',e=>{const b=e.target.closest('.pj-item');if(!b)return;st().sel=b.dataset.id;Lab.save();draw();$('#pj-detail').focus({preventScroll:true});});
  $('#pj-detail').addEventListener('change',e=>{const t=e.target;if(t.type!=='checkbox')return;const s=st();
    if(t.dataset.part){if(t.checked)s.have[t.dataset.part]=true;else delete s.have[t.dataset.part];}
    else if(t.dataset.step!=null){const p=P.find(x=>x.id===s.sel);const set=new Set(done(p)),i=+t.dataset.step;if(t.checked)set.add(i);else set.delete(i);s.done[p.id]=[...set].sort((a,b)=>a-b);}
    Lab.save();draw();});
  $('#pj-detail').addEventListener('click',e=>{const b=e.target.closest('button[data-view]');if(!b)return;
    if(b.dataset.view==='glass'){if(window.Glass)Glass.open();return;}location.hash=b.dataset.view;});
  draw();}
return{wire,update(){},count:()=>P.length};
})();
