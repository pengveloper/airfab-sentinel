/* 3D 공간.
   바닥: 1m 격자, 공유기에서 퍼지는 파면, 감지 링크마다 프레넬 영역(링크를 지나는 몸이 신호를 흔드는 구역).
   링크 위의 막: 최근 14초의 움직임 점수. 임계값을 넘은 부분은 금색으로 바뀝니다.
   값은 모두 Lab.S에서 읽습니다. 여기서 만들어 내는 데이터는 없습니다. */
window.Space=(()=>{'use strict';
let R=null,scene,cam,root,floor,host,labels,ver=-1,objs={},yaw=-0.62,pitch=0.5,vel=0,drag=null,ok=false,sw=0,sh=0,t0=null,px=0,py=0,ox=0,oy=0,glow=null,dust=null,pad=0;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const SEG=84,WINDOW=14000,HMAX=1.75,HK=3.2,GOLD=0xecb955,BLUE=0x9cc6ff,VIO=0xb9a8ff,PAPER=0xe8eef6;

const VS='varying vec2 vP;void main(){vP=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
const FS=`precision highp float;
varying vec2 vP;uniform float uT;uniform vec2 uSize;uniform vec2 uRouter;uniform vec3 uN[6];uniform int uCnt;uniform vec3 uLed;uniform vec3 uLedCol;
float grid(vec2 p,float s){vec2 q=p/s;vec2 g=abs(fract(q-.5)-.5)/fwidth(q);return 1.-min(min(g.x,g.y),1.);}
void main(){
  vec2 p=vec2(vP.x+uSize.x*.5,uSize.y*.5-vP.y);
  vec3 blue=vec3(.61,.78,1.),gold=vec3(.93,.73,.33);
  float out_=max(max(-p.x,p.x-uSize.x),max(-p.y,p.y-uSize.y));
  float inside=1.-smoothstep(-.015,.015,out_);
  float fall=exp(-max(out_,0.)*.62);
  float g=grid(p,1.);
  vec2 c0=(p-uSize*.5)/uSize;
  vec3 col=(vec3(.018,.03,.054)+vec3(.02,.034,.06)*max(1.-length(c0)*1.5,0.))*inside;
  float a=inside*.8;
  col+=blue*g*(.035+.1*inside)*fall;a+=g*.4*fall;
  float dr=distance(p,uRouter);
  float rw=pow(.5+.5*sin(dr*4.4-uT*1.5),20.)*exp(-dr*.3);
  col+=blue*rw*.2*inside;a+=rw*.14*inside;
  for(int i=0;i<6;i++){
    if(i>=uCnt)break;
    vec2 n=uN[i].xy;float e=uN[i].z;
    float dd=distance(p,n)+distance(p,uRouter)-distance(n,uRouter);
    vec3 c=mix(blue,gold,smoothstep(.04,.6,e));
    float zone=exp(-dd*(2.4-e*1.2));
    float ripple=.5+.5*cos(dd*14.-uT*(1.2+e*5.5));
    float first=1.-smoothstep(0.,.03,abs(dd-.2));
    float second=1.-smoothstep(0.,.02,abs(dd-.62));
    float core=exp(-dd*46.);
    float amt=zone*(.045+e*.5)*(.3+.7*ripple)+first*(.14+e*.55)+second*(.04+e*.18)+core*(.1+e*.35);
    col+=c*amt*inside;a+=(zone*(.08+e*.35)+first*.32+core*.2)*inside;
  }
  float ld=distance(p,uLed.xy);
  col+=uLedCol*exp(-ld*ld*.5)*uLed.z*inside*.75;
  gl_FragColor=vec4(col,clamp(a,0.,.97));
}`;
const CUR_VS='varying vec2 vU;varying float vH;void main(){vU=uv;vH=position.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
const CUR_FS=`precision highp float;varying vec2 vU;varying float vH;uniform float uThr;uniform float uE;
void main(){vec3 blue=vec3(.61,.78,1.),gold=vec3(.93,.73,.33);
  float over=smoothstep(uThr*.92,uThr*1.12,vH);vec3 c=mix(blue,gold,over);
  float top=smoothstep(.9,1.,vU.y);float body=pow(vU.y,1.5)*.3;
  float ends=smoothstep(0.,.05,vU.x)*smoothstep(1.,.86,vU.x);
  float scan=.72+.28*sin(vU.x*300.);
  gl_FragColor=vec4(c*(body*scan+top*1.25)*ends*(.5+uE*.7+over*.5),1.);}`;
const WALL_FS='precision highp float;varying vec2 vU;void main(){float f=pow(1.-vU.y,2.2);gl_FragColor=vec4(vec3(.61,.78,1.)*f*.13,1.);}';
const WALL_VS='varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';

function glowTexture(){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),r=g.createRadialGradient(64,64,0,64,64,64);
  r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.18,'rgba(255,255,255,.55)');r.addColorStop(.45,'rgba(255,255,255,.14)');r.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=r;g.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);}
function halo(color,size,opacity){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glow,color,transparent:true,opacity:opacity==null?0.9:opacity,blending:THREE.AdditiveBlending,depthWrite:false}));s.scale.setScalar(size);return s;}

function init(el){host=el;if(!window.THREE)return false;const T=THREE;
  try{R=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}catch(e){return false;}
  R.setPixelRatio(Math.min(devicePixelRatio||1,2));R.domElement.className='gl';host.prepend(R.domElement);
  labels=document.createElement('div');labels.className='lbls';host.appendChild(labels);
  scene=new T.Scene();cam=new T.PerspectiveCamera(34,1,0.1,200);root=new T.Group();scene.add(root);glow=glowTexture();
  host.addEventListener('pointerdown',e=>{if(e.target.closest('.hud,.side,button,a,input'))return;drag={x:e.clientX,y:e.clientY};vel=0;});
  window.addEventListener('pointerup',()=>{drag=null;});
  host.addEventListener('pointermove',e=>{const r=host.getBoundingClientRect();px=(e.clientX-r.left)/r.width*2-1;py=(e.clientY-r.top)/r.height*2-1;
    if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)<Math.abs(dy)*0.8&&e.pointerType==='touch')return;drag.x=e.clientX;drag.y=e.clientY;yaw+=dx*0.007;vel=dx*0.007;pitch=Lab.clamp(pitch+dy*0.004,0.22,1.25);});
  host.addEventListener('pointerleave',()=>{px=py=0;});
  ok=true;return true;}
function lbl(text,cls){const d=document.createElement('div');d.className='lbl '+(cls||'');d.textContent=text;labels.appendChild(d);return d;}
const line=(pts,color,opacity)=>new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color,transparent:true,opacity}));

function curtain(a,b){const T=THREE,n=SEG+1,pos=new Float32Array(n*6),uv=new Float32Array(n*4),idx=[];
  for(let i=0;i<n;i++){const f=i/SEG,x=a.x+(b.x-a.x)*f,z=a.z+(b.z-a.z)*f;pos.set([x,0,z,x,0.02,z],i*6);uv.set([f,0,f,1],i*4);if(i<SEG){const k=i*2;idx.push(k,k+1,k+2,k+1,k+3,k+2);}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));g.setAttribute('uv',new T.BufferAttribute(uv,2));g.setIndex(idx);
  const m=new T.Mesh(g,new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,uniforms:{uThr:{value:HMAX/HK},uE:{value:0}},vertexShader:CUR_VS,fragmentShader:CUR_FS}));
  m.frustumCulled=false;return m;}

function build(){const T=THREE,cfg=Lab.cfg,W=cfg.room.w,H=cfg.room.h;ver=Lab.S.ver;
  while(root.children.length){const c=root.children.pop();c.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material&&o.material.dispose)o.material.dispose();});}
  labels.innerHTML='';objs={nodes:[],devs:new Map(),links:[]};
  const P=(x,y,h)=>new T.Vector3(x-W/2,h||0,y-H/2);objs.P=P;
  floor=new T.Mesh(new T.PlaneGeometry(W+14,H+14),new T.ShaderMaterial({transparent:true,depthWrite:false,vertexShader:VS,fragmentShader:FS,extensions:{derivatives:true},
    uniforms:{uT:{value:0},uSize:{value:new T.Vector2(W,H)},uRouter:{value:new T.Vector2(cfg.router.x,cfg.router.y)},uN:{value:Array.from({length:6},()=>new T.Vector3())},uCnt:{value:0},uLed:{value:new T.Vector3()},uLedCol:{value:new T.Vector3()}}}));
  floor.rotation.x=-Math.PI/2;root.add(floor);
  /* 벽: 아래에서 위로 옅어지는 면과 테두리 선 */
  const wh=1.35,wm=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,vertexShader:WALL_VS,fragmentShader:WALL_FS}),edge=[];
  [[0,0,W,0],[W,0,W,H],[W,H,0,H],[0,H,0,0]].forEach(([a,b,c,d])=>{const p=P(a,b),q=P(c,d),g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute([p.x,0,p.z,q.x,0,q.z,p.x,wh,p.z,q.x,wh,q.z],3));g.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,0,1,1,1],2));g.setIndex([0,1,2,1,3,2]);root.add(new T.Mesh(g,wm));
    edge.push(p.x,0,p.z,q.x,0,q.z,p.x,0,p.z,p.x,wh,p.z);});
  const eg=new T.BufferGeometry();eg.setAttribute('position',new T.Float32BufferAttribute(edge,3));root.add(new T.LineSegments(eg,new T.LineBasicMaterial({color:BLUE,transparent:true,opacity:0.55})));
  /* 먼지: 깊이감을 주는 느린 점들 */
  const dn=reduced?0:420,dp=new Float32Array(dn*3);for(let i=0;i<dn;i++){dp[i*3]=(Math.random()-0.5)*(W+12);dp[i*3+1]=Math.random()*4.2+0.1;dp[i*3+2]=(Math.random()-0.5)*(H+12);}
  const dg=new T.BufferGeometry();dg.setAttribute('position',new T.BufferAttribute(dp,3));dust=new T.Points(dg,new T.PointsMaterial({color:BLUE,size:0.045,map:glow,transparent:true,opacity:0.5,blending:T.AdditiveBlending,depthWrite:false}));root.add(dust);

  const stem=(p,h,color)=>{const l=line([p.clone(),p.clone().setY(h)],color,0.55);root.add(l);};
  const board=(p,h,color,size)=>{const m=new T.Mesh(new T.BoxGeometry(size*1.8,size*0.28,size),new T.MeshBasicMaterial({color}));m.position.copy(p).setY(h);root.add(m);
    const hl=halo(color,size*5.5,0.7);hl.position.copy(p).setY(h);root.add(hl);const base=halo(color,size*7,0.28);base.position.copy(p).setY(0.03);root.add(base);return{m,hl};};
  const rp=P(cfg.router.x,cfg.router.y);stem(rp,0.62,PAPER);board(rp,0.62,PAPER,0.2);
  [-0.12,0,0.12].forEach(dx=>root.add(line([rp.clone().add(new T.Vector3(dx,0.66,0)),rp.clone().add(new T.Vector3(dx*1.5,1.0,0))],PAPER,0.8)));
  objs.nodes.push({el:lbl(L('공유기'),'sys'),pos:rp.clone().setY(1.2)});
  for(const n of cfg.nodes){const p=P(n.x,n.y);
    if(n.type==='csi'){stem(p,0.55,GOLD);const b=board(p,0.55,GOLD,0.17);objs.nodes.push({el:lbl(n.alias,'csi'),pos:p.clone().setY(1.05),key:n.key});
      const a0=p.clone().setY(0),b0=rp.clone().setY(0),cur=curtain(a0,b0);root.add(cur);
      const th=new T.Line(new T.BufferGeometry().setFromPoints([a0.clone().setY(HMAX/HK),b0.clone().setY(HMAX/HK)]),new T.LineDashedMaterial({color:0xff9d5c,dashSize:0.14,gapSize:0.1,transparent:true,opacity:0.7}));th.computeLineDistances();root.add(th);
      const los=line([p.clone().setY(0.55),rp.clone().setY(0.62)],BLUE,0.35);root.add(los);
      const dots=Array.from({length:6},()=>{const s=halo(BLUE,0.22,0.95);root.add(s);return s;});
      objs.links.push({key:n.key,a:p.clone().setY(0.55),b:rp.clone().setY(0.62),los,dots,cur,hl:b.hl});}
    else if(n.type==='ble'){stem(p,0.45,BLUE);board(p,0.45,BLUE,0.14);
      const ring=new T.LineLoop(new T.BufferGeometry().setFromPoints(Array.from({length:96},(_,i)=>new T.Vector3(Math.cos(i/96*6.2832),0,Math.sin(i/96*6.2832)))),new T.LineBasicMaterial({color:BLUE,transparent:true,opacity:0.35}));
      ring.position.copy(p).setY(0.03);root.add(ring);objs.nodes.push({el:lbl(n.alias,'ble'),pos:p.clone().setY(0.95),key:n.key,ring,room:n.key.slice(4)});}
    else if(n.type==='cam'){stem(p,0.95,VIO);board(p,0.95,VIO,0.14);const c=new T.Vector3(0,0.95,0),f=[[-1.7,0,3.4],[1.7,0,3.4]],cp=[];f.forEach(q=>{cp.push(c.x,c.y,c.z,q[0],q[1],q[2]);});cp.push(f[0][0],0,f[0][2],f[1][0],0,f[1][2]);
      const cg=new T.BufferGeometry();cg.setAttribute('position',new T.Float32BufferAttribute(cp,3));const cone=new T.LineSegments(cg,new T.LineBasicMaterial({color:VIO,transparent:true,opacity:0.5}));cone.position.copy(p);root.add(cone);
      objs.nodes.push({el:lbl(n.alias,'cam'),pos:p.clone().setY(1.45)});}
    else if(n.type==='led'){stem(p,0.6,0x8c9db3);const m=new T.Mesh(new T.SphereGeometry(0.12,20,14),new T.MeshBasicMaterial({color:0x334155}));m.position.copy(p).setY(0.6);root.add(m);
      const hl=halo(0x334155,1.6,0);hl.position.copy(m.position);root.add(hl);objs.led={m,hl,n};objs.nodes.push({el:lbl(n.alias,'sys'),pos:p.clone().setY(1.05)});}}
  /* 데모의 가상 인물 */
  const body=new T.Group(),bm=new T.MeshBasicMaterial({color:PAPER,transparent:true,opacity:0.9});
  bm.opacity=0.62;const cy=new T.Mesh(new T.CylinderGeometry(0.1,0.15,0.92,20),bm);cy.position.y=0.46;const hd=new T.Mesh(new T.SphereGeometry(0.125,20,14),bm);hd.position.y=1.1;
  const fr=new T.LineLoop(new T.BufferGeometry().setFromPoints(Array.from({length:48},(_,i)=>new T.Vector3(Math.cos(i/48*6.2832)*0.42,0.03,Math.sin(i/48*6.2832)*0.42))),new T.LineBasicMaterial({color:PAPER,transparent:true,opacity:0.6}));body.add(fr);
  const aura=halo(PAPER,1.5,0.35);aura.position.y=0.6;const foot=halo(PAPER,1.3,0.3);foot.position.y=0.03;body.add(cy,hd,aura,foot);body.visible=false;root.add(body);
  objs.person={g:body,el:lbl(L('가상의 사람'),'ghost')};}

function devMarker(d,pinned){const T=THREE;let o=objs.devs.get(d.id);if(o)return o;
  const m=new T.Mesh(new T.SphereGeometry(pinned?0.11:0.06,14,10),new T.MeshBasicMaterial({color:pinned?GOLD:0x8c9db3,transparent:true,opacity:pinned?1:0.6}));root.add(m);
  o={m,el:pinned?lbl(d.name||Lab.mask(d.id),'dev'):null,trail:null,pts:[]};
  if(pinned){o.hl=halo(GOLD,0.9,0.75);root.add(o.hl);const N=40,g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(N*3),3));g.setAttribute('color',new T.BufferAttribute(new Float32Array(N*3),3));
    o.trail=new T.Line(g,new T.LineBasicMaterial({vertexColors:true,transparent:true,blending:T.AdditiveBlending,depthWrite:false}));o.trail.frustumCulled=false;root.add(o.trail);}
  objs.devs.set(d.id,o);return o;}

function render(t){if(!ok)return;const S=Lab.S,cfg=Lab.cfg,w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;
  if(ver!==S.ver)build();const sd=document.getElementById('sp-cards'),wantPad=sd&&sd.offsetParent&&sd.offsetLeft>w*0.5&&!document.body.classList.contains('present')?sd.offsetWidth+16:0;
  if(w!==sw||h!==sh||wantPad!==pad){sw=w;sh=h;pad=wantPad;R.setSize(w,h,false);cam.aspect=w/h;if(pad)cam.setViewOffset(w,h,pad/2,h*0.045,w,h);else cam.clearViewOffset();cam.updateProjectionMatrix();}
  const present=document.body.classList.contains('present');
  if(!drag&&!reduced){yaw+=(present?0.0021:0.0008)+vel;vel*=0.93;}
  ox+=(px*0.1-ox)*0.04;oy+=(py*0.05-oy)*0.04;
  const portrait=w/h<0.9;let dist=(portrait?22:(pad?16.4:14.6))*Math.max(1,Math.max(cfg.room.w/10,cfg.room.h/7));
  if(t0===null)t0=t;const k0=reduced?1:Math.min(1,(t-t0)/3.4),ez=1-Math.pow(1-k0,3);dist*=1+(1-ez)*0.9;
  const ya=yaw+(1-ez)*0.9+(drag||reduced?0:ox),pi=Lab.clamp(pitch+(drag||reduced?0:oy),0.2,1.3);
  cam.position.set(Math.sin(ya)*Math.cos(pi)*dist,Math.sin(pi)*dist,Math.cos(ya)*Math.cos(pi)*dist);cam.lookAt(0,0.45,0);
  const u=floor.material.uniforms,tn=Lab.now();u.uT.value=reduced?2:t;let i=0;
  for(const n of S.csi.values()){const nd=Lab.node(n.key);if(!nd||i>=6)continue;const thr=n.thr||0.5,e=Lab.clamp(((n.last||0)-thr*0.35)/(thr*1.2),0,1);n._e=(n._e||0)+(e-(n._e||0))*0.12;u.uN.value[i++].set(nd.x,nd.y,n._e);}
  u.uCnt.value=i;const led=objs.led;
  if(led){const c=S.led.color;if(c){u.uLed.value.set(led.n.x,led.n.y,1);u.uLedCol.value.set(c[0]/255,c[1]/255,c[2]/255);led.m.material.color.setRGB(c[0]/255,c[1]/255,c[2]/255);led.hl.material.color.copy(led.m.material.color);led.hl.material.opacity=0.85;led.hl.scale.setScalar(1.7+0.2*Math.sin(t*6));}
    else{u.uLed.value.z=0;led.m.material.color.setHex(0x334155);led.hl.material.opacity=0;}}
  for(const K of objs.links){const n=S.csi.get(K.key.slice(4)),e=n?(n._e||0):0,hot=!!n&&n.state==='motion',col=hot?GOLD:BLUE;
    K.los.material.color.setHex(col);K.los.material.opacity=0.28+e*0.6;K.hl.scale.setScalar(0.95+e*1.1);
    K.dots.forEach((s,k)=>{const f=((reduced?0.3:t*(0.22+e*0.55))+k/K.dots.length)%1;s.position.lerpVectors(K.a,K.b,f);s.material.color.setHex(col);s.scale.setScalar(0.16+e*0.22);s.material.opacity=Math.sin(f*Math.PI)*0.95;});
    const pos=K.cur.geometry.attributes.position,sc=n?n.score:[],thr=n&&n.thr||0.5;let j=sc.length-1;
    for(let q=0;q<=SEG;q++){const at=tn-q/SEG*WINDOW;while(j>0&&sc[j].t>at)j--;const v=sc.length&&sc[j].t<=at+400?sc[j].v:0,target=0.02+Lab.clamp(v/(thr*HK),0,1)*HMAX,k=(q*2+1)*3+1;pos.array[k]+=(target-pos.array[k])*0.35;}
    pos.needsUpdate=true;K.cur.material.uniforms.uE.value=e;}
  const pin=cfg.pinned,lead=pin.map(id=>S.devs.get(id)).find(Boolean);
  for(const o of objs.nodes){if(o.ring){const ob=lead&&lead.obs[o.room];if(ob&&tn-ob.ts<15000){o.ring.visible=true;o.ring.scale.setScalar(Math.max(0.2,ob.d));o.ring.material.opacity=lead.room===o.room?0.85:0.25;}else o.ring.visible=false;}}
  for(const d of S.devs.values()){if(!d.pos)continue;const pinned=pin.includes(d.id);if(!pinned&&objs.devs.size>24&&!objs.devs.has(d.id))continue;
    const o=devMarker(d,pinned),p=objs.P(d.pos.x,d.pos.y,pinned?0.55:0.2);o.m.position.lerp(p,0.2);o.m.visible=tn-d.ts<20000;
    if(o.hl){o.hl.position.copy(o.m.position);o.hl.visible=o.m.visible;}
    if(o.trail){const last=o.pts[o.pts.length-1];if(!last||last.distanceTo(o.m.position)>0.04){o.pts.push(o.m.position.clone().setY(0.06));if(o.pts.length>40)o.pts.shift();}
      const pa=o.trail.geometry.attributes.position.array,ca=o.trail.geometry.attributes.color.array,N=o.pts.length;
      for(let q=0;q<40;q++){const pt=o.pts[Math.min(q,N-1)]||o.m.position,f=N>1?q/(N-1):0,b=q<N?f*f*0.9:0;pa[q*3]=pt.x;pa[q*3+1]=pt.y;pa[q*3+2]=pt.z;ca[q*3]=0.93*b;ca[q*3+1]=0.73*b;ca[q*3+2]=0.33*b;}
      o.trail.geometry.attributes.position.needsUpdate=true;o.trail.geometry.attributes.color.needsUpdate=true;o.trail.visible=o.m.visible;}}
  const sp=window.Sim&&Sim.person,pg=objs.person;if(sp&&sp.on&&S.source==='demo'){pg.g.visible=true;pg.g.position.lerp(objs.P(sp.x,sp.y),0.5);}else pg.g.visible=false;
  if(dust&&!reduced){dust.rotation.y=t*0.008;dust.position.y=Math.sin(t*0.15)*0.12;}
  R.render(scene,cam);root.updateMatrixWorld();
  const v=new THREE.Vector3(),place=(el,pos,show)=>{if(!el)return;if(show===false){el.style.display='none';return;}v.copy(pos).project(cam);if(v.z>1){el.style.display='none';return;}el.style.display='block';el.style.transform=`translate(${((v.x+1)/2*w).toFixed(1)}px,${((1-v.y)/2*h).toFixed(1)}px) translate(-50%,-100%)`;};
  for(const o of objs.nodes){place(o.el,o.pos);if(o.key&&o.key.startsWith('csi:')){const n=S.csi.get(o.key.slice(4));o.el.classList.toggle('hot',!!n&&n.state==='motion');}}
  for(const o of objs.devs.values())if(o.el)place(o.el,o.m.position.clone().setY(o.m.position.y+0.32),o.m.visible);
  place(pg.el,pg.g.position.clone().setY(1.55),pg.g.visible);}
return{init,render,get ok(){return ok;}};
})();
