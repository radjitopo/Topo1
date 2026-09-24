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
let currentUser=null,overview=null,selectedEmployeeId=null,checklistAdminData=null,monthlyReport=null;
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
function captureAccessLocation(){
  if(!navigator.geolocation)return Promise.reject(new Error('Este aparelho não permite confirmar a localização.'));
  return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(position=>resolve({
    latitude:position.coords.latitude,
    longitude:position.coords.longitude,
    accuracy:position.coords.accuracy,
    capturedAt:position.timestamp
  }),error=>{
    const messages={1:'Permita o acesso à localização para ativar esta proteção.',2:'Não foi possível confirmar sua localização. Ative a localização precisa e tente novamente.',3:'A localização demorou para responder. Tente novamente.'};
    reject(new Error(messages[error.code]||'Não foi possível confirmar sua localização.'));
  },{enableHighAccuracy:true,timeout:15000,maximumAge:0}));
}
function renderAccessPolicy(policy){
  const restricted=policy?.mode==='restricted',status=$('#accessPolicyStatus');
  status.classList.toggle('free',!restricted);
  $('#accessPolicyTitle').textContent=restricted?'Local + rede ativos':'Ponto livre';
  $('#accessPolicyText').textContent=restricted?'O ponto só é aceito na rede da padaria e dentro de um raio de 100 metros.':'Funcionários podem registrar o ponto de qualquer lugar.';
  const changed=policy?.updatedAt?'Alterado'+(policy.updatedByName?' por '+policy.updatedByName:'')+' em '+dateTime(policy.updatedAt):'';
  $('#accessPolicyMeta').textContent=(restricted?'Local e rede configurados. ':'')+changed;
  $('#restrictPunches').textContent=restricted?'Atualizar local + rede':'Ativar local + rede';
  $('#restrictPunches').disabled=false;$('#freePunches').disabled=!restricted;
}
function editorQuestions(){return $$('#checklistQuestionsAdmin input').map(input=>input.value)}
function editorMissingItems(){return $$('#missingOptionsAdmin input').map(input=>input.value)}
function renderQuestionEditor(values){
  const unit=$('#checklistUnit').value;
  const questions=values??(checklistAdminData?.items||[]).filter(item=>item.unit===unit).map(item=>item.question);
  const rows=questions.length?questions:[''];
  $('#checklistQuestionsAdmin').innerHTML=rows.map((question,index)=>'<div class="checklist-question-row"><span class="checklist-number">'+(index+1)+'</span><input value="'+esc(question)+'" maxlength="220" placeholder="Digite uma pergunta" aria-label="Pergunta '+(index+1)+'"><div class="checklist-row-actions"><button type="button" title="Subir pergunta" aria-label="Subir pergunta" onclick="moveChecklistQuestion('+index+',-1)" '+(index===0?'disabled':'')+'>↑</button><button type="button" title="Descer pergunta" aria-label="Descer pergunta" onclick="moveChecklistQuestion('+index+',1)" '+(index===rows.length-1?'disabled':'')+'>↓</button><button type="button" title="Remover pergunta" aria-label="Remover pergunta" onclick="removeChecklistQuestion('+index+')">×</button></div></div>').join('');
}
function renderMissingEditor(values){
  const unit=$('#checklistUnit').value;
  const missingItems=values??(checklistAdminData?.missingOptions||[]).filter(item=>item.unit===unit).map(item=>item.label);
  const rows=missingItems.length?missingItems:[''];
  $('#missingOptionsAdmin').innerHTML=rows.map((label,index)=>'<div class="checklist-question-row"><span class="checklist-number">'+(index+1)+'</span><input value="'+esc(label)+'" maxlength="120" placeholder="Ex.: leite, embalagens, detergente" aria-label="Item que pode faltar '+(index+1)+'"><div class="checklist-row-actions"><button type="button" title="Subir item" aria-label="Subir item" onclick="moveMissingItem('+index+',-1)" '+(index===0?'disabled':'')+'>↑</button><button type="button" title="Descer item" aria-label="Descer item" onclick="moveMissingItem('+index+',1)" '+(index===rows.length-1?'disabled':'')+'>↓</button><button type="button" title="Remover item" aria-label="Remover item" onclick="removeMissingItem('+index+')">×</button></div></div>').join('');
}
function renderChecklistEditors(){renderQuestionEditor();renderMissingEditor()}
function checklistAnswers(value){
  if(Array.isArray(value))return value;
  try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed:[]}catch{return[]}
}
function renderChecklistHistory(){
  const submissions=checklistAdminData?.submissions||[];
  $('#checklistHistory').innerHTML=submissions.map(row=>{
    const answers=checklistAnswers(row.answers);
    const missingItems=checklistAnswers(row.missing_items);
    const answerHtml=answers.length?'<div class="checklist-answers">'+answers.map(answer=>'<div class="checklist-answer '+(answer.answer?'yes':'no')+'"><span>'+esc(answer.question)+'</span><b>'+(answer.answer?'Sim':'Não')+'</b></div>').join('')+'</div>':'<div class="sub" style="margin-top:9px">Nenhuma pergunta estava configurada para esta área.</div>';
    const missingHtml=missingItems.length?'<div class="missing-tags">'+missingItems.map(item=>'<span class="missing-tag">Faltando: '+esc(item.label)+'</span>').join('')+'</div>':'<div class="sub" style="margin-top:9px">Nada informado como faltando.</div>';
    const target=row.message_audience==='team'?'toda a equipe':(row.recipient_name||'destinatário removido');
    const readStatus=row.message_audience==='team'?(Number(row.recipient_count)?Number(row.read_count)+' de '+Number(row.recipient_count)+' leram':'sem destinatários ativos'):(Number(row.read_count)?'lido pelo destinatário':'ainda não lido');
    const messageHtml=row.message?'<div class="message-box"><div class="sub">Recado para '+esc(target)+' · '+esc(readStatus)+'</div><p>'+esc(row.message)+'</p></div>':'';
    return '<article class="checklist-entry"><div class="checklist-entry-head"><div><strong>'+esc(row.employee_name)+'</strong><div class="sub">'+esc(row.unit)+' · '+dateTime(row.created_at)+'</div></div><span class="badge approved">'+esc(fullDateLabel(row.work_date))+'</span></div>'+answerHtml+missingHtml+messageHtml+'</article>';
  }).join('')||'<div class="empty">Nenhum checklist concluído ainda.</div>';
}
function renderClosingMessages(){
  const messages=(checklistAdminData?.submissions||[]).filter(row=>row.message).slice(0,30);
  $('#closingMessages').innerHTML=messages.map(row=>{const target=row.message_audience==='team'?'toda a equipe':(row.recipient_name||'destinatário removido');return '<article class="message-box" style="margin-top:0"><div class="sub">De '+esc(row.employee_name)+' para '+esc(target)+' · '+dateTime(row.created_at)+'</div><p>'+esc(row.message)+'</p></article>'}).join('')||'<div class="empty">Nenhum recado enviado ainda.</div>';
}
function renderMissingReports(){
  const reports=checklistAdminData?.missingReports||[];
  $('#missingReports').innerHTML=reports.map(row=>{const names=Array.isArray(row.reporter_names)?row.reporter_names.join(', '):String(row.reporter_names||'');return '<article class="missing-report"><div class="missing-report-head"><div><strong>'+esc(row.item_name)+'</strong><div class="sub">'+esc(row.unit)+' · último aviso '+dateTime(row.last_reported_at)+'</div></div><span class="missing-report-count">'+Number(row.report_count)+' '+(Number(row.report_count)===1?'aviso':'avisos')+'</span></div><div class="sub">Informado por: '+esc(names||'equipe')+'</div><div class="missing-report-actions"><button class="btn small" type="button" data-resolve-missing data-status="purchased" data-unit="'+esc(row.unit)+'" data-item-key="'+esc(row.item_key)+'">Comprado</button><button class="btn small secondary" type="button" data-resolve-missing data-status="resolved" data-unit="'+esc(row.unit)+'" data-item-key="'+esc(row.item_key)+'">Resolvido</button></div></article>'}).join('')||'<div class="empty">Nenhum item está faltando.</div>';
  $$('#missingReports [data-resolve-missing]').forEach(button=>button.addEventListener('click',async()=>{button.disabled=true;try{await api('admin-resolve-missing','POST',{unit:button.dataset.unit,itemKey:button.dataset.itemKey,status:button.dataset.status});await loadAdminChecklist()}catch(err){alert(err.message);button.disabled=false}}));
}
async function loadAdminChecklist(){
  $('#checklistHistory').innerHTML='<div class="empty">Carregando...</div>';
  $('#missingReports').innerHTML='<div class="empty">Carregando...</div>';$('#closingMessages').innerHTML='<div class="empty">Carregando...</div>';
  try{checklistAdminData=await api('admin-checklist');renderChecklistEditors();renderChecklistHistory();renderClosingMessages();renderMissingReports()}
  catch(e){if(e.status===401)showOnly('adminLogin');else alert(e.message)}
}
window.removeChecklistQuestion=index=>{const questions=editorQuestions();questions.splice(index,1);renderQuestionEditor(questions)};
window.moveChecklistQuestion=(index,direction)=>{const questions=editorQuestions(),target=index+direction;if(target<0||target>=questions.length)return;[questions[index],questions[target]]=[questions[target],questions[index]];renderQuestionEditor(questions);$$('#checklistQuestionsAdmin input')[target]?.focus()};
window.removeMissingItem=index=>{const items=editorMissingItems();items.splice(index,1);renderMissingEditor(items)};
window.moveMissingItem=(index,direction)=>{const items=editorMissingItems(),target=index+direction;if(target<0||target>=items.length)return;[items[index],items[target]]=[items[target],items[index]];renderMissingEditor(items);$$('#missingOptionsAdmin input')[target]?.focus()};
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
function currentMonth(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()).slice(0,7)}
function monthLabel(value){if(!value)return'';const label=new Date(value+'-01T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'});return label.charAt(0).toUpperCase()+label.slice(1)}
function durationLabel(value){if(value===null||value===undefined)return'—';const total=Math.max(0,Number(value)||0),hours=Math.floor(total/60),minutes=total%60;return hours?(hours+'h'+(minutes?' '+minutes+'min':'')):(minutes+'min')}
function reportStatusBadge(status){const type=status==='Completo'?'approved':status==='Falta'||status==='Batidas incompletas'?'rejected':status==='Fora da escala'?'':'pending';return '<span class="badge '+type+'">'+esc(status)+'</span>'}
function populateReportEmployees(users){
  const select=$('#reportEmployee'),selected=select.value;
  select.innerHTML='<option value="">Equipe inteira</option>'+users.map(user=>'<option value="'+esc(user.id)+'">'+esc(user.name)+(user.active?'':' (inativo)')+'</option>').join('');
  if([...select.options].some(option=>option.value===selected))select.value=selected;
}
function invalidateMonthlyReport(message='Os dados mudaram. Gere o fechamento novamente.'){
  monthlyReport=null;$('#reportContent').classList.add('hidden');$('#reportStatus').textContent=message;
}
function renderMonthlyReport(report){
  monthlyReport=report;$('#reportContent').classList.remove('hidden');$('#reportStatus').textContent='Fechamento atualizado.';
  $('#reportPeriodLabel').textContent=monthLabel(report.month);
  const people=report.employees.length===1?report.employees[0].name:report.employees.length+' '+(report.employees.length===1?'funcionário':'funcionários');
  $('#reportFilterLabel').textContent=people+' · período até '+report.periodEnd.split('-').reverse().join('/');
  $('#reportWorked').textContent=durationLabel(report.totals.workedMinutes);
  $('#reportExpected').textContent=durationLabel(report.totals.expectedMinutes);
  $('#reportDelays').textContent=durationLabel(report.totals.delayMinutes);
  $('#reportAbsences').textContent=report.totals.absenceDays;
  $('#reportCorrections').textContent=report.totals.correctionRequests;
  $('#reportEmployeeSummary').innerHTML=report.employees.map(employee=>'<article class="report-person"><div class="report-person-head"><div><strong>'+esc(employee.name)+'</strong><div class="sub">'+esc(employee.unit)+'</div></div>'+(employee.pendingCorrections?'<span class="badge pending">'+employee.pendingCorrections+' pendente'+(employee.pendingCorrections===1?'':'s')+'</span>':'')+'</div><div class="report-person-stats"><div class="report-person-stat"><span>Previsto</span><b>'+durationLabel(employee.expectedMinutes)+'</b></div><div class="report-person-stat"><span>Trabalhado</span><b>'+durationLabel(employee.workedMinutes)+'</b></div><div class="report-person-stat"><span>Atraso</span><b>'+durationLabel(employee.delayMinutes)+'</b></div><div class="report-person-stat"><span>Faltas</span><b>'+employee.absenceDays+'</b></div><div class="report-person-stat"><span>Incompletas</span><b>'+employee.incompleteDays+'</b></div><div class="report-person-stat"><span>Correções</span><b>'+employee.correctionRequests+'</b></div></div></article>').join('')||'<div class="empty">Nenhum funcionário encontrado.</div>';
  $('#reportRows').innerHTML=report.rows.map(row=>'<tr><td class="nowrap"><strong>'+esc(fullDateLabel(row.date))+'</strong></td><td><strong>'+esc(row.name)+'</strong><span class="sub">'+esc(row.unit)+'</span></td><td class="nowrap">'+esc(row.schedule)+'</td><td class="nowrap">'+row.punches.map(value=>esc(value||'—')).join(' · ')+'</td><td class="nowrap">'+durationLabel(row.workedMinutes)+'</td><td class="nowrap">'+durationLabel(row.delayMinutes)+'</td><td>'+reportStatusBadge(row.status)+'</td><td>'+(row.correctionRequests?row.correctionRequests+(row.pendingCorrections?' · '+row.pendingCorrections+' pendente'+(row.pendingCorrections===1?'':'s'):''):'—')+'</td></tr>').join('')||'<tr><td colspan="8" class="empty">Nenhuma jornada encontrada neste período.</td></tr>';
}
function csvCell(value){return '"'+String(value??'').replace(/"/g,'""')+'"'}
function downloadMonthlyReport(){
  if(!monthlyReport)return;
  const report=monthlyReport,lines=[
    ['Pão da Leli — Fechamento mensal'],
    ['Mês',monthLabel(report.month)],
    ['Período',report.periodStart.split('-').reverse().join('/')+' a '+report.periodEnd.split('-').reverse().join('/')],
    [],
    ['Resumo por funcionário'],
    ['Funcionário','Área','Horas previstas','Horas trabalhadas','Atrasos','Faltas','Jornadas incompletas','Correções','Correções pendentes'],
    ...report.employees.map(employee=>[employee.name,employee.unit,durationLabel(employee.expectedMinutes),durationLabel(employee.workedMinutes),durationLabel(employee.delayMinutes),employee.absenceDays,employee.incompleteDays,employee.correctionRequests,employee.pendingCorrections]),
    [],
    ['Detalhamento diário'],
    ['Data','Funcionário','Área','Escala','Entrada','Saída para intervalo','Volta do intervalo','Saída','Horas trabalhadas','Atraso','Situação','Correções','Correções pendentes'],
    ...report.rows.map(row=>[row.date.split('-').reverse().join('/'),row.name,row.unit,row.schedule,...row.punches.map(value=>value||''),durationLabel(row.workedMinutes),durationLabel(row.delayMinutes),row.status,row.correctionRequests,row.pendingCorrections])
  ];
  const blob=new Blob(['\ufeff'+lines.map(line=>line.map(csvCell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='pao-da-leli-fechamento-'+report.month+'.csv';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function printMonthlyReport(){
  if(!monthlyReport)return;
  const report=monthlyReport,popup=window.open('','_blank');if(!popup){alert('O navegador bloqueou a janela do PDF. Autorize a abertura e tente novamente.');return}
  const employeeRows=report.employees.map(employee=>'<tr><td><b>'+esc(employee.name)+'</b><br><small>'+esc(employee.unit)+'</small></td><td>'+durationLabel(employee.expectedMinutes)+'</td><td>'+durationLabel(employee.workedMinutes)+'</td><td>'+durationLabel(employee.delayMinutes)+'</td><td>'+employee.absenceDays+'</td><td>'+employee.incompleteDays+'</td><td>'+employee.correctionRequests+(employee.pendingCorrections?' ('+employee.pendingCorrections+' pend.)':'')+'</td></tr>').join('');
  const dailyRows=report.rows.map(row=>'<tr><td>'+esc(row.date.split('-').reverse().join('/'))+'</td><td><b>'+esc(row.name)+'</b></td><td>'+esc(row.schedule)+'</td><td>'+row.punches.map(value=>esc(value||'—')).join(' · ')+'</td><td>'+durationLabel(row.workedMinutes)+'</td><td>'+durationLabel(row.delayMinutes)+'</td><td>'+esc(row.status)+'</td><td>'+row.correctionRequests+(row.pendingCorrections?' ('+row.pendingCorrections+' pend.)':'')+'</td></tr>').join('');
  popup.document.open();popup.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Fechamento '+esc(report.month)+'</title><style>@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#31251f;margin:0;font-size:10px}h1,h2{font-family:Georgia,serif;color:#a71831;margin:0 0 8px}h1{font-size:25px}h2{font-size:16px;margin-top:20px}.meta{color:#6f6259;margin-bottom:14px}.totals{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin:12px 0}.total{border:1px solid #dbcdbd;border-radius:8px;padding:8px}.total b{display:block;color:#a71831;font:700 17px Georgia,serif}.total span{color:#7d6d63;text-transform:uppercase;font-size:8px}table{width:100%;border-collapse:collapse;margin-top:6px}th{background:#f2e5d3;color:#6f6259;text-align:left;text-transform:uppercase;font-size:8px}th,td{border:1px solid #dbcdbd;padding:6px;vertical-align:top}small{color:#7d6d63}.foot{margin-top:12px;color:#7d6d63;font-size:8px}@media print{button{display:none}}</style></head><body><h1>Pão da Leli — Fechamento mensal</h1><div class="meta">'+esc(monthLabel(report.month))+' · '+esc(report.periodStart.split('-').reverse().join('/'))+' a '+esc(report.periodEnd.split('-').reverse().join('/'))+'</div><div class="totals"><div class="total"><b>'+durationLabel(report.totals.workedMinutes)+'</b><span>Trabalhadas</span></div><div class="total"><b>'+durationLabel(report.totals.expectedMinutes)+'</b><span>Previstas</span></div><div class="total"><b>'+durationLabel(report.totals.delayMinutes)+'</b><span>Atrasos</span></div><div class="total"><b>'+report.totals.absenceDays+'</b><span>Faltas</span></div><div class="total"><b>'+report.totals.correctionRequests+'</b><span>Correções</span></div></div><h2>Resumo por funcionário</h2><table><thead><tr><th>Funcionário</th><th>Previsto</th><th>Trabalhado</th><th>Atraso</th><th>Faltas</th><th>Incompletas</th><th>Correções</th></tr></thead><tbody>'+employeeRows+'</tbody></table><h2>Detalhamento diário</h2><table><thead><tr><th>Data</th><th>Funcionário</th><th>Escala</th><th>Batidas</th><th>Trabalhado</th><th>Atraso</th><th>Situação</th><th>Correções</th></tr></thead><tbody>'+dailyRows+'</tbody></table><div class="foot">Gerado em '+esc(new Date(report.generatedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))+'. Relatório para conferência administrativa.</div></body></html>');popup.document.close();popup.focus();setTimeout(()=>popup.print(),350);
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
    renderAccessPolicy(overview.accessPolicy);

    const empUsers=users.filter(u=>u.role==='employee');
    populateReportEmployees(empUsers);
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
window.toggleUser=async id=>{try{await api('admin-toggle-user','POST',{id});invalidateMonthlyReport();await render()}catch(e){alert(e.message)}}
window.regenActivation=async id=>{const email=overview?.users?.find(u=>u.id===id)?.email||'esta pessoa';if(!confirm('Trocar o código de ativação de '+email+'? O código anterior deixará de funcionar.'))return;try{const r=await api('admin-reset-activation','POST',{id});await render();alert('Novo código: '+r.activationCode)}catch(e){alert(e.message)}}
window.decideCorrection=async(id,status)=>{const note=prompt(status==='approved'?'Observação opcional da aprovação:':'Motivo opcional da recusa:','');if(note===null)return;try{await api('admin-decide-correction','POST',{id,status,note});invalidateMonthlyReport();await render()}catch(e){alert(e.message)}}
window.redoCorrection=async id=>{if(!confirm('Refazer esta decisão? O horário voltará para pendente.'))return;try{await api('admin-reset-correction-decision','POST',{id});invalidateMonthlyReport();await render()}catch(e){alert(e.message)}}

$('#restrictPunches').addEventListener('click',async()=>{
  if(!confirm('Faça esta ativação dentro do Pão da Leli e conectado ao Wi-Fi da padaria. Continuar?'))return;
  const button=$('#restrictPunches'),free=$('#freePunches');button.disabled=true;free.disabled=true;button.textContent='CONFIRMANDO LOCAL...';
  try{
    const location=await captureAccessLocation();
    await api('admin-access-policy','POST',{mode:'restricted',location});
    await render();alert('Restrição ativada. Agora o ponto exige o local e a rede da padaria.');
  }catch(err){alert(err.message);renderAccessPolicy(overview?.accessPolicy)}
});
$('#freePunches').addEventListener('click',async()=>{
  if(!confirm('Deixar o ponto livre? Enquanto estiver assim, funcionários poderão registrar de qualquer lugar.'))return;
  const button=$('#freePunches'),restrict=$('#restrictPunches');button.disabled=true;restrict.disabled=true;
  try{await api('admin-access-policy','POST',{mode:'free'});await render();alert('Ponto livre ativado.');}
  catch(err){alert(err.message);renderAccessPolicy(overview?.accessPolicy)}
});

$('#setupForm').addEventListener('submit',async e=>{e.preventDefault();try{await api('bootstrap','POST',{token:$('#setupToken').value.trim(),name:$('#setupName').value.trim(),email:$('#setupEmail').value.trim(),password:$('#setupPassword').value});alert('Administrador criado. Faça o login.');showOnly('adminLogin');$('#adminEmail').value=$('#setupEmail').value.trim()}catch(err){alert(err.message)}});
$('#adminLoginForm').addEventListener('submit',async e=>{e.preventDefault();try{const r=await api('login','POST',{email:$('#adminEmail').value.trim(),password:$('#adminPassword').value});if(r.user.role!=='admin'){await api('logout','POST',{});throw new Error('Este usuário não é administrador.')}currentUser=r.user;showOnly('dashboard');$('#loggedAs').textContent='Entrou como '+currentUser.name;await render()}catch(err){alert(err.message)}});
$('#employeeForm').addEventListener('submit',async e=>{e.preventDefault();try{const r=await api('admin-create-user','POST',{name:$('#empName').value.trim(),email:$('#empEmail').value.trim(),position:'Colaborador',unit:$('#empUnit').value,role:'employee'});$('#activationResult').innerHTML='<div class="notice" style="margin-top:12px"><b>'+esc(r.user.name)+'</b><br>Código de ativação: <strong style="font-size:18px">'+esc(r.activationCode)+'</strong><br><span class="sub">Este código ficará visível aqui até a conta ser ativada.</span></div>';e.target.reset();invalidateMonthlyReport();await render()}catch(err){alert(err.message)}});
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
  try{const id=selectedEmployeeId;await api('admin-save-schedule','POST',{id,days});invalidateMonthlyReport();await openEmployee(id);$('#scheduleStatus').textContent='Escala salva.'}
  catch(err){$('#scheduleStatus').textContent='';alert(err.message)}
  finally{button.disabled=false}
});
$('#checklistUnit').addEventListener('change',()=>{renderChecklistEditors();$('#checklistSaveStatus').textContent=''});
$('#addChecklistQuestion').addEventListener('click',()=>{const questions=editorQuestions();if(questions.length>=30){alert('O limite é de 30 perguntas por área.');return}questions.push('');renderQuestionEditor(questions);$$('#checklistQuestionsAdmin input').at(-1)?.focus()});
$('#addMissingItem').addEventListener('click',()=>{const items=editorMissingItems();if(items.length>=60){alert('O limite é de 60 itens por área.');return}items.push('');renderMissingEditor(items);$$('#missingOptionsAdmin input').at(-1)?.focus()});
$('#checklistFormAdmin').addEventListener('submit',async e=>{
  e.preventDefault();const button=$('#saveChecklist'),questions=editorQuestions().map(value=>value.trim()).filter(Boolean),missingItems=editorMissingItems().map(value=>value.trim()).filter(Boolean);button.disabled=true;$('#checklistSaveStatus').textContent='Salvando...';
  try{await api('admin-save-checklist','POST',{unit:$('#checklistUnit').value,questions,missingItems});await loadAdminChecklist();$('#checklistSaveStatus').textContent='Configuração salva.'}
  catch(err){$('#checklistSaveStatus').textContent='';alert(err.message)}
  finally{button.disabled=false}
});
$('#reportForm').addEventListener('submit',async e=>{
  e.preventDefault();const button=e.submitter||e.currentTarget.querySelector('button[type="submit"]');button.disabled=true;$('#reportStatus').textContent='Calculando o fechamento...';$('#reportContent').classList.add('hidden');
  try{const report=await api('admin-monthly-report','GET',{month:$('#reportMonth').value,employeeId:$('#reportEmployee').value});renderMonthlyReport(report)}
  catch(err){monthlyReport=null;$('#reportStatus').textContent='';alert(err.message)}
  finally{button.disabled=false}
});
$('#downloadReportCsv').addEventListener('click',downloadMonthlyReport);
$('#printReport').addEventListener('click',printMonthlyReport);
$('#leaveAdmin').addEventListener('click',e=>{e.preventDefault();endAdminSession('./')});
$('#adminLogout').addEventListener('click',()=>endAdminSession());
$$('.tab').forEach(b=>b.addEventListener('click',()=>{$$('.tab').forEach(x=>x.classList.remove('active'));$$('.panel').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#'+b.dataset.tab).classList.add('active');if(b.dataset.tab==='checklistAdmin')loadAdminChecklist();else{render();if(b.dataset.tab==='reports')loadAdminChecklist()}}));
initPasswordToggles();
$('#reportMonth').value=currentMonth();
$('#reportMonth').max=currentMonth();
boot();
