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

/* 이 프로젝트에 맞추기: 필요한 규칙을 켜거나 더하고, 모델 화면의 두 스위치를 켭니다. 다른 규칙과 설정은 건드리지 않고,
   무엇을 바꿨는지 기억해 두었다가 되돌리기로 그것만 원래대로 돌립니다. */
const same=(r,s)=>!!(r&&r.when&&r.then)&&r.when.t===s.when.t&&r.then.t===s.then.t
  &&(s.when.t==='enter'?r.when.room===s.when.room:(r.when.node||'*')===s.when.node)&&(s.when.t!=='quiet'||r.when.sec===s.when.sec)
  &&(s.then.t!=='led'||String(r.then.color).toLowerCase()===s.then.color.toLowerCase())&&(s.then.t!=='notify'||(r.then.level||'alert')===s.then.level);
function plan(p,cfg){const s=p.setup||{},out=[],m=cfg.models||{},rules=Array.isArray(cfg.rules)?cfg.rules:[];
  for(const r of s.rules||[]){const have=rules.find(x=>same(x,r));if(!have)out.push({k:'add',r});else if(!have.on)out.push({k:'on',id:have.id,r});}
  for(const k of['glass','gcam'])if(s.models&&s.models[k]&&!m[k])out.push({k});
  return out;}
function applyTo(cfg,p,stamp){const steps=plan(p,cfg);if(!steps.length)return null;
  const u={id:p.id,added:[],turnedOn:[],models:{}};
  steps.forEach((x,i)=>{if(x.k==='add'){const id='p'+stamp.toString(36)+i;cfg.rules.push({id,on:true,when:{...x.r.when},then:{...x.r.then},fired:0,last:0});u.added.push(id);}
    else if(x.k==='on'){const r=cfg.rules.find(y=>y.id===x.id);if(r){r.on=true;u.turnedOn.push(r.id);}}
    else{if(!cfg.models)cfg.models={pick:[],glass:false,gmodel:'',len:512};u.models[x.k]=!!cfg.models[x.k];cfg.models[x.k]=true;}});
  return u;}
function undoTo(cfg,u){if(!u)return;cfg.rules=cfg.rules.filter(r=>!u.added.includes(r.id));
  for(const r of cfg.rules)if(u.turnedOn.includes(r.id))r.on=false;
  for(const[k,v]of Object.entries(u.models||{}))if(cfg.models)cfg.models[k]=v;}
function say(x){if(x.k==='glass')return L("'휴대폰·안경 질문에 답하기' 켜기");if(x.k==='gcam')return L("'안경 질문에도 카메라 사진을 함께 보내기' 켜기");
  const w=x.r.when,t=x.r.then;
  const when=w.t==='motion'?(w.node==='*'?L('어느 노드든 움직임이 있으면'):L`${w.node}에 움직임이 있으면`):w.t==='enter'?L`${w.room}에 들어오면`:L`${w.sec}초 동안 조용하면`;
  const then=t.t==='led'?L`LED를 ${t.color}로 ${t.sec}초`:t.level==='alert'?L('경고 알림'):L('알림');
  return L`규칙 켜기: ${when} → ${then}`;}
function setUp(p){const s=st(),u=applyTo(Lab.cfg,p,Date.now());if(!u)return;s.undo=u;Lab.save();sync();}
function undo(){const s=st();undoTo(Lab.cfg,s.undo);s.undo=null;Lab.save();sync();}
function sync(){const m=Lab.cfg.models||{};const g=$('#md-glass');if(g)g.checked=!!m.glass;if(window.Look)Look.draw();draw();}

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

  if(p.setup){const box=el('div','pj-setup'),todo=plan(p,Lab.cfg),u=st().undo,mine=u&&u.id===p.id;
    box.append(el('h3',null,L('이 프로젝트에 맞추기')));
    if(todo.length){const ul=el('ul','pj-dots');for(const x of todo)ul.append(el('li',null,say(x)));box.append(ul);
      const b=el('button','btn primary',L('한 번에 맞추기'));b.type='button';b.id='pj-apply';box.append(b);}
    else box.append(el('p','kv',mine?L`맞췄습니다. 규칙 ${u.added.length+u.turnedOn.length}개와 스위치 ${Object.keys(u.models||{}).length}개를 켰고, 다른 것은 그대로입니다.`:L('이미 이 프로젝트에 맞춰져 있습니다.')));
    const row=el('div','row');
    if(mine){const b=el('button','btn',L('되돌리기'));b.type='button';b.id='pj-undo';row.append(b);}
    if(p.setup.open){const b=el('button','btn',L('첫 화면 열기'));b.type='button';b.dataset.view=p.setup.open;row.append(b);}
    if(row.childNodes.length)box.append(row);
    const lab=el('label','inl'),cb=el('input');cb.type='checkbox';cb.id='pj-auto';cb.checked=st().auto!==false;lab.append(cb,document.createTextNode(L('프로젝트를 고르면 바로 맞추기')));box.append(lab);
    body.append(box);}

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
  $('#pj-list').addEventListener('click',e=>{const b=e.target.closest('.pj-item');if(!b)return;const s=st();s.sel=b.dataset.id;Lab.save();
    const p=P.find(x=>x.id===s.sel);if(p&&s.auto!==false&&plan(p,Lab.cfg).length)setUp(p);else draw();$('#pj-detail').focus({preventScroll:true});});
  $('#pj-detail').addEventListener('change',e=>{const t=e.target;if(t.type!=='checkbox')return;const s=st();
    if(t.id==='pj-auto'){s.auto=t.checked;Lab.save();return;}
    if(t.dataset.part){if(t.checked)s.have[t.dataset.part]=true;else delete s.have[t.dataset.part];}
    else if(t.dataset.step!=null){const p=P.find(x=>x.id===s.sel);const set=new Set(done(p)),i=+t.dataset.step;if(t.checked)set.add(i);else set.delete(i);s.done[p.id]=[...set].sort((a,b)=>a-b);}
    Lab.save();draw();});
  $('#pj-detail').addEventListener('click',e=>{
    if(e.target.closest('#pj-apply')){setUp(P.find(x=>x.id===st().sel));return;}
    if(e.target.closest('#pj-undo')){undo();return;}
    const b=e.target.closest('button[data-view]');if(!b)return;
    if(b.dataset.view==='glass'){if(window.Glass)Glass.open();return;}location.hash=b.dataset.view;});
  draw();}
return{wire,update(){},count:()=>P.length,plan,applyTo,undoTo};
})();
