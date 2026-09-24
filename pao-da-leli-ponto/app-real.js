function initPasswordToggles(){
  document.querySelectorAll('[data-password-toggle]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const input=document.getElementById(btn.dataset.passwordToggle);
      if(!input)return;
      const showing=input.type==='text';
      input.type=showing?'password':'text';
      btn.textContent=showing?'◉':'◎';
      btn.setAttribute('aria-label',showing?'Mostrar senha':'Ocultar senha');
      btn.setAttribute('title',showing?'Mostrar senha':'Ocultar senha');
    });
  });
}
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const API='/leli-api';
let currentUser=null,todayData=null,checklistData=null,lastConfirmReturn='ponto';

async function api(action,method='GET',data){
  const opt={method,headers:{'Content-Type':'application/json'}};
  if(data!==undefined)opt.body=JSON.stringify(data);
  const r=await fetch(API+'?action='+encodeURIComponent(action),opt);
  const j=await r.json().catch(()=>({error:'Resposta inválida do servidor.'}));
  if(!r.ok){const e=new Error(j.error||'Erro no sistema.');e.status=r.status;e.data=j;throw e}
  return j;
}
function show(id){
  $$('.screen').forEach(x=>x.classList.remove('active'));$('#'+id)?.classList.add('active');
  $('#bottom')?.classList.toggle('show',!['login','activate','confirm','review','correction','checklist','messages'].includes(id));
  $$('.nav').forEach(b=>b.classList.toggle('active',b.dataset.screen===id));
  if(id==='ponto')loadToday();
  if(id==='history')loadHistory();
  if(id==='profile')renderProfile();
  if(id==='review')renderReview();
}
function time(v){return v?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v)):'—'}
function dateLabel(v){if(!v)return'';const d=new Date(v+'T12:00:00');return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}
function fullDateLabel(v){if(!v)return'—';return new Date(v+'T12:00:00').toLocaleDateString('pt-BR')}
function dateTime(v){return v?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(v)):'—'}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function showConfirmation(title,text,rows){
  $('#confirmTitle').textContent=title;$('#confirmText').textContent=text;
  const details=$('#confirmDetails');details.textContent='';
  for(const [label,value] of rows){const row=document.createElement('div'),name=document.createElement('span'),result=document.createElement('b');row.className='row';name.textContent=label;result.textContent=value;row.append(name,result);details.append(row)}
  show('confirm');
}
function greeting(){const h=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',hour:'2-digit',hour12:false}).format(new Date()));return h<12?'Bom dia':h<18?'Boa tarde':'Boa noite'}
function event(kind){return todayData?.punches?.find(p=>p.kind===kind)}
function effective(kind){return time(event(kind)?.effective_at)}
function statusBadge(date,corr){
  const xs=corr.filter(c=>c.work_date===date);
  if(xs.some(c=>c.status==='pending'))return'<span class="pending">correção pendente</span>';
  if(xs.some(c=>c.status==='approved'))return'<span class="approved">corrigido</span>';
  if(xs.some(c=>c.status==='rejected'))return'<span class="rejected">correção recusada</span>';
  return'';
}
async function loadChecklistData(){checklistData=await api('checklist');return checklistData}
function renderMessages(){
  const messages=checklistData?.unreadMessages||[];
  $('#unreadMessages').innerHTML=messages.map(message=>'<article class="message-item"><div class="message-meta">De '+esc(message.sender_name)+' · '+dateTime(message.created_at)+'</div><p>'+esc(message.message)+'</p><div class="message-meta">'+esc(message.sender_unit||'')+(message.message_audience==='team'?' · Para toda a equipe':'')+'</div></article>').join('')||'<div class="empty">Nenhum recado novo.</div>';
}
async function openChecklist(){
  try{
    await loadChecklistData();
    $('#checklistUnitLabel').textContent=checklistData.unit||currentUser.unit||'Pão da Leli';
    const hasQuestions=checklistData.items.length>0;
    $('#checklistQuestions').innerHTML=hasQuestions?checklistData.items.map((item,index)=>'<div class="checklist-question"><strong>'+(index+1)+'. '+esc(item.question)+'</strong><div class="answer-options"><label class="answer-choice"><input type="radio" name="checklist_'+item.id+'" value="yes" required> Sim</label><label class="answer-choice"><input type="radio" name="checklist_'+item.id+'" value="no" required> Não</label></div></div>').join(''):'<div class="empty">O checklist desta área ainda não foi configurado. Avise o administrador.</div>';
    const missingOptions=checklistData.missingOptions||[];
    $('#missingOptions').innerHTML=missingOptions.length?missingOptions.map(item=>'<label class="missing-choice"><input type="checkbox" data-missing-id="'+item.id+'"> '+esc(item.label)+'</label>').join('')+'<label class="missing-choice nothing"><input id="nothingMissing" type="checkbox"> Nada está faltando</label>':'<div class="empty" style="grid-column:1/-1">A lista desta área ainda não foi configurada.</div>';
    $$('#missingOptions [data-missing-id]').forEach(input=>input.addEventListener('change',()=>{if(input.checked)document.getElementById('nothingMissing').checked=false}));
    document.getElementById('nothingMissing')?.addEventListener('change',event=>{if(event.target.checked)$$('#missingOptions [data-missing-id]').forEach(input=>{input.checked=false})});
    $('#checklistSubmit').disabled=!hasQuestions;
    $('#messageRecipient').innerHTML='<option value="team">Toda a equipe</option>'+checklistData.recipients.map(person=>'<option value="'+person.id+'">'+esc(person.name)+' · '+esc(person.unit)+'</option>').join('');
    $('#checklistMessage').value='';$('#messageRecipient').value='team';show('checklist');
  }catch(e){alert(e.message)}
}
async function loadToday(){
  try{
    todayData=await api('today');
    const d=new Date();
    $('#greeting').innerHTML=greeting()+',<br>'+currentUser.name+'.';
    $('#dateLine').textContent=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',weekday:'long',day:'2-digit',month:'long'}).format(d);
    $('#clock').textContent=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hour12:false}).format(d);
    const state=todayData.state;let html='',label='INICIAR JORNADA',disabled=false;
    if(state==='idle')html='<div class="label">Hoje</div><div class="big">Você ainda não iniciou sua jornada.</div>';
    if(state==='working'){html='<div class="statusline"><span class="dot"></span><b>Você está trabalhando</b></div><div class="big">Entrada '+effective('in')+'</div>';label='SAIR PARA INTERVALO'}
    if(state==='break'){html='<div class="label">Intervalo em andamento</div><div class="big">Desde '+effective('breakOut')+'</div>';label='VOLTAR AO TRABALHO'}
    if(state==='afterbreak'){html='<div class="statusline"><span class="dot"></span><b>Você voltou ao trabalho</b></div><div class="big">Retorno '+effective('breakIn')+'</div>';label='ENCERRAR JORNADA'}
    if(state==='out'){html='<div class="label">Jornada encerrada</div><div class="big">Saída '+effective('out')+'</div>';label='JORNADA ENCERRADA';disabled=true}
    $('#workCard').innerHTML=html;$('#mainAction').textContent=label;$('#mainAction').disabled=disabled;
  }catch(e){if(e.status===401){currentUser=null;show('login')}else alert(e.message)}
}
async function punch(){
  try{
    const before=todayData?.state;
    if(before==='afterbreak'){await openChecklist();return}
    await api('punch','POST',{});
    todayData=await api('today');
    const p=todayData.punches.at(-1),titles={in:['Jornada iniciada.','Entrada registrada com sucesso.'],breakOut:['Intervalo iniciado.','Saída para intervalo registrada.'],breakIn:['De volta!','Retorno do intervalo registrado.']};
    if(p.kind==='breakIn'){await openChecklist();return}
    const t=titles[p.kind]||['Ponto registrado.','Registro feito com sucesso.'];
    lastConfirmReturn='ponto';showConfirmation(t[0],t[1],[['Horário',time(p.occurred_at)],['Data',new Date(p.occurred_at).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'})]]);
  }catch(e){if(e.data?.needsChecklist)openChecklist();else{alert(e.message);loadToday()}}
}
function renderReview(){
  if(!todayData)return;
  $('#reviewGrid').innerHTML=[['Entrada','in'],['Saída intervalo','breakOut'],['Volta intervalo','breakIn'],['Saída','out']].map(([l,k])=>'<div class="mini"><span>'+l+'</span><b>'+effective(k)+'</b></div>').join('');
}
async function loadHistory(){
  try{
    const h=await api('history');
    $('#monthLabel').textContent=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',month:'long',year:'numeric'}).format(new Date());
    const map={};for(const p of h.punches){map[p.work_date]??={};map[p.work_date][p.kind]=p.occurred_at}
    for(const c of h.corrections){if(c.status==='approved'){map[c.work_date]??={};map[c.work_date][c.kind]=c.requested_at}}
    const dates=Object.keys(map).sort().reverse();
    let html='<div class="hrow head"><div>Data</div><div>Entrada</div><div>Intervalo</div><div>Saída</div></div>';
    if(!dates.length)html+='<div class="empty">Nenhum registro ainda.</div>';
    for(const d of dates){const r=map[d],bo=time(r.breakOut),bi=time(r.breakIn);html+='<div class="hrow"><div><b>'+dateLabel(d)+'</b><br>'+statusBadge(d,h.corrections)+'</div><div>'+time(r.in)+'</div><div>'+(bo==='—'?'—':bo+(bi!=='—'?'–'+bi:''))+'</div><div>'+time(r.out)+'</div></div>'}
    $('#historyTable').innerHTML=html;
  }catch(e){if(e.status===401)show('login');else alert(e.message)}
}
function renderAvatar(){
  const a=$('#avatar');if(!a)return;
  if(currentUser?.photo_data)a.innerHTML='<img src="'+currentUser.photo_data+'" alt="Foto de perfil">';
  else a.innerHTML='<span>'+currentUser.name.split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase()+'</span>';
}
function renderProfile(){
  if(!currentUser)return;
  $('#profileName').textContent=currentUser.name;$('#profileRole').textContent=currentUser.position||'Colaborador';$('#profileUnit').textContent=currentUser.unit||'Pão da Leli';renderAvatar();
}
function resizeImage(file){
  return new Promise((resolve,reject)=>{const img=new Image(),u=URL.createObjectURL(file);img.onload=()=>{const max=320,s=Math.min(1,max/Math.max(img.width,img.height)),w=Math.round(img.width*s),h=Math.round(img.height*s),c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);URL.revokeObjectURL(u);resolve(c.toDataURL('image/jpeg',.78))};img.onerror=reject;img.src=u})
}
async function boot(){
  try{const m=await api('me');if(!(await enterEmployeeApp(m.user)))return}catch{show('login')}
  if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
async function enterEmployeeApp(user){
  if(user?.role!=='employee'){
    await api('logout','POST',{}).catch(()=>{});
    currentUser=null;show('login');return false;
  }
  currentUser=user;
  try{await loadChecklistData();if(checklistData.unreadMessages.length){renderMessages();show('messages')}else show('ponto')}
  catch{checklistData=null;show('ponto')}
  return true;
}
$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();try{const r=await api('login','POST',{email:$('#email').value.trim(),password:$('#password').value});await enterEmployeeApp(r.user)}catch(err){if(err.data?.needsActivation){$('#activateEmail').value=$('#email').value.trim();show('activate')}else alert(err.message)}});
$('#goActivate').addEventListener('click',()=>{$('#activateEmail').value=$('#email').value.trim();show('activate')});$('#backToLogin').addEventListener('click',()=>show('login'));
$('#activateForm').addEventListener('submit',async e=>{e.preventDefault();try{await api('activate','POST',{email:$('#activateEmail').value.trim(),code:$('#activateCode').value.trim(),password:$('#activatePassword').value});alert('Conta ativada. Agora você já pode entrar.');$('#email').value=$('#activateEmail').value.trim();$('#password').value='';show('login')}catch(err){alert(err.message)}});
$('#mainAction').addEventListener('click',punch);
$('#cancelChecklist').addEventListener('click',()=>show('ponto'));
$('#checklistForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const answers=[];
  for(const item of checklistData?.items||[]){
    const selected=document.querySelector('input[name="checklist_'+item.id+'"]:checked');
    if(!selected){alert('Responda todas as perguntas com Sim ou Não.');return}
    answers.push({id:item.id,answer:selected.value==='yes'});
  }
  const missingItemIds=$$('#missingOptions [data-missing-id]:checked').map(input=>input.dataset.missingId),nothingMissing=Boolean(document.getElementById('nothingMissing')?.checked);
  if((checklistData?.missingOptions||[]).length&&!missingItemIds.length&&!nothingMissing){alert('Marque o que está faltando ou escolha “Nada está faltando”.');return}
  const message=$('#checklistMessage').value.trim(),recipientChoice=$('#messageRecipient').value,messageAudience=recipientChoice==='team'?'team':'individual',recipientId=messageAudience==='individual'?recipientChoice:null;
  const button=e.submitter||e.currentTarget.querySelector('button[type="submit"]');button.disabled=true;button.textContent='REGISTRANDO...';
  try{
    await api('checkout','POST',{answers,missingItemIds,nothingMissing,message,messageAudience,recipientId});
    todayData=await api('today');show('review');
  }catch(err){
    if(err.data?.checklistChanged){alert(err.message);await openChecklist()}else alert(err.message)
  }finally{button.disabled=false;button.textContent='CONCLUIR E REGISTRAR SAÍDA'}
});
$('#messagesOk').addEventListener('click',async()=>{
  const ids=(checklistData?.unreadMessages||[]).map(message=>message.id);
  try{if(ids.length)await api('messages-read','POST',{ids});if(checklistData)checklistData.unreadMessages=[];show('ponto')}catch(err){alert(err.message)}
});
$('#confirmOk').addEventListener('click',()=>show(lastConfirmReturn));
$('#reviewOk').addEventListener('click',()=>{
  lastConfirmReturn='ponto';
  showConfirmation('Jornada encerrada.','Tudo certo por hoje.',[['Horário',effective('out')],['Data',new Date().toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'})]]);
});

function fillCorrectionForm(){
  const map={in:['origIn','corrIn'],breakOut:['origBreakOut','corrBreakOut'],breakIn:['origBreakIn','corrBreakIn'],out:['origOut','corrOut']};
  for(const [kind,[origId,inputId]] of Object.entries(map)){
    const value=effective(kind);
    $('#'+origId).textContent=value;
    $('#'+inputId).value=value==='—'?'':value;
  }
}
$('#requestCorrection').addEventListener('click',()=>{if(['in','breakOut','breakIn','out'].some(kind=>effective(kind)==='—')){alert('A jornada precisa ter as quatro batidas antes da correção.');return}fillCorrectionForm();show('correction')});
$('#cancelCorrection').addEventListener('click',()=>show('review'));
$('#correctionForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const ordered=[$('#corrIn').value,$('#corrBreakOut').value,$('#corrBreakIn').value,$('#corrOut').value];
  const correctionDate=todayData.date;
  const minutes=ordered.map(value=>Number(value.slice(0,2))*60+Number(value.slice(3)));
  if(minutes.some((value,index)=>index>0&&value<minutes[index-1])){alert('Confira os horários: o intervalo não pode ser antes da chegada, a volta não pode ser antes do intervalo e a saída não pode ser antes da volta.');return}
  try{
    await api('correction-batch','POST',{
      date:correctionDate,
      reason:$('#corrReason').value.trim(),
      times:{
        in:$('#corrIn').value,
        breakOut:$('#corrBreakOut').value,
        breakIn:$('#corrBreakIn').value,
        out:$('#corrOut').value
      }
    });
    $('#corrReason').value='';
    lastConfirmReturn='ponto';
    showConfirmation('Pedido enviado.','O administrador ainda precisa aprovar. Até lá, os horários antigos continuam valendo.',[
      ['Data',fullDateLabel(correctionDate)],
      ['Entrada',ordered[0]],
      ['Saída para intervalo',ordered[1]],
      ['Volta do intervalo',ordered[2]],
      ['Saída',ordered[3]],
      ['Status','Aguardando aprovação']
    ]);
  }catch(err){alert(err.message)}
});
$('#photoBtn').addEventListener('click',()=>$('#photoInput').click());$('#photoInput').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{const photo=await resizeImage(f);await api('photo','POST',{photo});currentUser.photo_data=photo;renderAvatar()}catch(err){alert(err.message)}});
$('#logoutBtn').addEventListener('click',async()=>{try{await api('logout','POST',{})}catch{}currentUser=null;show('login')});
$$('.nav').forEach(b=>b.addEventListener('click',()=>show(b.dataset.screen)));setInterval(()=>{if($('#ponto')?.classList.contains('active'))$('#clock').textContent=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date())},1000);
initPasswordToggles();
boot();
