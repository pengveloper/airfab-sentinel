/* 밖에서 묻기: 로키드 앱의 사용자 지정 에이전트 → Wavrel 중계 서버(server/) → 이 PC.
   창은 서버에 직접 닿지 않습니다. 주소와 토큰은 메인 프로세스가 확인해 보관하고(토큰은 OS 암호화 저장소),
   창에는 연결 상태만 돌려줍니다. 저장한 토큰은 다시 보여 주지 않습니다. */
window.Remote=(()=>{'use strict';
const $=s=>document.querySelector(s),D=window.desktop||null;
let st={state:'off',url:null,hasToken:false,error:null,counts:{asked:0,answered:0}};
const ERR={UNREACHABLE:()=>L('서버에 연결하지 못했습니다. 주소와 토큰을 확인하세요.'),DROPPED:()=>L('연결이 끊겨 다시 잇는 중입니다.'),
  BUSY:()=>L('다른 PC가 같은 토큰으로 연결해 있습니다. 그 PC가 끊기면 이 PC가 이어받습니다.'),BAD_URL:()=>L('wss://로 시작하는 주소만 쓸 수 있습니다.'),
  BAD_TOKEN:()=>L('토큰 모양이 맞지 않습니다. 파라미터 스토어의 값을 그대로 붙여 넣으세요.'),NO_SECURE_STORAGE:()=>L('이 PC에서는 토큰을 안전하게 저장할 수 없습니다.')};
const why=e=>ERR[e]?ERR[e]():L('알 수 없는 오류입니다.');

function draw(){const chip=$('#rm-state'),note=$('#rm-note');
  if(!D){chip.className='chip';chip.textContent=L('데스크톱 앱 전용');note.textContent=L('브라우저 데모에서는 중계 서버에 연결하지 않습니다.');return;}
  const on=st.state==='on',wait=st.state==='connecting'||st.state==='retrying';
  chip.className='chip '+(on?'live':st.error==='BUSY'?'warn':st.state==='retrying'?'bad':'');
  chip.textContent=on?L('연결됨'):st.error==='BUSY'?L('대기 중'):wait?L('연결 중'):L('꺼짐');
  if(st.url&&document.activeElement!==$('#rm-url'))$('#rm-url').value=st.url;
  $('#rm-token').placeholder=st.hasToken?L('저장된 토큰을 그대로 둡니다'):L('파라미터 스토어의 home-token 값');
  note.textContent=on?L`질문 ${st.counts.asked}개를 받아 ${st.counts.answered}개에 답했습니다. 위의 '휴대폰·안경 질문에 답하기'가 켜져 있어야 답합니다.`
    :st.error?why(st.error):st.url?'':L('서버를 직접 띄우는 방법은 docs/ROKID_AGENT.md에 있습니다.');}

async function save(e){e.preventDefault();if(!D)return;
  const r=await D.setRemote($('#rm-url').value.trim(),$('#rm-token').value.trim());
  $('#rm-token').value='';
  if(r.refused){st={...st,...r,error:r.refused};draw();return;}
  st=r;draw();}
async function off(){if(!D)return;st=await D.setRemote('','');$('#rm-url').value='';draw();}

function wire(){
  $('#rm-form').addEventListener('submit',save);$('#rm-off').addEventListener('click',off);
  for(const id of['#rm-url','#rm-token','#rm-save','#rm-off'])$(id).disabled=!D;
  if(D){D.onRemote(s=>{st=s;draw();});D.remote().then(s=>{st=s;draw();});}
  draw();}
return{wire,update(){}};
})();
