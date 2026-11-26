/* Wavrel Console: 데이터 모델, 버스, 위치 추정, 자동화, 검증 세션 */
window.Lab=(()=>{'use strict';
const now=()=>Date.now(),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// 식별자 가림: 16자리 기기 ID와 MAC 꼴은 앞 4자만 남깁니다.
const mask=s=>String(s).replace(/\b[0-9a-f]{16}\b/gi,m=>m.slice(0,4)+'…').replace(/\b(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}\b/gi,m=>m.slice(0,5)+':…').replace(/\b[0-9a-f]{12}\b/gi,m=>m.slice(0,4)+'…');
const LSK='wavrel-console-v1';
const SLOTS={csi:[[1,6.1],[5,6.3],[1,3.5]],ble:[[0.9,0.9],[5.6,6.2],[9.1,5.6],[9.1,2.6],[3,3.5]]};
const ROOM_KO={office:L('작업실'),living:L('거실'),entry:L('현관'),bedroom:L('침실'),kitchen:L('주방')};
const DESK=!!window.desktop; // 데스크톱 앱 안에서는 내장 허브와 창 사이의 통로를 씁니다
const canLive=DESK||location.protocol==='file:'||/^(localhost|127\.0\.0\.1)$/.test(location.hostname);
function defCfg(){return{room:{w:10,h:7},router:{x:9.2,y:0.8},
  nodes:[{key:'cam',type:'cam',alias:L('카메라'),x:5,y:0.6},{key:'led',type:'led',alias:L('상태 LED'),x:2.4,y:0.7}],
  pinned:['sim:phone','sim:keys'],
  rules:[
    {id:'r1',on:true,when:{t:'motion',node:'*'},then:{t:'led',color:'#ecb955',sec:8},fired:0,last:0},
    {id:'r2',on:true,when:{t:'enter',room:'office'},then:{t:'led',color:'#5aa9ff',sec:8},fired:0,last:0},
    {id:'r3',on:false,when:{t:'quiet',node:'*',sec:300},then:{t:'notify',level:'info'},fired:0,last:0},
    R4()],
  cam:{url:''},led:{topic:'wled/lab/api'},broker:{url:'ws://localhost:9001',user:'lab'},bring:{},notify:{session:true}};}
function R4(){return{id:'r4',on:true,when:{t:'motion',node:'*'},then:{t:'notify',level:'alert'},fired:0,last:0};}
let cfg=defCfg();
try{const raw=localStorage.getItem(LSK);if(raw){const j=JSON.parse(raw);if(j&&j.room&&Array.isArray(j.nodes)){cfg=Object.assign(defCfg(),j);
  // 알림 채널이 생기기 전에 저장한 설정: 예전 알림 규칙을 새 형식으로 옮기고, 움직임 알림 규칙을 하나 더합니다.
  if(!j.notify&&Array.isArray(cfg.rules)){for(const r of cfg.rules)if(r.then&&r.then.t==='publish'&&r.then.topic==='lab/notify'&&r.then.payload==='{"msg":"quiet"}')r.then={t:'notify',level:'info'};
    if(!cfg.rules.some(r=>r.then&&r.then.t==='notify'&&r.when.t==='motion'))cfg.rules.push(R4());}}}}catch(e){}
/* 기본으로 붙은 이름(카메라, 거실 …)은 화면 언어를 따라갑니다. 직접 바꾼 이름은 그대로 둡니다. */
for(const n of cfg.nodes)n.alias=I18N.alias(n.alias);
const S={source:'idle',simMixed:false,simEver:false,count:0,rate:0,lastTs:0,ver:1,
  csi:new Map(),rooms:new Map(),devs:new Map(),inputs:new Map(),led:{color:null,until:0},feed:[],log:[],session:null,sessions:[],fires:[],notes:[]};
let _c=0;setInterval(()=>{S.rate=S.rate*0.5+_c*0.5;_c=0;},1000);
function save(){S.ver++;try{localStorage.setItem(LSK,JSON.stringify(cfg));}catch(e){}}
function reset(){const b=cfg.broker,g=cfg.bring;cfg=defCfg();cfg.broker=b;cfg.bring=g||{};save();if(S.source==='demo'){clearState();}}
const pend=new Map();
function clearState(){pend.clear();S.csi.clear();S.rooms.clear();S.devs.clear();S.inputs.clear();S.feed.length=0;S.notes.length=0;S.led={color:null,until:0};}
const node=k=>cfg.nodes.find(n=>n.key===k);
/* 첫 실측 순서: 허브에서 받은 것만 기록합니다. 시뮬레이터가 섞인 동안에는 세지 않습니다. */
function mark(k,v){const b=cfg.bring||(cfg.bring={});if(k!=='cam'&&(S.source!=='live'||S.simMixed||S.simEver))return;
  if(k==='rooms'){const a=b.rooms||(b.rooms={list:[],ts:0});if(a.list.includes(v)||a.list.length>=8)return;a.list.push(v);a.ts=now();save();return;}
  if(!b[k]){b[k]=now();save();}}
function clearBring(){cfg.bring={};save();}
function ensureNode(key,type,alias){let n=node(key);if(n)return n;const slots=SLOTS[type]||SLOTS.ble,used=cfg.nodes.filter(x=>x.type===type).length,s=slots[used%slots.length];
  n={key,type,alias,x:s[0],y:s[1],sim:S.source==='demo'};cfg.nodes.push(n);save();return n;}
/* 데모로 넘어갈 때 실제 보드의 자리(배치)는 따로 보관했다가, 실측으로 돌아오면 되돌립니다. */
function park(){const real=cfg.nodes.filter(n=>!n.sim&&(n.type==='csi'||n.type==='ble'));if(!real.length)return;cfg.parked=(cfg.parked||[]).filter(p=>!real.some(r=>r.key===p.key)).concat(real);cfg.nodes=cfg.nodes.filter(n=>!real.includes(n));save();}
function unpark(){cfg.nodes=cfg.nodes.filter(n=>!n.sim);for(const n of cfg.parked||[])if(!node(n.key))cfg.nodes.push(n);cfg.parked=[];save();}
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
  if(S.log.length&&S.log[S.log.length-1].src!==src)S.log.length=0; // 기록 한 벌에는 한 출처만 담습니다. 데모를 보다가 허브에 연결하면 실측 기록이 새로 시작됩니다
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
      if(j.state!==n.state){n.state=j.state;if(j.state==='motion'){n.events.push({s:t,e:0,peak:+j.score});if(n.events.length>300)n.events.shift();feed(L`${node(n.key).alias}: 움직임 시작`,'motion');trigger({t:'motion',node:n.key});}
        else{const ev=n.events[n.events.length-1];if(ev&&!ev.e){ev.e=t;feed(L`${node(n.key).alias}: 움직임 끝 (${((ev.e-ev.s)/1000).toFixed(1)}초)`,'idle');}n.quietSince=t;n.quietDone=null;}}
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
    if(!was||was.on!==on){const ss=S.session;if(ss&&!ss.end&&ss.truth==='pir:'+key)label(on);if(on)feed(L`${roomName(p[2])} 입력 ${p[3].slice(6)}: 감지`,'ble');}}
  else if(topic===cfg.led.topic&&j){const c=j.seg&&j.seg[0]&&j.seg[0].col&&j.seg[0].col[0];if(j.on===false)S.led={color:null,until:0};else if(c)S.led={color:c.slice(0,3),until:now()+(j._sec||8)*1000};}
  else if(topic==='lab/sim/truth'&&j){const ss=S.session;if(ss&&!ss.end&&ss.truth==='sim'&&ss.node==='csi:'+j.node)label(!!j.on);}
  for(const f of subs)f(topic,text,src,!!retained);
}
/* ---- 전송 ---- */
let client=null;
function publish(topic,payload){if(S.source==='live'&&client){client.publish(topic,payload);}else if(S.source==='demo'&&window.Sim){Sim.onPublish(topic,payload);}}
function connect(url,user,pass,cb){if(!canLive){cb(L('이 페이지에서는 브라우저 정책 때문에 허브에 연결할 수 없습니다. PC에 내려받은 콘솔에서 연결하세요.'));return;}
  const desk=DESK&&url==='desktop';
  if(!desk&&typeof mqtt==='undefined'){cb(L('vendor/mqtt.min.js를 불러오지 못했습니다.'));return;}
  disconnect();cfg.broker={url,user};save();let done=false;
  client=desk?deskClient():mqtt.connect(url,{username:user,password:pass,reconnectPeriod:3000,connectTimeout:6000,clientId:'wavrel-console-'+Math.random().toString(16).slice(2,8)});
  client.on('connect',()=>{if(window.Sim)Sim.stop();if(S.source!=='live'){clearState();unpark();}S.source='live';if(!cfg.bring)cfg.bring={};if(!cfg.bring.broker){cfg.bring.broker=now();save();}
    client.subscribe(['espectre/v1/devices/+/motion','espectre/v1/devices/+/sensing','espectre/v1/devices/+/health','espresense/devices/#','espresense/rooms/+/+','lab/sim/active','lab/in/ask',cfg.led.topic]);
    feed(L('허브에 연결됨'),'sys');if(!done){done=true;cb(null);}});
  client.on('message',(t,b,pk)=>ingest(t,b.toString(),'live',!!(pk&&pk.retain)));
  client.on('error',e=>{if(S.source!=='live'&&client){try{client.end(true);}catch(x){}client=null;}if(!done){done=true;cb(L`연결하지 못했습니다: ${e&&e.message||L('알 수 없는 오류')}. 허브가 켜져 있는지, 사용자 이름과 비밀번호가 맞는지 확인하세요.`);}});
  client.on('close',()=>{if(S.source==='live')S.linkDown=true;});client.on('connect',()=>{S.linkDown=false;});}
/* 데스크톱 앱: MQTT.js 클라이언트와 같은 모양으로, 메인 프로세스의 허브가 넘겨 주는 메시지를 받습니다. */
/* 토픽 필터 맞춤: MQTT의 + 는 한 단계, # 는 그 아래 전부 */
function topicMatch(f,t){const a=f.split('/'),b=t.split('/');for(let i=0;i<a.length;i++){if(a[i]==='#')return true;if(i>=b.length||(a[i]!=='+'&&a[i]!==b[i]))return false;}return a.length===b.length;}
function deskClient(){const h={},em=(e,...a)=>(h[e]||[]).slice().forEach(f=>f(...a)),D=window.desktop,subs=[];let up=false,offM=null,offB=null;
  /* 내장 허브는 앱이 보낸 메시지를 기기 값으로 되돌려 보내지 않습니다. 보통의 허브는 구독 중인 토픽이면 보낸 쪽에도 돌려주고,
     콘솔은 그것을 받아 LED 표시와 기록을 갱신합니다. 같은 동작이 되도록, 허브가 받아들인 메시지 중 구독 중인 토픽은 여기서 돌려줍니다. */
  const c={on(e,f){(h[e]||(h[e]=[])).push(f);return c;},subscribe(l){for(const f of[].concat(l))if(typeof f==='string'&&!subs.includes(f))subs.push(f);},
    publish(t,p){const s=String(p);Promise.resolve(D.publish(t,s)).then(ok=>{if(ok&&up&&subs.some(f=>topicMatch(f,t)))em('message',t,s,{retain:false});},()=>{});},
    end(){if(offM)offM();if(offB)offB();offM=offB=null;}};
  const state=s=>{if(s.running&&!up){up=true;em('connect');D.replayRetained().then(l=>l.forEach(m=>em('message',m.topic,m.payload,{retain:true})));}else if(!s.running&&up){up=false;em('close');}};
  offM=D.onMessage(m=>em('message',m.topic,m.payload,{retain:!!m.retain}));offB=D.onBroker(state);
  D.status().then(s=>{if(s.running)state(s);else em('error',new Error(s.error==='PORT_IN_USE'?L('1883 포트를 다른 프로그램이 쓰고 있습니다'):L('허브가 꺼져 있습니다')));});return c;}
function disconnect(){stopReplay();if(client){try{client.end(true);}catch(e){}client=null;}if(S.source==='live'){S.source='idle';S.simMixed=false;}}
function demo(){disconnect();clearState();park();S.simEver=false;S.source='demo';feed(L('데모 시작: 내장 시뮬레이터가 보내는 값입니다'),'sys');if(window.Sim)Sim.start();}

/* ---- 자동화 ---- */
function hexRgb(h){return[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));}
function trigger(ev){const t=now();for(const r of cfg.rules){if(!r.on||r.when.t!==ev.t)continue;
  if(ev.t==='motion'&&r.when.node!=='*'&&r.when.node!==ev.node)continue;
  if(ev.t==='enter'&&r.when.room!==ev.room)continue;
  if(ev.t==='quiet'&&(ev.rule!==r.id||(r.when.node!=='*'&&r.when.node!==ev.node)))continue;
  if(t-r.last<3000)continue;r.last=t;r.fired++;run(r,ev);const nm=ruleName(r);S.fires.unshift({t,name:nm});if(S.fires.length>30)S.fires.pop();feed(L`자동화 실행: ${nm}`,'rule');}}
function run(r,ev){const a=r.then;if(a.t==='led'){publish(cfg.led.topic,JSON.stringify({on:true,bri:160,seg:[{col:[hexRgb(a.color)]}],_sec:a.sec}));}
  else if(a.t==='notify'){const m=noteOf(r,ev||{t:r.when.t,node:r.when.node,room:r.when.room});note(r.when.t,a.level||'alert',m[0],m[1]);}
  else if(a.t==='publish'){publish(a.topic,a.payload);}}
/* ---- 알림: 안경·휴대폰처럼 바깥 화면에 띄울 짧은 문장 ----
   토픽 하나(lab/out/notify)에 JSON 한 줄로 냅니다. 내장 허브에서는 앱만 이 토픽에 쓸 수 있어 기기가 알림을 꾸며 낼 수 없습니다.
   source는 값이 어디서 왔는지 그대로 적습니다. 시뮬레이터 값이면 받는 쪽 화면에도 그렇게 보여야 하기 때문입니다. */
const NOTIFY='lab/out/notify';let _n=0;
/* opt: 센서 값이 아닌 알림(모델의 답 등)은 출처와 표시 시간을 따로 적습니다. {source,ttl,re,model} */
function note(kind,level,title,body,opt){const t=now(),o=opt||{},n={v:1,id:'n'+t.toString(36)+(_n++%1296).toString(36),ts:t,kind,level:level==='alert'?'alert':'info',title:mask(title).slice(0,40),body:mask(body||'').slice(0,90),ttl:o.ttl>=2&&o.ttl<=60?Math.round(o.ttl):8,
    source:o.source||(S.source==='live'?(S.simEver||S.simMixed?'broker_with_simulator':'broker'):S.source==='replay'?'replay':'built_in_simulator')};
  if(o.re)n.re=String(o.re).slice(0,40);if(o.model)n.model=String(o.model).slice(0,40);
  S.notes.unshift(n);if(S.notes.length>30)S.notes.pop();publish(NOTIFY,JSON.stringify(n));return n;}
function noteOf(r,ev){const alias=k=>{const n=k&&k!=='*'&&node(k);return n?n.alias:L('Wi‑Fi 링크');};
  if(ev.t==='motion'){const n=ev.node&&S.csi.get(ev.node.slice(4)),sc=n&&n.last!=null?n.last.toFixed(2):'-';return[L`${alias(ev.node)}: 움직임`,n&&n.thr!=null?L`점수 ${sc} · 임계값 ${n.thr}`:L`점수 ${sc}`];}
  if(ev.t==='enter'){const d=ev.dev&&S.devs.get(ev.dev);return[L`${roomName(ev.room)}에 들어옴`,(d&&d.name)||(ev.dev?mask(ev.dev):L('고정한 기기'))];}
  return[L`${alias(ev.node)}: 조용함`,L`${span((r.when&&r.when.sec)||0)} 동안 움직임이 없습니다`];}
const span=sec=>sec>=60?L`${Math.round(sec/60)}분`:L`${sec}초`;
/* 규칙 이름은 저장해 둔 글자가 아니라 규칙의 내용에서 그때그때 만듭니다. 그래야 화면 언어를 바꿔도 이름이 따라 바뀝니다. */
function ruleName(r){const w=r.when||{},a=r.then||{},nd=w.node&&w.node!=='*'&&node(w.node);
  const when=w.t==='motion'?(nd?L`${nd.alias}에서 움직임이 시작되면`:L('움직임이 시작되면')):w.t==='enter'?L`고정한 기기가 ${roomName(w.room)}에 들어오면`:nd?L`${nd.alias}이(가) ${span(w.sec||0)} 동안 조용하면`:L`${span(w.sec||0)} 동안 조용하면`;
  const then=a.t==='led'?L('LED 색 바꾸기'):a.t==='notify'?L('알림 보내기'):L`${a.topic} 토픽으로 보내기`;
  return I18N.lang==='en'?when+', '+then.charAt(0).toLowerCase()+then.slice(1):when+' '+then;}
/* 조용함 규칙은 규칙마다 정한 시간이 따로 지나야 합니다. 1분 규칙이 울렸다고 5분 규칙까지 함께 울리면 안 됩니다. */
function quietTick(){const t=now();for(const n of S.csi.values()){if(n.state!=='idle'||!n.quietSince)continue;const done=n.quietDone||(n.quietDone=new Set());
    for(const r of cfg.rules){if(!r.on||r.when.t!=='quiet'||done.has(r.id)||t-n.quietSince<=r.when.sec*1000)continue;if(r.when.node!=='*'&&r.when.node!==n.key)continue;done.add(r.id);trigger({t:'quiet',node:n.key,rule:r.id});}}}
setInterval(()=>{quietTick();const t=now();
  if(S.led.color&&t>S.led.until)S.led={color:null,until:0};},1000);

/* ---- 검증 세션 ---- */
function sessionStart(nodeKey,truth){truth=truth||'manual';S.session={start:now(),end:0,node:nodeKey,labels:[],cur:null,truth,auto:truth!=='manual',source:S.source};
  if(cfg.notify&&cfg.notify.session)note('session','info',L`검증 시작: ${(node(nodeKey)||{alias:L('Wi‑Fi 링크')}).alias}`,truth==='manual'?L('지나가는 동안 표시 버튼을 누르고 계세요'):L('링크를 가로질러 걸어 보세요. 정답은 자동으로 적힙니다'));
  if(truth.startsWith('pir:')){const i=S.inputs.get(truth.slice(4));if(i&&i.on)label(true);}}
function label(on){const ss=S.session;if(!ss||ss.end)return;if(on&&!ss.cur){ss.cur={s:now(),e:0};ss.labels.push(ss.cur);}
  else if(!on&&ss.cur){const l=ss.cur,i=ss.labels.length;l.e=now();ss.cur=null;setTimeout(()=>passCheck(ss,l,i),2200);}} // 감지가 조금 늦게 잡힐 수 있어 2초쯤 기다렸다가 알립니다
/* 한 번 지나갈 때마다 감지됐는지 바로 알려 줍니다. 화면 앞으로 돌아오지 않고도 결과를 볼 수 있게 하려는 것입니다. */
function passCheck(ss,l,i){if(ss.end||ss!==S.session||!(cfg.notify&&cfg.notify.session))return null;const n=S.csi.get(ss.node.slice(4)),t=now();
  const hit=!!n&&n.events.some(e=>e.s<=l.e+2000&&(e.e||t)>=l.s-2000),st=sessionStats(ss);
  return note('session',hit?'info':'alert',hit?L`통과 ${i}: 감지됨`:L`통과 ${i}: 놓침`,st.falses?L`지금까지 ${st.hits}/${st.labels} 감지 · 오탐 ${st.falses}`:L`지금까지 ${st.hits}/${st.labels} 감지`);}
function sessionStats(ss){ss=ss||S.session;if(!ss)return null;const t=ss.end||now(),id=ss.node.slice(4),n=S.csi.get(id);
  const evs=(n?n.events:[]).filter(e=>(e.e||t)>=ss.start&&e.s<=t),ov=(e,l)=>e.s<=(l.e||t)+2000&&(e.e||t)>=l.s-2000;
  const hits=ss.labels.filter(l=>evs.some(e=>ov(e,l))).length,falses=evs.filter(e=>!ss.labels.some(l=>ov(e,l))).length;
  return{dur:(t-ss.start)/1000,labels:ss.labels.length,hits,miss:ss.labels.length-hits,falses,events:evs.length,recall:ss.labels.length?hits/ss.labels.length:null};}
/* 세션이 끝날 때 리포트에 쓸 점수 곡선을 줄여서 함께 남깁니다 (구간별 최댓값, 최대 600점). */
function traceOf(ss){const n=S.csi.get(ss.node.slice(4)),a=ss.start-3000,b=ss.end+1000,pts=n?n.score.filter(p=>p.t>=a&&p.t<=b):[],k=Math.max(1,Math.ceil(pts.length/600)),out=[];
  for(let i=0;i<pts.length;i+=k){let m=pts[i];for(let q=i+1;q<Math.min(pts.length,i+k);q++)if(pts[q].v>m.v)m=pts[q];out.push([m.t-ss.start,+m.v.toFixed(3)]);}
  return{thr:n?n.thr:null,pts:out,labels:ss.labels.map(l=>[l.s-ss.start,(l.e||ss.end)-ss.start]),events:(n?n.events:[]).filter(e=>(e.e||ss.end)>=ss.start&&e.s<=ss.end).map(e=>[e.s-ss.start,(e.e||ss.end)-ss.start,+e.peak.toFixed(3)])};}
function sessionStop(){const ss=S.session;if(!ss||ss.end)return;label(false);ss.end=now();const st=sessionStats(ss);S.sessions.unshift(Object.assign({node:ss.node,alias:(node(ss.node)||{alias:mask(ss.node)}).alias,start:ss.start,end:ss.end,auto:ss.auto,truth:ss.truth,source:ss.source,sim:ss.source!=='live'||S.simEver||S.simMixed,trace:traceOf(ss)},st));if(ss.source==='live'&&st.labels>=3)mark('session');
  if(cfg.notify&&cfg.notify.session)note('session',st.miss||st.falses?'alert':'info',L`검증 끝: ${st.hits}/${st.labels} 감지`,st.recall==null?L`놓침 ${st.miss} · 오탐 ${st.falses}`:L`놓침 ${st.miss} · 오탐 ${st.falses} · 재현율 ${Math.round(st.recall*100)}%`);}
/* ---- 기록 재생: 내려받은 JSONL을 같은 수신 경로로 다시 흘립니다 ---- */
let rp=null;
function stopReplay(){if(rp){clearTimeout(rp.timer);rp=null;if(S.source==='replay')S.source='idle';}}
function replay(text,speed,cb){const rows=[];let head=null;for(const ln of String(text).split('\n')){if(!ln.trim())continue;let o;try{o=JSON.parse(ln);}catch(e){continue;}if(/^(wavrel|sentinel-lab)(-p1)?-log$/.test(o.kind)){head=o;continue;}if(o.topic&&o.t&&typeof o.payload==='string'){const t=Date.parse(o.t);if(!isNaN(t))rows.push([t,o.topic,o.payload]);}}
  if(!rows.length){cb(L('재생할 메시지를 찾지 못했습니다. 콘솔에서 내려받은 JSONL 파일인지 확인하세요.'));return;}
  disconnect();if(window.Sim)Sim.stop();clearState();unpark();S.source='replay';S.replayInfo={total:rows.length,done:0,origin:head?head.data_source:'unknown'};S.simEver=!head||head.data_source!=='broker';
  rp={i:0,timer:null};const sp=speed||1,step=()=>{if(!rp)return;const r=rows[rp.i++];ingest(r[1],r[2],'replay');S.replayInfo.done=rp.i;if(rp.i>=rows.length){feed(L('재생 끝'),'sys');rp=null;return;}rp.timer=setTimeout(step,Math.min(2000,Math.max(0,(rows[rp.i][0]-r[0])/sp)));};
  feed(L`기록 재생 시작: ${rows.length}건`,'sys');step();cb(null,rows.length);}
function report(){const rows=[L('| 시작 | 노드 | 길이 | 정답 구간 | 감지 | 놓침 | 오탐 | 재현율 | 정답 출처 | 데이터 |'),'|---|---|---|---|---|---|---|---|---|---|'];
  for(const s of S.sessions){rows.push('| '+new Date(s.start).toISOString().slice(0,19).replace('T',' ')+' | '+(s.alias||mask(s.node))+' | '+L`${Math.round(s.dur)}초`+' | '+s.labels+' | '+s.hits+' | '+s.miss+' | '+s.falses+' | '+(s.recall==null?'-':Math.round(s.recall*100)+'%')+' | '+(s.truth==='manual'?L('버튼'):s.truth==='sim'?L('시뮬레이터'):L('PIR 입력'))+' | '+(s.source==='live'&&!(s.sim??S.simEver)?L('허브 수신 (운영자 확인 필요)'):'SIMULATED')+' |');}
  return rows.join('\n');}
function exportLog(){const o=S.log.length?S.log[0].src:S.source==='live'?'live':S.source==='replay'?'replay':'sim'; // 지금 화면이 아니라 기록에 실제로 담긴 출처를 적습니다
  const sim=o!=='live'||S.simEver||S.simMixed||S.log.some(l=>l.src!==o);if(!sim)mark('export');
  const head={kind:'wavrel-log',exported_at:new Date().toISOString(),data_source:o==='live'?(sim?'broker_with_simulator':'broker'):o==='replay'?'replay':'built_in_simulator',verification:sim?'SIMULATED':'OPERATOR_TO_CONFIRM',messages:S.log.length,
    sessions:S.sessions.map(x=>Object.assign({},x,{node:mask(x.node)})),note:L('식별자는 앞 4자만 남기고 가렸습니다.')};
  return JSON.stringify(head)+'\n'+S.log.map(l=>JSON.stringify(l)).join('\n')+'\n';}
return{S,get cfg(){return cfg;},canLive,now,clamp,mask,save,reset,node,roomName,ingest,publish,connect,disconnect,demo,on:f=>subs.push(f),feed,
  sessionStart,sessionStop,sessionStats,label,exportLog,replay,stopReplay,report,mark,clearBring,hexRgb,ROOM_KO,note,passCheck,NOTIFY,quietTick,ruleName,topicMatch};
})();
