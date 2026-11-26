/* 시작, 화면 전환, 연결 서랍, 루프 */
(()=>{'use strict';
const $=s=>document.querySelector(s),S=Lab.S;
const TABS=[
  ['space',L('공간'),'<path d="M3 8l9-5 9 5-9 5-9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>'],
  ['motion',L('움직임'),'<path d="M2 12h4l2-6 4 13 3-9 2 4h5"/>'],
  ['presence',L('위치'),'<circle cx="12" cy="10" r="3"/><path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z"/>'],
  ['camera',L('카메라'),'<rect x="3" y="7" width="13" height="10" rx="1.5"/><path d="M16 11l5-3v8l-5-3"/>'],
  ['rules',L('자동화'),'<path d="M13 2L5 14h6l-1 8 8-12h-6l1-8z"/>'],
  ['models',L('모델'),'<path d="M4 5h16v11H10l-5 4v-4H4z"/><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01"/>'],
  ['nodes',L('노드'),'<rect x="7" y="7" width="10" height="10" rx="1"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>'],
  ['evidence',L('기록'),'<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h7"/>']];
const nav=$('#nav');
nav.innerHTML=TABS.map(t=>`<button role="tab" type="button" id="tab-${t[0]}" data-v="${t[0]}" aria-selected="false" aria-controls="v-${t[0]}"><svg viewBox="0 0 24 24" aria-hidden="true">${t[2]}</svg>${t[1]}</button>`).join('');
let view='space';
function show(v,push){if(!TABS.some(t=>t[0]===v))v='space';view=v;if(v!=='space'&&document.body.classList.contains('present'))document.body.classList.remove('present');
  for(const t of TABS){const on=t[0]===v;$('#v-'+t[0]).hidden=!on;const b=$('#tab-'+t[0]);b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;}
  $('#vtitle').textContent=TABS.find(t=>t[0]===v)[1];$('#main').scrollTop=0;if(v==='rules')Views.ruleArgs();
  if(push&&location.hash!=='#'+v){try{location.hash=v;}catch(e){}}}
nav.addEventListener('click',e=>{const b=e.target.closest('button');if(b)show(b.dataset.v,true);});
nav.addEventListener('keydown',e=>{const k=e.key;if(!['ArrowDown','ArrowUp','ArrowLeft','ArrowRight'].includes(k))return;e.preventDefault();const i=TABS.findIndex(t=>t[0]===view),n=(i+(k==='ArrowDown'||k==='ArrowRight'?1:-1)+TABS.length)%TABS.length;show(TABS[n][0],true);$('#tab-'+TABS[n][0]).focus();});
window.addEventListener('hashchange',()=>show(location.hash.slice(1),false));

/* 상단 상태 */
const src=$('#src'),mixed=$('#mixed'),rate=$('#rate'),clock=$('#clock'),openBtn=$('#openConn');
function status(){const d=new Date();clock.textContent=[d.getHours(),d.getMinutes(),d.getSeconds()].map(x=>String(x).padStart(2,'0')).join(':');
  rate.textContent=S.rate.toFixed(0)+' msg/s';
  if(S.source==='live'){src.className='chip '+(S.linkDown?'bad':'live');src.textContent=S.linkDown?(window.Desk?L('브로커 꺼짐'):L('연결 끊김, 다시 시도 중')):(window.Desk?L('실측: 내장 브로커'):L('실측: 브로커 연결됨'));openBtn.textContent=L('연결 끊기');}
  else if(S.source==='demo'){src.className='chip sim';src.textContent=L('데모: 시뮬레이션 값');openBtn.textContent=L('브로커 연결');}
  else if(S.source==='replay'){src.className='chip rp';src.textContent=L`재생: 기록 파일 ${S.replayInfo.done}/${S.replayInfo.total}`;openBtn.textContent=L('브로커 연결');}
  else{src.className='chip';src.textContent=L('대기');openBtn.textContent=L('브로커 연결');}
  if(window.Desk)openBtn.textContent=L('브로커');
  mixed.hidden=!S.simMixed;const sp=$('#sp-src');sp.className=src.className;sp.textContent=src.textContent+(S.simMixed?L(' · 시뮬레이터 포함'):'');}
setInterval(status,500);

/* 연결 서랍 */
const drawer=$('#conn'),note=$('#conn-note');let lastFocus=null;
function openDrawer(){lastFocus=document.activeElement;drawer.hidden=false;$('#c-url').value=Lab.cfg.broker.url;$('#c-user').value=Lab.cfg.broker.user;note.className='muted';
  if(!Lab.canLive){note.textContent=L('이 페이지는 데모 전용입니다. 브라우저 정책상 여기서는 브로커에 연결할 수 없어서, PC에 내려받은 콘솔(index.html)에서 연결합니다.');$('#c-go').disabled=true;}
  else note.textContent=L('PC에서 Mosquitto를 켠 뒤 연결합니다. 비밀번호는 이 탭의 메모리에만 둡니다.');
  (Lab.canLive?$('#c-pass'):$('#c-close')).focus();}
function closeDrawer(){drawer.hidden=true;if(lastFocus)lastFocus.focus();}
openBtn.addEventListener('click',()=>{if(window.Desk){Desk.open();return;}if(S.source==='live'){Lab.disconnect();Lab.demo();}else openDrawer();});
$('#c-close').addEventListener('click',closeDrawer);
drawer.addEventListener('click',e=>{if(e.target===drawer)closeDrawer();});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!drawer.hidden)closeDrawer();});
/* 발표 모드 */
const pb=$('#sp-present'),present=on=>{document.body.classList.toggle('present',on);pb.setAttribute('aria-pressed',on);pb.textContent=on?L('발표 모드 끝내기'):L('발표 모드');
  try{if(on&&document.documentElement.requestFullscreen)document.documentElement.requestFullscreen().catch(()=>{});else if(!on&&document.fullscreenElement)document.exitFullscreen().catch(()=>{});}catch(e){}};
pb.addEventListener('click',()=>present(!document.body.classList.contains('present')));pb.addEventListener('pointerdown',e=>e.stopPropagation());
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&document.body.classList.contains('present'))present(false);});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('present'))present(false);});
/* 검증 리포트 */
const rp=$('#rp');let rpHtml='',rpBack=null;
const rpClose=()=>{rp.hidden=true;$('#rp-frame').srcdoc='';if(rpBack)rpBack.focus();};
$('#ev-html').addEventListener('click',e=>{rpBack=e.currentTarget;rpHtml=Report.build();$('#rp-frame').srcdoc=rpHtml;$('#rp-note').textContent=S.sessions.length?L`세션 ${S.sessions.length}개`:L('끝낸 세션이 없습니다');rp.hidden=false;$('#rp-close').focus();});
$('#rp-close').addEventListener('click',rpClose);window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!rp.hidden)rpClose();});
$('#rp-save').addEventListener('click',()=>{try{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([rpHtml],{type:'text/html'}));a.download='wavrel-report-'+new Date().toISOString().slice(0,10)+'.html';document.body.appendChild(a);a.click();a.remove();}catch(err){$('#rp-note').textContent=L('이 페이지에서는 내려받기가 막혀 있습니다. PC에 내려받은 콘솔에서 하세요.');}});
$('#c-demo').addEventListener('click',()=>{Lab.demo();closeDrawer();});
$('#conn-form').addEventListener('submit',e=>{e.preventDefault();note.className='muted';note.textContent=L('연결하는 중입니다.');
  Lab.connect($('#c-url').value.trim(),$('#c-user').value,$('#c-pass').value,err=>{if(err){note.className='muted err';note.textContent=err;if(S.source!=='live'&&S.source!=='demo')Lab.demo();}else{$('#c-pass').value='';closeDrawer();}});});

/* 시작 */
Views.wire();Views.update.models=Models.update;Models.wire();Remote.wire();Space.init($('#space3d'));
const boot=$('#boot');if(boot){const kill=()=>boot.remove();boot.addEventListener('click',kill);setTimeout(kill,2400);}
$('#main').addEventListener('pointermove',e=>{const p=e.target.closest('.panel');if(!p)return;const r=p.getBoundingClientRect();p.style.setProperty('--mx',(e.clientX-r.left)+'px');p.style.setProperty('--my',(e.clientY-r.top)+'px');});
show(location.hash.slice(1)||'space',false);
Lab.demo();status();
if(location.hash==='#glass')Glass.open();
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function frame(){const t=performance.now()/1000;try{if(Glass.isOpen())Glass.update();else Views.update[view](t);}catch(err){if(!frame.err){frame.err=true;console.error(err);}}requestAnimationFrame(frame);}
requestAnimationFrame(frame);
})();
