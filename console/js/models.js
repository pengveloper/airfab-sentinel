/* 모델 화면: 이 PC(또는 집 안 망)의 Ollama에 설치한 공개 모델에 같은 질문을 던지고 답과 시간을 나란히 봅니다.
   휴대폰·안경에서 lab/in/ask로 들어온 질문에도 여기서 고른 모델이 답하고, 답은 알림 토픽으로 나갑니다.
   창은 모델 서버에 직접 닿지 않습니다. 데스크톱 앱의 메인 프로세스가 주소를 확인한 뒤 대신 묻습니다. */
window.Models=(()=>{'use strict';
const $=s=>document.querySelector(s),S=Lab.S,D=window.desktop||null;
const ASK='lab/in/ask';
const st={ok:false,url:'',models:[],error:null,busy:false,runs:[],asks:[]};
const cfg=()=>{const c=Lab.cfg;if(!c.models)c.models={pick:[],glass:false,gmodel:'',len:512};return c.models;};
const fmtSize=b=>b>=1e9?(b/1e9).toFixed(1)+' GB':b>=1e6?Math.round(b/1e6)+' MB':'';
const secs=ms=>ms==null?'-':(ms/1000).toFixed(ms<10000?1:0);
const ERR={NOT_RUNNING:()=>L('모델 서버에 닿지 않습니다. 이 PC에서 Ollama가 켜져 있는지 확인하세요.'),NO_SUCH_MODEL:()=>L('서버에 그 모델이 없습니다. 목록을 다시 찾아 보세요.'),
  TIMEOUT:()=>L('3분 안에 답이 오지 않았습니다. 더 작은 모델을 골라 보세요.'),BAD_RESPONSE:()=>L('모델 서버가 알아볼 수 없는 답을 보냈습니다.'),SERVER_ERROR:()=>L('모델 서버가 오류를 냈습니다.'),
  TOO_LARGE:()=>L('답이 너무 커서 버렸습니다.'),BAD_MODEL:()=>L('쓸 수 없는 모델 이름입니다.'),BAD_PROMPT:()=>L('질문이 비었거나 너무 깁니다.')};
const errText=(e,d)=>(ERR[e]?ERR[e]():L('알 수 없는 오류입니다.'))+(d?' ('+d+')':'');

/* ---- 화면 ---- */
function drawState(){const chip=$('#md-state'),note=$('#md-note');
  if(!D){chip.className='chip';chip.textContent=L('데스크톱 앱 전용');note.textContent=L('브라우저 데모에서는 모델을 돌리지 않습니다. 데스크톱 앱이 이 PC에 설치한 Ollama에 질문을 보냅니다.');return;}
  chip.className='chip '+(st.ok?'live':st.error?'bad':'');chip.textContent=st.ok?L`모델 ${st.models.length}개`:st.error?L('찾지 못함'):L('확인 중');
  note.textContent=st.ok?(st.models.length?L('묻고 싶은 모델을 고르세요. 노트북 그래픽카드 메모리가 8GB면 4~8B 크기가 알맞습니다.'):L('Ollama는 켜져 있지만 받은 모델이 없습니다. 터미널에서 ollama pull로 모델을 받은 뒤 다시 찾으세요.')):st.error?errText(st.error):'';}
function drawList(){const ul=$('#md-list'),c=cfg();
  if(!D||!st.models.length){ul.innerHTML='';return;}
  ul.innerHTML='';for(const m of st.models){const li=document.createElement('li'),lab=document.createElement('label'),cb=document.createElement('input'),b=document.createElement('b'),k=document.createElement('span');
    cb.type='checkbox';cb.value=m.name;cb.checked=c.pick.includes(m.name);lab.className='inl';b.textContent=m.name;k.className='kv';k.textContent=[m.params,m.quant,fmtSize(m.size)].filter(Boolean).join(' · ');
    lab.append(cb,b);li.append(lab,k);ul.append(li);}
  const sel=$('#md-gmodel');sel.innerHTML='';const none=document.createElement('option');none.value='';none.textContent=L('고르지 않음');sel.append(none);
  for(const m of st.models){const o=document.createElement('option');o.value=m.name;o.textContent=m.name;sel.append(o);}sel.value=st.models.some(m=>m.name===c.gmodel)?c.gmodel:'';
  picked();if(window.Look)Look.models();}
function picked(){const n=cfg().pick.filter(p=>st.models.some(m=>m.name===p)).length;$('#md-picked').textContent=n?L`모델 ${n}개 고름`:'';$('#md-run').disabled=!D||!n||st.busy;}
function card(run){const el=document.createElement('article');el.className='md-card';
  const h=document.createElement('header'),name=document.createElement('b'),chip=document.createElement('span'),stat=document.createElement('p'),body=document.createElement('p');
  name.textContent=run.model;chip.className='chip '+(run.state==='done'?'live':run.state==='fail'?'bad':'hot');chip.textContent=run.state==='done'?L('답함'):run.state==='fail'?L('실패'):run.state==='wait'?L('차례 기다림'):L('답하는 중');
  stat.className='kv';stat.textContent=run.state==='done'?[L`${secs(run.r.ms)}초`,run.r.tokensPerSec!=null?L`초당 ${run.r.tokensPerSec} 토큰`:'',run.r.loadMs>500?L`불러오기 ${secs(run.r.loadMs)}초`:''].filter(Boolean).join(' · '):'';
  body.className='md-text';body.textContent=run.state==='done'?run.r.text||L('(빈 답)'):run.state==='fail'?errText(run.r.error,run.r.detail):'';
  h.append(name,chip);el.append(h,stat,body);return el;}
function drawRuns(){const out=$('#md-out');out.innerHTML='';
  if(!D){const p=document.createElement('div');p.className='panel md-empty';p.innerHTML=L('<h3>이 PC에서 모델을 돌리려면</h3><ol><li>ollama.com에서 Ollama를 설치합니다.</li><li>터미널에서 <code>ollama pull 모델이름</code>으로 모델을 받습니다.</li><li>Wavrel 데스크톱 앱의 이 화면에서 다시 찾기를 누릅니다.</li></ol>');out.append(p);return;}
  if(!st.runs.length){const p=document.createElement('p');p.className='muted md-hint';p.textContent=L('질문을 쓰고 모델을 고른 뒤 묻기를 누르면, 모델마다 답과 걸린 시간이 여기에 나란히 나옵니다.');out.append(p);return;}
  for(const r of st.runs)out.append(card(r));}
function drawAsks(){const ol=$('#md-asks');ol.innerHTML='';
  if(!st.asks.length){const li=document.createElement('li');li.className='none';li.textContent=L('아직 들어온 질문이 없습니다.');ol.append(li);return;}
  for(const a of st.asks){const li=document.createElement('li'),t=document.createElement('time'),d=document.createElement('span');t.textContent=new Date(a.t).toTimeString().slice(0,8);
    d.textContent=a.q+(a.a?' → '+a.a:a.err?' → '+a.err:' …');if(a.err)li.className='sys';li.append(t,d);ol.append(li);}}

/* ---- 모델 찾기, 묻기 ---- */
async function refresh(){if(!D)return;st.error=null;st.ok=false;drawState();
  const r=await D.models();Object.assign(st,{ok:r.ok,url:r.url,models:r.models||[],error:r.ok?null:r.error});
  const u=$('#md-url');if(document.activeElement!==u)u.value=st.url;drawState();drawList();}
async function run(e){if(e)e.preventDefault();if(!D||st.busy)return;const prompt=$('#md-prompt').value.trim();if(!prompt){$('#md-prompt').focus();return;}
  const list=cfg().pick.filter(p=>st.models.some(m=>m.name===p));if(!list.length)return;const max=Number($('#md-len').value)||512;cfg().len=max;Lab.save();
  st.busy=true;picked();st.runs=list.map((model,i)=>({model,state:i?'wait':'run',r:null}));drawRuns();
  for(const run of st.runs){run.state='run';drawRuns();const r=await D.ask(run.model,prompt,{maxTokens:max});run.r=r;run.state=r.ok?'done':'fail';drawRuns();}
  st.busy=false;picked();}
/* 센서 기록으로 질문 만들기: 최근 기록 몇 줄과 출처를 붙입니다. 시뮬레이터 값이면 그렇다고 적습니다. */
function sensorPrompt(){const src=S.source==='live'?(S.simEver||S.simMixed?L('허브 수신, 시뮬레이터 값 섞임'):L('허브 수신 실측')):S.source==='replay'?L('기록 재생'):L('내장 시뮬레이터');
  const lines=S.feed.slice(0,24).reverse().map(f=>new Date(f.t).toTimeString().slice(0,8)+' '+f.txt);
  return L`다음은 Wavrel 콘솔의 최근 센서 기록입니다. 출처: ${src}.`+'\n'+lines.join('\n')+'\n\n'+L('무슨 일이 있었는지 세 문장 이내로 요약하세요. 기록만으로 알 수 없는 것은 그렇다고 말하세요.');}

/* ---- 안경 질문: lab/in/ask → 모델 → lab/out/notify ---- */
const SEE={ko:'함께 보낸 사진은 집 카메라가 방금 찍은 것이다. 사진에서 보이는 것만 말한다.',en:'The attached picture was just taken by the home camera. Say only what it shows.',zh:'附带的照片是家里摄像头刚拍的。只说照片里能看到的。'};
const SYS={ko:'너는 스마트 안경 렌즈에 뜨는 짧은 답을 쓴다. 한국어로 80자 이내, 한두 문장으로 답한다. 마크다운, 목록, 이모지는 쓰지 않는다. 모르면 모른다고 한다.',
  en:'You write short answers shown on a smart-glasses lens. Answer in English in at most 80 characters, one or two sentences. No markdown, lists or emoji. If you are not sure, say so.',
  zh:'你为智能眼镜镜片写简短的回答。用中文回答，不超过40个字，一两句话。不要使用Markdown、列表或表情符号。不确定时就说不确定。'};
const clean=s=>String(s).replace(/[\u0000-\u001f\u007f]+/g,' ').replace(/[*_#`>~|]/g,'').replace(/\s+/g,' ').trim();
const cut=(s,n)=>{const a=Array.from(s);return a.length>n?a.slice(0,n-1).join('')+'…':s;};
let pending=0,lastAt=0;
function parseAsk(text){let j;try{j=JSON.parse(text);}catch(e){return null;}if(!j||j.v!==1||typeof j.text!=='string')return null;
  const q=cut(clean(j.text),300);if(!q)return null;return{id:typeof j.id==='string'?j.id.slice(0,40):'',q,lang:j.lang==='en'||j.lang==='ko'||j.lang==='zh'?j.lang:I18N.lang};}
async function onAsk(topic,text,src,retained){if(topic!==ASK||src!=='live'||retained||!D)return; // 보관된 예전 질문에는 답하지 않습니다
  const a=parseAsk(text);if(!a)return;const c=cfg(),t=Lab.now();
  const entry={t,q:a.q,a:'',err:''};st.asks.unshift(entry);if(st.asks.length>20)st.asks.pop();
  const reply=(body,err,model)=>{Lab.note('answer','info',cut(a.q,40),body,{source:'local_model',ttl:15,re:a.id,model});if(err)entry.err=body;else entry.a=body;drawAsks();};
  if(!c.glass||!c.gmodel){reply(L('PC에서 질문 답하기가 꺼져 있습니다. Wavrel 모델 화면에서 켜세요.'),true);return;}
  if(pending>=2||t-lastAt<1500){reply(L('앞의 질문에 답하는 중입니다. 잠시 뒤에 다시 물어 주세요.'),true);return;}
  pending++;lastAt=t;drawAsks();
  try{const m=st.models.find(x=>x.name===c.gmodel),cam=Lab.cfg.cam&&Lab.cfg.cam.url;
    // 켜 두면 사진을 읽는 모델은 카메라 사진 한 장을 함께 봅니다. 사진을 못 찍으면 글로만 묻습니다.
    let r=c.gcam&&cam&&m&&m.vision?await D.look(c.gmodel,a.q,cam,{system:SYS[a.lang]+' '+SEE[a.lang],maxTokens:96}):null;
    if(!r||(!r.ok&&/^CAMERA_/.test(r.error||'')))r=await D.ask(c.gmodel,a.q,{system:SYS[a.lang],maxTokens:96});
    if(r.ok&&clean(r.text))reply(cut(clean(r.text),90),false,c.gmodel);else reply(r.ok?L('모델이 빈 답을 냈습니다.'):errText(r.error),true,c.gmodel);}
  finally{pending--;}}

/* ---- 연결 ---- */
function wire(){const c=cfg();
  $('#md-len').value=String(c.len||512);$('#md-glass').checked=!!c.glass;
  $('#md-form').addEventListener('submit',run);
  $('#md-sensors').addEventListener('click',()=>{$('#md-prompt').value=sensorPrompt();$('#md-prompt').focus();});
  $('#md-list').addEventListener('change',e=>{const cb=e.target;if(cb.type!=='checkbox')return;const p=cfg().pick.filter(x=>x!==cb.value);if(cb.checked)p.push(cb.value);cfg().pick=p;Lab.save();picked();});
  $('#md-glass').addEventListener('change',e=>{cfg().glass=e.target.checked;Lab.save();});
  $('#md-gmodel').addEventListener('change',e=>{cfg().gmodel=e.target.value;Lab.save();});
  $('#md-refresh').addEventListener('click',refresh);
  $('#md-save').addEventListener('click',async()=>{if(!D)return;const r=await D.setModelServer($('#md-url').value.trim());
    if(!r.ok){$('#md-note').textContent=L('이 PC나 집 안 망의 주소만 쓸 수 있습니다. 예: http://127.0.0.1:11434');$('#md-url').value=r.url;return;}refresh();});
  for(const id of['#md-url','#md-save','#md-refresh','#md-glass','#md-gmodel','#md-sensors','#md-prompt','#md-len'])$(id).disabled=!D;
  Lab.on(onAsk);drawState();drawList();drawRuns();drawAsks();picked();if(D)refresh();}
return{wire,refresh,parseAsk,onAsk,sensorPrompt,ASK,list:()=>st.models,cfg,update(){}};
})();
