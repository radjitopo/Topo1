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
const punchLabels={in:'Entrada',breakOut:'Saída para intervalo',breakIn:'Volta do intervalo',out:'Saída'};
const scheduleDays=[
  {weekday:1,label:'Segunda-feira'},
  {weekday:2,label:'Terça-feira'},
  {weekday:3,label:'Quarta-feira'},
  {weekday:4,label:'Quinta-feira'},
  {weekday:5,label:'Sexta-feira'},
  {weekday:6,label:'Sábado'},
  {weekday:0,label:'Domingo'}
];
let currentUser=null,overview=null,selectedEmployeeId=null,checklistAdminData=null;
async function api(action,method='GET',data){
  const params=new URLSearchParams({action});
  const opt={method,headers:{'Content-Type':'application/json'}};
  if(method==='GET'&&data){for(const [key,value] of Object.entries(data))params.set(key,String(value))}
  else if(data!==undefined)opt.body=JSON.stringify(data);
  const r=await fetch(API+'?'+params.toString(),opt);
  const j=await r.json().catch(()=>({error:'Resposta inválida do servidor.'}));
  if(!r.ok){const e=new Error(j.error||'Erro no sistema.');e.status=r.status;e.data=j;throw e}
  return j;
}
function showOnly(id){['setup','adminLogin','dashboard'].forEach(x=>$('#'+x).classList.add('hidden'));$('#'+id).classList.remove('hidden')}
async function endAdminSession(destination){
  try{
    await api('logout','POST',{});
    currentUser=null;
    if(destination)location.replace(destination);
    else showOnly('adminLogin');
  }catch(err){alert('Não foi possível encerrar a sessão. '+err.message)}
}
function time(v){return v?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v)):'—'}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function dateTime(v){return v?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v)):'—'}
function editorQuestions(){return $$('#checklistQuestionsAdmin input').map(input=>input.value)}
function renderChecklistEditor(values){
  const unit=$('#checklistUnit').value;
  const questions=values??(checklistAdminData?.items||[]).filter(item=>item.unit===unit).map(item=>item.question);
  const rows=questions.length?questions:[''];
  $('#checklistQuestionsAdmin').innerHTML=rows.map((question,index)=>'<div class="checklist-question-row"><span class="checklist-number">'+(index+1)+'</span><input value="'+esc(question)+'" maxlength="220" placeholder="Digite uma pergunta" aria-label="Pergunta '+(index+1)+'"><div class="checklist-row-actions"><button type="button" title="Subir pergunta" aria-label="Subir pergunta" onclick="moveChecklistQuestion('+index+',-1)" '+(index===0?'disabled':'')+'>↑</button><button type="button" title="Descer pergunta" aria-label="Descer pergunta" onclick="moveChecklistQuestion('+index+',1)" '+(index===rows.length-1?'disabled':'')+'>↓</button><button type="button" title="Remover pergunta" aria-label="Remover pergunta" onclick="removeChecklistQuestion('+index+')">×</button></div></div>').join('');
}
function checklistAnswers(value){
  if(Array.isArray(value))return value;
  try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed:[]}catch{return[]}
}
function renderChecklistHistory(){
  const submissions=checklistAdminData?.submissions||[];
  $('#checklistHistory').innerHTML=submissions.map(row=>{
    const answers=checklistAnswers(row.answers);
    const answerHtml=answers.length?'<div class="checklist-answers">'+answers.map(answer=>'<div class="checklist-answer '+(answer.answer?'yes':'no')+'"><span>'+esc(answer.question)+'</span><b>'+(answer.answer?'Sim':'Não')+'</b></div>').join('')+'</div>':'<div class="sub" style="margin-top:9px">Nenhuma pergunta estava configurada para esta área.</div>';
    const messageHtml=row.message?'<div class="message-box"><div class="sub">Recado para '+esc(row.recipient_name||'destinatário removido')+' · '+(row.read_at?'lido pelo destinatário':'ainda não lido')+'</div><p>'+esc(row.message)+'</p></div>':'';
    return '<article class="checklist-entry"><div class="checklist-entry-head"><div><strong>'+esc(row.employee_name)+'</strong><div class="sub">'+esc(row.unit)+' · '+dateTime(row.created_at)+'</div></div><span class="badge approved">'+esc(fullDateLabel(row.work_date))+'</span></div>'+answerHtml+messageHtml+'</article>';
  }).join('')||'<div class="empty">Nenhum checklist concluído ainda.</div>';
}
async function loadAdminChecklist(){
  $('#checklistHistory').innerHTML='<div class="empty">Carregando...</div>';
  try{checklistAdminData=await api('admin-checklist');renderChecklistEditor();renderChecklistHistory()}
  catch(e){if(e.status===401)showOnly('adminLogin');else alert(e.message)}
}
window.removeChecklistQuestion=index=>{const questions=editorQuestions();questions.splice(index,1);renderChecklistEditor(questions)};
window.moveChecklistQuestion=(index,direction)=>{const questions=editorQuestions(),target=index+direction;if(target<0||target>=questions.length)return;[questions[index],questions[target]]=[questions[target],questions[index]];renderChecklistEditor(questions);$$('#checklistQuestionsAdmin input')[target]?.focus()};
function correctionGroups(rows){
  const groups=new Map();
  for(const row of rows){
    const key=row.request_group||row.id;
    if(!groups.has(key))groups.set(key,{...row,key,grouped:Boolean(row.request_group),items:[]});
    groups.get(key).items.push(row);
  }
  return [...groups.values()];
}
function correctionDecision(item){
  if(item.status==='pending')return '<div class="correction-decision"><button class="btn small" type="button" onclick="decideCorrection(\''+item.id+'\',\'approved\')">Aprovar</button><button class="btn small red" type="button" onclick="decideCorrection(\''+item.id+'\',\'rejected\')">Recusar</button></div>';
  const label=item.status==='approved'?'Aprovado':'Recusado';
  return '<div class="correction-decision"><span class="badge '+item.status+'">'+label+'</span>'+(item.decided_by_name?'<span class="sub">por '+esc(item.decided_by_name)+'</span>':'')+'<button class="btn small secondary" type="button" onclick="redoCorrection(\''+item.id+'\')">Refazer</button></div>';
}
function correctionRequestSummary(items){
  const approved=items.filter(item=>item.status==='approved').length,rejected=items.filter(item=>item.status==='rejected').length,pending=items.filter(item=>item.status==='pending').length;
  const parts=[];
  if(approved)parts.push(approved+' '+(approved===1?'aprovado':'aprovados'));
  if(rejected)parts.push(rejected+' '+(rejected===1?'recusado':'recusados'));
  if(pending)parts.push(pending+' '+(pending===1?'pendente':'pendentes'));
  return '<div class="correction-summary"><span class="badge '+(pending?'pending':'approved')+'">'+(pending?'Aguardando decisão':'Pedido analisado')+'</span><span class="sub">'+parts.join(' · ')+'</span></div>';
}
function fullDateLabel(value){
  if(!value)return'';
  return new Date(value+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'});
}
function syncScheduleRow(row){
  const active=row.querySelector('input[type="checkbox"]').checked;
  row.querySelectorAll('input[type="time"]').forEach(input=>{input.disabled=!active;input.required=active});
}
function renderSchedule(schedule){
  const byDay=new Map(schedule.map(day=>[Number(day.weekday),day]));
  $('#scheduleList').innerHTML=scheduleDays.map(day=>{
    const saved=byDay.get(day.weekday);
    const times=[
      ['startTime','Entrada',saved?.start_time||''],
      ['breakStartTime','Saída intervalo',saved?.break_start_time||''],
      ['breakEndTime','Volta intervalo',saved?.break_end_time||''],
      ['endTime','Saída',saved?.end_time||'']
    ];
    return '<div class="schedule-row" data-weekday="'+day.weekday+'"><label class="schedule-toggle"><input type="checkbox" '+(saved?'checked':'')+'> '+day.label+'</label>'+times.map(([key,label,value])=>'<label class="schedule-time">'+label+'<input type="time" data-time="'+key+'" value="'+esc(value)+'" '+(saved?'':'disabled')+'></label>').join('')+'</div>';
  }).join('');
  $$('#scheduleList .schedule-row').forEach(row=>{syncScheduleRow(row);row.querySelector('input[type="checkbox"]').addEventListener('change',()=>syncScheduleRow(row))});
}
function historyBadge(date,corrections,row){
  const statuses=corrections.filter(c=>c.work_date===date).map(c=>c.status);
  if(statuses.includes('pending'))return'<span class="badge pending">correção pendente</span>';
  if(statuses.includes('approved'))return'<span class="badge approved">corrigido</span>';
  if(statuses.includes('rejected'))return'<span class="badge rejected">correção recusada</span>';
  return Object.keys(row).length===4?'<span class="badge approved">completo</span>':'<span class="badge pending">incompleto</span>';
}
function renderEmployeeHistory(detail){
  const days={};
  for(const punch of detail.punches){days[punch.work_date]??={};days[punch.work_date][punch.kind]=punch.occurred_at}
  const applied=new Set();
  for(const correction of detail.corrections){
    if(correction.status!=='approved')continue;
    const key=correction.work_date+':'+correction.kind;
    if(applied.has(key))continue;
    days[correction.work_date]??={};days[correction.work_date][correction.kind]=correction.requested_at;applied.add(key);
  }
  const dates=Object.keys(days).sort().reverse();
  $('#historyCount').textContent=dates.length+' '+(dates.length===1?'jornada':'jornadas');
  $('#employeeHistory').innerHTML=dates.map(date=>{
    const row=days[date];
    return '<article class="history-day"><div class="history-day-head"><strong>'+fullDateLabel(date)+'</strong>'+historyBadge(date,detail.corrections,row)+'</div><div class="history-times">'+Object.entries(punchLabels).map(([kind,label])=>'<div class="history-time"><span>'+label+'</span><b>'+time(row[kind])+'</b></div>').join('')+'</div></article>';
  }).join('')||'<div class="empty">Nenhuma jornada registrada ainda.</div>';
}
window.openEmployee=async id=>{
  selectedEmployeeId=id;
  $('#employeeGrid').classList.add('hidden');$('#employeeDetail').classList.remove('hidden');$('#employeeDetailBody').classList.add('hidden');
  $('#employeeDetailName').textContent='Carregando funcionário...';$('#employeeDetailMeta').textContent='';$('#employeeDetailStatus').innerHTML='';$('#scheduleStatus').textContent='';
  try{
    const detail=await api('admin-employee-detail','GET',{id});
    const employee=detail.employee;
    $('#employeeDetailName').textContent=employee.name;
    $('#employeeDetailMeta').textContent=[employee.email,employee.unit].filter(Boolean).join(' · ');
    $('#employeeDetailStatus').innerHTML=employee.pending_activation?'<span class="badge pending">aguardando ativação</span>':employee.active?'<span class="badge approved">ativo</span>':'<span class="badge rejected">desativado</span>';
    renderSchedule(detail.schedule);renderEmployeeHistory(detail);$('#employeeDetailBody').classList.remove('hidden');
    $('#employeeDetail').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(e){selectedEmployeeId=null;$('#employeeDetail').classList.add('hidden');$('#employeeGrid').classList.remove('hidden');alert(e.message)}
};
function closeEmployeeDetail(){selectedEmployeeId=null;$('#employeeDetail').classList.add('hidden');$('#employeeGrid').classList.remove('hidden');$('#scheduleStatus').textContent=''}
async function boot(){
  try{
    const health=await api('health');
    if(!health.hasAdmin){showOnly('setup');return}
    try{
      const m=await api('me');if(m.user?.role!=='admin')throw new Error('not admin');currentUser=m.user;showOnly('dashboard');$('#loggedAs').textContent='Entrou como '+currentUser.name;await render();
    }catch{showOnly('adminLogin')}
  }catch(e){alert('Não foi possível conectar ao banco de dados. '+e.message);showOnly('adminLogin')}
}
async function render(){
  try{
    overview=await api('admin-overview');
    const {users,punches,corrections,date}=overview;
    const correctionRequests=correctionGroups(corrections);
    const pendingCorrectionRequests=correctionRequests.filter(request=>request.items.some(item=>item.status==='pending')).length;
    $('#batidas').textContent=punches.length;
    $('#entradas').textContent=punches.filter(p=>p.kind==='in').length;
    $('#pendentes').textContent=pendingCorrectionRequests;
    $('#correctionCount').textContent=pendingCorrectionRequests;
    $('#correctionCount').classList.toggle('hidden',pendingCorrectionRequests===0);
    $('#correctionCount').setAttribute('aria-hidden',pendingCorrectionRequests===0?'true':'false');
    $('[data-tab="corrections"]').setAttribute('aria-label',pendingCorrectionRequests?'Correções, '+pendingCorrectionRequests+' '+(pendingCorrectionRequests===1?'pedido pendente':'pedidos pendentes'):'Correções');
    $('#funcionarios').textContent=users.filter(u=>u.role==='employee'&&u.active).length;

    const empUsers=users.filter(u=>u.role==='employee');
    const todayBy={};for(const p of punches){todayBy[p.user_id]??={};todayBy[p.user_id][p.kind]=p}
    $('#todayList').innerHTML=empUsers.map(u=>{const r=todayBy[u.id]||{};let st='<span class="badge">sem jornada</span>';if(r.in&&!r.out)st='<span class="badge pending">em andamento</span>';if(r.out)st='<span class="badge approved">jornada encerrada</span>';return '<div class="item"><div><strong>'+esc(u.name)+'</strong><div class="sub">Entrada '+time(r.in?.occurred_at)+' · Intervalo '+time(r.breakOut?.occurred_at)+' / '+time(r.breakIn?.occurred_at)+' · Saída '+time(r.out?.occurred_at)+'</div></div><div>'+st+'</div></div>'}).join('')||'<p class="muted">Nenhum funcionário cadastrado.</p>';

    $('#employeeList').innerHTML=empUsers.map(u=>'<div class="item employee-item" role="button" tabindex="0" data-employee-id="'+esc(u.id)+'"><div><strong>'+esc(u.name)+'</strong><div class="sub">'+esc(u.email)+' · '+esc(u.unit)+'</div><div style="margin-top:6px">'+(u.pending_activation?'<span class="badge pending">aguardando ativação</span><div class="activation-code">Código de ativação: <strong>'+esc(u.activation_code||'—')+'</strong></div>':u.active?'<span class="badge approved">ativo</span>':'<span class="badge rejected">desativado</span>')+'</div></div><div class="actions"><button class="btn small" onclick="openEmployee(\''+u.id+'\')">Ver ficha</button>'+(u.pending_activation&&u.activation_code?'<button class="btn small secondary" onclick="copyActivation(\''+esc(u.activation_code)+'\')">Copiar código</button>':'')+(u.pending_activation?'<button class="btn small secondary" onclick="regenActivation(\''+u.id+'\')">Trocar código</button>':'')+'<button class="btn small secondary" onclick="toggleUser(\''+u.id+'\')">'+(u.active?'Desativar':'Reativar')+'</button></div></div>').join('')||'<p class="muted">Nenhum funcionário.</p>';
    $$('#employeeList .employee-item').forEach(item=>{
      item.addEventListener('click',event=>{if(!event.target.closest('button'))openEmployee(item.dataset.employeeId)});
      item.addEventListener('keydown',event=>{if(event.target.closest('button'))return;if(event.key==='Enter'||event.key===' '){event.preventDefault();openEmployee(item.dataset.employeeId)}});
    });

    const labels={in:'Chegada',breakOut:'Saída para intervalo',breakIn:'Volta do intervalo',out:'Saída'},order={in:0,breakOut:1,breakIn:2,out:3};
    $('#correctionList').innerHTML=correctionRequests.map(c=>{const items=c.items.slice().sort((a,b)=>order[a.kind]-order[b.kind]),complete=c.grouped&&items.length===4,table='<div class="correction-times"><div class="correction-time-head"><span>Batida</span><span>Registrado</span><span>Solicitado</span><span>Decisão</span></div>'+items.map(x=>'<div class="correction-time-row '+(time(x.original_at)!==time(x.requested_at)?'changed':'')+'"><strong>'+labels[x.kind]+'</strong><b>'+time(x.original_at)+'</b><b>'+time(x.requested_at)+'</b>'+correctionDecision(x)+'</div>').join('')+'</div>';return '<div class="item"><div class="correction-content"><strong>'+esc(c.name)+' — '+(complete?'Jornada completa':labels[c.kind])+'</strong><div class="sub">'+c.work_date.split('-').reverse().join('/')+'</div>'+table+'<div class="sub">Motivo: '+esc(c.reason)+'</div>'+correctionRequestSummary(items)+'</div></div>'}).join('')||'<p class="muted">Nenhuma solicitação de correção.</p>';

    const admins=users.filter(u=>u.role==='admin');
    $('#adminList').innerHTML=admins.map(u=>'<div class="item"><div><strong>'+esc(u.name)+'</strong><div class="sub">'+esc(u.email)+'</div><div style="margin-top:6px">'+(u.pending_activation?'<span class="badge pending">aguardando ativação</span>':u.active?'<span class="badge approved">ativo</span>':'<span class="badge rejected">desativado</span>')+'</div></div></div>').join('');
    $('#addAdminForm').querySelector('button').disabled=admins.filter(u=>u.active).length>=2;
  }catch(e){if(e.status===401){showOnly('adminLogin')}else alert(e.message)}
}
window.copyActivation=async code=>{if(!code)return;try{await navigator.clipboard.writeText(code);alert('Código copiado.')}catch{prompt('Copie o código:',code)}}
window.toggleUser=async id=>{try{await api('admin-toggle-user','POST',{id});await render()}catch(e){alert(e.message)}}
window.regenActivation=async id=>{const email=overview?.users?.find(u=>u.id===id)?.email||'esta pessoa';if(!confirm('Trocar o código de ativação de '+email+'? O código anterior deixará de funcionar.'))return;try{const r=await api('admin-reset-activation','POST',{id});await render();alert('Novo código: '+r.activationCode)}catch(e){alert(e.message)}}
window.decideCorrection=async(id,status)=>{const note=prompt(status==='approved'?'Observação opcional da aprovação:':'Motivo opcional da recusa:','');if(note===null)return;try{await api('admin-decide-correction','POST',{id,status,note});await render()}catch(e){alert(e.message)}}
window.redoCorrection=async id=>{if(!confirm('Refazer esta decisão? O horário voltará para pendente.'))return;try{await api('admin-reset-correction-decision','POST',{id});await render()}catch(e){alert(e.message)}}

$('#setupForm').addEventListener('submit',async e=>{e.preventDefault();try{await api('bootstrap','POST',{token:$('#setupToken').value.trim(),name:$('#setupName').value.trim(),email:$('#setupEmail').value.trim(),password:$('#setupPassword').value});alert('Administrador criado. Faça o login.');showOnly('adminLogin');$('#adminEmail').value=$('#setupEmail').value.trim()}catch(err){alert(err.message)}});
$('#adminLoginForm').addEventListener('submit',async e=>{e.preventDefault();try{const r=await api('login','POST',{email:$('#adminEmail').value.trim(),password:$('#adminPassword').value});if(r.user.role!=='admin'){await api('logout','POST',{});throw new Error('Este usuário não é administrador.')}currentUser=r.user;showOnly('dashboard');$('#loggedAs').textContent='Entrou como '+currentUser.name;await render()}catch(err){alert(err.message)}});
$('#employeeForm').addEventListener('submit',async e=>{e.preventDefault();try{const r=await api('admin-create-user','POST',{name:$('#empName').value.trim(),email:$('#empEmail').value.trim(),position:'Colaborador',unit:$('#empUnit').value,role:'employee'});$('#activationResult').innerHTML='<div class="notice" style="margin-top:12px"><b>'+esc(r.user.name)+'</b><br>Código de ativação: <strong style="font-size:18px">'+esc(r.activationCode)+'</strong><br><span class="sub">Este código ficará visível aqui até a conta ser ativada.</span></div>';e.target.reset();await render()}catch(err){alert(err.message)}});
$('#addAdminForm').addEventListener('submit',async e=>{e.preventDefault();try{const r=await api('admin-create-user','POST',{name:$('#newAdminName').value.trim(),email:$('#newAdminEmail').value.trim(),position:'Administrador',unit:'Pão da Leli',role:'admin'});$('#adminActivationResult').innerHTML='<div class="notice" style="margin-top:12px">Código do novo administrador: <strong>'+esc(r.activationCode)+'</strong><br><span class="sub">Este código ficará visível aqui até o administrador ativar a conta.</span></div>';e.target.reset();await render()}catch(err){alert(err.message)}});
$('#closeEmployeeDetail').addEventListener('click',closeEmployeeDetail);
$('#scheduleForm').addEventListener('submit',async e=>{
  e.preventDefault();if(!selectedEmployeeId)return;
  const days=$$('#scheduleList .schedule-row').filter(row=>row.querySelector('input[type="checkbox"]').checked).map(row=>({
    weekday:Number(row.dataset.weekday),
    startTime:row.querySelector('[data-time="startTime"]').value,
    breakStartTime:row.querySelector('[data-time="breakStartTime"]').value,
    breakEndTime:row.querySelector('[data-time="breakEndTime"]').value,
    endTime:row.querySelector('[data-time="endTime"]').value
  }));
  const button=e.submitter||e.currentTarget.querySelector('button[type="submit"]');button.disabled=true;$('#scheduleStatus').textContent='Salvando...';
  try{const id=selectedEmployeeId;await api('admin-save-schedule','POST',{id,days});await openEmployee(id);$('#scheduleStatus').textContent='Escala salva.'}
  catch(err){$('#scheduleStatus').textContent='';alert(err.message)}
  finally{button.disabled=false}
});
$('#checklistUnit').addEventListener('change',()=>{renderChecklistEditor();$('#checklistSaveStatus').textContent=''});
$('#addChecklistQuestion').addEventListener('click',()=>{const questions=editorQuestions();if(questions.length>=30){alert('O limite é de 30 perguntas por área.');return}questions.push('');renderChecklistEditor(questions);$$('#checklistQuestionsAdmin input').at(-1)?.focus()});
$('#checklistFormAdmin').addEventListener('submit',async e=>{
  e.preventDefault();const button=$('#saveChecklist'),questions=editorQuestions().map(value=>value.trim()).filter(Boolean);button.disabled=true;$('#checklistSaveStatus').textContent='Salvando...';
  try{await api('admin-save-checklist','POST',{unit:$('#checklistUnit').value,questions});await loadAdminChecklist();$('#checklistSaveStatus').textContent=questions.length?'Checklist salvo.':'Checklist removido.'}
  catch(err){$('#checklistSaveStatus').textContent='';alert(err.message)}
  finally{button.disabled=false}
});
$('#leaveAdmin').addEventListener('click',e=>{e.preventDefault();endAdminSession('./')});
$('#adminLogout').addEventListener('click',()=>endAdminSession());
$$('.tab').forEach(b=>b.addEventListener('click',()=>{$$('.tab').forEach(x=>x.classList.remove('active'));$$('.panel').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#'+b.dataset.tab).classList.add('active');if(b.dataset.tab==='checklistAdmin')loadAdminChecklist();else render()}));
initPasswordToggles();
boot();
