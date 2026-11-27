/* 처음 안내: 앱을 처음 열면 프로젝트 하나를 골라 바로 시작하게 합니다. 한 번 고르거나 '나중에'를 누르면 다시 뜨지 않고,
   프로젝트 화면의 '처음 안내'로 다시 열 수 있습니다. */
window.Welcome=(()=>{'use strict';
const $=s=>document.querySelector(s),P=window.PROJECTS||[];
const lang=()=>window.I18N&&I18N.lang==='en'?'en':'ko';
const lab=()=>{const c=Lab.cfg;if(!c.lab||typeof c.lab!=='object')c.lab={};return c.lab;};
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;};
const LEVEL=()=>['',L('쉬움'),L('보통'),L('도전')];
let back=null;

function card(title,meta,body,id){const li=el('li'),b=el('button','wl-card');b.type='button';b.dataset.id=id;
  b.append(el('b',null,title),el('span','kv',meta),el('span',null,body));li.append(b);return li;}

function open(){const ul=$('#wl-cards');ul.textContent='';const lg=lang();
  for(const p of P.filter(x=>x.start))ul.append(card(p.title[lg],L`${LEVEL()[p.level]} · 약 ${p.minutes}분 · 부품 ${p.parts.length}가지`,p.summary[lg].split(/(?<=[.。])\s/)[0],p.id));
  ul.append(card(L('보드 없이 둘러보기'),L('설치할 것 없음'),L('시뮬레이터가 만든 값으로 화면을 먼저 구경합니다. 값에는 시뮬레이션 표시가 붙습니다.'),'demo'));
  back=document.activeElement;$('#welcome').hidden=false;const first=ul.querySelector('button');if(first)first.focus();}

function close(){lab().welcomed=true;Lab.save();$('#welcome').hidden=true;if(back&&back.focus)back.focus();}

function choose(id){close();
  if(id==='demo'){if(Lab.S.source!=='demo'&&Lab.S.source!=='live')Lab.demo();location.hash='space';return;}
  if(window.Projects)Projects.pick(id);}

/** 처음 한 번만: 첫 실행 비밀번호 창이 떠 있으면 기다립니다. */
function maybe(){if(lab().welcomed||!$('#setup').hidden||!$('#welcome').hidden)return;open();}

function wire(){$('#wl-cards').addEventListener('click',e=>{const b=e.target.closest('.wl-card');if(b)choose(b.dataset.id);});
  $('#wl-later').addEventListener('click',close);
  $('#welcome').addEventListener('keydown',e=>{if(e.key==='Escape')close();});}
return{wire,maybe,open};
})();
