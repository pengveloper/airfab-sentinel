/* 화면 언어. 한국어 원문이 곧 열쇠입니다.
   영어 사전(i18n-en.js)에 같은 열쇠가 있으면 그 문장을 쓰고, 없으면 원문을 그대로 보여 줍니다.
   L`노드 ${n}대` 처럼 쓰면 열쇠는 "노드 {0}대"가 되고, 영어 문장에서는 {0}의 자리를 옮길 수 있습니다.
   언어는 주소의 ?lang=, 저장해 둔 선택, 기기 언어 순으로 정합니다. 바꾸면 화면을 다시 엽니다. */
(function(g){'use strict';
const EN=g.I18N_EN||{},HANGUL=/[ㄱ-ㆎ가-힣]/,KEY='wavrel-lang',ATTRS=['title','aria-label','placeholder','alt','data-title'];
const ok=x=>x==='ko'||x==='en';
let saved=null,asked=null;
try{saved=g.localStorage.getItem(KEY);}catch(e){}
try{asked=new URLSearchParams(g.location.search).get('lang');}catch(e){}
const lang=ok(asked)?asked:ok(saved)?saved:/^ko\b/i.test((g.navigator&&g.navigator.language)||'ko')?'ko':'en';
if(ok(asked)){try{if(asked!==saved)g.localStorage.setItem(KEY,asked);}catch(e){}
  try{const u=new URL(g.location.href);u.searchParams.delete('lang');g.history.replaceState(null,'',u.toString());}catch(e){}} // 적용한 뒤에는 주소를 깨끗이 둡니다
const missing=new Set(),keys=new WeakMap();
const join=(s,v)=>{let o=s[0];for(let i=0;i<v.length;i++)o+=v[i]+s[i+1];return o;};
function L(s,...v){
  if(typeof s==='string'){if(lang==='ko')return s;const e=EN[s];if(e==null){missing.add(s);return s;}return e;}
  if(lang==='ko')return join(s,v);
  let k=keys.get(s);if(k===undefined){k=s[0];for(let i=1;i<s.length;i++)k+='{'+(i-1)+'}'+s[i];keys.set(s,k);}
  const e=EN[k];if(e==null){missing.add(k);return join(s,v);}
  return e.replace(/\{(\d+)\}/g,(m,i)=>v[i]);}
/* index.html에 적어 둔 글자와 속성을 한 번 바꿉니다. 스크립트가 나중에 채우는 글자는 L을 거쳐 이미 맞는 언어로 들어옵니다. */
function page(){const d=g.document;if(lang!=='en'||!d||!d.body)return;d.documentElement.lang='en';
  const tr=t=>{const k=t.replace(/\s+/g,' ').trim();if(!k||!HANGUL.test(k))return null;const e=EN[k];if(e==null){missing.add(k);return null;}return t.replace(/^(\s*)[\s\S]*?(\s*)$/,(m,a,b)=>a+e+b);};
  const w=d.createTreeWalker(d.body,4,{acceptNode:n=>/^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName)?2:1});
  for(let n;(n=w.nextNode());){const e=tr(n.nodeValue);if(e!=null)n.nodeValue=e;}
  for(const el of d.querySelectorAll(ATTRS.map(a=>'['+a+']').join(',')))for(const a of ATTRS){const v=el.getAttribute(a);if(v){const e=tr(v);if(e!=null)el.setAttribute(a,e);}}}
/* 기본 이름이 다른 언어로 저장돼 있으면 지금 언어의 이름으로 돌려줍니다. 사전에 짝이 있는 짧은 이름만 해당합니다. */
const REV=new Map();for(const k in EN)if(k.length<=12&&!/[{<]/.test(k))REV.set(EN[k],k);
const alias=a=>typeof a!=='string'?a:lang==='en'?(a.length<=12&&HANGUL.test(a)&&EN[a]!=null?EN[a]:a):(REV.has(a)?REV.get(a):a);
g.L=L;
g.I18N={lang,missing,page,alias,set(l){if(!ok(l)||l===lang)return;try{g.localStorage.setItem(KEY,l);}catch(e){}
  // 고른 언어를 주소에 실어 다시 엽니다. 저장소를 쓸 수 없는 환경에서도 바뀌고, 주소가 달라지므로 화면이 반드시 새로 열립니다.
  try{const u=new URL(g.location.href);u.searchParams.set('lang',l);g.location.replace(u.toString());}catch(e){g.location.reload();}}};
page();
/* 언어 바꾸기 버튼: 바꿀 언어의 이름을 그 언어로 적습니다 */
if(g.document)for(const b of g.document.querySelectorAll('#lang,#su-lang')){const to=lang==='ko'?'en':'ko';b.textContent=to==='en'?'EN':'한국어';b.lang=to;
  b.setAttribute('aria-label',to==='en'?'Switch to English':'한국어로 바꾸기');b.addEventListener('click',()=>g.I18N.set(to));}
})(typeof window!=='undefined'?window:globalThis);
