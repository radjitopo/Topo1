import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {createMissingExitFixture,employeeId,otherEmployeeId,adminId} from './leli-missing-exit-fixture.mjs';

let fixture;
before(async()=>{fixture=await createMissingExitFixture({now:new Date('2026-11-03T12:00:00Z')});});
after(async()=>{await fixture?.db.close();});
beforeEach(async()=>{await fixture.reset();});
const review=(id=employeeId,month='2026-10',role='admin')=>fixture.request('admin-monthly-times','GET',{},role,{id,month});
const savedRows=async()=> (await fixture.db.query('SELECT * FROM leli_corrections ORDER BY created_at,id')).rows;
const payload=(data,date,times)=>({date,version:data.days.find(day=>day.date===date).version,times:{...data.days.find(day=>day.date===date).times,...times}});
const save=(days,extra={})=>fixture.request('admin-save-monthly-times','POST',{id:employeeId,month:'2026-10',reason:'Conferência do fechamento mensal',days,...extra},'admin');
async function addPending(date='2026-10-01'){
  await fixture.db.query("INSERT INTO leli_corrections(user_id,work_date,kind,requested_at,reason) VALUES($1,$2,'out',($2::date+time '18:00') AT TIME ZONE 'America/Sao_Paulo','Saída solicitada')",[employeeId,date]);
}

test('abre todos os dias do mês, com horários originais e revisão estável',async()=>{
  const first=await review();
  assert.equal(first.statusCode,200,JSON.stringify(first.data));
  assert.equal(first.data.days.length,31);
  assert.equal(first.data.days[0].date,'2026-10-01');
  assert.deepEqual(first.data.days[0].times,{in:'09:00',breakOut:'12:00',breakIn:'13:00',out:''});
  assert.equal(first.data.days[0].workedMinutes,null);
  assert.equal(first.data.days[1].hasRecords,false);
  assert.match(first.data.days[0].version,/^[a-f0-9]{32}$/);
  assert.equal((await review()).data.days[0].version,first.data.days[0].version);
  assert.equal((await review(employeeId,'2024-02')).data.days.length,29);
});

test('corrige e completa horários mantendo as batidas originais e atualizando o fechamento',async()=>{
  const before=(await fixture.db.query('SELECT id,kind,occurred_at FROM leli_punches ORDER BY kind')).rows;
  const data=(await review()).data;
  const res=await save([payload(data,'2026-10-01',{in:'08:00',out:'17:00'})]);
  assert.equal(res.statusCode,200,JSON.stringify(res.data));
  assert.equal(res.data.changedTimes,2);
  assert.deepEqual((await fixture.db.query('SELECT id,kind,occurred_at FROM leli_punches ORDER BY kind')).rows,before);
  const rows=await savedRows();
  assert.equal(rows.length,2);
  assert(rows.every(row=>row.status==='approved'&&row.decided_by===adminId));
  assert.equal(new Set(rows.map(row=>row.request_group)).size,1);
  const updated=(await review()).data.days[0];
  assert.deepEqual(updated.times,{in:'08:00',breakOut:'12:00',breakIn:'13:00',out:'17:00'});
  assert.equal(updated.original.in,'09:00');
  assert.equal(updated.original.out,'');
  assert.equal(updated.workedMinutes,480);
  assert(updated.corrected.in&&updated.corrected.out);
  const report=await fixture.request('admin-monthly-report','GET',{},'admin',{month:'2026-10',employeeId});
  assert.equal(report.statusCode,200,JSON.stringify(report.data));
  assert.equal(report.data.rows[0].workedMinutes,480);
  assert.equal(report.data.employees[0].balanceNetMinutes,0);
});

test('salva vários dias no mesmo envio e conserva o valor anterior de uma correção',async()=>{
  await fixture.seedDay('2026-10-02');
  let data=(await review()).data;
  let res=await save([payload(data,'2026-10-01',{out:'17:00'}),payload(data,'2026-10-02',{out:'17:30'})]);
  assert.equal(res.statusCode,200,JSON.stringify(res.data));
  assert.equal(res.data.changedDays,2);
  data=(await review()).data;
  res=await save([payload(data,'2026-10-01',{out:'18:00'})]);
  assert.equal(res.statusCode,200,JSON.stringify(res.data));
  const rows=(await savedRows()).filter(row=>String(row.work_date).includes('2026-10-01')||new Date(row.work_date).toISOString().startsWith('2026-10-01'));
  assert.equal(rows.length,2);
  const newest=rows.find(row=>new Date(row.requested_at).getUTCHours()===21);
  assert.equal(new Date(newest.original_at).getUTCHours(),20);
  assert.equal((await review()).data.days[0].times.out,'18:00');
});

test('completa um dia sem nenhuma batida e o mantém visível no histórico e na folha',async()=>{
  const schedule=[{weekday:6,start_time:'08:00',break_start_time:'12:00',break_end_time:'13:00',end_time:'17:00'}];
  await fixture.db.query("INSERT INTO leli_schedule_versions(user_id,effective_from,schedule) VALUES($1,'2026-10-01',$2::jsonb)",[employeeId,JSON.stringify(schedule)]);
  const data=(await review()).data;
  const res=await save([payload(data,'2026-10-03',{in:'08:00',breakOut:'12:00',breakIn:'13:00',out:'17:00'})]);
  assert.equal(res.statusCode,200,JSON.stringify(res.data));
  assert.equal((await fixture.db.query("SELECT count(*)::int AS n FROM leli_punches WHERE work_date='2026-10-03'")).rows[0].n,0);
  const history=await fixture.request('history','GET',{},'employee',{month:'2026-10'});
  assert.equal(history.statusCode,200,JSON.stringify(history.data));
  assert.equal(history.data.punches.filter(p=>p.work_date==='2026-10-03').length,0);
  assert.equal(history.data.corrections.filter(c=>c.work_date==='2026-10-03'&&c.status==='approved').length,4);
  const report=await fixture.request('admin-monthly-report','GET',{},'admin',{month:'2026-10',employeeId});
  const day=report.data.rows.find(row=>row.date==='2026-10-03');
  assert.equal(day.status,'Completo');
  assert.equal(day.workedMinutes,480);
  assert.equal(day.balanceMinutes,0);
});

test('o fechamento usa a decisão mais recente mesmo com aprovações em dias diferentes',async()=>{
  await fixture.db.query("INSERT INTO leli_corrections(user_id,work_date,kind,requested_at,reason,status,decided_at,created_at) VALUES ($1,'2026-10-01','out','2026-10-01T19:00:00Z','Ajuste anterior','approved','2026-10-28T12:00:00Z','2026-10-28T12:00:00Z'), ($1,'2026-10-01','out','2026-10-01T20:00:00Z','Ajuste mais recente','approved','2026-10-29T12:00:00Z','2026-10-29T12:00:00Z')",[employeeId]);
  assert.equal((await review()).data.days[0].times.out,'17:00');
  const report=await fixture.request('admin-monthly-report','GET',{},'admin',{month:'2026-10',employeeId});
  assert.equal(report.statusCode,200,JSON.stringify(report.data));
  assert.equal(report.data.rows[0].punches[3],'17:00');
  assert.equal(report.data.rows[0].workedMinutes,420);
});

test('encerra pedidos pendentes apenas dos dias corrigidos, sem aceitar a proposta automaticamente',async()=>{
  await fixture.seedDay('2026-10-02');
  await addPending();await addPending('2026-10-02');
  const data=(await review()).data;
  assert.equal(data.days[0].pendingCorrections,1);
  const res=await save([payload(data,'2026-10-01',{out:'17:00'})]);
  assert.equal(res.statusCode,200,JSON.stringify(res.data));
  assert.equal(res.data.supersededPending,1);
  const rows=await savedRows();
  assert.equal(rows.filter(row=>row.status==='pending').length,1);
  assert.equal(rows.filter(row=>row.status==='rejected').length,1);
  assert.equal((await review()).data.days[0].times.out,'17:00');
  const audit=(await fixture.db.query("SELECT actor_user_id,details FROM leli_audit_log WHERE action='admin_monthly_time_correction'")).rows;
  assert.equal(audit.length,1);assert.equal(audit[0].actor_user_id,adminId);
  assert.equal(audit[0].details.supersededPending,1);
  assert.equal(audit[0].details.changes.length,1);
});

test('não grava parcialmente um mês quando algum dia está inválido ou desatualizado',async()=>{
  await fixture.seedDay('2026-10-02');
  const data=(await review()).data;
  const res=await save([payload(data,'2026-10-01',{out:'17:00'}),payload(data,'2026-10-02',{out:'11:00'})]);
  assert.equal(res.statusCode,400);
  assert.equal((await savedRows()).length,0);
  await addPending('2026-10-02');
  const stale=await save([payload(data,'2026-10-01',{out:'17:00'}),payload(data,'2026-10-02',{out:'17:00'})]);
  assert.equal(stale.statusCode,409);
  assert.equal((await savedRows()).filter(row=>row.status==='approved').length,0);
});

test('detecta alteração concorrente ocorrida depois da leitura e antes da gravação',async()=>{
  const data=(await review()).data;
  const original=fixture.db.transaction.bind(fixture.db);let transactions=0;
  fixture.db.transaction=async(...args)=>{
    if(++transactions===2){fixture.db.transaction=original;await addPending();}
    return original(...args);
  };
  const res=await save([payload(data,'2026-10-01',{out:'17:00'})]);
  fixture.db.transaction=original;
  assert.equal(res.statusCode,409,JSON.stringify(res.data));
  const rows=await savedRows();
  assert.equal(rows.length,1);assert.equal(rows[0].status,'pending');
  assert.equal((await fixture.db.query("SELECT count(*)::int AS n FROM leli_audit_log WHERE action='admin_monthly_time_correction'")).rows[0].n,0);
});

test('mantém jornadas incompletas quando apenas parte das batidas faltantes é preenchida',async()=>{
  const data=(await review()).data;
  const res=await save([payload(data,'2026-10-04',{in:'08:00',breakOut:'12:00'})]);
  assert.equal(res.statusCode,200,JSON.stringify(res.data));
  const day=(await review()).data.days[3];
  assert.equal(day.workedMinutes,null);
  assert.deepEqual(day.times,{in:'08:00',breakOut:'12:00',breakIn:'',out:''});
});

test('valida motivo, mês, datas, formato e preenchimento dos horários registrados',async()=>{
  const data=(await review()).data,day=payload(data,'2026-10-01',{out:'17:00'});
  for(const days of [[{...day,times:{...day.times,in:''}}],[{...day,times:{...day.times,out:'25:00'}}],[day,day],[{...day,date:'2026-09-30'}]]){
    assert.equal((await save(days)).statusCode,400);
  }
  assert.equal((await save([day],{reason:''})).statusCode,400);
  assert.equal((await save([])).statusCode,400);
  assert.equal((await save([payload(data,'2026-10-01',{})])).statusCode,400);
  assert.equal((await review(employeeId,'2027-01')).statusCode,400);
  const november=(await review(employeeId,'2026-11')).data;
  assert.equal((await save([payload(november,'2026-11-04',{in:'08:00'})],{month:'2026-11'})).statusCode,400);
  assert.equal((await save([payload(november,'2026-11-03',{in:'23:00'})],{month:'2026-11'})).statusCode,400);
  assert.equal((await savedRows()).length,0);
});

test('a revisão é exclusiva do ADM e não modifica horários de outro funcionário',async()=>{
  assert.equal((await review(employeeId,'2026-10','employee')).statusCode,403);
  assert.equal((await review(employeeId,'2026-10','anonymous')).statusCode,401);
  await fixture.seedDay('2026-10-01',otherEmployeeId);
  const data=(await review()).data;
  assert.equal((await fixture.request('admin-save-monthly-times','POST',{id:employeeId,month:'2026-10',reason:'Teste',days:[payload(data,'2026-10-01',{out:'17:00'})]},'employee')).statusCode,403);
  assert.equal((await save([payload(data,'2026-10-01',{out:'17:00'})])).statusCode,200);
  assert.equal((await fixture.db.query('SELECT count(*)::int AS n FROM leli_corrections WHERE user_id=$1',[otherEmployeeId])).rows[0].n,0);
});
