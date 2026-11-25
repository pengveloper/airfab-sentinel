/* 안경 화면: 검은 바탕에 꼭 필요한 것만 크게 띄웁니다.
   빛을 겹쳐 보여 주는 안경에서는 검은색이 투명하게 보이므로, 이 화면을 그대로 안경에 비추면 시야를 가리지 않습니다.
   알림 채널(lab/out/notify)로 나가는 것과 같은 문장을 보여 주므로, 받는 쪽 앱을 만들기 전에 문장과 순서를 여기서 먼저 확인할 수 있습니다. */
window.Glass=(()=>{'use strict';
const $=s=>document.querySelector(s),S=Lab.S,el=$('#glass');
const two=x=>String(x).padStart(2,'0'),hms=t=>{const d=new Date(t);return two(d.getHours())+':'+two(d.getMinutes())+':'+two(d.getSeconds());};
const SRC={broker:L('실측'),broker_with_simulator:L('실측 + 시뮬레이터'),replay:L('기록 재생'),built_in_simulator:L('시뮬레이션 값')};
const srcNow=()=>S.source==='live'?(S.simEver||S.simMixed?SRC.broker_with_simulator:SRC.broker):S.source==='demo'?SRC.built_in_simulator:S.source==='replay'?SRC.replay:L('대기');
let open=false,back=null,ownFs=false,shown='',last=0,idle=0;
/* 지금 보여 줄 링크: 움직이는 곳이 있으면 그곳, 없으면 가장 최근에 값을 보낸 곳 */
function pick(){const list=[...S.csi.values()].filter(n=>Lab.node(n.key));return list.find(n=>n.state==='motion')||list.sort((a,b)=>b.ts-a.ts)[0]||null;}
function update(){const t=Lab.now();if(!open||t-last<120)return;last=t;
  $('#gl-clock').textContent=hms(t);$('#gl-src').textContent=srcNow();
  const n=pick(),st=$('#gl-state'),m=$('#gl-meter');
  if(!n){st.textContent=S.source==='idle'?L('연결을 기다리는 중'):L('보드를 기다리는 중');st.className='gl-state wait';$('#gl-link').textContent='';m.hidden=true;$('#gl-num').textContent='';}
  else{const hot=n.state==='motion',thr=n.thr||0.5,max=Math.max(thr*2.4,1),v=n.last==null?0:n.last;
    st.textContent=hot?L('움직임'):L('조용함');st.className='gl-state'+(hot?' hot':'');$('#gl-link').textContent=Lab.node(n.key).alias;
    m.hidden=false;m.classList.toggle('hot',hot);m.firstElementChild.style.transform='scaleX('+Math.min(1,v/max).toFixed(3)+')';m.lastElementChild.style.left=(thr/max*100).toFixed(1)+'%';
    $('#gl-num').textContent=L`점수 ${v.toFixed(2)} · 임계값 ${thr}`;}
  const ss=S.session,se=$('#gl-session');
  if(ss&&!ss.end){const s=Lab.sessionStats(ss),d=Math.floor(s.dur);se.hidden=false;const tm=two(Math.floor(d/60))+':'+two(d%60);se.textContent=ss.cur?L`검증 중 ${tm} · 통과 ${s.labels} · 감지 ${s.hits} · 지나가는 중`:L`검증 중 ${tm} · 통과 ${s.labels} · 감지 ${s.hits}`;}
  else se.hidden=true;
  const nt=S.notes[0],box=$('#gl-note'),age=nt?(t-nt.ts)/1000:1e9;
  if(nt&&age<nt.ttl){if(shown!==nt.id){shown=nt.id;$('#gl-title').textContent=nt.title;$('#gl-body').textContent=nt.body;box.className='gl-note on '+nt.level;
      const bar=$('#gl-ttl');bar.style.animation='none';void bar.offsetWidth;bar.style.animation='gl-ttl '+nt.ttl+'s linear -'+age.toFixed(2)+'s forwards';}}
  else if(shown){shown='';box.classList.remove('on');}
  if(idle&&t>idle){idle=0;el.classList.remove('ctl');}}
function wake(){el.classList.add('ctl');idle=Lab.now()+2600;}
function show(){if(open)return;back=document.activeElement;open=true;shown='';last=0;el.hidden=false;wake();$('#gl-close').focus({preventScroll:true});
  try{if(!document.fullscreenElement&&document.documentElement.requestFullscreen)document.documentElement.requestFullscreen().then(()=>{ownFs=true;}).catch(()=>{});}catch(e){}
  update();}
function hide(){if(!open)return;open=false;el.hidden=true;
  try{if(ownFs&&document.fullscreenElement)document.exitFullscreen().catch(()=>{});}catch(e){}ownFs=false;
  if(back&&back.focus)back.focus({preventScroll:true});back=null;}
function mono(on){el.classList.toggle('mono',on);const b=$('#gl-mono');b.setAttribute('aria-pressed',String(on));b.textContent=on?L('색으로 보기'):L('단색으로 보기');}
$('#gl-close').addEventListener('click',hide);
$('#gl-mono').addEventListener('click',()=>mono(!el.classList.contains('mono')));
el.addEventListener('pointermove',wake);el.addEventListener('pointerdown',wake);
window.addEventListener('keydown',e=>{if(!open)return;wake();if(e.key==='Escape'){e.stopPropagation();hide();}
  else if(e.key==='Tab'){const f=[$('#gl-mono'),$('#gl-close')];e.preventDefault();f[(f.indexOf(document.activeElement)+(e.shiftKey?-1:1)+2)%2].focus();} // 열려 있는 동안 초점은 이 화면 안에 둡니다
  else if((e.key==='m'||e.key==='M')&&!e.ctrlKey&&!e.metaKey&&!e.altKey)mono(!el.classList.contains('mono'));},true);
document.addEventListener('fullscreenchange',()=>{if(open&&ownFs&&!document.fullscreenElement)hide();});
for(const id of['#nt-open','#sp-glass']){const b=$(id);if(b){b.addEventListener('click',show);b.addEventListener('pointerdown',e=>e.stopPropagation());}}
return{open:show,close:hide,update,mono,isOpen:()=>open,SRC};
})();
