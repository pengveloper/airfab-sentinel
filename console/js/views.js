/* 화면별 그리기. 데모와 실측이 같은 상태(Lab.S)를 읽습니다. */
window.Views=(()=>{'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const S=Lab.S,DPR=Math.min(devicePixelRatio||1,2),now=Lab.now;
const C={gold:'#ecb955',wave:'#9cc6ff',sim:'#b9a8ff',text:'#e8eef6',muted:'#8c9db3',line:'#1f2c3d',raise:'#121b27',warn:'#ff9d5c',ok:'#5fd3a2'};
const F='"IBM Plex Sans KR",sans-serif',FM='"IBM Plex Mono",monospace';
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const hms=t=>{const d=new Date(t);return[d.getHours(),d.getMinutes(),d.getSeconds()].map(x=>String(x).padStart(2,'0')).join(':');};
// 내용이 바뀔 때만 다시 그립니다. 같은 내용을 주기적으로 다시 넣으면 들어오는 애니메이션이 매번 처음부터 돌아 목록이 깜빡입니다.
const put=(el,html)=>{if(el._html!==html){el._html=html;el.innerHTML=html;}};
const stamps={};const every=(k,ms)=>{const t=now();if(t-(stamps[k]||0)<ms)return false;stamps[k]=t;return true;};
function fit(cv){const w=cv.clientWidth,h=cv.clientHeight;if(cv.width!==Math.round(w*DPR)||cv.height!==Math.round(h*DPR)){cv.width=Math.round(w*DPR);cv.height=Math.round(h*DPR);}const c=cv.getContext('2d');c.setTransform(DPR,0,0,DPR,0,0);c.clearRect(0,0,w,h);return[c,w,h];}
const txt=(c,s,x,y,col,size,font,al)=>{c.font=`${size||12}px ${font||F}`;c.fillStyle=col||C.muted;c.textAlign=al||'left';c.fillText(s,x,y);c.textAlign='left';};
const srcChip=()=>S.source==='live'?'<span class="chip live">실측</span>':S.source==='demo'?'<span class="chip sim">시뮬레이션</span>':S.source==='replay'?'<span class="chip rp">기록 재생</span>':'<span class="chip">대기</span>';
const truthName=v=>v==='manual'?'버튼 (L 키)':v==='sim'?'시뮬레이터 정답':'PIR 입력: '+Lab.roomName(v.slice(4).split('/')[0])+' '+v.split('/')[1]+'번';
const csiList=()=>[...S.csi.values()].filter(n=>Lab.node(n.key));
const pinnedDevs=()=>Lab.cfg.pinned.map(id=>S.devs.get(id)).filter(Boolean);
const devName=d=>d.name?Lab.mask(d.name):Lab.mask(d.id);

/* ---------- 공간 ---------- */
let cardSig='';
function spark(cv,n){const[c,w,h]=fit(cv),t=now(),win=60000,sc=n.score.filter(p=>t-p.t<win);if(!sc.length)return;const thr=n.thr||0.5,max=Math.max(thr*2,...sc.map(p=>p.v))*1.1,X=p=>w-(t-p.t)/win*w,Y=v=>h-2-(v/max)*(h-6);
  c.beginPath();sc.forEach((p,i)=>i?c.lineTo(X(p),Y(p.v)):c.moveTo(X(p),Y(p.v)));c.strokeStyle=C.gold;c.lineWidth=1.4;c.stroke();c.setLineDash([3,4]);c.beginPath();c.moveTo(0,Y(thr));c.lineTo(w,Y(thr));c.strokeStyle=C.warn;c.lineWidth=1;c.stroke();c.setLineDash([]);}
function space(t){const cfg=Lab.cfg,hot=csiList().filter(n=>n.state==='motion'),nowEl=$('#sp-now');
  if(every('sp',250)){
    nowEl.textContent=S.source==='idle'?'연결을 기다리는 중':hot.length?Lab.node(hot[0].key).alias+'에서 움직임':'조용함';nowEl.classList.toggle('hot',hot.length>0);
    const pd=pinnedDevs().filter(d=>d.room);
    $('#sp-sub').textContent=`노드 ${cfg.nodes.length}대, 고정 기기 ${pd.length}개, 켜진 규칙 ${cfg.rules.filter(r=>r.on).length}개`+(pd[0]?` · ${devName(pd[0])}: ${Lab.roomName(pd[0].room)}`:'');
    put($('#sp-feed'),S.feed.slice(0,5).map(f=>`<li><time>${hms(f.t)}</time><span class="${f.kind}">${esc(f.txt)}</span></li>`).join('')||'<li><time></time><span class="sys">아직 없습니다</span></li>');
    const sig=S.ver+'|'+cfg.pinned.join()+'|'+S.source+'|'+S.csi.size+'|'+S.rooms.size;
    if(sig!==cardSig){cardSig=sig;let h='';const nx=brNext();
      if(Lab.canLive&&nx)h+=`<div class="card nextup"><div class="ct"><b>다음 단계</b><span class="kv">${BR.filter(s=>brDone(s.k)).length} / ${BR.length}</span></div><p>${brOf(nx).t}</p><a class="btn" href="#nodes">순서 보기</a></div>`;
      for(const n of csiList())h+=`<div class="card" data-k="${n.key}"><div class="ct"><b>${esc(Lab.node(n.key).alias)}</b><span class="chip" data-f="st"></span></div><div class="big"><span data-f="v">0.00</span><small>움직임 점수, 임계값 <span data-f="thr"></span></small></div><canvas role="img" aria-label="최근 1분 점수"></canvas></div>`;
      const rooms=cfg.nodes.filter(n=>n.type==='ble');
      if(rooms.length)h+=`<div class="card" id="cd-ble"><div class="ct"><b>BLE 위치</b>${srcChip()}</div><div data-f="rows" class="muted"></div></div>`;
      h+=`<div class="card" id="cd-led"><div class="ct"><b>상태 LED</b><span class="kv" data-f="led">꺼짐</span></div><div class="swatch"></div></div>`;
      h+=`<div class="card"><div class="ct"><b>데이터 출처</b>${srcChip()}</div><p class="muted">${S.source==='live'?'브로커에서 받은 메시지입니다. 보드가 보낸 값인지는 운영자가 확인합니다.':S.source==='demo'?'내장 시뮬레이터가 실제 펌웨어와 같은 토픽 모양으로 만든 값입니다. 하드웨어 결과가 아닙니다.':S.source==='replay'?'내려받은 기록 파일을 다시 흘려보내는 중입니다.':'브로커에 연결하거나 데모를 시작하세요.'}</p></div>`;
      $('#sp-cards').innerHTML=h;}
    for(const n of csiList()){const el=$(`.card[data-k="${n.key}"]`);if(!el)continue;const mv=n.state==='motion',ch=$('[data-f=st]',el);ch.className='chip '+(mv?'hot':'');ch.textContent=mv?'움직임 감지':'조용함';$('[data-f=v]',el).textContent=n.last!=null?n.last.toFixed(2):'—';$('[data-f=thr]',el).textContent=n.thr??'—';spark($('canvas',el),n);}
    const be=$('#cd-ble [data-f=rows]');if(be){const pd2=pinnedDevs();be.innerHTML=pd2.length?pd2.map(d=>`${esc(devName(d))}: <span style="color:var(--text)">${d.room?esc(Lab.roomName(d.room)):'찾는 중'}</span>`).join('<br>'):'고정한 기기가 없습니다. 위치 화면에서 기기를 고정하세요.';}
    const le=$('#cd-led');if(le){const c=S.led.color;$('.swatch',le).style.background=c?`rgb(${c})`:'';$('.swatch',le).style.boxShadow=c?`0 0 18px rgba(${c},.7)`:'';$('[data-f=led]',le).textContent=c?'켜짐':'꺼짐';}
  }
  if(Space.ok)Space.render(t);else drawPlan($('#space3d canvas.fallback')||fallback());}
function fallback(){const c=document.createElement('canvas');c.className='gl fallback';$('#space3d').prepend(c);return c;}

/* ---------- 카메라 ---------- */
function CamBox(el,small){let mode='',cv=null;
  function mount(){const url=Lab.cfg.cam.url,m=url?'url:'+url:S.source==='demo'?'sim':'none';if(m===mode)return;mode=m;cv=null;
    if(url){el.innerHTML=`<img alt="카메라 실시간 영상" src="${esc(url)}"><span class="tag">실제 스트림</span>`;$('img',el).addEventListener('error',()=>{el.innerHTML='<p class="none">스트림을 열 수 없습니다. 주소가 맞는지, 카메라와 이 PC가 같은 네트워크인지 확인하세요.</p>';});}
    else if(m==='sim'){el.innerHTML='<canvas role="img" aria-label="시뮬레이션 영상"></canvas><span class="tag">시뮬레이션 영상</span>';cv=$('canvas',el);}
    else el.innerHTML=`<p class="none">${small?'카메라 화면에서 스트림 주소를 넣으면 여기에 나란히 보입니다.':'스트림 주소를 넣으면 영상이 여기에 나옵니다.'}</p>`;}
  function draw(t){mount();if(!cv){const im=el.querySelector('img');if(im&&im.naturalWidth>0)Lab.mark('cam');return;}const[c,w,h]=fit(cv),cfg=Lab.cfg,hz=h*0.34;
    c.fillStyle='#070c14';c.fillRect(0,0,w,h);c.strokeStyle='rgba(156,198,255,.16)';c.lineWidth=1;
    for(let i=0;i<=10;i++){const x=i/10;c.beginPath();c.moveTo(w*(0.3+x*0.4),hz);c.lineTo(w*(-0.2+x*1.4),h);c.stroke();}
    for(let i=0;i<7;i++){const f=Math.pow(i/6,1.8),y=hz+(h-hz)*f;c.beginPath();c.moveTo(w*(0.3-0.5*f),y);c.lineTo(w*(0.7+0.5*f),y);c.stroke();}
    const p=Sim.person,dep=Lab.clamp(1-(p.y/cfg.room.h),0.02,1),f=Math.pow(1-dep,1.8),y=hz+(h-hz)*f,x=w*(0.3-0.5*f)+(p.x/cfg.room.w)*w*(0.4+f),s=(0.25+f*0.9)*h*0.36;
    c.fillStyle='rgba(232,238,246,.9)';c.beginPath();c.arc(x,y-s*0.86,s*0.11,0,7);c.fill();c.fillRect(x-s*0.12,y-s*0.74,s*0.24,s*0.74);
    c.fillStyle='rgba(0,0,0,.35)';c.beginPath();c.ellipse(x,y,s*0.2,s*0.05,0,0,7);c.fill();
    txt(c,hms(now()),w-10,h-10,'rgba(232,238,246,.7)',11,FM,'right');}
  return{draw};}
let camMain,camInset;
function camera(t){camMain.draw(t);if(every('cam',600)){const ch=$('#cam-chip'),url=Lab.cfg.cam.url;ch.className='chip '+(url?'live':S.source==='demo'?'sim':'');ch.textContent=url?'스트림 주소 설정됨':S.source==='demo'?'시뮬레이션':'연결 안 됨';}}

/* ---------- 움직임 ---------- */
let moSel=null;
function overlaps(e,l,t){return e.s<=(l.e||t)+2000&&(e.e||t)>=l.s-2000;}
function motion(t){const list=csiList();if(!list.length){if(every('mo0',800)){$('#mo-name').textContent='Wi‑Fi 움직임';$('#mo-tiles').innerHTML='<div><small>상태</small><b>—</b></div>';fit($('#mo-scope'));}return;}
  if(!moSel||!S.csi.get(moSel.slice(4)))moSel=list.slice().sort((a,b)=>b.ts-a.ts)[0].key;const n=S.csi.get(moSel.slice(4)),nd=Lab.node(moSel),ss=S.session,tn=now();
  // 스코프
  const[c,w,h]=fit($('#mo-scope')),win=120000,L=46,R=14,T=30,B=26,pw=w-L-R,ph=h-T-B,thr=n.thr||0.5;
  const sc=n.score.filter(p=>tn-p.t<win),max=Math.max(thr*2.4,...sc.map(p=>p.v))*1.08,X=tt=>L+pw-(tn-tt)/win*pw,Y=v=>T+ph-(v/max)*ph;
  c.strokeStyle='rgba(31,44,61,.9)';c.lineWidth=1;for(let i=0;i<=4;i++){const y=T+ph*i/4;c.beginPath();c.moveTo(L,y);c.lineTo(L+pw,y);c.stroke();txt(c,(max*(1-i/4)).toFixed(2),L-8,y+4,C.muted,11,FM,'right');}
  [120,90,60,30,0].forEach(sv=>{const x=X(tn-sv*1000);txt(c,sv?'-'+sv+'초':'지금',x,h-8,C.muted,11,F,sv?'center':'right');});
  for(const e of n.events){const a=Math.max(e.s,tn-win),b=e.e||tn;if(b<tn-win)continue;c.fillStyle='rgba(236,185,85,.13)';c.fillRect(X(a),T,Math.max(2,X(b)-X(a)),ph);}
  if(ss&&ss.node===moSel){for(const l of ss.labels){const a=Math.max(l.s,tn-win),b=l.e||tn;if(b<tn-win)continue;c.fillStyle=C.wave;c.fillRect(X(a),T-10,Math.max(2,X(b)-X(a)),5);}txt(c,'정답 구간',L,T-14,C.wave,11);}
  if(sc.length){c.beginPath();sc.forEach((p,i)=>i?c.lineTo(X(p.t),Y(p.v)):c.moveTo(X(p.t),Y(p.v)));c.strokeStyle=C.gold;c.lineWidth=1.7;c.stroke();const lp=sc[sc.length-1];c.lineTo(X(lp.t),T+ph);c.lineTo(X(sc[0].t),T+ph);c.closePath();c.fillStyle='rgba(236,185,85,.1)';c.fill();c.beginPath();c.arc(X(lp.t),Y(lp.v),3.5,0,7);c.fillStyle=C.text;c.fill();}
  c.setLineDash([5,5]);c.beginPath();c.moveTo(L,Y(thr));c.lineTo(L+pw,Y(thr));c.strokeStyle=C.warn;c.stroke();c.setLineDash([]);txt(c,'임계값 '+thr,L+pw-4,Y(thr)-6,C.warn,11,F,'right');
  camInset.draw(t);
  if(!every('mo',300))return;
  $('#mo-name').textContent=nd.alias;const mv=n.state==='motion',st=$('#mo-state');st.className='chip '+(mv?'hot':'');st.textContent=mv?'움직임 감지':'조용함';
  const tabs=$('#mo-tabs');if(list.length>1){const sig=list.map(x=>x.key).join()+moSel;if(tabs.dataset.sig!==sig){tabs.dataset.sig=sig;tabs.innerHTML=list.map(x=>`<button type="button" data-k="${x.key}" aria-pressed="${x.key===moSel}">${esc(Lab.node(x.key).alias)}</button>`).join('');}}else tabs.innerHTML='';
  const lastEv=n.events[n.events.length-1],done=n.events.filter(e=>e.e),avg=done.length?done.reduce((a,e)=>a+(e.e-e.s),0)/done.length/1000:0;
  $('#mo-tiles').innerHTML=`<div><small>지금 점수</small><b>${n.last!=null?n.last.toFixed(2):'—'}</b></div><div><small>감지 횟수</small><b>${n.events.length}</b></div><div><small>평균 지속</small><b>${avg?avg.toFixed(1)+'초':'—'}</b></div><div><small>마지막 감지</small><b>${lastEv?hms(lastEv.s):'—'}</b></div>`;
  // 검증
  const stt=Lab.sessionStats(),run=ss&&!ss.end,vc=$('#va-chip');vc.className='chip '+(run?'hot':'');vc.textContent=run?'기록 중':ss?'끝남':'세션 없음';
  const sel=$('#va-src'),opts=['manual'].concat(S.source==='demo'?['sim']:[],[...S.inputs.keys()].map(k=>'pir:'+k)),osig=opts.join()+S.ver;
  if(sel.dataset.sig!==osig&&document.activeElement!==sel){const keep=sel.value||(S.source==='demo'?'sim':'manual');sel.dataset.sig=osig;sel.innerHTML=opts.map(o=>`<option value="${esc(o)}">${esc(truthName(o))}</option>`).join('');sel.value=opts.includes(keep)?keep:opts[0];}
  sel.disabled=!!run;const tv=run?ss.truth:sel.value;
  $('#va-start').textContent=run?'세션 끝내기':'세션 시작';$('#va-label').disabled=!run||ss.truth!=='manual';
  $('#va-help').textContent=tv==='sim'?'시뮬레이터가 사람이 링크를 지나간 구간을 정답으로 자동 표시합니다. 데모에서만 쓸 수 있습니다.':tv==='manual'?'세션을 시작하고, 사람이 보드와 공유기 사이를 지나가는 동안 아래 버튼을 누르고 있으면 정답 구간이 기록됩니다. 키보드 L 키도 같습니다.':'ESPresense 노드에 연결한 PIR 센서가 켜진 구간을 정답으로 씁니다. PIR은 보는 범위가 넓어서 링크를 지나지 않은 움직임도 정답으로 잡힙니다.';
  const d=(k,v,hotc)=>`<div><dt>${k}</dt><dd class="${hotc?'hot':''}">${v}</dd></div>`;
  $('#va-stats').innerHTML=stt?d('길이',Math.round(stt.dur)+'초')+d('정답 구간',stt.labels)+d('감지함',stt.hits)+d('놓침',stt.miss,stt.miss>0)+d('오탐',stt.falses,stt.falses>0)+d('재현율',stt.recall==null?'—':Math.round(stt.recall*100)+'%'):d('길이','—')+d('정답 구간','—')+d('감지함','—')+d('놓침','—')+d('오탐','—')+d('재현율','—');
  const rows=n.events.slice(-10).reverse().map(e=>{let m='—';if(ss&&ss.node===moSel&&(e.e||tn)>=ss.start&&(!ss.end||e.s<=ss.end))m=ss.labels.some(l=>overlaps(e,l,tn))?'일치':'정답 없음 (오탐)';
    return `<tr><td class="n">${hms(e.s)}</td><td class="n">${e.e?((e.e-e.s)/1000).toFixed(1)+'초':'진행 중'}</td><td class="n">${e.peak.toFixed(2)}</td><td class="${m.startsWith('정답 없음')?'hot':''}">${m}</td></tr>`;}).join('');
  $('#mo-events tbody').innerHTML=rows||'<tr class="empty"><td colspan="4">아직 감지된 움직임이 없습니다.</td></tr>';}

/* ---------- 위치 ---------- */
let plan={edit:false,drag:null,geo:null};
function drawPlan(cv){const[c,w,h]=fit(cv),cfg=Lab.cfg,RW=cfg.room.w,RH=cfg.room.h,m=34,k=Math.min((w-m*2)/RW,(h-m*2)/RH),ox=(w-RW*k)/2,oy=(h-RH*k)/2,X=x=>ox+x*k,Y=y=>oy+y*k,tn=now();plan.geo={ox,oy,k};
  c.strokeStyle='rgba(31,44,61,.8)';c.lineWidth=1;for(let x=0;x<=RW;x++){c.beginPath();c.moveTo(X(x),Y(0));c.lineTo(X(x),Y(RH));c.stroke();}for(let y=0;y<=RH;y++){c.beginPath();c.moveTo(X(0),Y(y));c.lineTo(X(RW),Y(y));c.stroke();}
  c.strokeStyle='rgba(156,198,255,.6)';c.lineWidth=1.5;c.strokeRect(X(0),Y(0),RW*k,RH*k);c.lineWidth=1;
  txt(c,RW+' m',X(RW/2),Y(0)-10,C.muted,11,FM,'center');c.save();c.translate(X(0)-12,Y(RH/2));c.rotate(-Math.PI/2);txt(c,RH+' m',0,0,C.muted,11,FM,'center');c.restore();
  const r=cfg.router;for(const n of S.csi.values()){const nd=Lab.node(n.key);if(!nd)continue;const mv=n.state==='motion';c.beginPath();c.moveTo(X(nd.x),Y(nd.y));c.lineTo(X(r.x),Y(r.y));c.strokeStyle=mv?C.gold:'rgba(156,198,255,.45)';c.lineWidth=mv?3:1.5;c.setLineDash(mv?[]:[6,6]);c.stroke();c.setLineDash([]);c.lineWidth=1;}
  const lead=pinnedDevs()[0];
  for(const nd of cfg.nodes){const x=X(nd.x),y=Y(nd.y),col=nd.type==='csi'?C.gold:nd.type==='ble'?C.wave:nd.type==='cam'?C.sim:C.muted;
    if(nd.type==='ble'&&lead){const ob=lead.obs[nd.key.slice(4)];if(ob&&tn-ob.ts<15000){c.beginPath();c.arc(x,y,ob.d*k,0,7);c.strokeStyle=lead.room===nd.key.slice(4)?'rgba(156,198,255,.7)':'rgba(156,198,255,.22)';c.stroke();}}
    if(nd.type==='cam'){c.beginPath();c.moveTo(x,y);c.lineTo(x-1.6*k,y+3.2*k);c.lineTo(x+1.6*k,y+3.2*k);c.closePath();c.fillStyle='rgba(185,168,255,.07)';c.fill();}
    if(nd.type==='led'&&S.led.color){const g=c.createRadialGradient(x,y,0,x,y,1.6*k);g.addColorStop(0,`rgba(${S.led.color},.5)`);g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(x-1.6*k,y-1.6*k,3.2*k,3.2*k);}
    c.fillStyle=col;c.fillRect(x-5,y-5,10,10);if(plan.edit){c.strokeStyle=C.text;c.strokeRect(x-9,y-9,18,18);}txt(c,nd.alias,x+10,y+4,col,12);}
  c.fillStyle=C.text;c.beginPath();c.arc(X(r.x),Y(r.y),6,0,7);c.fill();if(plan.edit){c.strokeStyle=C.text;c.strokeRect(X(r.x)-10,Y(r.y)-10,20,20);}txt(c,'공유기',X(r.x)-10,Y(r.y)+4,C.text,12,F,'right');
  for(const d of S.devs.values()){if(!d.pos||tn-d.ts>20000)continue;const pin=cfg.pinned.includes(d.id),x=X(d.pos.x),y=Y(d.pos.y);
    if(pin){c.beginPath();d.trail.forEach((p,i)=>i?c.lineTo(X(p[0]),Y(p[1])):c.moveTo(X(p[0]),Y(p[1])));c.strokeStyle='rgba(236,185,85,.35)';c.stroke();c.beginPath();c.arc(x,y,6,0,7);c.fillStyle=C.gold;c.fill();c.beginPath();c.arc(x,y,11,0,7);c.strokeStyle=C.gold;c.stroke();txt(c,devName(d),x+15,y+4,C.text,12);}
    else{c.beginPath();c.arc(x,y,3,0,7);c.fillStyle='rgba(140,157,179,.7)';c.fill();}}
  if(S.source==='demo'&&Sim.person.on){const p=Sim.person;c.setLineDash([3,3]);c.beginPath();c.arc(X(p.x),Y(p.y),15,0,7);c.strokeStyle='rgba(232,238,246,.45)';c.stroke();c.setLineDash([]);}}
function presence(){drawPlan($('#pl-canvas'));if(!every('pr',900))return;const tb=$('#pr-table tbody');if(tb.contains(document.activeElement))return;
  const q=$('#pr-filter').value.trim().toLowerCase(),tn=now(),pin=Lab.cfg.pinned;
  const list=[...S.devs.values()].filter(d=>!q||(d.name+' '+d.id).toLowerCase().includes(q)).sort((a,b)=>(pin.includes(b.id)-pin.includes(a.id))||b.ts-a.ts).slice(0,16);
  tb.innerHTML=list.map(d=>{const ob=d.room&&d.obs[d.room],p=pin.includes(d.id);return `<tr class="${tn-d.ts>20000?'stale':''}"><td><button class="pin" type="button" data-id="${esc(d.id)}" aria-pressed="${p}" aria-label="${esc(devName(d))} 고정">${p?'●':'○'}</button></td><td>${esc(devName(d))}</td><td class="${p?'hot':''}">${d.room?esc(Lab.roomName(d.room)):'—'}</td><td class="n">${ob?ob.d.toFixed(1)+' m':'—'}</td></tr>`;}).join('')||'<tr class="empty"><td colspan="4">아직 보이는 기기가 없습니다.</td></tr>';}

/* ---------- 자동화 ---------- */
let ruSig='',ntSig='';
function ruleArgs(){const w=$('#ru-when').value,a=$('#ru-arg'),cfg=Lab.cfg;let o='';
  if(w==='motion')o='<option value="*">모든 CSI 노드</option>'+cfg.nodes.filter(n=>n.type==='csi').map(n=>`<option value="${esc(n.key)}">${esc(n.alias)}</option>`).join('');
  else if(w==='enter')o=cfg.nodes.filter(n=>n.type==='ble').map(n=>`<option value="${esc(n.key.slice(4))}">${esc(n.alias)}</option>`).join('')||'<option value="">BLE 노드 없음</option>';
  else o='<option value="60">1분</option><option value="300">5분</option><option value="600">10분</option>';
  a.innerHTML=o;$('#ru-arg-l').firstChild.textContent=w==='quiet'?'시간':w==='enter'?'방':'대상';}
function rules(){if(!every('ru',400))return;const cfg=Lab.cfg,tn=now(),ul=$('#ru-list');
  const sig=cfg.rules.map(r=>r.id+r.on+r.fired).join()+S.ver;
  if(sig!==ruSig&&!ul.contains(document.activeElement)){ruSig=sig;ul.innerHTML=cfg.rules.map(r=>`<li data-id="${r.id}" class="${tn-r.last<1200?'flash':''}"><input type="checkbox" ${r.on?'checked':''} aria-label="${esc(r.name)} 켜기"><b>${esc(r.name)}</b><span class="kv">${r.fired}회 실행</span><button class="del" type="button" aria-label="${esc(r.name)} 삭제">삭제</button></li>`).join('')||'<li><span class="muted">규칙이 없습니다. 아래에서 추가하세요.</span></li>';}
  $('#ru-count').textContent=cfg.rules.filter(r=>r.on).length+'개 켜짐';
  // 바깥 화면 알림: 가장 최근에 내보낸 문장을 안경에 뜨는 모양 그대로 작게 보여 줍니다
  const nt=S.notes[0],ns=(nt?nt.id:'none')+'|'+S.source;
  if(ns!==ntSig){ntSig=ns;const L=$('#nt-lens');
    $('#ntl-src').textContent=nt?Glass.SRC[nt.source]||'':'';$('#ntl-time').textContent=nt?hms(nt.ts):'';
    $('#ntl-title').textContent=nt?nt.title:'아직 보낸 알림이 없습니다';$('#ntl-body').textContent=nt?nt.body:'규칙이 울리면 같은 문장이 여기와 안경 화면에 보입니다';
    L.className='lens '+(nt?nt.level:'empty');if(nt){void L.offsetWidth;L.classList.add('pop');}
    $('#nt-count').textContent=S.notes.length?'이번 실행에서 '+S.notes.length+'건':'';}
  put($('#ru-fires'),S.fires.slice(0,10).map(f=>`<li><time>${hms(f.t)}</time><span class="rule">${esc(f.name)}</span></li>`).join('')||'<li><time></time><span class="sys">아직 실행된 규칙이 없습니다</span></li>');}

/* ---------- 노드 ---------- */
const BR=[
  {k:'broker',t:'PC에서 브로커 켜기',d:'broker 폴더에서 start.ps1을 실행한 뒤, 이 콘솔에서 브로커에 연결합니다.',
   more:[['주소','ws://localhost:9001'],['사용자','lab'],['비밀번호','start.ps1에서 직접 정한 값']],go:['conn','브로커 연결 열기'],
   help:'연결되지 않으면 Docker Desktop이 켜져 있는지 먼저 확인하세요.',
   desk:{t:'앱이 브로커를 켭니다',d:'이 앱을 켜면 브로커가 함께 켜집니다. 아래 값을 보드에 넣으면 됩니다.',more:[['Host','@LAN'],['Port','1883'],['사용자','lab'],['비밀번호','브로커 창에서 확인']],go:['conn','브로커 정보 열기'],
     help:'보드가 붙지 않으면 Windows가 처음 띄운 방화벽 창에서 개인 네트워크를 허용했는지 확인하세요.'}},
  {k:'csi',t:'S3 보드 ①에 ESPectre 굽기',d:'크롬이나 엣지에서 굽고 와이파이를 넣은 다음, Device settings에 아래 MQTT 값을 넣습니다.',
   link:['https://espectre.dev/tools/flash/','ESPectre 굽기 페이지'],
   more:[['Scheme','mqtt'],['Host','@LAN'],['Port','1883'],['사용자','lab']],
   help:'보드는 2.4GHz 와이파이에만 붙습니다. 값이 오지 않으면 Windows 방화벽의 개인 네트워크에서 TCP 1883 인바운드가 막혀 있을 수 있습니다. 보안 설정이므로 직접 판단해서 바꾸세요.'},
  {k:'session',t:'움직임 검증 세션 한 번 기록하기',d:'움직임 화면에서 세션을 시작하고, 보드와 공유기 사이를 세 번 이상 지나가는 동안 L 키를 누릅니다.',go:['motion','움직임 화면으로']},
  {k:'rooms',t:'S3 보드 ②③과 C3에 ESPresense 굽기',d:'세 대 모두 같은 설치 페이지에서 굽고, 방 이름을 서로 다르게 줍니다.',
   link:['https://espresense.com/firmware','ESPresense 설치 페이지'],
   more:[['방 이름','office, living, entry'],['MQTT host','@LAN'],['Port','1883'],['사용자','lab']],
   help:'설치 페이지가 칩에 맞는 펌웨어를 고릅니다. 굽고 나면 보드가 espresense-로 시작하는 와이파이를 띄우니, 거기에 접속해 값을 넣습니다. 가진 보드는 ESPresense 권장 목록에 이름이 없는 일반 보드라서, 거리 값은 직접 재서 확인합니다.'},
  {k:'plan',t:'방 크기와 노드 위치 맞추기',d:'위치 화면에서 방 크기를 넣고, "노드 옮기기"를 켜서 보드를 실제 자리로 끌어다 놓습니다.',go:['presence','위치 화면으로']},
  {k:'cam',t:'ESP32‑CAM에 카메라 펌웨어 굽기',d:'Tasmota 설치 페이지에서 tasmota32-webcam을 골라 굽고, 스트림 주소를 카메라 화면에 넣습니다.',
   link:['https://tasmota.github.io/install/','Tasmota 설치 페이지'],more:[['스트림 주소','http://카메라 주소:81/stream']],go:['camera','카메라 화면으로'],
   help:'어댑터에 꽂은 채로 USB에 연결합니다. 영상이 나오지 않으면 Tasmota의 Configure Other에서 AI‑Thinker ESP32‑CAM 템플릿을 적용하세요.'},
  {k:'export',t:'기록 내려받고 검증 요약 복사하기',d:'기록 화면에서 JSONL 파일을 내려받고, 검증 요약을 README에 붙입니다.',go:['evidence','기록 화면으로']}];
const brDone=k=>{const b=Lab.cfg.bring||{};return k==='rooms'?!!(b.rooms&&b.rooms.list.length>=3):!!b[k];};
const brNext=()=>BR.find(s=>!brDone(s.k));
const brOf=s=>window.Desk&&s.desk?Object.assign({},s,s.desk):s,lanText=()=>(window.Desk&&Desk.lan())||'이 PC의 LAN 주소';
const md=ts=>{const d=new Date(ts);return (d.getMonth()+1)+'월 '+d.getDate()+'일';};
const LOCKED=[
  ['점퍼선 (F/F, M/F)','센서 핀과 보드 핀을 잇는 선입니다. PIR은 F/F 선 세 가닥이면 브레드보드 없이 연결됩니다.','모든 배선 모듈의 전제'],
  ['HC‑SR501 PIR 센서','ESPresense 노드의 입력 핀에 연결하면 움직임 화면의 정답 출처에 나타납니다. 버튼 대신 센서가 정답 구간을 기록합니다.','감지 검증 자동화 (콘솔 지원 완료)'],
  ['SSD1306 OLED','노드 옆에서 점수와 상태를 바로 보여 주는 화면입니다.','노드 상태 화면, 책상 단말'],
  ['WS2812B LED 스트립','지금은 보드의 RGB LED 한 개로 대신합니다. 스트립이 있으면 조명 효과를 넓힙니다.','LED 모듈 확장'],
  ['INMP441 마이크와 MAX98357A 앰프','말로 규칙을 실행하는 음성 단말을 만듭니다.','음성 AI 단말'],
  ['LoRa 보드 2대','와이파이가 닿지 않는 곳에서 값을 나릅니다. 12월 도착 뒤에 엽니다.','LoRa 메시']];
let noSig='',brSig='',brNx=null;
function nodes(){if(!every('no',700))return;const tn=now();
  const bg=Lab.cfg.bring||{},nx=brNext(),bsig=JSON.stringify(bg)+'|'+S.source+'|'+S.simMixed+'|'+(window.Desk?Desk.rev:0);
  if(bsig!==brSig){brSig=bsig;const ol=$('#br-steps'),nk=nx?nx.k:'',n=BR.filter(s=>brDone(s.k)).length;let open=new Set($$('details[open]',ol).map(d=>d.dataset.k));if(nk!==brNx){brNx=nk;open=new Set(nk?[nk]:[]);} // 다음 단계가 바뀌면 그 단계만 펼칩니다
    $('#br-count').textContent=BR.length+'단계 중 '+n+'단계';
    $('#br-bar').innerHTML=BR.map(s=>`<i class="${brDone(s.k)?'done':s===nx?'next':''}"></i>`).join('');
    $('#br-note').textContent=!Lab.canLive?'이 페이지는 데모 전용이라 단계가 채워지지 않습니다. PC에 내려받은 콘솔에서 진행하세요.':S.simMixed?'브로커에 시뮬레이터 값이 섞여 있어서 지금은 단계를 세지 않습니다.':S.source==='live'?'브로커에서 받은 메시지로 단계를 채웁니다. 수신 확인일 뿐이고, 하드웨어 검증 판정은 운영자가 합니다.':'데모와 기록 재생 값은 단계로 세지 않습니다. 브로커에 연결하면 채워지기 시작합니다.';
    ol.innerHTML=BR.map(s0=>{const s=brOf(s0),dn=brDone(s.k),rl=s.k==='rooms'&&bg.rooms?bg.rooms.list.length:0,cls=dn?'done':s.k===nk?'next':'wait';
      const chip=dn?`<span class="chip live">확인 · ${md(s.k==='rooms'?bg.rooms.ts:bg[s.k])}</span>`:s.k==='rooms'&&rl?`<span class="chip hot">3대 중 ${rl}대</span>`:s.k===nk?'<span class="chip hot">지금 할 일</span>':'<span class="chip">대기</span>';
      const more=s.more?'<dl>'+s.more.map(m=>`<dt>${m[0]}</dt><dd>${esc(m[1]==='@LAN'?lanText():m[1])}</dd>`).join('')+'</dl>':'';
      const acts=(s.link?`<a class="btn" href="${s.link[0]}" target="_blank" rel="noopener">${s.link[1]}</a>`:'')+(s.go?`<button class="btn${s.k===nk?' primary':''}" type="button" data-go="${s.go[0]}">${s.go[1]}</button>`:'');
      return `<li class="step ${cls}"><h3>${s.t}</h3>${chip}<p>${s.d}</p><details data-k="${s.k}"${open.has(s.k)?' open':''}><summary>넣을 값과 막힐 때</summary>${more}${s.help?`<p class="help">${s.help}</p>`:''}<div class="acts">${acts}</div></details></li>`;}).join('');}
  const tb=$('#no-found tbody');const sig=S.ver+'|'+S.source;if(sig!==noSig&&!tb.contains(document.activeElement)){noSig=sig;
    tb.innerHTML=Lab.cfg.nodes.map(n=>`<tr data-k="${esc(n.key)}"><td><input class="alias" value="${esc(n.alias)}" aria-label="${esc(n.alias)} 이름"></td><td>${{csi:'Wi‑Fi 움직임',ble:'BLE 위치',cam:'카메라',led:'LED'}[n.type]}</td><td class="n">${esc(Lab.mask(n.key))}</td><td class="n" data-f="seen"></td></tr>`).join('');}
  $$('#no-found tbody tr').forEach(tr=>{const k=tr.dataset.k,c=$('[data-f=seen]',tr);let ts=0;if(k.startsWith('csi:')){const n=S.csi.get(k.slice(4));ts=n?n.ts:0;}else if(k.startsWith('ble:')){for(const d of S.devs.values()){const o=d.obs[k.slice(4)];if(o&&o.ts>ts)ts=o.ts;}}
    c.textContent=ts?(tn-ts<3000?'방금':Math.round((tn-ts)/1000)+'초 전'):'—';});
  const ll=$('#no-locked');if(!ll.children.length)ll.innerHTML=LOCKED.map(l=>`<li><b>${l[0]}</b><span>${l[1]}</span><em>${l[2]}</em></li>`).join('');}

/* ---------- 기록 ---------- */
function evidence(){if(!every('ev',700))return;const live=S.source==='live',clean=live&&!S.simEver;
  const row=(a,b,cls)=>`<tr><td>${a}</td><td><span class="chip ${cls}">${b}</span></td></tr>`;
  $('#ev-status tbody').innerHTML=
    row('콘솔 수신과 표시 (내장 시뮬레이터)',S.source==='demo'&&S.count>0?'SIMULATED 동작 중':'SIMULATED','sim')+
    row('정답 센서 입력 (PIR)',S.inputs.size?(clean?'수신 중, 운영자 확인 필요':'시뮬레이션 또는 재생'):'OPERATOR_REQUIRED',S.inputs.size?(clean?'live':'sim'):'')+
    row('브로커 연결',live?'연결됨':'OPERATOR_REQUIRED',live?'live':'')+
    row('ESPectre 보드의 실제 메시지',clean&&S.csi.size?'수신 중, 운영자 확인 필요':'OPERATOR_REQUIRED',clean&&S.csi.size?'live':'')+
    row('ESPresense 보드의 실제 메시지',clean&&S.rooms.size?'수신 중, 운영자 확인 필요':'OPERATOR_REQUIRED',clean&&S.rooms.size?'live':'')+
    row('하드웨어 검증 (HARDWARE_VERIFIED)','아직 없음','');
  $('#ev-sessions tbody').innerHTML=S.sessions.slice(0,8).map(s=>`<tr><td class="n">${hms(s.start)}</td><td>${esc(s.alias||Lab.mask(s.node))}</td><td class="n">${Math.round(s.dur)}초</td><td class="n">${s.labels}</td><td class="n">${s.hits}</td><td class="n">${s.miss}</td><td class="n">${s.falses}</td><td class="n">${s.recall==null?'—':Math.round(s.recall*100)+'%'}</td><td>${esc(truthName(s.truth||'manual'))}</td><td>${s.source==='live'&&!(s.sim??S.simEver)?'브로커 수신':s.source==='replay'?'기록 재생':'시뮬레이션'}</td></tr>`).join('')||'<tr class="empty"><td colspan="10">끝낸 세션이 없습니다. 움직임 화면에서 세션을 시작하세요.</td></tr>';
  $('#ev-count').textContent=S.count.toLocaleString('en-US')+'건';$('#ev-rp').textContent=S.source==='replay'?`재생 중 ${S.replayInfo.done} / ${S.replayInfo.total}`:S.replayInfo&&S.replayInfo.done>=S.replayInfo.total?'재생 끝':'';
  const lg=$('#ev-log');if(document.activeElement!==lg)lg.textContent=S.log.slice(-16).map(l=>l.t.slice(11,19)+'  '+l.topic+'  '+l.payload.slice(0,70)).join('\n');}

/* ---------- 이벤트 연결 ---------- */
function wire(){camMain=CamBox($('#cam-main'),false);camInset=CamBox($('#mo-cam'),true);
  $('#mo-tabs').addEventListener('click',e=>{const b=e.target.closest('button');if(b){moSel=b.dataset.k;stamps.mo=0;}});
  $('#va-start').addEventListener('click',()=>{const ss=S.session;if(ss&&!ss.end)Lab.sessionStop();else if(moSel)Lab.sessionStart(moSel,$('#va-src').value||'manual');stamps.mo=0;});
  $('#va-src').addEventListener('change',()=>{stamps.mo=0;});
  const lb=$('#va-label'),down=()=>{if(lb.disabled)return;Lab.label(true);lb.classList.add('on');},up=()=>{Lab.label(false);lb.classList.remove('on');};
  lb.addEventListener('pointerdown',down);lb.addEventListener('pointerup',up);lb.addEventListener('pointerleave',up);lb.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();down();}});lb.addEventListener('keyup',up);
  const typing=()=>/INPUT|SELECT|TEXTAREA/.test((document.activeElement||{}).tagName||'');
  window.addEventListener('keydown',e=>{if((e.key==='l'||e.key==='L')&&!typing()&&!e.repeat)down();});window.addEventListener('keyup',e=>{if(e.key==='l'||e.key==='L')up();});
  // 평면도
  const cv=$('#pl-canvas'),toRoom=e=>{const r=cv.getBoundingClientRect(),g=plan.geo;return{x:(e.clientX-r.left-g.ox)/g.k,y:(e.clientY-r.top-g.oy)/g.k};};
  $('#pl-edit').addEventListener('change',e=>{plan.edit=e.target.checked;cv.style.cursor=plan.edit?'move':'';});
  cv.addEventListener('pointerdown',e=>{if(!plan.edit||!plan.geo)return;const p=toRoom(e),cfg=Lab.cfg;let best=null,bd=0.7;for(const n of[...cfg.nodes,cfg.router]){const d=Math.hypot(n.x-p.x,n.y-p.y);if(d<bd){bd=d;best=n;}}if(best){plan.drag=best;cv.setPointerCapture(e.pointerId);}});
  cv.addEventListener('pointermove',e=>{if(!plan.drag)return;const p=toRoom(e),cfg=Lab.cfg;plan.drag.x=+Lab.clamp(p.x,0,cfg.room.w).toFixed(2);plan.drag.y=+Lab.clamp(p.y,0,cfg.room.h).toFixed(2);});
  cv.addEventListener('pointerup',()=>{if(plan.drag){plan.drag=null;Lab.save();Lab.mark('plan');}});
  const pw=$('#pl-w'),phh=$('#pl-h');pw.value=Lab.cfg.room.w;phh.value=Lab.cfg.room.h;
  const size=()=>{const cfg=Lab.cfg,w=Lab.clamp(+pw.value||10,3,30),h=Lab.clamp(+phh.value||7,3,30);cfg.room={w,h};for(const n of[...cfg.nodes,cfg.router]){n.x=Lab.clamp(n.x,0,w);n.y=Lab.clamp(n.y,0,h);}Lab.save();Lab.mark('plan');};pw.addEventListener('change',size);phh.addEventListener('change',size);
  $('#pr-table').addEventListener('click',e=>{const b=e.target.closest('.pin');if(!b)return;const id=b.dataset.id,p=Lab.cfg.pinned,i=p.indexOf(id);if(i>=0)p.splice(i,1);else p.push(id);Lab.save();b.blur();stamps.pr=0;});
  $('#pr-filter').addEventListener('input',()=>{stamps.pr=0;});
  // 카메라
  $('#cam-url').value=Lab.cfg.cam.url;$('#cam-form').addEventListener('submit',e=>{e.preventDefault();const v=$('#cam-url').value.trim();Lab.cfg.cam.url=/^https?:\/\//.test(v)?v:'';$('#cam-url').value=Lab.cfg.cam.url;Lab.save();});
  // 자동화
  $('#ru-when').addEventListener('change',ruleArgs);$('#ru-then').addEventListener('change',e=>{const v=e.target.value;$('#ru-color-l').hidden=v!=='led';$('#ru-topic-l').hidden=v!=='publish';});
  // 바깥 화면 알림
  const ns=$('#nt-session');ns.checked=!!(Lab.cfg.notify&&Lab.cfg.notify.session);ns.addEventListener('change',()=>{Lab.cfg.notify={session:ns.checked};Lab.save();});
  $('#nt-test').addEventListener('click',()=>Lab.note('test','info','시험 알림','안경 화면과 구독 중인 앱에 이 문장이 보이면 됩니다'));
  $('#nt-copy').addEventListener('click',e=>{const b=e.currentTarget,done=()=>{b.textContent='복사됨';setTimeout(()=>{b.textContent='토픽 복사';},1400);};
    try{if(window.desktop){window.desktop.copy(Lab.NOTIFY);done();}else navigator.clipboard.writeText(Lab.NOTIFY).then(done,()=>{});}catch(err){}});
  $('#ru-form').addEventListener('submit',e=>{e.preventDefault();const w=$('#ru-when').value,a=$('#ru-arg').value,th=$('#ru-then').value,cfg=Lab.cfg;if(w==='enter'&&!a)return;
    const when=w==='motion'?{t:w,node:a}:w==='enter'?{t:w,room:a}:{t:w,node:'*',sec:+a};const argTxt=$('#ru-arg').selectedOptions[0].textContent;
    const then=th==='led'?{t:'led',color:$('#ru-color').value,sec:8}:th==='notify'?{t:'notify',level:w==='quiet'?'info':'alert'}:{t:'publish',topic:$('#ru-topic').value.trim()||'lab/custom',payload:JSON.stringify({rule:w,arg:a})};
    const name=(w==='motion'?argTxt+'에서 움직임이 시작되면':w==='enter'?'고정한 기기가 '+argTxt+'에 들어오면':argTxt+' 동안 조용하면')+' '+(th==='led'?'LED 색 바꾸기':th==='notify'?'알림 보내기':then.topic+' 토픽으로 보내기');
    cfg.rules.push({id:'r'+Date.now().toString(36),on:true,name,when,then,fired:0,last:0});Lab.save();stamps.ru=0;});
  $('#ru-list').addEventListener('change',e=>{const li=e.target.closest('li');if(!li)return;const r=Lab.cfg.rules.find(x=>x.id===li.dataset.id);if(r){r.on=e.target.checked;Lab.save();}});
  $('#ru-list').addEventListener('click',e=>{const b=e.target.closest('.del');if(!b)return;const cfg=Lab.cfg,i=cfg.rules.findIndex(x=>x.id===b.closest('li').dataset.id);if(i>=0){cfg.rules.splice(i,1);Lab.save();b.blur();ruSig='';stamps.ru=0;}});
  const lt=$('#led-topic');lt.value=Lab.cfg.led.topic;lt.addEventListener('change',()=>{Lab.cfg.led.topic=lt.value.trim()||'wled/lab/api';lt.value=Lab.cfg.led.topic;Lab.save();});
  ruleArgs();
  // 노드
  $('#no-found').addEventListener('change',e=>{const i=e.target.closest('.alias');if(!i)return;const n=Lab.node(i.closest('tr').dataset.k);if(n&&i.value.trim()){n.alias=i.value.trim().slice(0,24);Lab.save();}});
  $('#br-steps').addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(!b)return;if(b.dataset.go==='conn')$('#openConn').click();else location.hash=b.dataset.go;});
  const bc=$('#br-clear');let bcT=0;bc.addEventListener('click',()=>{if(now()-bcT<4000){Lab.clearBring();bc.textContent='순서 기록 지우기';bcT=0;}else{bcT=now();bc.textContent='한 번 더 누르면 지웁니다';setTimeout(()=>{bc.textContent='순서 기록 지우기';},4000);}});
  $('#no-reset').addEventListener('click',()=>{Lab.reset();if(S.source==='demo')Lab.demo();pw.value=Lab.cfg.room.w;phh.value=Lab.cfg.room.h;ruSig='';noSig='';});
  // 기록
  $('#ev-file').addEventListener('change',e=>{const f=e.target.files&&e.target.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{Lab.replay(String(rd.result),+$('#ev-speed').value,err=>{$('#ev-rp').textContent=err||'';});};rd.readAsText(f);e.target.value='';});
  $('#ev-report').addEventListener('click',()=>{const md=Lab.report(),out=$('#ev-out'),b=$('#ev-report');out.hidden=false;out.value=md;out.focus();out.select();if(navigator.clipboard)navigator.clipboard.writeText(md).then(()=>{b.textContent='복사했습니다';setTimeout(()=>{b.textContent='검증 요약 복사';},1600);},()=>{});});
  $('#ev-export').addEventListener('click',()=>{const data=Lab.exportLog(),out=$('#ev-out');
    if(Lab.canLive){try{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type:'application/x-ndjson'}));a.download='sentinel-lab-'+new Date().toISOString().replace(/[:.]/g,'-')+'.jsonl';document.body.appendChild(a);a.click();a.remove();return;}catch(err){}}
    out.hidden=false;out.value=data.split('\n').slice(0,400).join('\n');out.focus();out.select();
    if(navigator.clipboard)navigator.clipboard.writeText(data).then(()=>{$('#ev-export').textContent='클립보드에 복사함';},()=>{});});
}
return{wire,update:{space,motion,presence,camera,rules,nodes,evidence},ruleArgs};
})();
