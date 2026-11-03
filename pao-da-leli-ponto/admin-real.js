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
let currentUser=null,overview=null,selectedEmployeeId=null,checklistAdminData=null,closingSearchDate='',monthlyReport=null,monthlyTimeReview=null,monthlyTimeReviewBusy=false,monthlyTimeReviewSequence=0,recipeAdminData=[],selectedRecipeAdminId=null;
async function api(action,method='GET',data){
  return leliApi(API,action,method,data);
}
function showOnly(id){['setup','adminLogin','adminActivate','dashboard'].forEach(x=>$('#'+x).classList.add('hidden'));$('#'+id).classList.remove('hidden')}
async function enterAdminDashboard(user){
  if(user?.role!=='admin'){throw new Error('Este usuário não é administrador.')}
  currentUser=user;
  if(new URLSearchParams(location.search).get('next')==='recipes'){location.replace('./receitas.html');return}
  showOnly('dashboard');$('#loggedAs').textContent='Entrou como '+currentUser.name;await render();await activateRequestedAdminTab();
}
async function endAdminSession(destination){
  try{
    await api('logout','POST',{});
    currentUser=null;
    $('#adminPassword').value='';
    if(destination)location.replace(destination);
    else showOnly('adminLogin');
  }catch(err){alert('Não foi possível encerrar a sessão. '+err.message)}
}
function time(v){return v?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v)):'—'}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function dateTime(v){return v?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v)):'—'}
function formatPhone(v){const d=String(v||'').replace(/\D/g,'');if(d.length===11)return'('+d.slice(0,2)+') '+d.slice(2,7)+'-'+d.slice(7);if(d.length===10)return'('+d.slice(0,2)+') '+d.slice(2,6)+'-'+d.slice(6);return String(v||'')}
function contactLabel(person){return person?.phone?formatPhone(person.phone):(person?.email||'Sem contato')}
function normalizedRecipeSearch(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()}
function recipeIngredientRow(ingredient={}){
  return '<div class="recipe-ingredient-row"><input class="ingredient-name" value="'+esc(ingredient.name||'')+'" placeholder="Ingrediente" aria-label="Nome do ingrediente" required><input class="ingredient-amount" type="number" min="0.01" step="0.01" value="'+esc(ingredient.amount||'')+'" placeholder="Qtd." aria-label="Quantidade" required><select class="ingredient-unit" aria-label="Unidade"><option value="g" '+(ingredient.unit==='g'?'selected':'')+'>g</option><option value="ml" '+(ingredient.unit==='ml'?'selected':'')+'>ml</option><option value="un." '+(ingredient.unit==='un.'?'selected':'')+'>un.</option></select><input class="ingredient-group-input" value="'+esc(ingredient.group||'')+'" placeholder="Grupo opcional" aria-label="Grupo do ingrediente"><button class="remove-ingredient" type="button" aria-label="Remover ingrediente">×</button></div>';
}
function renderRecipeIngredients(ingredients=[{}]){
  $('#recipeIngredients').innerHTML=(ingredients.length?ingredients:[{}]).map(recipeIngredientRow).join('');
}
function clearRecipeForm(){
  selectedRecipeAdminId=null;$('#recipeForm').reset();$('#recipeId').value='';$('#recipeCategory').value='Pães';$('#recipeMeasureUnit').value='g';$('#recipeReferenceUnit').value='g';$('#recipeServiceLabel').value='Forno';$('#recipeFormTitle').textContent='Nova receita';$('#recipeSaveStatus').textContent='';$('#recipeForm').classList.add('is-new');renderRecipeIngredients();renderAdminRecipeList();
}
function fillRecipeForm(recipe){
  selectedRecipeAdminId=recipe.id;$('#recipeId').value=recipe.id;$('#recipeName').value=recipe.name;$('#recipeCategory').value=recipe.category;$('#recipeDescription').value=recipe.description||'';$('#recipeYieldAmount').value=recipe.yieldAmount;$('#recipeYieldUnit').value=recipe.yieldUnit;$('#recipeMeasureAmount').value=recipe.yieldMeasure.amount;$('#recipeMeasureUnit').value=recipe.yieldMeasure.unit;$('#recipeReferenceLabel').value=recipe.reference.label;$('#recipeReferenceAmount').value=recipe.reference.amount;$('#recipeReferenceUnit').value=recipe.reference.unit;$('#recipePrepTime').value=recipe.prepTime;$('#recipeTotalTime').value=recipe.totalTime;$('#recipeServiceLabel').value=recipe.heatLabel||'Forno';$('#recipeServiceValue').value=recipe.oven;$('#recipeSteps').value=(recipe.steps||[]).join('\n');$('#recipeNotes').value=recipe.notes||'';$('#recipeFormTitle').textContent='Editar '+recipe.name;$('#recipeSaveStatus').textContent='';$('#recipeForm').classList.remove('is-new');renderRecipeIngredients(recipe.ingredients);renderAdminRecipeList();
}
function renderAdminRecipeList(){
  const search=normalizedRecipeSearch($('#adminRecipeSearch')?.value),visible=recipeAdminData.filter(recipe=>!search||normalizedRecipeSearch(recipe.name+' '+recipe.category).includes(search));
  $('#adminRecipeList').innerHTML=visible.map(recipe=>'<button class="admin-recipe-item '+(recipe.id===selectedRecipeAdminId?'active':'')+'" type="button" data-admin-recipe="'+esc(recipe.id)+'"><span>'+esc(recipe.category)+'</span><strong>'+esc(recipe.name)+'</strong></button>').join('')||'<div class="recipe-list-empty">Nenhuma receita encontrada.</div>';
  $$('[data-admin-recipe]').forEach(button=>button.addEventListener('click',()=>{const recipe=recipeAdminData.find(item=>item.id===button.dataset.adminRecipe);if(recipe){fillRecipeForm(recipe);$('#recipeForm').scrollIntoView({behavior:'smooth',block:'start'})}}));
}
async function loadAdminRecipes(preferredId){
  try{const result=await api('admin-recipes');recipeAdminData=result.recipes||[];renderAdminRecipeList();const id=preferredId||selectedRecipeAdminId;if(id){const recipe=recipeAdminData.find(item=>item.id===id);if(recipe)fillRecipeForm(recipe)}}catch(err){alert(err.message)}
}
function recipeFromForm(){
  const ingredients=$$('#recipeIngredients .recipe-ingredient-row').map(row=>({name:row.querySelector('.ingredient-name').value.trim(),amount:Number(row.querySelector('.ingredient-amount').value),unit:row.querySelector('.ingredient-unit').value,...(row.querySelector('.ingredient-group-input').value.trim()?{group:row.querySelector('.ingredient-group-input').value.trim()}: {})}));
  return{id:$('#recipeId').value||undefined,name:$('#recipeName').value.trim(),category:$('#recipeCategory').value,description:$('#recipeDescription').value.trim(),yieldAmount:Number($('#recipeYieldAmount').value),yieldUnit:$('#recipeYieldUnit').value.trim(),yieldMeasure:{amount:Number($('#recipeMeasureAmount').value),unit:$('#recipeMeasureUnit').value},reference:{label:$('#recipeReferenceLabel').value.trim(),amount:Number($('#recipeReferenceAmount').value),unit:$('#recipeReferenceUnit').value},prepTime:$('#recipePrepTime').value.trim(),totalTime:$('#recipeTotalTime').value.trim(),heatLabel:$('#recipeServiceLabel').value.trim(),oven:$('#recipeServiceValue').value.trim(),ingredients,steps:$('#recipeSteps').value.split(/\n+/).map(step=>step.trim()).filter(Boolean),notes:$('#recipeNotes').value.trim()};
}
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
  $('#accessPolicyTitle').textContent=restricted?'Localização ativa':'Ponto livre';
  $('#accessPolicyText').textContent=restricted?'O ponto é aceito dentro de um raio de '+(Number(policy.radiusMeters)||30)+' metros do local salvo.':'Funcionários podem registrar o ponto de qualquer lugar.';
  const changed=policy?.updatedAt?'Alterado'+(policy.updatedByName?' por '+policy.updatedByName:'')+' em '+dateTime(policy.updatedAt):'';
  $('#accessPolicyMeta').textContent=changed;
  const details=$('#accessPolicyDetails'),latitude=Number(policy?.latitude),longitude=Number(policy?.longitude),configured=Boolean(policy?.configured&&Number.isFinite(latitude)&&Number.isFinite(longitude));
  details.classList.toggle('hidden',!configured);
  if(configured){
    const coordinates=latitude.toFixed(5)+', '+longitude.toFixed(5),map=$('#accessPolicyMap');
    $('#accessPolicyLocation').textContent=coordinates;
    $('#accessPolicyRadius').textContent='Até '+(Number(policy.radiusMeters)||30)+' metros';
    map.href='https://www.google.com/maps?q='+encodeURIComponent(coordinates);
  }
  $('#restrictPunches').textContent=policy?.configured?'Atualizar local atual':'Salvar local atual';
  $('#restrictPunches').disabled=false;$('#freePunches').disabled=!restricted;
}
function renderAccessProfiles(profiles,policy){
  const list=$('#accessProfileList'),rows=Array.isArray(profiles)?profiles:[],restricted=policy?.mode==='restricted';
  if(!rows.length){list.innerHTML='<div class="empty">Nenhum local foi salvo ainda.</div>';return}
  list.innerHTML=rows.map(profile=>{
    const latitude=Number(profile.latitude),longitude=Number(profile.longitude),coordinates=Number.isFinite(latitude)&&Number.isFinite(longitude)?latitude.toFixed(5)+', '+longitude.toFixed(5):'Local não informado';
    const active=restricted&&String(policy?.activeProfileId||'')===String(profile.id),mapUrl='https://www.google.com/maps?q='+encodeURIComponent(coordinates);
    return '<article class="access-profile"><div class="access-profile-main"><div class="access-profile-title"><strong>'+esc(profile.locationName||'Local salvo')+'</strong>'+(active?'<span class="badge approved">em uso</span>':'<span class="badge">salva</span>')+'</div><div class="access-profile-info">Local: '+esc(coordinates)+' · Área: até '+(Number(profile.radiusMeters)||30)+' metros<br><a href="'+mapUrl+'" target="_blank" rel="noopener">Abrir local no mapa</a></div></div><button class="btn small '+(active?'secondary':'')+'" type="button" data-activate-access-profile="'+esc(profile.id)+'" '+(active?'disabled':'')+'>'+(active?'Configuração ativa':'Ativar esta configuração')+'</button></article>';
  }).join('');
  $$('[data-activate-access-profile]').forEach(button=>button.addEventListener('click',()=>activateAccessProfile(button.dataset.activateAccessProfile,button)));
}
function accountStatus(u){
  const resetRequested=Boolean(u.password_reset_requested_at);
  if(!u.active)return '<span class="badge rejected">desativado</span>';
  if(u.pending_activation){
    const label=resetRequested?'nova senha pendente':'aguardando ativação';
    return '<span class="badge pending">'+label+'</span>'+(u.activation_code?'<div class="activation-code">Código: <strong>'+esc(u.activation_code)+'</strong></div>':'');
  }
  if(resetRequested)return '<span class="badge pending">pediu nova senha</span>';
  return '<span class="badge approved">ativo</span>';
}
function passwordActions(u,allowReset=true){
  if(!u.active||!allowReset)return'';
  const copy=u.pending_activation&&u.activation_code?'<button class="btn small secondary" onclick="copyActivation(\''+esc(u.activation_code)+'\')">Copiar código</button>':'';
  const label=u.pending_activation?'Trocar código':u.password_reset_requested_at?'Gerar novo código':'Redefinir senha';
  return copy+'<button class="btn small secondary" onclick="regenActivation(\''+u.id+'\')">'+label+'</button>';
}
async function activateAccessProfile(profileId,button){
  const profile=(overview?.accessProfiles||[]).find(item=>String(item.id)===String(profileId));
  if(!profile||!confirm('Ativar o local “'+profile.locationName+'” para registrar o ponto?'))return;
  button.disabled=true;button.textContent='ATIVANDO...';
  try{await api('admin-access-policy','POST',{mode:'restricted',profileId});await render();alert('Local “'+profile.locationName+'” ativado.');}
  catch(err){alert(err.message);button.disabled=false;button.textContent='Ativar esta configuração'}
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
  }).join('')||'<div class="empty">Nenhum fechamento encontrado para esta data.</div>';
}
function renderClosingMessages(){
  const messages=(checklistAdminData?.submissions||[]).filter(row=>row.message).slice(0,30);
  $('#closingMessages').innerHTML=messages.map(row=>{const target=row.message_audience==='team'?'toda a equipe':(row.recipient_name||'destinatário removido');return '<article class="message-box" style="margin-top:0"><div class="sub">De '+esc(row.employee_name)+' para '+esc(target)+' · '+dateTime(row.created_at)+'</div><p>'+esc(row.message)+'</p></article>'}).join('')||'<div class="empty">Nenhum recado enviado nesta data.</div>';
}
function renderMissingReports(){
  const reports=checklistAdminData?.missingReports||[];
  $('#missingReports').innerHTML=reports.map(row=>{const names=Array.isArray(row.reporter_names)?row.reporter_names.join(', '):String(row.reporter_names||'');return '<article class="missing-report"><div class="missing-report-head"><div><strong>'+esc(row.item_name)+'</strong><div class="sub">'+esc(row.unit)+' · último aviso '+dateTime(row.last_reported_at)+'</div></div><span class="missing-report-count">'+Number(row.report_count)+' '+(Number(row.report_count)===1?'aviso':'avisos')+'</span></div><div class="sub">Informado por: '+esc(names||'equipe')+'</div><div class="missing-report-actions"><button class="btn small" type="button" data-resolve-missing data-status="resolved" data-unit="'+esc(row.unit)+'" data-item-key="'+esc(row.item_key)+'">Resolvido</button></div></article>'}).join('')||'<div class="empty">Nenhum item está faltando.</div>';
  $$('#missingReports [data-resolve-missing]').forEach(button=>button.addEventListener('click',async()=>{button.disabled=true;try{await api('admin-resolve-missing','POST',{unit:button.dataset.unit,itemKey:button.dataset.itemKey,status:button.dataset.status});await loadAdminChecklist()}catch(err){alert(err.message);button.disabled=false}}));
}
async function loadAdminChecklist(){
  $('#checklistHistory').innerHTML='<div class="empty">Carregando...</div>';
  $('#missingReports').innerHTML='<div class="empty">Carregando...</div>';$('#closingMessages').innerHTML='<div class="empty">Carregando...</div>';
  try{
    checklistAdminData=await api('admin-checklist','GET',closingSearchDate?{date:closingSearchDate}:undefined);
    const selectedDate=checklistAdminData.selectedDate||'';
    $('#closingDate').value=selectedDate;
    $('#closingDateStatus').textContent=selectedDate?fullDateLabel(selectedDate)+' · '+(checklistAdminData.submissions?.length||0)+' fechamento(s)':'Nenhum fechamento registrado';
    $('#closingLatestDate').disabled=!checklistAdminData.latestDate||!closingSearchDate;
    renderChecklistEditors();renderChecklistHistory();renderClosingMessages();renderMissingReports();
  }
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
  if(item.status==='pending'&&item.kind==='out'&&item.punch_id===null)return '<div class="correction-decision"><button class="btn small" type="button" title="Confirmar saída informada" onclick="confirmMissingExit(\''+item.id+'\',this)">OK</button><button class="btn small red" type="button" onclick="decideCorrection(\''+item.id+'\',\'rejected\')">Recusar</button></div>';
  if(item.status==='pending')return '<div class="correction-decision"><button class="btn small" type="button" onclick="decideCorrection(\''+item.id+'\',\'approved\')">Aprovar</button><button class="btn small red" type="button" onclick="decideCorrection(\''+item.id+'\',\'rejected\')">Recusar</button></div>';
  const label=item.status==='approved'?(item.kind==='out'&&item.punch_id===null?'Incluída depois':'Aprovado'):'Recusado';
  return '<div class="correction-decision"><span class="badge '+item.status+'">'+label+'</span>'+(item.decided_by_name?'<span class="sub">por '+esc(item.decided_by_name)+'</span>':'')+'<button class="btn small secondary" type="button" onclick="redoCorrection(\''+item.id+'\')">Refazer</button></div>';
}
function missingExitList(rows){
  return rows.map(row=>{
    const pending=row.status==='pending'&&row.correction_id;
    const text=pending?'Saída informada: '+time(row.requested_at)+'. Confira o horário e toque em OK para confirmar.':row.status==='rejected'?'Pedido recusado. Aguardando o colaborador informar novamente.':'Aguardando o colaborador informar o horário real da saída.';
    const decision=pending?correctionDecision({id:row.correction_id,kind:'out',punch_id:null,status:'pending'}):'<span class="badge pending">aguardando colaborador</span>';
    const regularize=pending?'':'<details class="regularize-exit"><summary class="btn small secondary">Regularizar saída</summary><form class="regularize-exit-form" data-user-id="'+esc(row.user_id)+'" data-work-date="'+esc(row.work_date)+'" onsubmit="submitExitRegularization(event,this)"><p class="sub">Confirme o horário real com o colaborador e toque em OK para regularizar.</p><label class="form-label">Horário da saída<input type="time" name="requestedTime" step="60" value="'+(row.requested_at?esc(time(row.requested_at)):'')+'" required></label><label class="form-label">Motivo<input name="reason" value="Regularização de saída pelo ADM." minlength="3" maxlength="1000" required></label><div class="actions"><button class="btn small" type="submit">OK — regularizar</button><button class="btn small secondary" type="button" onclick="this.closest(\'details\').open=false">Cancelar</button></div><p class="sub" data-regularize-status role="status" aria-live="polite"></p></form></details>';
    return '<div class="item"><div class="missing-exit-content"><strong>'+esc(row.name)+' — '+esc(fullDateLabel(row.work_date))+'</strong><div class="sub">'+esc(row.unit)+'</div><div style="margin-top:6px"><span class="badge rejected">saída não registrada</span></div><div class="sub">'+esc(text)+'</div>'+regularize+'</div>'+decision+'</div>';
  }).join('')||'<p class="muted">Nenhuma saída pendente de dias anteriores.</p>';
}
async function submitExitRegularization(event,form){
  event.preventDefault();
  const button=form.querySelector('button[type="submit"]'),status=form.querySelector('[data-regularize-status]');
  if(button.disabled||!form.reportValidity())return;
  const data={userId:form.dataset.userId,date:form.dataset.workDate,requestedTime:form.querySelector('[name="requestedTime"]').value,reason:form.querySelector('[name="reason"]').value.trim()};
  const originalLabel=button.textContent;button.disabled=true;button.textContent='SALVANDO...';status.textContent='Regularizando saída...';
  try{await api('admin-regularize-missing-exit','POST',data);status.textContent='Saída regularizada.';invalidateMonthlyReport();await render()}
  catch(err){status.textContent=err.message}finally{button.disabled=false;button.textContent=originalLabel}
}
async function confirmMissingExit(id,button){
  if(button?.disabled)return;
  if(button)button.disabled=true;
  try{await api('admin-decide-correction','POST',{id,status:'approved'});invalidateMonthlyReport();await render()}
  catch(err){alert(err.message)}finally{if(button)button.disabled=false}
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
function monthlyReportFileName(month,extension=''){
  const year=month.split('-')[0],name=new Date(month+'-01T12:00:00').toLocaleDateString('pt-BR',{month:'long'}).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  return 'pao-da-leli-fechamento-'+name+'-'+year+(extension?'.'+extension:'');
}
function employeeDailyWorkMinutes(employee){const value=Number(employee?.daily_work_minutes??employee?.dailyWorkMinutes??480);return Number.isInteger(value)&&value>=60&&value<=720&&value%15===0?value:480}
function durationLabel(value){if(value===null||value===undefined)return'—';const total=Math.max(0,Number(value)||0),hours=Math.floor(total/60),minutes=total%60;return hours?(hours+'h'+(minutes?' '+minutes+'min':'')):(minutes+'min')}
function signedDurationLabel(value){if(value===null||value===undefined)return'—';return(value<0?'−':value>0?'+':'')+durationLabel(Math.abs(value))}
function balanceClass(value){return value===null||value===undefined?'':value<0?'balance-negative':value>0?'balance-positive':''}
function reportStatusBadge(status){const type=status==='Completo'?'approved':status==='Falta'||status==='Batidas incompletas'?'rejected':status==='Fora da escala'?'':'pending';return '<span class="badge '+type+'">'+esc(status)+'</span>'}
function reportRowStatus(row){return row.status+(row.exitAddedLater?' · Saída incluída depois':'')}
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
  $('#reportFilterLabel').textContent=people+' · período até '+report.periodEnd.split('-').reverse().join('/')+' · '+(report.employees.length===1?'jornada '+durationLabel(employeeDailyWorkMinutes(report.employees[0]))+'/dia':'jornada diária conforme cada ficha')+' · limite semanal '+durationLabel(report.overtimeRules.weeklyLimitMinutes);
  $('#reportWorked').textContent=durationLabel(report.totals.workedMinutes);
  $('#reportExpected').textContent=durationLabel(report.totals.expectedMinutes);
  $('#reportOvertime').textContent=durationLabel(report.totals.overtimeMinutes);
  $('#reportBalancePositive').textContent='+'+durationLabel(report.totals.balancePositiveMinutes);
  $('#reportBalanceNegative').textContent='−'+durationLabel(report.totals.balanceNegativeMinutes);
  $('#reportBalanceNet').textContent=signedDurationLabel(report.totals.balanceNetMinutes);
  $('#reportBalanceNet').className=balanceClass(report.totals.balanceNetMinutes);
  $('#reportBalanceFormula').textContent=reportBalanceFormula(report.totals);
  $('#reportDelays').textContent=durationLabel(report.totals.delayMinutes);
  $('#reportAbsences').textContent=report.totals.absenceDays;
  $('#reportCorrections').textContent=report.totals.correctionRequests;
  $('#reportEmployeeSummary').innerHTML=report.employees.map(employee=>'<article class="report-person"><div class="report-person-head"><div><strong>'+esc(employee.name)+'</strong><div class="sub">'+esc(employee.unit)+' · '+durationLabel(employeeDailyWorkMinutes(employee))+'/dia</div></div>'+(employee.pendingCorrections?'<span class="badge pending">'+employee.pendingCorrections+' pendente'+(employee.pendingCorrections===1?'':'s')+'</span>':'')+'</div><div class="report-person-balance"><span>Saldo final do mês</span><b class="'+balanceClass(employee.balanceNetMinutes)+'">'+signedDurationLabel(employee.balanceNetMinutes)+'</b><small>'+reportBalanceFormula(employee)+'</small></div><div class="report-person-stats"><div class="report-person-stat"><span>Previsto</span><b>'+durationLabel(employee.expectedMinutes)+'</b></div><div class="report-person-stat"><span>Trabalhado</span><b>'+durationLabel(employee.workedMinutes)+'</b></div><div class="report-person-stat"><span>Horas extras</span><b>'+durationLabel(employee.overtimeMinutes)+'</b></div><div class="report-person-stat"><span>Horas positivas</span><b class="balance-positive">+'+durationLabel(employee.balancePositiveMinutes)+'</b></div><div class="report-person-stat"><span>Horas negativas</span><b class="balance-negative">−'+durationLabel(employee.balanceNegativeMinutes)+'</b></div><div class="report-person-stat"><span>Dias a conferir</span><b>'+employee.balancePendingDays+'</b></div><div class="report-person-stat"><span>Extras diárias</span><b>'+durationLabel(employee.overtimeDailyMinutes)+'</b></div><div class="report-person-stat"><span>Extras semanais</span><b>'+durationLabel(employee.overtimeWeeklyMinutes)+'</b></div><div class="report-person-stat"><span>Atraso</span><b>'+durationLabel(employee.delayMinutes)+'</b></div><div class="report-person-stat"><span>Faltas</span><b>'+employee.absenceDays+'</b></div><div class="report-person-stat"><span>Incompletas</span><b>'+employee.incompleteDays+'</b></div><div class="report-person-stat"><span>Correções</span><b>'+employee.correctionRequests+'</b></div></div><button class="btn small secondary review-employee-shortcut" type="button" data-review-employee="'+esc(employee.userId)+'" data-review-month="'+esc(report.month)+'">Revisar horários</button></article>').join('')||'<div class="empty">Nenhum funcionário encontrado.</div>';
  $('#reportRows').innerHTML=report.rows.map(row=>'<tr><td class="nowrap"><strong>'+esc(fullDateLabel(row.date))+'</strong></td><td><strong>'+esc(row.name)+'</strong><span class="sub">'+esc(row.unit)+'</span></td><td class="nowrap">'+esc(row.schedule)+'</td><td class="nowrap">'+row.punches.map(value=>esc(value||'—')).join(' · ')+'</td><td class="nowrap">'+durationLabel(row.workedMinutes)+'</td><td class="nowrap"><b>'+durationLabel(row.overtimeMinutes)+'</b></td><td class="nowrap balance-positive">'+(row.balanceMinutes===null?'—':'+'+durationLabel(row.balancePositiveMinutes))+'</td><td class="nowrap balance-negative">'+(row.balanceMinutes===null?'—':'−'+durationLabel(row.balanceNegativeMinutes))+'</td><td class="nowrap '+balanceClass(row.balanceMinutes)+'"><b>'+signedDurationLabel(row.balanceMinutes)+'</b></td><td class="nowrap">'+durationLabel(row.delayMinutes)+'</td><td>'+reportStatusBadge(row.status)+(row.exitAddedLater?'<span class="sub">Saída incluída depois</span>':'')+'</td><td>'+(row.correctionRequests?row.correctionRequests+(row.pendingCorrections?' · '+row.pendingCorrections+' pendente'+(row.pendingCorrections===1?'':'s'):''):'—')+'</td></tr>').join('')||'<tr><td colspan="12" class="empty">Nenhuma jornada encontrada neste período.</td></tr>';
}

function csvCell(value){
  const cell=String(value??'');
  const safe=/^[=+\-@\t\r]/.test(cell)?"'"+cell:cell;
  return '"'+safe.replace(/"/g,'""')+'"';
}
function saveReportFile(text,filename,type){
  const blob=new Blob(['\ufeff',text],{type:type+';charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function downloadMonthlyReport(){
  if(!monthlyReport)return;
  const report=monthlyReport,rule=report.overtimeRules,lines=[
    ['Pão da Leli — Fechamento mensal'],
    ['Mês',monthLabel(report.month)],
    ['Período',report.periodStart.split('-').reverse().join('/')+' a '+report.periodEnd.split('-').reverse().join('/')],
    ['Jornada diária','Conforme a ficha de cada funcionário'],
    ['Limite semanal de referência',durationLabel(rule.weeklyLimitMinutes)],
    ['Horas extras totais (estimadas)',durationLabel(report.totals.overtimeMinutes)],
    ['Horas extras diárias',durationLabel(report.totals.overtimeDailyMinutes)],
    ['Horas extras semanais (sem duplicidade)',durationLabel(report.totals.overtimeWeeklyMinutes)],
    ['Horas positivas da jornada',durationLabel(report.totals.balancePositiveMinutes)],
    ['Horas negativas da jornada','-'+durationLabel(report.totals.balanceNegativeMinutes)],
    ['Saldo final do mês (positivas - negativas)',signedDurationLabel(report.totals.balanceNetMinutes)],
    ['Dias a conferir',report.totals.balancePendingDays],
    [],
    ['Resumo por funcionário'],
    ['Funcionário','Área','Jornada diária','Horas previstas','Horas trabalhadas','Horas extras total','Extras diárias','Extras semanais','Horas positivas','Horas negativas','Saldo final do mês','Dias a conferir','Atrasos','Faltas','Jornadas incompletas','Correções','Correções pendentes'],
    ...report.employees.map(e=>[e.name,e.unit,durationLabel(employeeDailyWorkMinutes(e)),durationLabel(e.expectedMinutes),durationLabel(e.workedMinutes),durationLabel(e.overtimeMinutes),durationLabel(e.overtimeDailyMinutes),durationLabel(e.overtimeWeeklyMinutes),durationLabel(e.balancePositiveMinutes),'-'+durationLabel(e.balanceNegativeMinutes),signedDurationLabel(e.balanceNetMinutes),e.balancePendingDays,durationLabel(e.delayMinutes),e.absenceDays,e.incompleteDays,e.correctionRequests,e.pendingCorrections]),
    [],
    ['Detalhamento diário'],
    ['Data','Funcionário','Área','Escala','Entrada','Saída para intervalo','Volta do intervalo','Saída','Horas trabalhadas','Extras totais','Extras diárias','Extras semanais','Horas positivas','Horas negativas','Saldo final do mês','Atraso','Situação','Correções','Correções pendentes'],
    ...report.rows.map(row=>[row.date.split('-').reverse().join('/'),row.name,row.unit,row.schedule,...row.punches.map(v=>v||''),durationLabel(row.workedMinutes),durationLabel(row.overtimeMinutes),durationLabel(row.overtimeDailyMinutes),durationLabel(row.overtimeWeeklyMinutes),row.balancePositiveMinutes===null?'':durationLabel(row.balancePositiveMinutes),row.balanceNegativeMinutes===null?'':'-'+durationLabel(row.balanceNegativeMinutes),signedDurationLabel(row.balanceMinutes),durationLabel(row.delayMinutes),reportRowStatus(row),row.correctionRequests,row.pendingCorrections]),
    [],
    ['Observações','Saldo final = horas positivas - horas negativas. Referência: jornada diária cadastrada na ficha de cada funcionário. Dias incompletos e correções pendentes ficam para conferência. Horas extras estimadas separadamente.']
  ];
  saveReportFile(lines.map(line=>line.map(csvCell).join(';')).join('\r\n'),monthlyReportFileName(report.month,'csv'),'text/csv');
}
function downloadMonthlyReportTxt(){
  if(!monthlyReport)return;
  const report=monthlyReport,rule=report.overtimeRules;
  const date=dateValue=>String(dateValue).split('-').reverse().join('/');
  const lines=[
    'PÃO DA LELI | FECHAMENTO MENSAL',
    monthLabel(report.month)+' | '+date(report.periodStart)+' a '+date(report.periodEnd),
    'Jornada diária: conforme a ficha de cada funcionário. Limite semanal: '+durationLabel(rule.weeklyLimitMinutes)+' (segunda a domingo)',
    '',
    'TOTAL DA EQUIPE',
    'Trabalhado: '+durationLabel(report.totals.workedMinutes)+' | Previsto: '+durationLabel(report.totals.expectedMinutes),
    'Horas extras: '+durationLabel(report.totals.overtimeMinutes)+' (diárias '+durationLabel(report.totals.overtimeDailyMinutes)+'; semanais '+durationLabel(report.totals.overtimeWeeklyMinutes)+')',
    'Saldo final do mês: '+reportBalanceFormula(report.totals)+' | '+report.totals.balancePendingDays+' dia(s) a conferir',
    'Atrasos: '+durationLabel(report.totals.delayMinutes)+' | Faltas: '+report.totals.absenceDays+' | Incompletas: '+report.totals.incompleteDays,
    '',
    'RESUMO POR FUNCIONÁRIO',
  ];
  for(const e of report.employees){
    lines.push('',e.name+' | '+e.unit,'Jornada diária: '+durationLabel(employeeDailyWorkMinutes(e)),'Trabalhado: '+durationLabel(e.workedMinutes)+' | Previsto: '+durationLabel(e.expectedMinutes),'Extras: '+durationLabel(e.overtimeMinutes)+' (diárias '+durationLabel(e.overtimeDailyMinutes)+'; semanais '+durationLabel(e.overtimeWeeklyMinutes)+')','Saldo final do mês: '+reportBalanceFormula(e)+' | '+e.balancePendingDays+' dia(s) a conferir','Atrasos: '+durationLabel(e.delayMinutes)+' | Faltas: '+e.absenceDays+' | Incompletas: '+e.incompleteDays+' | Correções: '+e.correctionRequests+' ('+e.pendingCorrections+' pendentes)');
  }
  lines.push('','DETALHAMENTO DIÁRIO');
  for(const row of report.rows){
    lines.push('',date(row.date)+' | '+row.name+' | '+row.unit,
      'Escala: '+row.schedule,
      'Batidas: '+row.punches.map((value,index)=>['Entrada','Intervalo saída','Intervalo volta','Saída'][index]+' '+(value||'—')).join(' | '),
      'Trabalhado: '+durationLabel(row.workedMinutes)+' | Extras: '+durationLabel(row.overtimeMinutes)+' (diárias '+durationLabel(row.overtimeDailyMinutes)+'; semanais '+durationLabel(row.overtimeWeeklyMinutes)+')',
      'Saldo do dia: '+signedDurationLabel(row.balanceMinutes)+' | positivas '+durationLabel(row.balancePositiveMinutes)+' | negativas '+(row.balanceNegativeMinutes===null?'—':'−'+durationLabel(row.balanceNegativeMinutes)),
      'Situação: '+reportRowStatus(row)+' | Correções: '+row.correctionRequests+' ('+row.pendingCorrections+' pendentes)');
  }
  lines.push('','OBSERVAÇÃO','Saldo final = horas positivas - horas negativas. Referência: jornada diária cadastrada na ficha de cada funcionário. Dias incompletos e correções pendentes ficam para conferência. Horas extras estimadas separadamente.','Gerado em '+dateTime(report.generatedAt)+'.');
  saveReportFile(lines.join('\r\n'),monthlyReportFileName(report.month,'txt'),'text/plain');
}
function compactReportDuration(value,signed=false){
  if(value===null||value===undefined)return'—';
  const minutes=Math.abs(Math.round(Number(value)||0));
  return (signed?(value<0?'−':value>0?'+':''):'')+Math.floor(minutes/60)+'h'+String(minutes%60).padStart(2,'0');
}
function reportBalanceFormula(summary){
  return '+'+compactReportDuration(summary.balancePositiveMinutes)+' − '+compactReportDuration(summary.balanceNegativeMinutes)+' = '+compactReportDuration(summary.balanceNetMinutes,true);
}
function printReportStatus(row){
  const labels={'Saída aguardando aprovação':'Saída pendente','Saída não registrada':'Sem saída','Batidas incompletas':'Incompleto','Correção pendente':'Correção pendente','Fora da escala':'Fora da escala'};
  return labels[row.status]||(row.exitAddedLater?'Saída corrigida':row.status);
}
function buildMonthlyPrintHtml(report){
  const date=value=>String(value).split('-').reverse().join('/');
  const pages=report.employees.map((employee,index)=>{
    const rows=report.rows.filter(row=>row.userId===employee.userId);
    const dailyRows=rows.map(row=>'<tr><td>'+esc(row.date.slice(8)+'/'+row.date.slice(5,7))+'</td>'+row.punches.map(value=>'<td>'+esc(value||'—')+'</td>').join('')+'<td>'+compactReportDuration(row.workedMinutes)+'</td><td class="'+balanceClass(row.balanceMinutes)+'">'+compactReportDuration(row.balanceMinutes,true)+'</td><td class="day-status">'+esc(printReportStatus(row))+'</td></tr>').join('')||'<tr><td colspan="8" class="empty-month">Sem registros neste mês.</td></tr>';
    const pending=employee.balancePendingDays||employee.incompleteDays||employee.pendingCorrections;
    const reference='Jornada diária cadastrada: '+compactReportDuration(employeeDailyWorkMinutes(employee))+'.';
    return '<section class="employee-sheet" data-employee-id="'+esc(employee.userId)+'"><header class="sheet-header"><div><strong>Pão da Leli</strong><span>Fechamento mensal</span></div><b>'+esc(monthLabel(report.month))+'</b></header><div class="employee-heading"><h1>'+esc(employee.name)+'</h1><p>'+esc(employee.unit)+' · jornada '+compactReportDuration(employeeDailyWorkMinutes(employee))+'/dia · '+esc(date(report.periodStart))+' a '+esc(date(report.periodEnd))+'</p></div><div class="balance-grid"><div><span>Horas positivas</span><strong class="balance-positive">+'+compactReportDuration(employee.balancePositiveMinutes)+'</strong></div><div><span>Horas negativas</span><strong class="balance-negative">−'+compactReportDuration(employee.balanceNegativeMinutes)+'</strong></div><div class="final-balance"><span>Saldo final do mês</span><strong class="'+balanceClass(employee.balanceNetMinutes)+'">'+compactReportDuration(employee.balanceNetMinutes,true)+'</strong></div></div><div class="balance-formula">'+reportBalanceFormula(employee)+'</div><div class="monthly-totals"><span>Trabalhadas: <b>'+compactReportDuration(employee.workedMinutes)+'</b></span><span>Referência: <b>'+compactReportDuration(employee.expectedMinutes)+'</b></span><span>Correções pendentes: <b>'+Number(employee.pendingCorrections||0)+'</b></span></div><table class="print-table"><colgroup><col style="width:10%"><col span="4" style="width:10%"><col style="width:14%"><col style="width:14%"><col style="width:22%"></colgroup><thead><tr><th>Dia</th><th>Entrada</th><th>Intervalo<br>saída</th><th>Intervalo<br>volta</th><th>Saída</th><th>Trabalhado</th><th>Saldo</th><th>Situação</th></tr></thead><tbody>'+dailyRows+'</tbody><tfoot><tr><th colspan="5">Total apurado no mês</th><th>'+compactReportDuration(employee.workedMinutes)+'</th><th class="'+balanceClass(employee.balanceNetMinutes)+'">'+compactReportDuration(employee.balanceNetMinutes,true)+'</th><th></th></tr></tfoot></table><footer class="sheet-footer"><p>Saldo final = horas positivas − horas negativas. '+esc(reference)+' Dias incompletos e correções pendentes ficam para conferência.</p>'+(pending?'<p class="pending-note">A conferir: '+Number(employee.balancePendingDays||0)+' dia(s) com saldo pendente · '+Number(employee.incompleteDays||0)+' jornada(s) incompleta(s) · '+Number(employee.pendingCorrections||0)+' correção(ões) pendente(s).</p>':'')+'<div class="signatures"><span>Funcionário(a)</span><span>Responsável</span></div><div class="sheet-meta"><span>Gerado em '+esc(dateTime(report.generatedAt))+'</span><span>Folha '+(index+1)+' de '+report.employees.length+'</span></div></footer></section>';
  }).join('');
  const employeeName=report.employees.length===1?'-'+String(report.employees[0].name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80):'-todos';
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(monthlyReportFileName(report.month)+employeeName)+'</title><style>@page{size:A4 portrait;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#31251f;margin:0;background:#fff;font-size:10px}.print-toolbar{max-width:190mm;margin:14px auto;display:flex;justify-content:space-between;align-items:center;gap:12px;color:#7d6d63}.print-toolbar button{border:0;border-radius:20px;background:#a71831;color:white;font-weight:bold;padding:10px 16px;cursor:pointer}.employee-sheet{width:190mm;margin:0 auto 16mm;break-after:page;page-break-after:always;break-inside:avoid;page-break-inside:avoid}.employee-sheet:last-child{break-after:auto;page-break-after:auto}.sheet-header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #a71831;padding:0 0 3mm;gap:5mm}.sheet-header strong{display:block;font:italic 700 22px Georgia,serif;color:#a71831}.sheet-header span{display:block;margin-top:1mm;letter-spacing:1px;text-transform:uppercase;font-size:9px}.sheet-header>b{font-size:13px;text-align:right}.employee-heading{margin:3mm 0}.employee-heading h1{font:700 21px Georgia,serif;color:#a71831;margin:0;overflow-wrap:anywhere}.employee-heading p{margin:1mm 0 0;color:#7d6d63;font-size:10px}.balance-grid{display:grid;grid-template-columns:1fr 1fr 1.2fr;border:1px solid #dbcdbd;border-radius:7px;overflow:hidden}.balance-grid>div{padding:2.5mm 3mm}.balance-grid>div+div{border-left:1px solid #dbcdbd}.balance-grid span{display:block;text-transform:uppercase;font-size:9px;letter-spacing:.3px}.balance-grid strong{display:block;font:700 23px Georgia,serif;margin-top:1mm}.final-balance{background:#f6ead9}.balance-formula{text-align:right;color:#7d6d63;margin:1.5mm 0 2mm;font-size:10px}.monthly-totals{display:flex;justify-content:space-between;gap:3mm;margin:2mm 0 3mm;font-size:10px}.print-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10px}.print-table th{background:#f2e5d3;color:#6f6259;font-size:9px;text-align:center;padding:1mm .6mm;line-height:1.15}.print-table td{height:5mm;padding:.7mm .5mm;border-bottom:1px solid #e5dace;text-align:center;white-space:nowrap;line-height:1.2}.print-table tbody tr{break-inside:avoid;page-break-inside:avoid}.print-table .day-status{font-size:9px;white-space:normal}.print-table tfoot th{padding:1.5mm .6mm;border-top:1px solid #dbcdbd}.print-table tfoot th:first-child{text-align:left}.print-table .empty-month{height:20mm;color:#7d6d63}.balance-positive{color:#2e6b2e!important}.balance-negative{color:#a71831!important}.sheet-footer{margin-top:2.5mm;color:#7d6d63;font-size:8px;line-height:1.4}.sheet-footer p{margin:1mm 0}.pending-note{color:#8a5b00}.signatures{display:flex;justify-content:space-between;gap:12mm;margin:9mm 0 2mm;text-align:center}.signatures span{width:45%;border-top:1px solid #b7a99c;padding-top:1mm}.sheet-meta{display:flex;justify-content:space-between;gap:5mm;border-top:1px solid #e5dace;padding-top:1.5mm}@media print{.print-toolbar{display:none}.employee-sheet{width:auto;margin:0}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="print-toolbar"><span>Uma página por funcionário</span><button type="button" onclick="window.print()">Salvar em PDF / imprimir</button></div>'+pages+'</body></html>';
}
function openMonthlyReportWindow(){
  const popup=window.open('','_blank');
  if(!popup)alert('O navegador bloqueou a janela do PDF. Autorize a abertura e tente novamente.');
  return popup;
}
function printMonthlyReport(report=monthlyReport,popup=null){
  if(!report)return;
  if(!report.employees.length){if(popup&&!popup.closed)popup.close();alert('Nenhum funcionário encontrado para este fechamento.');return}
  popup=popup||openMonthlyReportWindow();if(!popup||popup.closed)return;
  popup.document.open();popup.document.write(buildMonthlyPrintHtml(report));popup.document.close();popup.focus();
  setTimeout(()=>{if(!popup.closed)popup.print()},350);
}
function monthlyReportParameters(allEmployees=false){
  return {month:$('#reportMonth').value,employeeId:allEmployees?'':$('#reportEmployee').value,weeklyHours:$('#reportWeeklyHours').value};
}
function setMonthlyReportBusy(busy){
  $('#reportForm').querySelectorAll('input,select,button').forEach(control=>{control.disabled=busy});
  ['generateAllReports','downloadReportCsv','downloadReportTxt','printReport'].forEach(id=>{$('#'+id).disabled=busy});
}
async function generateAllMonthlyReports(){
  if($('#generateAllReports').disabled||!$('#reportForm').reportValidity())return;
  const popup=openMonthlyReportWindow();if(!popup)return;
  popup.document.open();popup.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Gerando fechamentos</title></head><body style="font-family:Arial,sans-serif;padding:24px;color:#31251f"><p>Gerando os fechamentos de todos os funcionários...</p></body></html>');popup.document.close();
  const parameters=monthlyReportParameters(true);setMonthlyReportBusy(true);
  invalidateMonthlyReport('Calculando os fechamentos de todos os funcionários...');
  try{
    const report=await api('admin-monthly-report','GET',parameters);
    $('#reportEmployee').value='';renderMonthlyReport(report);printMonthlyReport(report,popup);
    $('#reportStatus').textContent=report.employees.length?'Fechamentos gerados: '+report.employees.length+' funcionário(s), uma página por pessoa.':'Nenhum funcionário encontrado.';
  }catch(err){if(!popup.closed)popup.close();invalidateMonthlyReport('Não foi possível gerar os fechamentos.');alert(err.message)}
  finally{setMonthlyReportBusy(false)}
}
function historyBadge(date,corrections,row){
  const items=corrections.filter(c=>c.work_date===date),statuses=items.map(c=>c.status);
  if(items.some(c=>c.kind==='out'&&c.punch_id===null&&c.status==='pending'))return'<span class="badge pending">saída aguardando aprovação</span>';
  if(row.in&&!row.out&&date<new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()))return'<span class="badge pending">saída não registrada</span>';
  if(statuses.includes('pending'))return'<span class="badge pending">correção pendente</span>';
  if(items.some(c=>c.kind==='out'&&c.punch_id===null&&c.status==='approved'))return'<span class="badge approved">saída incluída depois</span>';
  if(statuses.includes('approved'))return'<span class="badge approved">corrigido</span>';
  if(statuses.includes('rejected'))return'<span class="badge rejected">correção recusada</span>';
  return Object.keys(row).length===4?'<span class="badge approved">completo</span>':'<span class="badge pending">incompleto</span>';
}
function renderEmployeeHistory(detail){
  const days={};
  for(const punch of detail.punches){days[punch.work_date]??={};days[punch.work_date][punch.kind]=punch.occurred_at}
  const applied=new Set();
  const corrections=detail.corrections.slice().sort((a,b)=>new Date(b.decided_at||b.created_at)-new Date(a.decided_at||a.created_at)||new Date(b.created_at)-new Date(a.created_at)||String(b.id).localeCompare(String(a.id)));
  for(const correction of corrections){
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
function renderTodaySummary(users,punches){
  const todayBy={};for(const punch of punches){todayBy[punch.user_id]??={};todayBy[punch.user_id][punch.kind]=punch}
  const displayTime=punch=>time(punch?.effective_at||punch?.occurred_at);
  return users.map(user=>{
    const row=todayBy[user.id]||{};
    let status='<span class="badge">sem jornada</span>';
    if(row.in&&!row.out)status='<span class="badge pending">em andamento</span>';
    if(row.out)status='<span class="badge approved">jornada encerrada</span>';
    return '<div class="item"><div><strong>'+esc(user.name)+'</strong><div class="sub">Entrada '+displayTime(row.in)+' · Intervalo '+displayTime(row.breakOut)+' / '+displayTime(row.breakIn)+' · Saída '+displayTime(row.out)+'</div></div><div>'+status+'</div></div>';
  }).join('')||'<p class="muted">Nenhum funcionário cadastrado.</p>';
}
const REVIEW_TIME_LABELS={in:'Entrada',breakOut:'Intervalo: saída',breakIn:'Intervalo: volta',out:'Saída'};
function monthlyReviewChanges(){
  if(!monthlyTimeReview)return[];
  return monthlyTimeReview.days.filter(day=>day.editable).flatMap(day=>{
    const row=$('#employeeReviewDays').querySelector('[data-review-date="'+day.date+'"]');if(!row)return[];
    const times=Object.fromEntries(Object.keys(REVIEW_TIME_LABELS).map(kind=>[kind,row.querySelector('[data-review-kind="'+kind+'"]').value]));
    return Object.keys(times).some(kind=>times[kind]!==day.times[kind])?[{date:day.date,version:day.version,times}]:[];
  });
}
function monthlyReviewWorked(times){
  const values=Object.keys(REVIEW_TIME_LABELS).map(kind=>times[kind]);
  if(values.some(value=>!value))return null;
  const minutes=values.map(value=>Number(value.slice(0,2))*60+Number(value.slice(3)));
  if(minutes.some((value,index)=>index>0&&value<minutes[index-1]))return null;
  return minutes[1]-minutes[0]+minutes[3]-minutes[2];
}
function updateMonthlyReviewEdits(event){
  if(event)$('#employeeReviewStatus').textContent='';
  if(monthlyTimeReview){
    for(const day of monthlyTimeReview.days){
      const row=$('#employeeReviewDays').querySelector('[data-review-date="'+day.date+'"]');if(!row)continue;
      const times={};
      row.querySelectorAll('[data-review-kind]').forEach(input=>{
        const kind=input.dataset.reviewKind,changed=input.value!==day.times[kind];times[kind]=input.value;
        input.classList.toggle('review-changed',changed);
        input.parentElement.querySelector('.review-original').classList.toggle('hidden',!changed&&!day.corrected[kind]);
      });
      row.classList.toggle('review-day-changed',Object.keys(times).some(kind=>times[kind]!==day.times[kind]));
      row.querySelector('[data-review-worked]').textContent=compactReportDuration(monthlyReviewWorked(times));
    }
  }
  const count=monthlyReviewChanges().length;
  $('#employeeReviewChanges').textContent=count?count+' '+(count===1?'dia alterado':'dias alterados')+' para salvar.':'Nenhuma alteração para salvar.';
  $('#employeeReviewSave').disabled=monthlyTimeReviewBusy||!count;
  $('#employeeReviewUndo').disabled=monthlyTimeReviewBusy||!count;
}
function setMonthlyReviewBusy(busy){
  monthlyTimeReviewBusy=busy;
  ['employeeReviewMonth','employeeReviewReload','employeeReviewReason','closeEmployeeDetail'].forEach(id=>{$('#'+id).disabled=busy});
  $$('#employeeReviewDays [data-review-kind]').forEach(input=>{input.disabled=busy||input.dataset.reviewEditable!=='true'});
  updateMonthlyReviewEdits();
}
function canDiscardMonthlyReview(){
  return !monthlyReviewChanges().length||confirm('Há horários alterados que ainda não foram salvos. Descartar essas alterações?');
}
function renderMonthlyTimeReview(review){
  monthlyTimeReview=review;
  $('#employeeReviewHeading').textContent=monthLabel(review.month)+' · jornada de '+durationLabel(employeeDailyWorkMinutes(review.employee))+' por dia';
  $('#employeeReviewDays').innerHTML=review.days.map(day=>{
    const date=day.date.split('-').reverse().join('/'),label=day.pendingCorrections?'<span class="badge pending">'+day.pendingCorrections+' pendente(s)</span>':!day.editable?'<span class="badge">Data futura</span>':day.hasRecords?'<span class="badge '+(day.workedMinutes===null?'pending':'approved')+'">'+(day.workedMinutes===null?'Incompleto':'Completo')+'</span>':'<span class="badge">Sem registros</span>';
    return '<article class="month-review-day '+(!day.editable?'review-future':'')+'" data-review-date="'+esc(day.date)+'"><div class="review-day-heading"><strong>'+esc(date.slice(0,5))+'</strong><small>'+esc(new Date(day.date+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short'}))+'</small>'+label+'</div>'+Object.entries(REVIEW_TIME_LABELS).map(([kind,text])=>'<label class="review-time-field"><span>'+text+'</span><input type="time" step="60" aria-label="'+esc(text+' em '+date)+'" value="'+esc(day.times[kind]||'')+'" data-review-kind="'+kind+'" data-review-editable="'+day.editable+'"'+(!day.editable||monthlyTimeReviewBusy?' disabled':'')+'><small class="review-original '+(day.corrected[kind]?'':'hidden')+'">Original: '+esc(day.original[kind]||'sem batida')+'</small></label>').join('')+'<div class="review-day-total"><span>Trabalhado</span><b data-review-worked>'+compactReportDuration(day.workedMinutes)+'</b></div></article>';
  }).join('');
  updateMonthlyReviewEdits();
}
async function loadMonthlyTimeReview(){
  if(monthlyTimeReviewBusy||!selectedEmployeeId)return;
  const month=$('#employeeReviewMonth').value;if(!month)return;
  if(!canDiscardMonthlyReview()){if(monthlyTimeReview)$('#employeeReviewMonth').value=monthlyTimeReview.month;return}
  const id=selectedEmployeeId,sequence=++monthlyTimeReviewSequence;
  monthlyTimeReview=null;$('#employeeReviewDays').innerHTML='<p class="muted">Carregando os horários do mês...</p>';$('#employeeReviewHeading').textContent=monthLabel(month);$('#employeeReviewStatus').textContent='';
  setMonthlyReviewBusy(true);
  try{
    const review=await api('admin-monthly-times','GET',{id,month});
    if(sequence!==monthlyTimeReviewSequence||selectedEmployeeId!==id)return;
    renderMonthlyTimeReview(review);
  }catch(error){if(sequence===monthlyTimeReviewSequence){$('#employeeReviewDays').innerHTML='';$('#employeeReviewStatus').textContent=error.message}}
  finally{if(sequence===monthlyTimeReviewSequence)setMonthlyReviewBusy(false)}
}
async function saveMonthlyTimeReview(event){
  event.preventDefault();
  if(monthlyTimeReviewBusy||!monthlyTimeReview||!$('#employeeReviewForm').reportValidity())return;
  const days=monthlyReviewChanges();if(!days.length)return;
  const id=selectedEmployeeId,month=monthlyTimeReview.month,reason=$('#employeeReviewReason').value.trim();
  let saved=false;setMonthlyReviewBusy(true);$('#employeeReviewStatus').textContent='Salvando as correções do mês...';
  try{
    const result=await api('admin-save-monthly-times','POST',{id,month,reason,days});saved=true;
    invalidateMonthlyReport('Horários corrigidos. Gere o fechamento novamente para atualizar os totais e os arquivos.');
    const review=await api('admin-monthly-times','GET',{id,month});
    if(selectedEmployeeId!==id)return;
    renderMonthlyTimeReview(review);
    const detail=await api('admin-employee-detail','GET',{id});renderEmployeeHistory(detail);
    await render();
    $('#employeeReviewStatus').textContent='Correções salvas: '+result.changedDays+' dia(s), '+result.changedTimes+' horário(s). Gere o fechamento novamente.';
  }catch(error){
    if(saved)monthlyTimeReview=null;
    $('#employeeReviewStatus').textContent=saved?'As correções foram salvas. Recarregue o mês para conferir os horários atualizados.':error.message;
  }finally{setMonthlyReviewBusy(false)}
}
window.reviewEmployeeMonth=async(id,month)=>{
  if(monthlyTimeReviewBusy)return;
  await activateAdminTab('employees');await openEmployee(id,month);
};
window.openEmployee=async(id,reviewMonth)=>{
  if(monthlyTimeReviewBusy||!canDiscardMonthlyReview())return;
  monthlyTimeReviewSequence+=1;monthlyTimeReview=null;
  selectedEmployeeId=id;
  $('#employeeGrid').classList.add('hidden');$('#employeeDetail').classList.remove('hidden');$('#employeeDetailBody').classList.add('hidden');
  $('#employeeDetailName').textContent='Carregando funcionário...';$('#employeeDetailMeta').textContent='';$('#employeeDetailStatus').innerHTML='';
  try{
    const detail=await api('admin-employee-detail','GET',{id});
    if(selectedEmployeeId!==id)return;
    const employee=detail.employee;
    $('#employeeDetailName').textContent=employee.name;
    $('#employeeDetailMeta').textContent=[contactLabel(employee),employee.unit,durationLabel(employeeDailyWorkMinutes(employee))+'/dia'].filter(Boolean).join(' · ');
    $('#employeeDetailStatus').innerHTML=employee.pending_activation?'<span class="badge pending">aguardando ativação</span>':employee.active?'<span class="badge approved">ativo</span>':'<span class="badge rejected">desativado</span>';
    $('#employeeDailyHours').value=employeeDailyWorkMinutes(employee)/60;$('#employeeDailyHoursStatus').textContent='';
    renderEmployeeHistory(detail);$('#employeeDetailBody').classList.remove('hidden');
    $('#employeeReviewMonth').max=currentMonth();$('#employeeReviewMonth').value=reviewMonth||$('#reportMonth').value||currentMonth();
    $('#employeeReviewReason').value='Conferência do fechamento mensal';await loadMonthlyTimeReview();
    $('#employeeDetail').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(e){selectedEmployeeId=null;$('#employeeDetail').classList.add('hidden');$('#employeeGrid').classList.remove('hidden');alert(e.message)}
};
async function saveEmployeeDailyHours(event){
  event.preventDefault();const form=event.currentTarget,id=selectedEmployeeId,button=form.querySelector('button[type="submit"]'),input=$('#employeeDailyHours');
  if(!id||button.disabled||!form.reportValidity())return;
  const dailyHours=Number(input.value);button.disabled=true;input.disabled=true;$('#employeeDailyHoursStatus').textContent='Salvando jornada...';
  try{
    const result=await api('admin-save-daily-hours','POST',{id,dailyHours});
    invalidateMonthlyReport('Jornada atualizada. Gere o fechamento novamente.');
    await render();
    if(selectedEmployeeId===id){input.value=employeeDailyWorkMinutes(result.employee)/60;$('#employeeDailyHoursStatus').textContent='Jornada salva: '+durationLabel(employeeDailyWorkMinutes(result.employee))+' por dia. Os próximos fechamentos usarão esse valor.';$('#employeeDetailMeta').textContent=[contactLabel(overview?.users?.find(user=>user.id===id)||result.employee),result.employee.unit,durationLabel(employeeDailyWorkMinutes(result.employee))+'/dia'].filter(Boolean).join(' · ')}
  }catch(error){if(selectedEmployeeId===id)$('#employeeDailyHoursStatus').textContent=error.message}
  finally{button.disabled=false;input.disabled=false}
}
function closeEmployeeDetail(){if(monthlyTimeReviewBusy||!canDiscardMonthlyReview())return;monthlyTimeReviewSequence+=1;monthlyTimeReview=null;selectedEmployeeId=null;$('#employeeDetail').classList.add('hidden');$('#employeeGrid').classList.remove('hidden')}
async function activateAdminTab(name){
  const button=$('[data-tab="'+name+'"]'),panel=$('#'+name);if(!button||!panel)return;
  $$('.tab').forEach(item=>item.classList.remove('active'));$$('.panel').forEach(item=>item.classList.remove('active'));button.classList.add('active');panel.classList.add('active');
  if(name==='checklistAdmin')await loadAdminChecklist();
  else if(name==='recipesAdmin')await loadAdminRecipes();
  else{await render();if(name==='reports')await loadAdminChecklist()}
}
async function activateRequestedAdminTab(){
  const name=location.hash.replace(/^#/,'');if(name&&name!=='today'&&$('#'+name)?.classList.contains('panel'))await activateAdminTab(name);
}
async function boot(){
  try{
    const health=await api('health');
    if(!health.hasAdmin){showOnly('setup');return}
    try{
      const m=await api('me');await enterAdminDashboard(m.user);
    }catch{showOnly('adminLogin')}
  }catch(e){alert('Não foi possível conectar ao banco de dados. '+e.message);showOnly('adminLogin')}
}
async function render(){
  try{
    overview=await api('admin-overview');
    const {users,punches,corrections,date}=overview;
    const correctionRequests=correctionGroups(corrections);
    const pendingCorrectionRequests=correctionRequests.filter(request=>request.items.some(item=>item.status==='pending')).length;
    const missing=overview.missingExits||[],pendingCount=pendingCorrectionRequests+missing.filter(row=>row.status!=='pending').length;
    $('#batidas').textContent=punches.length;
    $('#entradas').textContent=punches.filter(p=>p.kind==='in').length;
    $('#pendentes').textContent=pendingCount;
    $('#correctionCount').textContent=pendingCount;
    $('#correctionCount').classList.toggle('hidden',pendingCount===0);
    $('#correctionCount').setAttribute('aria-hidden',pendingCount===0?'true':'false');
    $('[data-tab="corrections"]').setAttribute('aria-label',pendingCount?'Correções, '+pendingCount+' '+(pendingCount===1?'pendência':'pendências'):'Correções');
    $('#funcionarios').textContent=users.filter(u=>u.role==='employee'&&u.active).length;
    renderAccessPolicy(overview.accessPolicy);
    renderAccessProfiles(overview.accessProfiles,overview.accessPolicy);

    const empUsers=users.filter(u=>u.role==='employee');
    populateReportEmployees(empUsers);
    $('#todayList').innerHTML=renderTodaySummary(empUsers,punches);

    $('#employeeList').innerHTML=empUsers.map(u=>'<div class="item employee-item" role="button" tabindex="0" data-employee-id="'+esc(u.id)+'"><div><strong>'+esc(u.name)+'</strong><div class="sub">'+esc(contactLabel(u))+' · '+esc(u.unit)+' · '+durationLabel(employeeDailyWorkMinutes(u))+'/dia</div><div style="margin-top:6px">'+accountStatus(u)+'</div></div><div class="actions"><button class="btn small" onclick="openEmployee(\''+u.id+'\')">Ver ficha</button>'+passwordActions(u)+'<button class="btn small secondary" onclick="toggleUser(\''+u.id+'\')">'+(u.active?'Desativar':'Reativar')+'</button></div></div>').join('')||'<p class="muted">Nenhum funcionário.</p>';
    $$('#employeeList .employee-item').forEach(item=>{
      item.addEventListener('click',event=>{if(!event.target.closest('button'))openEmployee(item.dataset.employeeId)});
      item.addEventListener('keydown',event=>{if(event.target.closest('button'))return;if(event.key==='Enter'||event.key===' '){event.preventDefault();openEmployee(item.dataset.employeeId)}});
    });

    const labels={in:'Chegada',breakOut:'Saída para intervalo',breakIn:'Volta do intervalo',out:'Saída'},order={in:0,breakOut:1,breakIn:2,out:3};
    $('#missingExitList').innerHTML=missingExitList(missing);
    $('#correctionList').innerHTML=correctionRequests.map(c=>{
      const items=c.items.slice().sort((a,b)=>order[a.kind]-order[b.kind]),complete=c.grouped&&items.length===4,missingExit=c.kind==='out'&&c.punch_id===null;
      const table='<div class="correction-times"><div class="correction-time-head"><span>Batida</span><span>Registrado</span><span>Solicitado</span><span>Decisão</span></div>'+items.map(x=>'<div class="correction-time-row '+(time(x.original_at)!==time(x.requested_at)?'changed':'')+'"><strong>'+labels[x.kind]+'</strong><b>'+(x.kind==='out'&&x.punch_id===null?'Não registrada':time(x.original_at))+'</b><b>'+time(x.requested_at)+'</b>'+correctionDecision(x)+'</div>').join('')+'</div>';
      return '<div class="item"><div class="correction-content"><strong>'+esc(c.name)+' — '+(missingExit?'Saída esquecida':complete?'Jornada completa':labels[c.kind])+'</strong><div class="sub">'+c.work_date.split('-').reverse().join('/')+'</div>'+table+'<div class="sub">Motivo: '+esc(c.reason)+'</div>'+correctionRequestSummary(items)+'</div></div>';
    }).join('')||'<p class="muted">Nenhuma solicitação de correção.</p>';

    const admins=users.filter(u=>u.role==='admin');
    $('#adminList').innerHTML=admins.map(u=>'<div class="item"><div><strong>'+esc(u.name)+'</strong><div class="sub">'+esc(contactLabel(u))+'</div><div style="margin-top:6px">'+accountStatus(u)+'</div></div><div class="actions">'+passwordActions(u,u.id!==currentUser?.id)+'</div></div>').join('');
    $('#addAdminForm').querySelector('button').disabled=admins.filter(u=>u.active).length>=2;
  }catch(e){if(e.status===401){showOnly('adminLogin')}else alert(e.message)}
}
window.copyActivation=async code=>{if(!code)return;try{await navigator.clipboard.writeText(code);alert('Código copiado.')}catch{prompt('Copie o código:',code)}}
window.toggleUser=async id=>{try{await api('admin-toggle-user','POST',{id});invalidateMonthlyReport();await render()}catch(e){alert(e.message)}}
window.regenActivation=async id=>{const person=overview?.users?.find(u=>u.id===id),contact=contactLabel(person)||'esta pessoa',alreadyPending=Boolean(person?.pending_activation);if(!confirm(alreadyPending?'Trocar o código de '+contact+'? O código anterior deixará de funcionar.':'Gerar um código para '+contact+' criar outra senha? A senha atual será invalidada e as sessões abertas serão encerradas.'))return;try{const r=await api('admin-reset-activation','POST',{id});await render();alert('Novo código de senha: '+r.activationCode)}catch(e){alert(e.message)}}
window.decideCorrection=async(id,status)=>{const note=prompt(status==='approved'?'Observação opcional da aprovação:':'Motivo opcional da recusa:','');if(note===null)return;try{await api('admin-decide-correction','POST',{id,status,note});invalidateMonthlyReport();await render()}catch(e){alert(e.message)}}
window.redoCorrection=async id=>{if(!confirm('Refazer esta decisão? O horário voltará para pendente.'))return;try{await api('admin-reset-correction-decision','POST',{id});invalidateMonthlyReport();await render()}catch(e){alert(e.message)}}

$('#restrictPunches').addEventListener('click',async()=>{
  if(!confirm('Para salvar, esteja dentro do Pão da Leli e permita a localização. O local ficará disponível para ativar depois. Continuar?'))return;
  const locationName=prompt('Qual nome você quer mostrar para este local?',overview?.accessPolicy?.locationName||'Pão da Leli');
  if(locationName===null)return;
  if(!locationName.trim()){alert('Digite um nome para identificar este local.');return}
  const button=$('#restrictPunches'),free=$('#freePunches');button.disabled=true;free.disabled=true;button.textContent='CONFIRMANDO LOCAL...';
  try{
    const location=await captureAccessLocation();
    await api('admin-access-policy','POST',{mode:'restricted',location,locationName:locationName.trim()});
    await render();alert('Local salvo e ativado. Depois você poderá reativar esta configuração mesmo estando longe.');
  }catch(err){alert(err.message);renderAccessPolicy(overview?.accessPolicy)}
});
$('#freePunches').addEventListener('click',async()=>{
  if(!confirm('Deixar o ponto livre? Enquanto estiver assim, funcionários poderão registrar de qualquer lugar.'))return;
  const button=$('#freePunches'),restrict=$('#restrictPunches');button.disabled=true;restrict.disabled=true;
  try{await api('admin-access-policy','POST',{mode:'free'});await render();alert('Ponto livre ativado.');}
  catch(err){alert(err.message);renderAccessPolicy(overview?.accessPolicy)}
});

$('#setupForm').addEventListener('submit',async e=>{e.preventDefault();try{await api('bootstrap','POST',{token:$('#setupToken').value.trim(),name:$('#setupName').value.trim(),phone:$('#setupPhone').value.trim(),password:$('#setupPassword').value});alert('Administrador criado. Faça o login.');showOnly('adminLogin');$('#adminIdentifier').value=$('#setupPhone').value.trim()}catch(err){alert(err.message)}});
$('#adminLoginForm').addEventListener('submit',async e=>{e.preventDefault();const identifier=$('#adminIdentifier').value.trim(),button=e.submitter||e.currentTarget.querySelector('button[type="submit"]');button.disabled=true;try{const r=await api('admin-login','POST',{identifier,password:$('#adminPassword').value,rememberMe:$('#adminRememberLogin').checked});$('#adminPassword').value='';await enterAdminDashboard(r.user)}catch(err){if(err.data?.needsActivation){$('#adminActivateIdentifier').value=identifier;showOnly('adminActivate')}else alert(err.message)}finally{button.disabled=false}});
$('#goAdminActivate').addEventListener('click',()=>{$('#adminActivateIdentifier').value=$('#adminIdentifier').value.trim();showOnly('adminActivate')});
$('#backToAdminLogin').addEventListener('click',()=>{$('#adminIdentifier').value=$('#adminActivateIdentifier').value.trim();showOnly('adminLogin')});
$('#adminActivateForm').addEventListener('submit',async e=>{e.preventDefault();const identifier=$('#adminActivateIdentifier').value.trim(),password=$('#adminActivationPassword').value,button=e.submitter||e.currentTarget.querySelector('button[type="submit"]');button.disabled=true;try{await api('admin-activate','POST',{identifier,code:$('#adminActivationCode').value.trim(),password});const r=await api('admin-login','POST',{identifier,password});await enterAdminDashboard(r.user);alert('Acesso administrativo ativado.')}catch(err){alert(err.message)}finally{button.disabled=false}});
$('#adminForgotPassword').addEventListener('click',async()=>{const identifier=prompt('Informe o telefone ou e-mail do administrador:',$('#adminIdentifier').value.trim());if(identifier===null)return;try{await api('request-password-reset','POST',{identifier:identifier.trim()});alert('Pedido enviado. Outro administrador deve gerar o novo código. Depois toque em “Primeiro acesso” nesta tela para criar outra senha.')}catch(err){alert(err.message)}});
$('#employeeForm').addEventListener('submit',async e=>{e.preventDefault();try{const r=await api('admin-create-user','POST',{name:$('#empName').value.trim(),phone:$('#empPhone').value.trim(),position:'Colaborador',unit:$('#empUnit').value,dailyHours:$('#empDailyHours').value,role:'employee'});$('#activationResult').innerHTML='<div class="notice" style="margin-top:12px"><b>'+esc(r.user.name)+'</b><br>Código de ativação: <strong style="font-size:18px">'+esc(r.activationCode)+'</strong><br><span class="sub">Este código ficará visível aqui até a conta ser ativada.</span></div>';e.target.reset();invalidateMonthlyReport();await render()}catch(err){alert(err.message)}});
$('#addAdminForm').addEventListener('submit',async e=>{e.preventDefault();try{const r=await api('admin-create-user','POST',{name:$('#newAdminName').value.trim(),phone:$('#newAdminPhone').value.trim(),position:'Administrador',unit:'Pão da Leli',role:'admin'});$('#adminActivationResult').innerHTML='<div class="notice" style="margin-top:12px"><b>'+esc(r.user.name)+'</b><br>Código de primeiro acesso: <strong style="font-size:18px">'+esc(r.activationCode)+'</strong><br><span class="sub">Entregue este código ao novo ADM. Ele deve abrir /admin, tocar em “Primeiro acesso” e criar a senha.</span></div>';e.target.reset();await render()}catch(err){alert(err.message)}});
$('#closeEmployeeDetail').addEventListener('click',closeEmployeeDetail);
$('#employeeDailyHoursForm').addEventListener('submit',saveEmployeeDailyHours);
$('#employeeReviewMonthForm').addEventListener('submit',event=>{event.preventDefault();loadMonthlyTimeReview()});
$('#employeeReviewMonth').addEventListener('change',loadMonthlyTimeReview);
$('#employeeReviewDays').addEventListener('input',updateMonthlyReviewEdits);
$('#employeeReviewForm').addEventListener('submit',saveMonthlyTimeReview);
$('#employeeReviewUndo').addEventListener('click',()=>{if(monthlyTimeReviewBusy||!monthlyTimeReview)return;renderMonthlyTimeReview(monthlyTimeReview);$('#employeeReviewStatus').textContent='Alterações não salvas desfeitas.'});
$('#reportEmployeeSummary').addEventListener('click',event=>{const button=event.target.closest('[data-review-employee]');if(button)reviewEmployeeMonth(button.dataset.reviewEmployee,button.dataset.reviewMonth)});

$('#closingDateForm').addEventListener('submit',async e=>{e.preventDefault();const date=$('#closingDate').value;if(!date)return;closingSearchDate=date;await loadAdminChecklist()});
$('#closingLatestDate').addEventListener('click',async()=>{closingSearchDate='';await loadAdminChecklist()});
$('#checklistUnit').addEventListener('change',()=>{renderChecklistEditors();$('#checklistSaveStatus').textContent=''});
$('#addChecklistQuestion').addEventListener('click',()=>{const questions=editorQuestions();if(questions.length>=30){alert('O limite é de 30 perguntas por área.');return}questions.push('');renderQuestionEditor(questions);$$('#checklistQuestionsAdmin input').at(-1)?.focus()});
$('#addMissingItem').addEventListener('click',()=>{const items=editorMissingItems();if(items.length>=60){alert('O limite é de 60 itens por área.');return}items.push('');renderMissingEditor(items);$$('#missingOptionsAdmin input').at(-1)?.focus()});
$('#checklistFormAdmin').addEventListener('submit',async e=>{
  e.preventDefault();const button=$('#saveChecklist'),questions=editorQuestions().map(value=>value.trim()).filter(Boolean),missingItems=editorMissingItems().map(value=>value.trim()).filter(Boolean);button.disabled=true;$('#checklistSaveStatus').textContent='Salvando...';
  try{await api('admin-save-checklist','POST',{unit:$('#checklistUnit').value,questions,missingItems});await loadAdminChecklist();$('#checklistSaveStatus').textContent='Configuração salva.'}
  catch(err){$('#checklistSaveStatus').textContent='';alert(err.message)}
  finally{button.disabled=false}
});
$('#newRecipe').addEventListener('click',()=>{clearRecipeForm();$('#recipeForm').scrollIntoView({behavior:'smooth',block:'start'});$('#recipeName').focus()});
$('#cancelRecipeEdit').addEventListener('click',clearRecipeForm);
$('#adminRecipeSearch').addEventListener('input',renderAdminRecipeList);
$('#addRecipeIngredient').addEventListener('click',()=>{$('#recipeIngredients').insertAdjacentHTML('beforeend',recipeIngredientRow());$$('#recipeIngredients .ingredient-name').at(-1)?.focus()});
$('#recipeIngredients').addEventListener('click',event=>{
  const button=event.target.closest('.remove-ingredient');if(!button)return;
  const rows=$$('#recipeIngredients .recipe-ingredient-row');if(rows.length===1){rows[0].querySelectorAll('input').forEach(input=>input.value='');return}button.closest('.recipe-ingredient-row').remove();
});
$('#recipeForm').addEventListener('submit',async event=>{
  event.preventDefault();const button=$('#saveRecipe'),recipe=recipeFromForm();button.disabled=true;$('#recipeSaveStatus').textContent='Salvando...';
  try{const result=await api('admin-save-recipe','POST',{id:recipe.id,recipe});$('#recipeSaveStatus').textContent='Receita salva.';await loadAdminRecipes(result.recipe.id);}
  catch(err){$('#recipeSaveStatus').textContent='';alert(err.message)}finally{button.disabled=false}
});
$('#deleteRecipe').addEventListener('click',async()=>{
  const recipe=recipeAdminData.find(item=>item.id===selectedRecipeAdminId);if(!recipe)return;
  if(!confirm('Excluir “'+recipe.name+'” do caderno de receitas?'))return;
  const button=$('#deleteRecipe');button.disabled=true;
  try{await api('admin-delete-recipe','POST',{id:recipe.id});clearRecipeForm();await loadAdminRecipes();}
  catch(err){alert(err.message)}finally{button.disabled=false}
});
$('#reportForm').addEventListener('submit',async e=>{
  e.preventDefault();const parameters=monthlyReportParameters();setMonthlyReportBusy(true);invalidateMonthlyReport('Calculando o fechamento...');
  try{const report=await api('admin-monthly-report','GET',parameters);renderMonthlyReport(report)}
  catch(err){invalidateMonthlyReport('Não foi possível gerar o fechamento.');alert(err.message)}
  finally{setMonthlyReportBusy(false)}
});
$('#generateAllReports').addEventListener('click',generateAllMonthlyReports);
$('#downloadReportCsv').addEventListener('click',downloadMonthlyReport);
$('#downloadReportTxt').addEventListener('click',downloadMonthlyReportTxt);
['reportMonth','reportEmployee','reportWeeklyHours'].forEach(id=>$('#'+id).addEventListener('change',()=>{if(monthlyReport)invalidateMonthlyReport('Parâmetros alterados. Gere o fechamento novamente para baixar os arquivos.')}));
$('#printReport').addEventListener('click',()=>printMonthlyReport());

$('#resetSystem').addEventListener('click',async()=>{
  if(!confirm('Zerar o sistema agora? Todos os funcionários, outros administradores, batidas, escalas, correções, checklists, recados e locais salvos serão apagados. Somente o seu administrador continuará. Esta ação não pode ser desfeita.'))return;
  const confirmation=prompt('Para confirmar, digite APAGAR TUDO:','');
  if(confirmation===null)return;
  if(confirmation.trim()!=='APAGAR TUDO'){alert('Nada foi apagado. A confirmação precisa ser exatamente APAGAR TUDO.');return}
  const button=$('#resetSystem'),status=$('#resetSystemStatus'),originalLabel=button.textContent;
  button.disabled=true;button.textContent='ZERANDO...';status.textContent='Apagando os dados com segurança...';
  try{
    const result=await api('admin-reset-system','POST',{confirmation:'APAGAR TUDO'});
    selectedEmployeeId=null;checklistAdminData=null;monthlyReport=null;overview=null;
    status.textContent='Sistema zerado.';
    alert(result.message||'Sistema zerado. Somente o seu administrador foi mantido.');
    location.reload();
  }catch(err){status.textContent='';alert(err.message);button.disabled=false;button.textContent=originalLabel}
});
$('#leaveAdmin').addEventListener('click',e=>{e.preventDefault();endAdminSession('./')});
$('#adminLogout').addEventListener('click',()=>endAdminSession());
$$('.tab').forEach(button=>button.addEventListener('click',()=>activateAdminTab(button.dataset.tab)));
initPasswordToggles();
clearRecipeForm();
$('#reportMonth').value=currentMonth();
$('#reportMonth').max=currentMonth();
boot();



