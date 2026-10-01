import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import { buildMonthlyReport, getMonthBounds } from '../leli-report.js';

const apiSource=(await readFile(new URL('../leli-api.js',import.meta.url),'utf8'))
  .replace(/^import .*;\r?\n/gm,'').replace('export default async function handler','async function handler');
const factory=new Function('neon','createHash','randomBytes','scryptSync','timingSafeEqual','buildMonthlyReport','getMonthBounds','defaultRecipes',apiSource+'\nreturn {handler,applyApprovedPunchCorrections};');
const adminSource=await readFile(new URL('../pao-da-leli-ponto/admin-real.js',import.meta.url),'utf8');
const context=vm.createContext({Intl,Date,URLSearchParams,window:{}});
vm.runInContext(adminSource.slice(0,adminSource.indexOf('\nwindow.openEmployee=')),context);
const render=context.renderTodaySummary;
const date='2026-10-01';
const punch={user_id:'jackson',work_date:date,kind:'out',occurred_at:date+'T16:08:00Z'};
const correction={id:'correction',user_id:'jackson',work_date:date,kind:'out',status:'approved',requested_at:date+'T20:30:00Z',created_at:date+'T19:00:00Z',decided_at:date+'T19:10:00Z'};
const create=(sql=async()=>[])=>factory(()=>sql,crypto.createHash,crypto.randomBytes,crypto.scryptSync,crypto.timingSafeEqual,buildMonthlyReport,getMonthBounds,[]);

test('the summary shows an approved exit while preserving the original punch',()=>{
  const {applyApprovedPunchCorrections}=create();
  const [updated]=applyApprovedPunchCorrections([punch],[correction]);
  assert.equal(updated.occurred_at,punch.occurred_at);
  assert.equal(updated.effective_at,correction.requested_at);
  assert.equal(updated.corrected,true);
  const html=render([{id:'jackson',name:'Jackson'}],[updated]);
  assert.match(html,/Saída 17:30/);
  assert.doesNotMatch(html,/Saída 13:08/);
  assert.match(html,/jornada encerrada/);
});

test('the latest approval wins even when an older request was reapproved later',()=>{
  const {applyApprovedPunchCorrections}=create();
  const laterApproval={...correction,id:'older-request',created_at:date+'T17:00:00Z',decided_at:date+'T19:20:00Z',requested_at:date+'T21:00:00Z'};
  for(const rows of [[correction,laterApproval],[laterApproval,correction]]){
    assert.equal(applyApprovedPunchCorrections([punch],rows)[0].effective_at,laterApproval.requested_at);
  }
});

test('pending or refused requests and corrections for another person, date or kind do not affect the exit',()=>{
  const {applyApprovedPunchCorrections}=create();
  const rows=[
    {...correction,status:'pending'}, {...correction,status:'rejected'},
    {...correction,user_id:'another-person'}, {...correction,work_date:'2026-09-30'}, {...correction,kind:'breakIn'},
  ];
  const [unchanged]=applyApprovedPunchCorrections([punch],rows);
  assert.equal(unchanged.effective_at,punch.occurred_at);
  assert.equal(unchanged.corrected,false);
  assert.match(render([{id:'jackson',name:'Jackson'}],[unchanged]),/Saída 13:08/);
});

test('all four summary times use the effective value with a fallback for uncorrected punches',()=>{
  const rows=['in','breakOut','breakIn','out'].map((kind,index)=>({user_id:'jackson',kind,occurred_at:date+'T16:08:00Z',effective_at:date+'T'+['09:19','15:12','16:08','20:30'][index]+':00Z'}));
  const html=render([{id:'jackson',name:'Jackson'}],rows);
  assert.match(html,/Entrada 06:19 · Intervalo 12:12 \/ 13:08 · Saída 17:30/);
  assert.match(render([{id:'jackson',name:'Jackson'}],[punch]),/Saída 13:08/);
  assert.match(render([{id:'none',name:'Sem batidas'}],[]),/Entrada — · Intervalo — \/ — · Saída —/);
});

test('admin overview uses the complete approved set instead of the 100-row correction list',async()=>{
  const calls=[];
  const sql=async(parts,...values)=>{
    const query=parts.join('?').replace(/\s+/g,' ').trim(); calls.push({query,values});
    if(query.includes('SELECT count(*)::int AS count FROM leli_recipes'))return[{count:1}];
    if(query.includes('FROM leli_sessions s JOIN leli_users'))return[{id:'admin',role:'admin',active:true}];
    if(query.startsWith('SELECT id,email,phone,name,role'))return[{id:'jackson',name:'Jackson',role:'employee',active:true}];
    if(query.includes('FROM leli_punches p JOIN leli_users'))return[punch];
    if(query.includes("FROM leli_corrections WHERE work_date=")&&query.includes("status='approved'")){
      assert.equal(values.length,1);
      assert.doesNotMatch(query,/LIMIT 100/);
      return[correction];
    }
    if(query.includes('FROM leli_corrections c JOIN leli_users'))return Array.from({length:100},(_,i)=>({...correction,id:'recent-'+i,user_id:'another',status:'pending'}));
    if(query.includes('FROM leli_access_policy'))return[{mode:'free'}];
    return[];
  };
  const {handler}=create(sql);
  const res={setHeader(){},status(code){this.statusCode=code;return this;},json(data){this.data=data;return this;}};
  await handler({method:'GET',query:{action:'admin-overview'},headers:{cookie:'leli_session=test-session'}},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.data.corrections.length,100);
  assert.equal(res.data.punches[0].effective_at,correction.requested_at);
  assert.equal(res.data.punches[0].occurred_at,punch.occurred_at);
  assert.match(render(res.data.users,res.data.punches),/Saída 17:30/);
});
