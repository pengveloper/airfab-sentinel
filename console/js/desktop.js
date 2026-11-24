/* 창 껍데기: 상단의 메시지 맥박, 빈 공간 안내, 그리고 데스크톱 앱일 때의 브로커 설정과 정보 창.
   window.desktop이 없으면(웹 데모, 파일로 연 콘솔) 데스크톱 부분은 건너뜁니다. */
(()=>{'use strict';
const $=s=>document.querySelector(s),S=Lab.S,D=window.desktop||null;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* 상단 맥박: 최근 1분의 초당 메시지 수 */
const pc=$('#pulse'),pg=pc.getContext('2d'),hist=new Array(120).fill(0);
function pulse(){hist.push(S.rate||0);hist.shift();const w=pc.clientWidth,h=pc.clientHeight,dpr=Math.min(devicePixelRatio||1,2);if(!w||!h)return;
  if(pc.width!==Math.round(w*dpr)||pc.height!==Math.round(h*dpr)){pc.width=Math.round(w*dpr);pc.height=Math.round(h*dpr);}
  pg.setTransform(dpr,0,0,dpr,0,0);pg.clearRect(0,0,w,h);const max=Math.max(8,...hist)*1.9,col=S.source==='live'?'236,185,85':S.source==='idle'?'140,157,179':'185,168,255';
  pg.beginPath();hist.forEach((v,i)=>{const x=i/(hist.length-1)*w,y=h-2-(v/max)*(h-10);i?pg.lineTo(x,y):pg.moveTo(x,y);});
  pg.strokeStyle=`rgba(${col},.34)`;pg.lineWidth=1;pg.stroke();pg.lineTo(w,h);pg.lineTo(0,h);pg.closePath();
  const g=pg.createLinearGradient(0,0,0,h);g.addColorStop(0,`rgba(${col},.1)`);g.addColorStop(1,`rgba(${col},0)`);pg.fillStyle=g;pg.fill();}
setInterval(pulse,500);

/* 빈 공간 안내: 실측인데 아직 보드가 없을 때 */
const empty=$('#sp-empty'),tl=document.querySelector('.hud-tl');
setInterval(()=>{const on=S.source==='live'&&S.csi.size===0&&S.rooms.size===0&&S.devs.size===0;if(empty.hidden===on){empty.hidden=!on;tl.style.visibility=on?'hidden':'';}},400);
$('#sp-demo').addEventListener('click',()=>Lab.demo());

if(!D)return;
document.body.classList.add('desktop');
let st=null,shown=null,shownT=0;
const setup=$('#setup'),drawer=$('#desk'),note=$('#su-note'),NOTE0=note.textContent;
const Desk=window.Desk={rev:0,lan:()=>st&&st.addresses.length?st.addresses.map(a=>a.address).join(' 또는 '):null,open,status:()=>st};
const live=()=>Lab.connect('desktop','lab','',err=>{if(err)open();});

function draw(){if(!st||drawer.hidden)return;const state=$('#dk-state'),err=st.error;
  state.className='chip '+(st.running?'live':'bad');state.textContent=st.running?'켜짐 · 포트 '+st.port:err==='PORT_IN_USE'?'꺼짐 · 포트 사용 중':'꺼짐';
  $('#dk-count').textContent=st.running?`메시지 ${st.counts.messages.toLocaleString('en-US')}건 · 거절한 로그인 ${st.counts.authRejected}건`:'';
  $('#dk-note').textContent=err==='PORT_IN_USE'?'1883 포트를 다른 프로그램이 쓰고 있습니다. 실행 중인 Mosquitto나 Docker 컨테이너를 끄고 "브로커 다시 켜기"를 누르세요.':!st.addresses.length?'연결된 집 안 망을 찾지 못했습니다. PC가 공유기에 연결돼 있는지 확인하세요.':'보드가 붙지 않으면 Windows가 처음 띄운 방화벽 창에서 개인 네트워크를 허용했는지 확인하세요.';
  const hosts=st.addresses.length?st.addresses.map(a=>`<span class="val">${esc(a.address)}<button class="mini" type="button" data-copy="${esc(a.address)}">복사</button><small>${esc(a.name)}</small></span>`).join(''):'<span class="val">찾지 못함</span>';
  const pw=shown&&Lab.now()-shownT<20000?`<span class="val">${esc(shown)}<button class="mini" type="button" data-copy="@pw">복사</button><button class="mini" type="button" data-pw="hide">가리기</button></span>`:'<span class="val">••••••••••<button class="mini" type="button" data-pw="show">보기</button><button class="mini" type="button" data-copy="@pw">복사</button></span>';
  $('#dk-vals').innerHTML=`<dt>Host</dt><dd>${hosts}</dd><dt>Port</dt><dd><span class="val">${st.port}</span></dd><dt>사용자</dt><dd><span class="val">${esc(st.user)}</span></dd><dt>비밀번호</dt><dd>${pw}</dd><dt>Scheme</dt><dd><span class="val">mqtt</span></dd>`;
  $('#dk-clients').innerHTML=st.clients.length?st.clients.map(c=>`<li><b>${esc(c.id)}</b><span class="kv">${esc(c.address)}</span></li>`).join(''):'<li class="none">아직 붙은 기기가 없습니다.</li>';
  $('#dk-live').hidden=S.source==='live';$('#dk-demo').hidden=S.source==='demo';}
function open(){drawer.hidden=false;D.status().then(apply);$('#dk-close').focus();}
function close(){drawer.hidden=true;shown=null;}
function apply(s){st=s;Desk.rev++;draw();}
function openSetup(){setup.hidden=false;note.textContent=NOTE0;note.className='muted';$('#su-pass').focus();}

D.onBroker(apply);
D.status().then(s=>{apply(s);if(!s.hasPassword)openSetup();else live();});

$('#su-gen').addEventListener('click',()=>D.suggestPassword().then(v=>{$('#su-pass').value=v;}));
$('#su-demo').addEventListener('click',()=>{setup.hidden=true;});
$('#su-form').addEventListener('submit',e=>{e.preventDefault();const v=$('#su-pass').value;
  if(!/^[A-Za-z0-9!@#$%^&*_\-+=.]{10,64}$/.test(v)){note.className='muted err';note.textContent='쓸 수 없는 값입니다. 영문, 숫자, 기호(!@#$%^&*_-+=.)로 10자 이상 64자 이하로 정해 주세요.';return;}
  $('#su-go').disabled=true;D.setup(v).then(s=>{$('#su-go').disabled=false;apply(s);
    if(s.error==='NO_SECURE_STORAGE'||s.error==='INVALID'){note.className='muted err';note.textContent=s.error==='INVALID'?'쓸 수 없는 값입니다.':'이 PC에서 암호화 저장소를 쓸 수 없어 비밀번호를 저장하지 못했습니다.';return;}
    $('#su-pass').value='';setup.hidden=true;live();open();});});

drawer.addEventListener('click',e=>{if(e.target===drawer){close();return;}const b=e.target.closest('button');if(!b)return;
  if(b.dataset.copy){const done=()=>{b.textContent='복사됨';setTimeout(()=>{b.textContent='복사';},1400);};
    if(b.dataset.copy==='@pw')D.revealPassword().then(p=>p&&D.copy(p)).then(done);else D.copy(b.dataset.copy).then(done);}
  else if(b.dataset.pw==='show')D.revealPassword().then(p=>{shown=p;shownT=Lab.now();draw();setTimeout(draw,20500);});
  else if(b.dataset.pw==='hide'){shown=null;draw();}});
$('#dk-close').addEventListener('click',close);
$('#dk-live').addEventListener('click',()=>{live();close();});
$('#dk-demo').addEventListener('click',()=>{Lab.demo();close();});
$('#dk-restart').addEventListener('click',()=>D.restart().then(s=>{apply(s);if(s.running&&S.source!=='demo')live();}));
$('#dk-pass').addEventListener('click',()=>{close();openSetup();});
window.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(!drawer.hidden)close();});
/* 검증 요약 복사: 앱에서는 메인 프로세스의 클립보드를 씁니다 */
$('#ev-report').addEventListener('click',()=>D.copy(Lab.report()));
})();
