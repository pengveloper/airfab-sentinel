/* Wavrel Console: 검증 리포트. 끝낸 세션을 혼자 열리는 HTML 한 장으로 만듭니다. 바깥으로 나가는 요청이 없습니다. */
window.Report=(()=>{'use strict';
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const p2=n=>String(n).padStart(2,'0');
const dt=ts=>{const d=new Date(ts);return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())+' '+p2(d.getHours())+':'+p2(d.getMinutes())+':'+p2(d.getSeconds());};
const real=s=>s.source==='live'&&!s.sim;
const truthKo=v=>v==='manual'?L('사람이 누른 버튼'):v==='sim'?L('시뮬레이터가 표시'):L('PIR 센서 입력');
function chart(s){const tr=s.trace;if(!tr||!tr.pts.length)return L('<p class="none">이 세션에는 저장된 점수 곡선이 없습니다.</p>');
  const W=960,H=230,ML=44,R=12,T=14,B=30,dur=Math.max(1000,s.end-s.start),thr=tr.thr||0.5,max=Math.max(thr*2,...tr.pts.map(p=>p[1]))*1.08;
  const X=ms=>ML+Math.max(0,Math.min(1,ms/dur))*(W-ML-R),Y=v=>T+(1-v/max)*(H-T-B);
  let g='';const stepS=dur<=30000?5:dur<=120000?15:dur<=600000?60:300;
  for(let t=0;t<=dur/1000;t+=stepS)g+=`<line x1="${X(t*1000).toFixed(1)}" y1="${T}" x2="${X(t*1000).toFixed(1)}" y2="${H-B}" class="gl"/><text x="${X(t*1000).toFixed(1)}" y="${H-10}" class="ax" text-anchor="middle">${L`${t}초`}</text>`;
  for(let i=0;i<=3;i++){const v=max*i/3;g+=`<line x1="${ML}" y1="${Y(v).toFixed(1)}" x2="${W-R}" y2="${Y(v).toFixed(1)}" class="gl"/><text x="${ML-6}" y="${(Y(v)+4).toFixed(1)}" class="ax" text-anchor="end">${v.toFixed(2)}</text>`;}
  const ev=tr.events.map(e=>`<rect x="${X(e[0]).toFixed(1)}" y="${T}" width="${Math.max(2,X(e[1])-X(e[0])).toFixed(1)}" height="${H-T-B}" class="ev"/>`).join('');
  const lb=tr.labels.map(l=>`<rect x="${X(l[0]).toFixed(1)}" y="${T}" width="${Math.max(2,X(l[1])-X(l[0])).toFixed(1)}" height="7" class="lb"/>`).join('');
  const line=tr.pts.filter(p=>p[0]>=0).map((p,i)=>(i?'L':'M')+X(p[0]).toFixed(1)+' '+Y(p[1]).toFixed(1)).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${L`세션 동안의 움직임 점수. 정답 구간 ${tr.labels.length}개, 감지 구간 ${tr.events.length}개.`}"><g>${g}</g>${ev}${lb}<line x1="${ML}" y1="${Y(thr).toFixed(1)}" x2="${W-R}" y2="${Y(thr).toFixed(1)}" class="th"/><path d="${line}" class="sc"/></svg>`;}
function plan(cfg){const W=520,k=Math.min((W-40)/cfg.room.w,300/cfg.room.h),w=cfg.room.w*k,h=cfg.room.h*k,ox=20,oy=20,H=h+40;
  const col={csi:'#ecb955',ble:'#9cc6ff',cam:'#b9a8ff',led:'#ecb955'},dot=(n,c,t)=>`<circle cx="${(ox+n.x*k).toFixed(1)}" cy="${(oy+n.y*k).toFixed(1)}" r="5" fill="${c}"/><text x="${(ox+n.x*k+9).toFixed(1)}" y="${(oy+n.y*k+4).toFixed(1)}" class="ax">${esc(t)}</text>`;
  const links=cfg.nodes.filter(n=>n.type==='csi').map(n=>`<line x1="${(ox+n.x*k).toFixed(1)}" y1="${(oy+n.y*k).toFixed(1)}" x2="${(ox+cfg.router.x*k).toFixed(1)}" y2="${(oy+cfg.router.y*k).toFixed(1)}" class="th"/>`).join('');
  return `<svg viewBox="0 0 ${W} ${H.toFixed(0)}" role="img" aria-label="${L`방 ${cfg.room.w}m × ${cfg.room.h}m 안의 노드 배치`}"><rect x="${ox}" y="${oy}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" class="room"/>${links}${cfg.nodes.map(n=>dot(n,col[n.type]||'#9cc6ff',n.alias)).join('')}${dot(cfg.router,'#e8eef6',L('공유기'))}</svg>`;}
function build(){const S=Lab.S,cfg=Lab.cfg,ss=S.sessions.slice().reverse(),anyReal=ss.some(real),allReal=ss.length>0&&ss.every(real);
  const sum=ss.reduce((a,s)=>{a.labels+=s.labels;a.hits+=s.hits;a.miss+=s.miss;a.falses+=s.falses;a.dur+=s.dur;return a;},{labels:0,hits:0,miss:0,falses:0,dur:0});
  const recall=sum.labels?Math.round(sum.hits/sum.labels*100)+'%':'—',fpm=sum.dur?(sum.falses/(sum.dur/60)).toFixed(2):'—';
  const banner=allReal?L('<p class="tag ok">데이터: 브로커에서 받은 메시지. 보드가 실제로 보낸 값인지는 운영자가 확인합니다.</p>'):anyReal?L('<p class="tag warn">데이터: 브로커 수신과 시뮬레이션이 섞여 있습니다. 세션마다 표시를 확인하세요.</p>'):L('<p class="tag sim">데이터: SIMULATED. 시뮬레이터가 만든 값이며 하드웨어 결과가 아닙니다.</p>');
  const sess=ss.map((s,i)=>`<section class="sess"><h3>${L`세션 ${i+1} · ${esc(s.alias||Lab.mask(s.node))}`}</h3>
<p class="meta">${L`${dt(s.start)} 시작, ${Math.round(s.dur)}초 · 정답 출처: ${truthKo(s.truth||'manual')} · ${real(s)?L('<b class="ok">브로커 수신</b>'):'<b class="sim">SIMULATED</b>'}${s.trace&&s.trace.thr!=null?L` · 임계값 ${s.trace.thr}`:''}`}</p>
${chart(s)}
<table><thead><tr><th>${L`정답 구간`}</th><th>${L`감지함`}</th><th>${L`놓침`}</th><th>${L`오탐`}</th><th>${L`재현율`}</th></tr></thead><tbody><tr><td>${s.labels}</td><td>${s.hits}</td><td>${s.miss}</td><td>${s.falses}</td><td>${s.recall==null?'—':Math.round(s.recall*100)+'%'}</td></tr></tbody></table></section>`).join('');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${L`Wavrel 검증 리포트`}</title><style>
:root{--bg:#05080d;--fg:#e8eef6;--mu:#93a1b3;--ln:#1c2a3c;--gold:#ecb955;--blue:#9cc6ff;--vio:#b9a8ff;--ok:#5fd3a2;--warn:#ffb057;--pn:#0a1019}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 "IBM Plex Sans KR","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;word-break:keep-all}
main{max-width:1000px;margin:0 auto;padding:48px 24px 72px}
h1{font:800 clamp(34px,6vw,64px)/1 "Archivo","Arial Narrow",system-ui,sans-serif;letter-spacing:-.02em;margin:0 0 10px}
h2{font-size:22px;margin:44px 0 12px}h3{font-size:17px;margin:0 0 4px}
p{margin:0 0 10px;max-width:42em}.lead{color:var(--mu)}.meta{color:var(--mu);font-size:14px;max-width:none}
.tag{display:inline-block;border:1px solid var(--ln);border-radius:4px;padding:8px 12px;font-size:14.5px;margin-top:8px}
.tag.sim{border-color:rgba(185,168,255,.5);color:var(--vio)}.tag.ok{border-color:rgba(95,211,162,.5);color:var(--ok)}.tag.warn{border-color:rgba(255,176,87,.5);color:var(--warn)}
b.ok{color:var(--ok)}b.sim{color:var(--vio)}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));background:var(--pn);border:1px solid var(--ln);margin-top:8px}
.tiles div{padding:14px 16px;box-shadow:0 0 0 .5px var(--ln)}.tiles b{display:block;font:800 30px/1.1 "Archivo","Arial Narrow",system-ui,sans-serif;font-variant-numeric:tabular-nums}.tiles span{color:var(--mu);font-size:13.5px}
.sess{border:1px solid var(--ln);background:var(--pn);padding:18px;margin-top:14px;break-inside:avoid}
svg{width:100%;height:auto;display:block;margin:8px 0}
.gl{stroke:var(--ln);stroke-width:1}.ax{fill:var(--mu);font:11px ui-monospace,Consolas,monospace}
.sc{fill:none;stroke:var(--gold);stroke-width:1.6;stroke-linejoin:round}.th{stroke:var(--warn);stroke-width:1;stroke-dasharray:4 4}
.ev{fill:rgba(236,185,85,.16)}.lb{fill:var(--blue)}.room{fill:none;stroke:var(--mu);stroke-width:1}
table{border-collapse:collapse;width:100%;font-size:14.5px;margin-top:6px}th,td{text-align:left;padding:8px 10px;border-top:1px solid var(--ln);font-variant-numeric:tabular-nums}th{color:var(--mu);font-weight:500}
.key{display:flex;flex-wrap:wrap;gap:6px 18px;color:var(--mu);font-size:13.5px;margin:4px 0 0}.key i{display:inline-block;width:14px;height:8px;margin-right:6px;vertical-align:middle}
ul{padding-left:1.2em;margin:0;max-width:44em}li{margin:4px 0}.none{color:var(--mu)}
@media print{:root{--bg:#fff;--fg:#111;--mu:#555;--ln:#ccc;--pn:#fff;--gold:#9a6a00;--blue:#1f5fbf;--vio:#5b3fc4;--ok:#0b7a4b;--warn:#b35a00}main{padding:0}.ev{fill:rgba(154,106,0,.15)}}
</style></head><body><main>
<h1>${L`Wavrel 검증 리포트`}</h1>
<p class="lead">${L`Wi‑Fi 신호(CSI)만으로 움직임을 감지한 결과를, 따로 기록한 정답 구간과 맞춰 본 기록입니다. ${dt(Lab.now())} 작성.`}</p>
${banner}
<h2>${L`요약`}</h2>
<div class="tiles"><div><b>${ss.length}</b><span>${L`세션`}</span></div><div><b>${sum.labels}</b><span>${L`정답 구간`}</span></div><div><b>${sum.hits}</b><span>${L`감지함`}</span></div><div><b>${sum.miss}</b><span>${L`놓침`}</span></div><div><b>${sum.falses}</b><span>${L`오탐`}</span></div><div><b>${recall}</b><span>${L`재현율`}</span></div><div><b>${fpm}</b><span>${L`분당 오탐`}</span></div></div>
<h2>${L`세션`}</h2>
<p class="key"><span><i style="background:var(--gold)"></i>${L`움직임 점수`}</span><span><i style="background:var(--blue)"></i>${L`정답 구간`}</span><span><i style="background:rgba(236,185,85,.3)"></i>${L`감지 구간`}</span><span><i style="background:var(--warn)"></i>${L`임계값`}</span></p>
${sess||L('<p class="none">끝낸 세션이 없습니다.</p>')}
<h2>${L`배치`}</h2>
<p class="meta">${L`방 ${cfg.room.w}m × ${cfg.room.h}m. 점선은 감지 보드와 공유기 사이의 링크입니다. 이름은 별칭이고 기기 식별자는 넣지 않았습니다.`}</p>
${plan(cfg)}
<h2>${L`판정 방법`}</h2>
<ul><li>${L`정답 구간은 사람이 실제로 링크를 지나간 시간입니다. 출처는 세션마다 적혀 있습니다.`}</li><li>${L`감지 구간이 정답 구간과 앞뒤 2초 안에서 겹치면 감지한 것으로 셉니다.`}</li><li>${L`어떤 정답 구간과도 겹치지 않은 감지 구간은 오탐입니다.`}</li><li>${L`재현율은 정답 구간 가운데 감지한 비율입니다.`}</li></ul>
<h2>${L`이 리포트가 말하지 않는 것`}</h2>
<ul><li>${L`브로커 수신으로 표시된 세션도 메시지를 받았다는 기록입니다. 하드웨어 검증 판정은 보드, 펌웨어 버전, 실행한 사람과 함께 따로 적습니다.`}</li><li>${L`다른 방, 다른 공유기, 다른 보드 위치에서의 성능은 이 결과로 알 수 없습니다.`}</li><li>${L`사람 수, 자세, 위치는 재지 않았습니다. 움직임이 있었는지만 봅니다.`}</li></ul>
</main></body></html>`;}
return{build};
})();
