/* Sentinel Lab Console: 데이터 모델, 버스, 위치 추정, 자동화, 검증 세션 */
window.Lab=(()=>{'use strict';
const now=()=>Date.now(),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// 식별자 가림: 16자리 기기 ID와 MAC 꼴은 앞 4자만 남깁니다.
const mask=s=>String(s).replace(/\b[0-9a-f]{16}\b/gi,m=>m.slice(0,4)+'…').replace(/\b(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}\b/gi,m=>m.slice(0,5)+':…').replace(/\b[0-9a-f]{12}\b/gi,m=>m.slice(0,4)+'…');
const LSK='sentinel-lab-console-v1';
const SLOTS={csi:[[1,6.1],[5,6.3],[1,3.5]],ble:[[0.9,0.9],[5.6,6.2],[9.1,5.6],[9.1,2.6],[3,3.5]]};
const ROOM_KO={office:'작업실',living:'거실',entry:'현관',bedroom:'침실',kitchen:'주방'};
const canLive=location.protocol==='file:'||/^(localhost|127\.0\.0\.1)$/.test(location.hostname);
function defCfg(){return{room:{w:10,h:7},router:{x:9.2,y:0.8},
  nodes:[{key:'cam',type:'cam',alias:'카메라',x:5,y:0.6},{key:'led',type:'led',alias:'상태 LED',x:2.4,y:0.7}],
  pinned:['sim:phone','sim:keys'],
  rules:[
    {id:'r1',on:true,name:'움직임이 시작되면 LED를 금색으로',when:{t:'motion',node:'*'},then:{t:'led',color:'#ecb955',sec:8},fired:0,last:0},
    {id:'r2',on:true,name:'고정한 기기가 작업실에 들어오면 LED를 파란색으로',when:{t:'enter',room:'office'},then:{t:'led',color:'#5aa9ff',sec:8},fired:0,last:0},
    {id:'r3',on:false,name:'5분 동안 조용하면 알림 토픽으로 보내기',when:{t:'quiet',node:'*',sec:300},then:{t:'publish',topic:'lab/notify',payload:'{"msg":"quiet"}'},fired:0,last:0}],
  cam:{url:''},led:{topic:'wled/lab/api'},broker:{url:'ws://localhost:9001',user:'lab'},bring:{}};}
let cfg=defCfg();
try{const raw=localStorage.getItem(LSK);if(raw){const j=JSON.parse(raw);if(j&&j.room&&Array.isArray(j.nodes))cfg=Object.assign(defCfg(),j);}}catch(e){}
const S={source:'idle',simMixed:false,simEver:false,count:0,rate:0,lastTs:0,ver:1,
  csi:new Map(),rooms:new Map(),devs:new Map(),inputs:new Map(),led:{color:null,until:0},feed:[],log:[],session:null,sessions:[],fires:[]};
let _c=0;setInterval(()=>{S.rate=S.rate*0.5+_c*0.5;_c=0;},1000);
function save(){S.ver++;try{localStorage.setItem(LSK,JSON.stringify(cfg));}catch(e){}}
function reset(){const b=cfg.broker,g=cfg.bring;cfg=defCfg();cfg.broker=b;cfg.bring=g||{};save();if(S.source==='demo'){clearState();}}
const pend=new Map();
function clearState(){pend.clear();S.csi.clear();S.rooms.clear();S.devs.clear();S.inputs.clear();S.feed.length=0;S.led={color:null,until:0};}
const node=k=>cfg.nodes.find(n=>n.key===k);
/* 첫 실측 순서: 브로커에서 받은 것만 기록합니다. 시뮬레이터가 섞인 동안에는 세지 않습니다. */
function mark(k,v){const b=cfg.bring||(cfg.bring={});if(k!=='cam'&&(S.source!=='live'||S.simMixed||S.simEver))return;
  if(k==='rooms'){const a=b.rooms||(b.rooms={list:[],ts:0});if(a.list.includes(v)||a.list.length>=8)return;a.list.push(v);a.ts=now();save();return;}
  if(!b[k]){b[k]=now();save();}}
function clearBring(){cfg.bring={};save();}
function ensureNode(key,type,alias){let n=node(key);if(n)return n;const L=SLOTS[type]||SLOTS.ble,used=cfg.nodes.filter(x=>x.type===type).length,s=L[used%L.length];
  n={key,type,alias,x:s[0],y:s[1],sim:S.source==='demo'};cfg.nodes.push(n);save();return n;}
function feed(txt,kind){S.feed.unshift({t:now(),txt,kind});if(S.feed.length>40)S.feed.pop();}

/* ---- 위치 추정 ---- */
function locate(d){const t=now(),o=[];for(const r in d.obs){const ob=d.obs[r],n=node('ble:'+r);if(n&&t-ob.ts<15000)o.push({x:n.x,y:n.y,d:Math.max(0.2,ob.d),r});}
  if(!o.length)return;o.sort((a,b)=>a.d-b.d);const prevRoom=d.room;
  // 방 판정은 가장 가까운 노드, 0.4m 이상 차이 날 때만 바꿉니다.
  if(!d.room||!d.obs[d.room]||t-d.obs[d.room].ts>15000||o[0].d<d.obs[d.room].d-0.4)d.room=o[0].r;
  let p;if(o.length>=3){const a=o[0];let s11=0,s12=0,s22=0,b1=0,b2=0;for(let i=1;i<o.length;i++){const q=o[i],A=2*(q.x-a.x),B=2*(q.y-a.y),C=a.d*a.d-q.d*q.d-a.x*a.x+q.x*q.x-a.y*a.y+q.y*q.y;s11+=A*A;s12+=A*B;s22+=B*B;b1+=A*C;b2+=B*C;}
    const det=s11*s22-s12*s12;if(Math.abs(det)>1e-6)p={x:(b1*s22-b2*s12)/det,y:(s11*b2-s12*b1)/det,n:o.length};}
  if(!p&&o.length>=2){const a=o[0],b=o[1],f=a.d/(a.d+b.d);p={x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,n:2};}
  if(!p)p={x:o[0].x,y:o[0].y,n:1};
  p.x=clamp(p.x,0,cfg.room.w);p.y=clamp(p.y,0,cfg.room.h);
  d.pos=d.pos?{x:d.pos.x+(p.x-d.pos.x)*0.3,y:d.pos.y+(p.y-d.pos.y)*0.3,n:p.n}:p;
  d.trail.push([d.pos.x,d.pos.y]);if(d.trail.length>60)d.trail.shift();
  if(prevRoom&&d.room!==prevRoom&&cfg.pinned.includes(d.id)){feed((d.name||mask(d.id))+': '+roomName(prevRoom)+' → '+roomName(d.room),'ble');trigger({t:'enter',room:d.room,dev:d.id});}
}
const roomName=r=>{const n=node('ble:'+r);return n?n.alias:(ROOM_KO[r]||r);};

/* ---- 수신 ---- */
const subs=[];
function ingest(topic,text,src,retained){S.count++;_c++;S.lastTs=now();const fresh=src==='live'&&!retained; // 보관(retained) 메시지는 예전 값일 수 있어 단계 확인에 쓰지 않습니다
  const le={t:new Date().toISOString(),src,topic:mask(topic),payload:mask(text)};if(retained)le.retained=true;S.log.push(le);if(S.log.length>8000)S.log.shift();
  if(topic==='lab/sim/active'){S.simMixed=text==='1'&&src==='live';if(text==='1')S.simEver=true;return;}
  let j=null;try{j=JSON.parse(text);}catch(e){}
  const p=topic.split('/');
  if(p[0]==='espectre'&&p[2]==='devices'&&p[3]){
    const id=p[3],kind=p[4];let n=S.csi.get(id);
    if(!n){if(retained){pend.set(id+'/'+kind,text);return;} // 꺼진 보드의 보관 메시지만으로는 노드를 만들지 않습니다
      n={id,key:'csi:'+id,score:[],state:'idle',thr:null,events:[],health:'',last:null,ts:0};S.csi.set(id,n);ensureNode(n.key,'csi','CSI '+id.slice(0,4));
      for(const k of['sensing','health']){const v=pend.get(id+'/'+k);if(v!=null){pend.delete(id+'/'+k);ingest('espectre/v1/devices/'+id+'/'+k,v,'pend');S.count--;S.log.pop();}}}
    if(kind==='motion'&&j){const t=now();if(fresh)mark('csi');n.last=+j.score;n.ts=t;n.score.push({t,v:+j.score});if(n.score.length>6000)n.score.shift();
      if(j.state!==n.state){n.state=j.state;if(j.state==='motion'){n.events.push({s:t,e:0,peak:+j.score});if(n.events.length>300)n.events.shift();feed(node(n.key).alias+': 움직임 시작','motion');trigger({t:'motion',node:n.key});}
        else{const ev=n.events[n.events.length-1];if(ev&&!ev.e){ev.e=t;feed(node(n.key).alias+': 움직임 끝 ('+((ev.e-ev.s)/1000).toFixed(1)+'초)','idle');}n.quietSince=t;n.quietFired=false;}}
      else if(n.state==='motion'){const ev=n.events[n.events.length-1];if(ev&&+j.score>ev.peak)ev.peak=+j.score;}}
    else if(kind==='sensing'&&j){if(typeof j.threshold==='number')n.thr=j.threshold;n.detector=j.detector;n.calibrating=!!j.calibrating;}
    else if(kind==='health'){n.health=j&&j.status?String(j.status):text.slice(0,24);}
  }else if(p[0]==='espresense'&&p[1]==='devices'&&p.length===4&&j){
    const id=p[2],room=p[3];let d=S.devs.get(id);if(!d){d={id,name:'',obs:{},pos:null,room:null,trail:[],ts:0};S.devs.set(id,d);}
    if(j.name)d.name=j.name;d.obs[room]={d:+j.distance,rssi:+j.rssi,ts:now()};d.ts=now();
    if(!S.rooms.has(room)){S.rooms.set(room,{status:'online',ts:now()});}ensureNode('ble:'+room,'ble',ROOM_KO[room]||room);if(fresh)mark('rooms',room);locate(d);
  }else if(p[0]==='espresense'&&p[1]==='rooms'&&p[3]==='status'){if(!text)return;S.rooms.set(p[2],{status:text,ts:now()});if(fresh&&text==='online')mark('rooms',p[2]);ensureNode('ble:'+p[2],'ble',ROOM_KO[p[2]]||p[2]);}
  else if(p[0]==='espresense'&&p[1]==='rooms'&&p[3]==='telemetry'){if(fresh){mark('rooms',p[2]);if(!S.rooms.has(p[2]))S.rooms.set(p[2],{status:'online',ts:now()});ensureNode('ble:'+p[2],'ble',ROOM_KO[p[2]]||p[2]);}}
  else if(p[0]==='espresense'&&p[1]==='rooms'&&/^input_\d+$/.test(p[3]||'')&&(text==='ON'||text==='OFF')){const key=p[2]+'/'+p[3].slice(6),on=text==='ON',was=S.inputs.get(key);S.inputs.set(key,{key,room:p[2],n:p[3].slice(6),on,ts:now()});if(fresh)mark('pir');
    if(!was||was.on!==on){const ss=S.session;if(ss&&!ss.end&&ss.truth==='pir:'+key)label(on);if(on)feed(roomName(p[2])+' 입력 '+p[3].slice(6)+': 감지','ble');}}
  else if(topic===cfg.led.topic&&j){const c=j.seg&&j.seg[0]&&j.seg[0].col&&j.seg[0].col[0];if(j.on===false)S.led={color:null,until:0};else if(c)S.led={color:c.slice(0,3),until:now()+(j._sec||8)*1000};}
  else if(topic==='lab/sim/truth'&&j){const ss=S.session;if(ss&&!ss.end&&ss.truth==='sim'&&ss.node==='csi:'+j.node)label(!!j.on);}
  for(const f of subs)f(topic,text,src);
}
/* ---- 전송 ---- */
let client=null;
function publish(topic,payload){if(S.source==='live'&&client){client.publish(topic,payload);}else if(S.source==='demo'&&window.Sim){Sim.onPublish(topic,payload);}}
function connect(url,user,pass,cb){if(!canLive){cb('이 페이지에서는 브라우저 정책 때문에 브로커에 연결할 수 없습니다. PC에 내려받은 콘솔에서 연결하세요.');return;}
  if(typeof mqtt==='undefined'){cb('vendor/mqtt.min.js를 불러오지 못했습니다.');return;}
  disconnect();cfg.broker={url,user};save();let done=false;
  client=mqtt.connect(url,{username:user,password:pass,reconnectPeriod:3000,connectTimeout:6000,clientId:'sentinel-console-'+Math.random().toString(16).slice(2,8)});
  client.on('connect',()=>{if(window.Sim)Sim.stop();if(S.source!=='live'){clearState();cfg.nodes=cfg.nodes.filter(n=>!n.sim);save();}S.source='live';if(!cfg.bring)cfg.bring={};if(!cfg.bring.broker){cfg.bring.broker=now();save();}
    client.subscribe(['espectre/v1/devices/+/motion','espectre/v1/devices/+/sensing','espectre/v1/devices/+/health','espresense/devices/#','espresense/rooms/+/+','lab/sim/active',cfg.led.topic]);
    feed('브로커에 연결됨','sys');if(!done){done=true;cb(null);}});
  client.on('message',(t,b,pk)=>ingest(t,b.toString(),'live',!!(pk&&pk.retain)));
  client.on('error',e=>{if(S.source!=='live'&&client){try{client.end(true);}catch(x){}client=null;}if(!done){done=true;cb('연결하지 못했습니다: '+(e&&e.message||'알 수 없는 오류')+'. 브로커가 켜져 있는지, 사용자 이름과 비밀번호가 맞는지 확인하세요.');}});
  client.on('close',()=>{if(S.source==='live')S.linkDown=true;});client.on('connect',()=>{S.linkDown=false;});}
function disconnect(){stopReplay();if(client){try{client.end(true);}catch(e){}client=null;}if(S.source==='live'){S.source='idle';S.simMixed=false;}}
function demo(){disconnect();clearState();S.simEver=false;S.source='demo';if(window.Sim)Sim.start();feed('데모 시작: 내장 시뮬레이터가 보내는 값입니다','sys');}

/* ---- 자동화 ---- */
function hexRgb(h){return[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));}
function trigger(ev){const t=now();for(const r of cfg.rules){if(!r.on||r.when.t!==ev.t)continue;
  if(ev.t==='motion'&&r.when.node!=='*'&&r.when.node!==ev.node)continue;
  if(ev.t==='enter'&&r.when.room!==ev.room)continue;
  if(ev.t==='quiet'&&r.when.node!=='*'&&r.when.node!==ev.node)continue;
  if(t-r.last<3000)continue;r.last=t;r.fired++;run(r);S.fires.unshift({t,name:r.name});if(S.fires.length>30)S.fires.pop();feed('자동화 실행: '+r.name,'rule');}}
function run(r){const a=r.then;if(a.t==='led'){publish(cfg.led.topic,JSON.stringify({on:true,bri:160,seg:[{col:[hexRgb(a.color)]}],_sec:a.sec}));}
  else if(a.t==='publish'){publish(a.topic,a.payload);}}
setInterval(()=>{const t=now();for(const n of S.csi.values()){if(n.state==='idle'&&n.quietSince&&!n.quietFired){for(const r of cfg.rules){if(r.on&&r.when.t==='quiet'&&t-n.quietSince>r.when.sec*1000){n.quietFired=true;trigger({t:'quiet',node:n.key});break;}}}}
  if(S.led.color&&t>S.led.until)S.led={color:null,until:0};},1000);

/* ---- 검증 세션 ---- */
function sessionStart(nodeKey,truth){truth=truth||'manual';S.session={start:now(),end:0,node:nodeKey,labels:[],cur:null,truth,auto:truth!=='manual',source:S.source};
  if(truth.startsWith('pir:')){const i=S.inputs.get(truth.slice(4));if(i&&i.on)label(true);}}
function label(on){const ss=S.session;if(!ss||ss.end)return;if(on&&!ss.cur){ss.cur={s:now(),e:0};ss.labels.push(ss.cur);}else if(!on&&ss.cur){ss.cur.e=now();ss.cur=null;}}
function sessionStats(ss){ss=ss||S.session;if(!ss)return null;const t=ss.end||now(),id=ss.node.slice(4),n=S.csi.get(id);
  const evs=(n?n.events:[]).filter(e=>(e.e||t)>=ss.start&&e.s<=t),ov=(e,l)=>e.s<=(l.e||t)+2000&&(e.e||t)>=l.s-2000;
  const hits=ss.labels.filter(l=>evs.some(e=>ov(e,l))).length,falses=evs.filter(e=>!ss.labels.some(l=>ov(e,l))).length;
  return{dur:(t-ss.start)/1000,labels:ss.labels.length,hits,miss:ss.labels.length-hits,falses,events:evs.length,recall:ss.labels.length?hits/ss.labels.length:null};}
/* 세션이 끝날 때 리포트에 쓸 점수 곡선을 줄여서 함께 남깁니다 (구간별 최댓값, 최대 600점). */
function traceOf(ss){const n=S.csi.get(ss.node.slice(4)),a=ss.start-3000,b=ss.end+1000,pts=n?n.score.filter(p=>p.t>=a&&p.t<=b):[],k=Math.max(1,Math.ceil(pts.length/600)),out=[];
  for(let i=0;i<pts.length;i+=k){let m=pts[i];for(let q=i+1;q<Math.min(pts.length,i+k);q++)if(pts[q].v>m.v)m=pts[q];out.push([m.t-ss.start,+m.v.toFixed(3)]);}
  return{thr:n?n.thr:null,pts:out,labels:ss.labels.map(l=>[l.s-ss.start,(l.e||ss.end)-ss.start]),events:(n?n.events:[]).filter(e=>(e.e||ss.end)>=ss.start&&e.s<=ss.end).map(e=>[e.s-ss.start,(e.e||ss.end)-ss.start,+e.peak.toFixed(3)])};}
function sessionStop(){const ss=S.session;if(!ss||ss.end)return;label(false);ss.end=now();const st=sessionStats(ss);S.sessions.unshift(Object.assign({node:ss.node,alias:(node(ss.node)||{alias:mask(ss.node)}).alias,start:ss.start,end:ss.end,auto:ss.auto,truth:ss.truth,source:ss.source,sim:ss.source!=='live'||S.simEver||S.simMixed,trace:traceOf(ss)},st));if(ss.source==='live'&&st.labels>=3)mark('session');}
/* ---- 기록 재생: 내려받은 JSONL을 같은 수신 경로로 다시 흘립니다 ---- */
let rp=null;
function stopReplay(){if(rp){clearTimeout(rp.timer);rp=null;if(S.source==='replay')S.source='idle';}}
function replay(text,speed,cb){const rows=[];let head=null;for(const ln of String(text).split('\n')){if(!ln.trim())continue;let o;try{o=JSON.parse(ln);}catch(e){continue;}if(o.kind==='sentinel-lab-log'||o.kind==='sentinel-lab-p1-log'){head=o;continue;}if(o.topic&&o.t&&typeof o.payload==='string'){const t=Date.parse(o.t);if(!isNaN(t))rows.push([t,o.topic,o.payload]);}}
  if(!rows.length){cb('재생할 메시지를 찾지 못했습니다. 콘솔에서 내려받은 JSONL 파일인지 확인하세요.');return;}
  disconnect();if(window.Sim)Sim.stop();clearState();cfg.nodes=cfg.nodes.filter(n=>!n.sim);save();S.source='replay';S.replayInfo={total:rows.length,done:0,origin:head?head.data_source:'unknown'};S.simEver=!head||head.data_source!=='broker';
  rp={i:0,timer:null};const sp=speed||1,step=()=>{if(!rp)return;const r=rows[rp.i++];ingest(r[1],r[2],'replay');S.replayInfo.done=rp.i;if(rp.i>=rows.length){feed('재생 끝','sys');rp=null;return;}rp.timer=setTimeout(step,Math.min(2000,Math.max(0,(rows[rp.i][0]-r[0])/sp)));};
  feed('기록 재생 시작: '+rows.length+'건','sys');step();cb(null,rows.length);}
function report(){const L=['| 시작 | 노드 | 길이 | 정답 구간 | 감지 | 놓침 | 오탐 | 재현율 | 정답 출처 | 데이터 |','|---|---|---|---|---|---|---|---|---|---|'];
  for(const s of S.sessions){L.push('| '+new Date(s.start).toISOString().slice(0,19).replace('T',' ')+' | '+(s.alias||mask(s.node))+' | '+Math.round(s.dur)+'초 | '+s.labels+' | '+s.hits+' | '+s.miss+' | '+s.falses+' | '+(s.recall==null?'-':Math.round(s.recall*100)+'%')+' | '+(s.truth==='manual'?'버튼':s.truth==='sim'?'시뮬레이터':'PIR 입력')+' | '+(s.source==='live'&&!(s.sim??S.simEver)?'브로커 수신 (운영자 확인 필요)':'SIMULATED')+' |');}
  return L.join('\n');}
function exportLog(){const sim=S.source!=='live'||S.simEver;if(!sim)mark('export');
  const head={kind:'sentinel-lab-log',exported_at:new Date().toISOString(),data_source:S.source==='live'?(S.simEver?'broker_with_simulator':'broker'):S.source==='replay'?'replay':'built_in_simulator',verification:sim?'SIMULATED':'OPERATOR_TO_CONFIRM',messages:S.log.length,sessions:S.sessions,note:'식별자는 앞 4자만 남기고 가렸습니다.'};
  return JSON.stringify(head)+'\n'+S.log.map(l=>JSON.stringify(l)).join('\n')+'\n';}
return{S,get cfg(){return cfg;},canLive,now,clamp,mask,save,reset,node,roomName,ingest,publish,connect,disconnect,demo,on:f=>subs.push(f),feed,
  sessionStart,sessionStop,sessionStats,label,exportLog,replay,stopReplay,report,mark,clearBring,hexRgb,ROOM_KO};
})();
