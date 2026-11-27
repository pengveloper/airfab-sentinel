/* 카메라에게 묻기: 메인 프로세스가 집 안 망의 카메라에서 사진 한 장을 받아 사진을 읽는 모델에 묻습니다.
   창은 카메라나 모델 서버에 직접 닿지 않고, 돌려받은 사진(data: 주소)과 답만 보여 줍니다. */
window.Look=(()=>{'use strict';
const $=s=>document.querySelector(s),D=window.desktop||null;
let busy=false;
const ERR={CAMERA_BAD_URL:()=>L('카메라 화면의 주소가 집 안 망의 IP 주소(http://192.168.x.x 같은)가 아닙니다.'),CAMERA_UNREACHABLE:()=>L('카메라에서 사진을 받지 못했습니다. 카메라가 켜져 있는지 확인하세요.'),
  CAMERA_TIMEOUT:()=>L('카메라가 6초 안에 사진을 주지 않았습니다.'),CAMERA_TOO_LARGE:()=>L('사진이 3MB보다 큽니다. 카메라 해상도를 낮추세요.'),CAMERA_NOT_JPEG:()=>L('카메라가 JPEG 사진이 아닌 것을 보냈습니다.'),
  BAD_MODEL:()=>L('모델을 고르세요.'),BAD_PROMPT:()=>L('질문을 적어 주세요.'),NOT_RUNNING:()=>L('모델 서버가 꺼져 있습니다.'),TIMEOUT:()=>L('모델이 제때 답하지 못했습니다.'),NO_SUCH_MODEL:()=>L('그 모델이 모델 서버에 없습니다.')};
const why=e=>ERR[e]?ERR[e]():L`오류: ${e}`;
const cam=()=>Lab.cfg.cam&&Lab.cfg.cam.url||'';

function models(){const sel=$('#lk-model');if(!sel||!window.Models)return;const c=Models.cfg(),list=Models.list().filter(m=>m.vision);
  sel.textContent='';const none=document.createElement('option');none.value='';none.textContent=list.length?L('고르지 않음'):L('사진을 읽는 모델이 없습니다');sel.append(none);
  for(const m of list){const o=document.createElement('option');o.value=m.name;o.textContent=m.name;sel.append(o);}
  sel.value=list.some(m=>m.name===c.lmodel)?c.lmodel:(list[0]?list[0].name:'');draw();}

function draw(){const st=$('#lk-state'),note=$('#lk-note'),c=window.Models?Models.cfg():{};
  if(!D){st.className='chip';st.textContent=L('데스크톱 앱 전용');note.textContent=L('브라우저 데모에서는 카메라 사진을 모델에 보내지 않습니다.');return;}
  const url=cam();st.className='chip'+(url?' live':'');st.textContent=url?L('카메라 있음'):L('카메라 없음');
  $('#lk-glass').checked=!!c.gcam;
  note.textContent=!url?L('먼저 카메라 화면에 ESP32‑CAM 스트림 주소를 넣으세요. 사진은 같은 카메라의 /snapshot.jpg에서 받습니다.')
    :!$('#lk-model').value?L('사진을 읽는 모델이 필요합니다. 예: ollama pull gemma3:4b 또는 llava'):'';
  $('#lk-go').disabled=busy||!url||!$('#lk-model').value;}

async function look(e){e.preventDefault();if(!D||busy)return;const model=$('#lk-model').value,prompt=$('#lk-prompt').value.trim()||$('#lk-prompt').placeholder;
  busy=true;draw();$('#lk-go').textContent=L('찍고 묻는 중…');
  try{const r=await D.look(model,prompt,cam(),{maxTokens:256});const out=$('#lk-out');out.hidden=false;
    if(r.image&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(r.image))$('#lk-img').src=r.image;else $('#lk-img').removeAttribute('src');
    $('#lk-img').alt=L('모델이 본 사진');
    $('#lk-text').textContent=r.ok?(r.text||L('모델이 빈 답을 냈습니다.')):why(r.error);
    $('#lk-meta').textContent=r.ok?[model,r.ms!=null?(r.ms/1000).toFixed(1)+L('초'):'',r.imageBytes?Math.round(r.imageBytes/1024)+' KB':''].filter(Boolean).join(' · '):'';}
  finally{busy=false;$('#lk-go').textContent=L('사진 찍고 묻기');draw();}}

function wire(){$('#lk-prompt').placeholder=L('사진에 무엇이 보이나요? 사람이 있나요?');
  if(!D){for(const id of['#lk-model','#lk-prompt','#lk-glass','#lk-go'])$(id).disabled=true;draw();return;}
  $('#lk-form').addEventListener('submit',look);
  $('#lk-model').addEventListener('change',()=>{Models.cfg().lmodel=$('#lk-model').value;Lab.save();draw();});
  $('#lk-glass').addEventListener('change',()=>{Models.cfg().gcam=$('#lk-glass').checked;Lab.save();});
  window.addEventListener('hashchange',draw);models();}
return{wire,models,draw};
})();
