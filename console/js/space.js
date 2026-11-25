/* 3D 공간: 바닥 셰이더로 CSI 링크와 파동을 그리고, 노드와 기기를 실시간으로 올립니다. */
window.Space=(()=>{'use strict';
let R=null,scene,cam,root,floor,host,labels,ver=-1,objs={},yaw=-0.55,pitch=0.62,vel=0,drag=null,dist=15,ok=false,sw=0,sh=0,t0=null;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const FS=`precision highp float;varying vec2 vP;uniform float uT;uniform vec2 uSize;uniform vec2 uRouter;uniform vec3 uN[6];uniform int uCnt;uniform vec3 uLed;uniform vec3 uLedCol;
float seg(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/max(dot(ba,ba),.0001),0.,1.);return length(pa-ba*h);}
void main(){vec2 p=vec2(vP.x+uSize.x*.5,uSize.y*.5-vP.y);vec3 blue=vec3(.61,.78,1.),gold=vec3(.93,.73,.33);
 vec2 g=abs(fract(p)-.5);float line=smoothstep(.47,.5,max(g.x,g.y));
 float inside=step(0.,p.x)*step(p.x,uSize.x)*step(0.,p.y)*step(p.y,uSize.y);
 float edge=1.-smoothstep(0.,3.,max(max(-p.x,p.x-uSize.x),max(-p.y,p.y-uSize.y)));
 vec3 col=vec3(.03,.05,.085)*inside+blue*line*(.035+.1*inside)*edge;float a=line*.5*edge+inside*.72;
 for(int i=0;i<6;i++){if(i>=uCnt)break;vec2 n=uN[i].xy;float e=uN[i].z;float d=distance(p,n);
  float w=sin(d*6.5-uT*(2.2+e*3.))*.5+.5;float ring=pow(w,12.)*exp(-d*.42);vec3 c=mix(blue,gold,clamp(e,0.,1.));
  col+=c*ring*(.22+e*.9)*inside;a+=ring*.4*inside;
  float sd=seg(p,n,uRouter);float beam=exp(-sd*sd*14.)*(.16+e*.9);float flow=.55+.45*sin(d*8.-uT*7.);
  col+=c*beam*flow*inside;a+=beam*.5*inside;}
 float ld=distance(p,uLed.xy);col+=uLedCol*exp(-ld*ld*.45)*uLed.z*inside*.7;
 gl_FragColor=vec4(col,clamp(a,0.,.96));}`;
const VS='varying vec2 vP;void main(){vP=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
function init(el){host=el;if(!window.THREE)return false;const T=THREE;
  try{R=new T.WebGLRenderer({antialias:true,alpha:true});}catch(e){return false;}
  R.setPixelRatio(Math.min(devicePixelRatio||1,2));R.domElement.className='gl';host.prepend(R.domElement);
  labels=document.createElement('div');labels.className='lbls';host.appendChild(labels);
  scene=new T.Scene();cam=new T.PerspectiveCamera(36,1,0.1,200);root=new T.Group();scene.add(root);
  host.addEventListener('pointerdown',e=>{if(e.target.closest('.hud,button,a,input'))return;drag={x:e.clientX,y:e.clientY};vel=0;});
  window.addEventListener('pointerup',()=>{drag=null;});
  host.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)<Math.abs(dy)*0.8&&e.pointerType==='touch')return;drag.x=e.clientX;drag.y=e.clientY;yaw+=dx*0.007;vel=dx*0.007;pitch=Lab.clamp(pitch+dy*0.004,0.25,1.25);});
  ok=true;return true;}
function lbl(text,cls){const d=document.createElement('div');d.className='lbl '+(cls||'');d.textContent=text;labels.appendChild(d);return d;}
function build(){const T=THREE,cfg=Lab.cfg,W=cfg.room.w,H=cfg.room.h;ver=Lab.S.ver;
  while(root.children.length){const c=root.children.pop();c.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});}
  labels.innerHTML='';objs={nodes:[],devs:new Map(),links:[]};
  const P=(x,y,h)=>new T.Vector3(x-W/2,h||0,y-H/2);objs.P=P;
  floor=new T.Mesh(new T.PlaneGeometry(W+8,H+8),new T.ShaderMaterial({transparent:true,depthWrite:false,vertexShader:VS,fragmentShader:FS,
    uniforms:{uT:{value:0},uSize:{value:new T.Vector2(W,H)},uRouter:{value:new T.Vector2(cfg.router.x,cfg.router.y)},uN:{value:Array.from({length:6},()=>new T.Vector3())},uCnt:{value:0},uLed:{value:new T.Vector3()},uLedCol:{value:new T.Vector3()}}}));
  floor.rotation.x=-Math.PI/2;root.add(floor);
  const wh=1.15,pts=[];[[0,0,W,0],[W,0,W,H],[W,H,0,H],[0,H,0,0]].forEach(([a,b,c,d])=>{const p=P(a,b),q=P(c,d);pts.push(p.x,0,p.z,q.x,0,q.z,p.x,wh,p.z,q.x,wh,q.z,p.x,0,p.z,p.x,wh,p.z);});
  const wg=new T.BufferGeometry();wg.setAttribute('position',new T.Float32BufferAttribute(pts,3));root.add(new T.LineSegments(wg,new T.LineBasicMaterial({color:0x9cc6ff,transparent:true,opacity:0.5})));
  const post=(p,color,size,h)=>{const g=new T.Group(),m=new T.Mesh(new T.BoxGeometry(size,size*0.45,size*1.7),new T.MeshBasicMaterial({color}));m.position.y=h;g.add(m);
    g.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(0,0,0),new T.Vector3(0,h,0)]),new T.LineBasicMaterial({color,transparent:true,opacity:0.5})));g.position.copy(p);root.add(g);return g;};
  const rp=P(cfg.router.x,cfg.router.y);post(rp,0xe8eef6,0.3,0.5);objs.nodes.push({el:lbl('공유기','sys'),pos:rp.clone().setY(0.95)});
  for(const n of cfg.nodes){const p=P(n.x,n.y);
    if(n.type==='csi'){post(p,0xecb955,0.24,0.5);objs.nodes.push({el:lbl(n.alias,'csi'),pos:p.clone().setY(0.95),key:n.key});
      const a=p.clone().setY(0.5),b=rp.clone().setY(0.5),ln=new T.Line(new T.BufferGeometry().setFromPoints([a,b]),new T.LineBasicMaterial({color:0x9cc6ff,transparent:true,opacity:0.35}));root.add(ln);
      const dots=Array.from({length:5},()=>{const m=new T.Mesh(new T.SphereGeometry(0.055,8,6),new T.MeshBasicMaterial({color:0x9cc6ff}));root.add(m);return m;});objs.links.push({key:n.key,a,b,ln,dots});}
    else if(n.type==='ble'){post(p,0x9cc6ff,0.2,0.4);const ring=new T.LineLoop(new T.BufferGeometry().setFromPoints(Array.from({length:72},(_,i)=>new T.Vector3(Math.cos(i/72*6.2832),0,Math.sin(i/72*6.2832)))),new T.LineBasicMaterial({color:0x9cc6ff,transparent:true,opacity:0.35}));
      ring.position.copy(p).setY(0.03);root.add(ring);objs.nodes.push({el:lbl(n.alias,'ble'),pos:p.clone().setY(0.85),key:n.key,ring,room:n.key.slice(4)});}
    else if(n.type==='cam'){post(p,0xb9a8ff,0.2,0.9);const c=new T.Vector3(0,0.9,0),f=[[-1.6,0,3.2],[1.6,0,3.2]],cp=[];f.forEach(q=>{cp.push(c.x,c.y,c.z,q[0],q[1],q[2]);});cp.push(f[0][0],0,f[0][2],f[1][0],0,f[1][2]);
      const cg=new T.BufferGeometry();cg.setAttribute('position',new T.Float32BufferAttribute(cp,3));const cone=new T.LineSegments(cg,new T.LineBasicMaterial({color:0xb9a8ff,transparent:true,opacity:0.45}));cone.position.copy(p);root.add(cone);
      objs.nodes.push({el:lbl(n.alias,'cam'),pos:p.clone().setY(1.35)});}
    else if(n.type==='led'){const m=new T.Mesh(new T.SphereGeometry(0.14,16,12),new T.MeshBasicMaterial({color:0x334155}));m.position.copy(p).setY(0.6);root.add(m);
      root.add(new T.Line(new T.BufferGeometry().setFromPoints([p.clone(),p.clone().setY(0.6)]),new T.LineBasicMaterial({color:0x8c9db3,transparent:true,opacity:0.4})));objs.led={m,n};objs.nodes.push({el:lbl(n.alias,'sys'),pos:p.clone().setY(1.0)});}}
  const body=new T.Group(),bm=new T.MeshBasicMaterial({color:0xe8eef6,transparent:true,opacity:0.85});const cy=new T.Mesh(new T.CylinderGeometry(0.15,0.19,0.85,14),bm);cy.position.y=0.43;const hd=new T.Mesh(new T.SphereGeometry(0.15,14,10),bm);hd.position.y=1.02;body.add(cy,hd);body.visible=false;root.add(body);
  objs.person={g:body,el:lbl('가상의 사람','ghost')};}
function devMarker(d,pinned){const T=THREE;let o=objs.devs.get(d.id);if(o)return o;
  const m=new T.Mesh(new T.SphereGeometry(pinned?0.13:0.07,12,10),new T.MeshBasicMaterial({color:pinned?0xecb955:0x8c9db3,transparent:true,opacity:pinned?1:0.6}));root.add(m);
  o={m,el:pinned?lbl(d.name||Lab.mask(d.id),'dev'):null};objs.devs.set(d.id,o);return o;}
function render(t){if(!ok)return;const S=Lab.S,cfg=Lab.cfg,w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;
  if(ver!==S.ver)build();if(w!==sw||h!==sh){sw=w;sh=h;R.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();}
  if(!drag&&!reduced){yaw+=(document.body.classList.contains('present')?0.0022:0.0009)+vel;vel*=0.93;}
  const portrait=w/h<0.9;dist=(portrait?22:14.5)*Math.max(1,Math.max(cfg.room.w/10,cfg.room.h/7));
  if(t0===null)t0=t;const k0=reduced?1:Math.min(1,(t-t0)/3.2),ez=1-Math.pow(1-k0,3);dist*=1+(1-ez)*0.9;
  cam.position.set(Math.sin(yaw+(1-ez)*0.9)*Math.cos(pitch)*dist,Math.sin(pitch)*dist,Math.cos(yaw+(1-ez)*0.9)*Math.cos(pitch)*dist);cam.lookAt(0,0.3,0);
  const u=floor.material.uniforms;u.uT.value=reduced?2:t;let i=0;
  for(const n of S.csi.values()){const nd=Lab.node(n.key);if(!nd||i>=6)continue;const thr=n.thr||0.5,e=Lab.clamp(((n.last||0)-thr*0.35)/(thr*1.2),0,1);n._e=(n._e||0)+(e-(n._e||0))*0.12;u.uN.value[i++].set(nd.x,nd.y,n._e);}
  u.uCnt.value=i;const L=objs.led;
  if(L){const c=S.led.color;if(c){u.uLed.value.set(L.n.x,L.n.y,1);u.uLedCol.value.set(c[0]/255,c[1]/255,c[2]/255);L.m.material.color.setRGB(c[0]/255,c[1]/255,c[2]/255);L.m.scale.setScalar(1.35+0.12*Math.sin(t*6));}else{u.uLed.value.z=0;L.m.material.color.setHex(0x334155);L.m.scale.setScalar(1);}}
  for(const L2 of objs.links){const n=S.csi.get(L2.key.slice(4)),e=n?(n._e||0):0,hot=n&&n.state==='motion',col=hot?0xecb955:0x9cc6ff;L2.ln.material.color.setHex(col);L2.ln.material.opacity=0.3+e*0.6;
    L2.dots.forEach((m,k)=>{const f=((reduced?0.3:t*(0.25+e*0.5))+k/L2.dots.length)%1;m.position.lerpVectors(L2.a,L2.b,f);m.material.color.setHex(col);m.scale.setScalar(1+e*1.4);});}
  const pin=cfg.pinned,lead=pin.map(id=>S.devs.get(id)).find(Boolean),tn=Lab.now();
  for(const o of objs.nodes){if(o.ring){const ob=lead&&lead.obs[o.room];if(ob&&tn-ob.ts<15000){o.ring.visible=true;o.ring.scale.setScalar(Math.max(0.2,ob.d));o.ring.material.opacity=lead.room===o.room?0.8:0.25;}else o.ring.visible=false;}}
  for(const d of S.devs.values()){if(!d.pos)continue;const pinned=pin.includes(d.id);if(!pinned&&objs.devs.size>24&&!objs.devs.has(d.id))continue;const o=devMarker(d,pinned),p=objs.P(d.pos.x,d.pos.y,pinned?0.55:0.2);o.m.position.lerp(p,0.2);o.m.visible=tn-d.ts<20000;}
  const sp=window.Sim&&Sim.person;const pg=objs.person;if(sp&&sp.on&&S.source==='demo'){pg.g.visible=true;pg.g.position.copy(objs.P(sp.x,sp.y));}else pg.g.visible=false;
  R.render(scene,cam);root.updateMatrixWorld();
  const v=new THREE.Vector3(),place=(el,pos,show)=>{if(!el)return;if(show===false){el.style.display='none';return;}v.copy(pos).project(cam);if(v.z>1){el.style.display='none';return;}el.style.display='block';el.style.transform=`translate(${((v.x+1)/2*w).toFixed(1)}px,${((1-v.y)/2*h).toFixed(1)}px) translate(-50%,-100%)`;};
  for(const o of objs.nodes){place(o.el,o.pos);if(o.key&&o.key.startsWith('csi:')){const n=S.csi.get(o.key.slice(4));o.el.classList.toggle('hot',!!n&&n.state==='motion');}}
  for(const o of objs.devs.values())if(o.el)place(o.el,o.m.position.clone().setY(o.m.position.y+0.3),o.m.visible);
  place(pg.el,pg.g.position.clone().setY(1.5),pg.g.visible);}
return{init,render,get ok(){return ok;}};
})();
