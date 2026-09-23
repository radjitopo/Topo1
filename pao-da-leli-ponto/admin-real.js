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
let currentUser=null,overview=null;
async function api(action,method='GET',data){
  const opt={method,headers:{'Content-Type':'application/json'}};
  if(data!==undefined)opt.body=JSON.stringify(data);
  const r=await fetch(API+'?action='+encodeURIComponent(action),opt);
  const j=await r.json().catch(()=>({error:'Resposta inválida do servidor.'}));
  if(!r.ok){const e=new Error(j.error||'Erro no sistema.');e.status=r.status;e.data=j;throw e}
  return j;
}
function showOnly(id){['setup','adminLogin','dashboard'].forEach(x=>$('#'+x).classList.add('hidden'));$('#'+id).classList.remove('hidden')}
function time(v){return v?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v)):'—'}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function correctionGroups(rows){
  const groups=new Map();
  for(const row of rows){
    const key=row.request_group||row.id;
    if(!groups.has(key))groups.set(key,{...row,key,grouped:Boolean(row.request_group),items:[]});
    groups.get(key).items.push(row);
  }
  return [...groups.values()];
}
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
    $('#batidas').textContent=punches.length;
    $('#entradas').textContent=punches.filter(p=>p.kind==='in').length;
    $('#pendentes').textContent=correctionRequests.filter(c=>c.status==='pending').length;
    $('#funcionarios').textContent=users.filter(u=>u.role==='employee'&&u.active).length;

    const empUsers=users.filter(u=>u.role==='employee');
    const todayBy={};for(const p of punches){todayBy[p.user_id]??={};todayBy[p.user_id][p.kind]=p}
    $('#todayList').innerHTML=empUsers.map(u=>{const r=todayBy[u.id]||{};let st='<span class="badge">sem jornada</span>';if(r.in&&!r.out)st='<span class="badge pending">em andamento</span>';if(r.out)st='<span class="badge approved">jornada encerrada</span>';return '<div class="item"><div><strong>'+esc(u.name)+'</strong><div class="sub">Entrada '+time(r.in?.occurred_at)+' · Intervalo '+time(r.breakOut?.occurred_at)+' / '+time(r.breakIn?.occurred_at)+' · Saída '+time(r.out?.occurred_at)+'</div></div><div>'+st+'</div></div>'}).join('')||'<p class="muted">Nenhum funcionário cadastrado.</p>';

    $('#employeeList').innerHTML=empUsers.map(u=>'<div class="item"><div><strong>'+esc(u.name)+'</strong><div class="sub">'+esc(u.email)+' · '+esc(u.unit)+'</div><div style="margin-top:6px">'+(u.pending_activation?'<span class="badge pending">aguardando ativação</span><div class="activation-code">Código de ativação: <strong>'+esc(u.activation_code||'—')+'</strong></div>':u.active?'<span class="badge approved">ativo</span>':'<span class="badge rejected">desativado</span>')+'</div></div><div class="actions">'+(u.pending_activation&&u.activation_code?'<button class="btn small secondary" onclick="copyActivation(\''+esc(u.activation_code)+'\')">Copiar código</button>':'')+(u.pending_activation?'<button class="btn small secondary" onclick="regenActivation(\''+u.id+'\')">Trocar código</button>':'')+'<button class="btn small secondary" onclick="toggleUser(\''+u.id+'\')">'+(u.active?'Desativar':'Reativar')+'</button></div></div>').join('')||'<p class="muted">Nenhum funcionário.</p>';

    const labels={in:'Chegada',breakOut:'Saída para intervalo',breakIn:'Volta do intervalo',out:'Saída'},order={in:0,breakOut:1,breakIn:2,out:3};
    $('#correctionList').innerHTML=correctionRequests.map(c=>{const items=c.items.slice().sort((a,b)=>order[a.kind]-order[b.kind]),complete=c.grouped&&items.length===4,table='<div class="correction-times"><div class="correction-time-head"><span>Batida</span><span>Registrado</span><span>Solicitado</span></div>'+items.map(x=>'<div class="correction-time-row '+(time(x.original_at)!==time(x.requested_at)?'changed':'')+'"><strong>'+labels[x.kind]+'</strong><b>'+time(x.original_at)+'</b><b>'+time(x.requested_at)+'</b></div>').join('')+'</div>';return '<div class="item"><div class="correction-content"><strong>'+esc(c.name)+' — '+(complete?'Jornada completa':labels[c.kind])+'</strong><div class="sub">'+c.work_date.split('-').reverse().join('/')+'</div>'+table+'<div class="sub">Motivo: '+esc(c.reason)+'</div><div style="margin-top:6px"><span class="badge '+c.status+'">'+(c.status==='pending'?'pendente':c.status==='approved'?'aprovada':'recusada')+'</span>'+(c.decided_by_name?'<span class="sub"> · por '+esc(c.decided_by_name)+'</span>':'')+'</div></div>'+(c.status==='pending'?'<div class="actions"><button class="btn small" onclick="decideRequest(\''+c.key+'\','+c.grouped+',\'approved\')">'+(complete?'Aprovar tudo':'Aprovar')+'</button><button class="btn small red" onclick="decideRequest(\''+c.key+'\','+c.grouped+',\'rejected\')">'+(complete?'Recusar tudo':'Recusar')+'</button></div>':'')+'</div>'}).join('')||'<p class="muted">Nenhuma solicitação de correção.</p>';

    const admins=users.filter(u=>u.role==='admin');
    $('#adminList').innerHTML=admins.map(u=>'<div class="item"><div><strong>'+esc(u.name)+'</strong><div class="sub">'+esc(u.email)+'</div><div style="margin-top:6px">'+(u.pending_activation?'<span class="badge pending">aguardando ativação</span>':u.active?'<span class="badge approved">ativo</span>':'<span class="badge rejected">desativado</span>')+'</div></div></div>').join('');
    $('#addAdminForm').querySelector('button').disabled=admins.filter(u=>u.active).length>=2;
  }catch(e){if(e.status===401){showOnly('adminLogin')}else alert(e.message)}
}
window.copyActivation=async code=>{if(!code)return;try{await navigator.clipboard.writeText(code);alert('Código copiado.')}catch{prompt('Copie o código:',code)}}
window.toggleUser=async id=>{try{await api('admin-toggle-user','POST',{id});await render()}catch(e){alert(e.message)}}
window.regenActivation=async id=>{const email=overview?.users?.find(u=>u.id===id)?.email||'esta pessoa';if(!confirm('Trocar o código de ativação de '+email+'? O código anterior deixará de funcionar.'))return;try{const r=await api('admin-reset-activation','POST',{id});await render();alert('Novo código: '+r.activationCode)}catch(e){alert(e.message)}}
window.decideRequest=async(key,grouped,status)=>{const note=prompt(status==='approved'?'Observação opcional da aprovação:':'Motivo opcional da recusa:','');if(note===null)return;try{await api(grouped?'admin-decide-correction-group':'admin-decide-correction','POST',grouped?{groupId:key,status,note}:{id:key,status,note});await render()}catch(e){alert(e.message)}}

$('#setupForm').addEventListener('submit',async e=>{e.preventDefault();try{await api('bootstrap','POST',{token:$('#setupToken').value.trim(),name:$('#setupName').value.trim(),email:$('#setupEmail').value.trim(),password:$('#setupPassword').value});alert('Administrador criado. Faça o login.');showOnly('adminLogin');$('#adminEmail').value=$('#setupEmail').value.trim()}catch(err){alert(err.message)}});
$('#adminLoginForm').addEventListener('submit',async e=>{e.preventDefault();try{const r=await api('login','POST',{email:$('#adminEmail').value.trim(),password:$('#adminPassword').value});if(r.user.role!=='admin'){await api('logout','POST',{});throw new Error('Este usuário não é administrador.')}currentUser=r.user;showOnly('dashboard');$('#loggedAs').textContent='Entrou como '+currentUser.name;await render()}catch(err){alert(err.message)}});
$('#employeeForm').addEventListener('submit',async e=>{e.preventDefault();try{const r=await api('admin-create-user','POST',{name:$('#empName').value.trim(),email:$('#empEmail').value.trim(),position:'Colaborador',unit:$('#empUnit').value,role:'employee'});$('#activationResult').innerHTML='<div class="notice" style="margin-top:12px"><b>'+esc(r.user.name)+'</b><br>Código de ativação: <strong style="font-size:18px">'+esc(r.activationCode)+'</strong><br><span class="sub">Este código ficará visível aqui até a conta ser ativada.</span></div>';e.target.reset();await render()}catch(err){alert(err.message)}});
$('#addAdminForm').addEventListener('submit',async e=>{e.preventDefault();try{const r=await api('admin-create-user','POST',{name:$('#newAdminName').value.trim(),email:$('#newAdminEmail').value.trim(),position:'Administrador',unit:'Pão da Leli',role:'admin'});$('#adminActivationResult').innerHTML='<div class="notice" style="margin-top:12px">Código do novo administrador: <strong>'+esc(r.activationCode)+'</strong><br><span class="sub">Este código ficará visível aqui até o administrador ativar a conta.</span></div>';e.target.reset();await render()}catch(err){alert(err.message)}});
$('#adminLogout').addEventListener('click',async()=>{try{await api('logout','POST',{})}catch{}currentUser=null;showOnly('adminLogin')});
$$('.tab').forEach(b=>b.addEventListener('click',()=>{$$('.tab').forEach(x=>x.classList.remove('active'));$$('.panel').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#'+b.dataset.tab).classList.add('active');render()}));
initPasswordToggles();
boot();
