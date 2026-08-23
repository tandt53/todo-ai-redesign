const K='uat-flow-v2';let S={};try{S=JSON.parse(localStorage.getItem(K)||'{}')}catch(e){}
let PLAT=localStorage.getItem(K+'-p')||'web';
function plat(){document.querySelectorAll('.sh').forEach(el=>el.style.display=el.dataset.p===PLAT?'':'none');
document.querySelectorAll('.seg button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.p===PLAT))}
function paint(){let d=0;document.querySelectorAll('.v').forEach(v=>{const st=S[v.dataset.id]||{};
v.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===st.v));
if(st.n!==undefined)v.querySelector('.note').value=st.n;
const c=v.closest('.card');c.classList.remove('pass','fail','na');if(st.v){c.classList.add(st.v);d++}});
document.getElementById('prog').textContent=d+' / '+TOTAL}
function save(){try{localStorage.setItem(K,JSON.stringify(S))}catch(e){}paint()}
document.addEventListener('click',e=>{const sb=e.target.closest('.seg button');
if(sb){PLAT=sb.dataset.p;localStorage.setItem(K+'-p',PLAT);plat();return}
const b=e.target.closest('.v button');if(b){const id=b.closest('.v').dataset.id;S[id]=S[id]||{};
S[id].v=S[id].v===b.dataset.v?undefined:b.dataset.v;save();return}
if(e.target.tagName==='IMG'&&e.target.classList.contains('sh')){const lb=document.getElementById('lb');
lb.querySelector('img').src=e.target.src;lb.style.display='grid';return}
if(e.target.closest('#lb'))document.getElementById('lb').style.display='none'});
document.addEventListener('input',e=>{if(!e.target.classList.contains('note'))return;
const id=e.target.closest('.v').dataset.id;S[id]=S[id]||{};S[id].n=e.target.value;
try{localStorage.setItem(K,JSON.stringify(S))}catch(e2){}});
document.getElementById('exp').addEventListener('click',()=>{const out=[];
document.querySelectorAll('.flow').forEach(f=>{const rows=[];f.querySelectorAll('.card').forEach(c=>{
const st=S[c.querySelector('.v').dataset.id]||{};if(st.v)rows.push('  ['+st.v.toUpperCase()+'] '+c.querySelector('.cap span:last-child').innerText+(st.n?' — '+st.n:''))});
if(rows.length)out.push(f.querySelector('h2').innerText.replace(/\n/g,' ').trim()+'\n'+rows.join('\n'))});
const t='UAT '+PLAT+'\n\n'+(out.join('\n\n')||'(chưa đánh giá bước nào)');
navigator.clipboard?.writeText(t).then(()=>alert('Đã chép kết quả'),()=>prompt('Chép tay:',t))});
plat();paint();