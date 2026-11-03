import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as crypto from 'node:crypto';
import { buildMonthlyReport, getMonthBounds, getReportCoverageBounds } from '../leli-report.js';

const six='00000000-0000-4000-8000-000000000006',eight='00000000-0000-4000-8000-000000000008';
const employees=[{id:six,name:'Pessoa 6h',unit:'Pão da Leli Café',daily_work_minutes:360},{id:eight,name:'Pessoa 8h',unit:'Pão da Leli Café',daily_work_minutes:480}];
const date='2026-10-05';
const punches=employees.flatMap(employee=>['08:00','12:00','13:00','15:30'].map((time,index)=>({user_id:employee.id,work_date:date,kind:['in','breakOut','breakIn','out'][index],occurred_at:date+'T'+time+':00-03:00'})));
const base={month:'2026-10',employees,punches,corrections:[],scheduleVersions:[],now:new Date('2026-11-03T12:00:00-03:00')};
const apiSource=fs.readFileSync(new URL('../leli-api.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export default async function handler','async function handler');
const factory=new Function('neon','createHash','randomBytes','scryptSync','timingSafeEqual','buildMonthlyReport','getMonthBounds','getReportCoverageBounds','defaultRecipes',apiSource+'\nreturn handler;');

function harness(role='admin'){
  const employee={...employees[0],daily_work_minutes:480,active:true},calls=[];
  const sql=async(parts,...values)=>{
    const query=parts.join('?').replace(/\s+/g,' ').trim();calls.push({query,values});
    if(query.includes('SELECT count(*)::int AS count FROM leli_recipes'))return[{count:1}];
    if(query.includes('FROM leli_sessions s JOIN leli_users'))return[{id:'admin',role,active:true}];
    if(query.startsWith('UPDATE leli_users SET daily_work_minutes=')){
      if(values[1]!==six)return[];
      employee.daily_work_minutes=values[0];return[{...employee}];
    }
    if(query.startsWith('INSERT INTO leli_users('))return[{id:six,name:values[2],role:values[3],daily_work_minutes:values.at(-1)}];
    if(query.startsWith('SELECT id,email,phone,name,position,unit,active'))return[{...employee}];
    if(query.startsWith('SELECT id,name,email,phone,unit,active'))return[{...employee}];
    if(query.includes('FROM leli_punches p JOIN leli_users'))return punches.filter(p=>p.user_id===six);
    return[];
  };
  const handler=factory(()=>sql,crypto.createHash,crypto.randomBytes,crypto.scryptSync,crypto.timingSafeEqual,buildMonthlyReport,getMonthBounds,getReportCoverageBounds,[]);
  const request=async(action,body={},method='POST',query={})=>{
    const res={setHeader(){},status(code){this.statusCode=code;return this;},json(data){this.data=data;return this;}};
    await handler({method,body,query:{action,...query},headers:{cookie:'leli_session=test-session'}},res);
    return res;
  };
  return{employee,calls,request};
}

test('a mesma jornada de 6h30 gera +30min para 6h e −1h30 para 8h',()=>{
  const report=buildMonthlyReport(base);
  assert.equal(report.employees[0].dailyWorkMinutes,360);
  assert.equal(report.employees[0].balanceNetMinutes,30);
  assert.equal(report.employees[0].overtimeMinutes,30);
  assert.equal(report.employees[1].dailyWorkMinutes,480);
  assert.equal(report.employees[1].balanceNetMinutes,-90);
  assert.equal(report.employees[1].overtimeMinutes,0);
});

test('a ficha individual prevalece sobre a referência global e escalas antigas',()=>{
  const report=buildMonthlyReport({...base,dailyLimitMinutes:600,scheduleVersions:[{user_id:six,effective_from:'2026-10-01',schedule:[{weekday:1,start_time:'08:00',break_start_time:'12:00',break_end_time:'13:00',end_time:'17:00'}]}]});
  const row=report.rows.find(row=>row.userId===six&&row.date===date);
  assert.equal(row.expectedMinutes,360);
  assert.equal(row.balanceMinutes,30);
  assert.equal(row.overtimeMinutes,30);
  assert.equal(row.balanceReference,'employee');
});

test('salvar 6h persiste na ficha e é usado no próximo fechamento do servidor',async()=>{
  const {request,employee,calls}=harness();
  const saved=await request('admin-save-daily-hours',{id:six,dailyHours:6});
  assert.equal(saved.statusCode,200);
  assert.equal(employee.daily_work_minutes,360);
  assert(calls.some(c=>c.query.startsWith('INSERT INTO leli_audit_log')&&c.values[1]==='save_daily_hours'));
  const detail=await request('admin-employee-detail',{},'GET',{id:six});
  assert.equal(detail.data.employee.daily_work_minutes,360);
  const monthly=await request('admin-monthly-report',{},'GET',{month:'2026-10',employeeId:six});
  assert.equal(monthly.statusCode,200);
  assert.equal(monthly.data.employees[0].dailyWorkMinutes,360);
  assert.equal(monthly.data.employees[0].balanceNetMinutes,30);
});

test('somente administradores podem alterar a jornada',async()=>{
  const {request,calls}=harness('employee');
  const res=await request('admin-save-daily-hours',{id:six,dailyHours:6});
  assert.equal(res.statusCode,403);
  assert(!calls.some(c=>c.query.startsWith('UPDATE leli_users SET daily_work_minutes=')));
});

test('jornadas inválidas e funcionários inexistentes não alteram registros',async()=>{
  for(const dailyHours of [undefined,null,'',0,13,6.1,'abc',true,[]]){
    const {request,employee,calls}=harness();
    const res=await request('admin-save-daily-hours',{id:six,dailyHours});
    assert.equal(res.statusCode,400,String(dailyHours));
    assert.equal(employee.daily_work_minutes,480);
    assert(!calls.some(c=>c.query.startsWith('UPDATE leli_users SET daily_work_minutes=')));
  }
  const {request}=harness();
  assert.equal((await request('admin-save-daily-hours',{id:eight,dailyHours:6})).statusCode,404);
});

test('novos cadastros usam 8h por padrão ou a jornada informada',async()=>{
  for(const [dailyHours,expected]of[[undefined,480],[6,360],[6.25,375]]){
    const {request}=harness();
    const res=await request('admin-create-user',{name:'Nova pessoa',phone:'48999990000',unit:'Pão da Leli Café',role:'employee',...(dailyHours===undefined?{}:{dailyHours})});
    assert.equal(res.statusCode,201);
    assert.equal(res.data.user.daily_work_minutes,expected);
  }
});

test('PDF identifica a jornada de 6h e a de 8h em páginas separadas',()=>{
  const source=fs.readFileSync(new URL('../pao-da-leli-ponto/admin-real.js',import.meta.url),'utf8');
  const context=vm.createContext({Intl,Date,esc:value=>String(value??''),dateTime:()=> '03/11/2026'});
  vm.runInContext(source.slice(source.indexOf('function monthLabel('),source.indexOf('function historyBadge(')),context);
  const html=context.buildMonthlyPrintHtml(buildMonthlyReport(base));
  const pages=[...html.matchAll(/<section class="employee-sheet"[\s\S]*?<\/section>/g)].map(m=>m[0]);
  assert.match(pages[0],/Jornada diária cadastrada: 6h00/);
  assert.match(pages[0],/\+0h30/);
  assert.match(pages[1],/Jornada diária cadastrada: 8h00/);
  assert.match(pages[1],/−1h30/);
});
