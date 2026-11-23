/* 내장 시뮬레이터: 실제 펌웨어와 같은 토픽 모양으로 값을 만들어 같은 수신 경로에 넣습니다. */
window.Sim=(()=>{'use strict';
const ID='51a0000000000001',ROOMS=['office','living','entry'];
let timer=null,t=0,burst=0,hits=0,state='idle',truth=false,tick=0,pir=false;
const person={x:5,y:3.5,on:false};const keys={x:2.1,y:5.2};
const emit=(topic,obj)=>Lab.ingest(topic,typeof obj==='string'?obj:JSON.stringify(obj),'sim');
function segDist(p,a,b){const vx=b.x-a.x,vy=b.y-a.y,l=vx*vx+vy*vy||1,h=Lab.clamp(((p.x-a.x)*vx+(p.y-a.y)*vy)/l,0,1);return Math.hypot(p.x-(a.x+vx*h),p.y-(a.y+vy*h));}
function step(){const cfg=Lab.cfg,W=cfg.room.w,H=cfg.room.h;t+=0.2;tick++;
  person.x=W/2+(W/2-0.9)*Math.sin(t*0.17);person.y=H/2+(H/2-0.9)*Math.sin(t*0.26+0.9);
  const n=Lab.node('csi:'+ID)||{x:0.9,y:0.9};const cross=segDist(person,n,cfg.router)<0.85;
  if(cross!==truth){truth=cross;emit('lab/sim/truth',{node:ID,on:cross});}
  burst=cross?Math.min(1,burst+0.35):burst*0.8;if(Math.random()<0.004)burst=Math.max(burst,0.5); // 가끔 사람 없이도 튑니다
  const score=0.09+Math.random()*0.07+burst*(0.75+Math.random()*0.5);
  hits=score>0.5?Math.min(5,hits+1):Math.max(0,hits-1);if(state==='idle'&&hits>=3)state='motion';else if(state==='motion'&&hits===0)state='idle';
  emit('espectre/v1/devices/'+ID+'/motion',{timestamp_ms:Math.round(t*1000),state,score:+score.toFixed(4)});
  const ln=Lab.node('ble:living');if(ln){const near=segDist(person,n,cfg.router)<1.9; // 가상 PIR은 링크 주변을 넓게 봅니다
   if(near!==pir){pir=near;emit('espresense/rooms/living/input_1',near?'ON':'OFF');}}
  if(tick%5===0){for(const r of ROOMS){const bn=Lab.node('ble:'+r);if(!bn)continue;
      const pub=(id,name,p)=>{const d=Math.hypot(p.x-bn.x,p.y-bn.y)*(1+(Math.random()-0.5)*0.24)+0.15;emit('espresense/devices/'+id+'/'+r,{id,name,distance:+d.toFixed(2),rssi:Math.round(-50-d*6.5)});};
      pub('sim:phone','내 휴대폰 (가상)',person);pub('sim:keys','열쇠 태그 (가상)',keys);
      if(r==='living')emit('espresense/devices/a4c1380011ff/living',{id:'a4c1380011ff',distance:+(3.6+Math.random()*0.5).toFixed(2),rssi:-78});}}
}
function start(){stop();t=Math.random()*40;burst=0;hits=0;state='idle';truth=false;tick=0;pir=false;person.on=true;
  emit('espectre/v1/devices/'+ID+'/sensing',{enabled:true,ready:true,calibrating:false,mode:'sensing',detector:'lightweight',threshold:0.5,motion_on_hits:3,motion_off_hits:5});
  emit('espectre/v1/devices/'+ID+'/health',{status:'online'});const n=Lab.node('csi:'+ID);if(n&&n.alias.startsWith('CSI ')){n.alias='거실 CSI';}
  ROOMS.forEach(r=>emit('espresense/rooms/'+r+'/status','online'));emit('espresense/rooms/living/input_1','OFF');
  timer=setInterval(step,200);for(let i=0;i<8;i++)step();}
function stop(){if(timer){clearInterval(timer);timer=null;}person.on=false;}
function onPublish(topic,payload){emit(topic,payload);} // 데모에서는 보낸 명령을 그대로 되돌려 LED 상태를 보여 줍니다
return{start,stop,onPublish,person,keys,ID,get running(){return!!timer;}};
})();
