import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const source=await readFile(new URL('../leli-api.js',import.meta.url),'utf8');
const apiSource=source.replace(/^import .*;\r?\n/gm,'').replace('export default async function handler','async function handler');
const factory=new Function('neon','createHash','randomBytes','scryptSync','timingSafeEqual',apiSource+'\nreturn handler;');
const password='Test-password-2026';
const salt='01'.repeat(16);
const passwordHash=crypto.scryptSync(password,Buffer.from(salt,'hex'),64).toString('hex');
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');

function server(role='employee'){
  const sessions=new Map(),calls=[];
  const user={id:'test-user',name:'Teste',phone:'48999999999',role,active:true,password_salt:salt,password_hash:passwordHash};
  const sql=async(parts,...values)=>{
    const query=parts.join('?').replace(/\s+/g,' ').trim();calls.push({query,values});
    if(query.includes('SELECT count(*)::int AS count FROM leli_recipes'))return[{count:1}];
    if(query.startsWith('SELECT * FROM leli_users'))return[user];
    if(query.startsWith('INSERT INTO leli_sessions')){sessions.set(values[1],{id:'session',expires:Date.now()+values[2]*1000,remember_me:values[3]});return[];}
    if(query.includes('FROM leli_sessions s JOIN leli_users')){
      const session=sessions.get(values[0]);
      return session&&session.expires>Date.now()&&user.active?[{...user,remember_me:session.remember_me}]:[];
    }
    if(query.startsWith('UPDATE leli_sessions s')){
      const session=sessions.get(values[1]);
      if(!session||session.expires<=Date.now()||!user.active)return[];
      session.expires=Date.now()+values[0]*1000;return[{id:session.id}];
    }
    if(query.startsWith('DELETE FROM leli_sessions WHERE token_hash=')){sessions.delete(values[0]);return[];}
    return[];
  };
  const handler=factory(()=>sql,crypto.createHash,crypto.randomBytes,crypto.scryptSync,crypto.timingSafeEqual);
  async function request(action,method='GET',body={},cookie=''){
    const headers={},res={setHeader(k,v){headers[k]=v;},status(code){this.statusCode=code;return this;},json(data){this.data=data;return this;}};
    await handler({method,query:{action},body,headers:{cookie}},res);
    return{...res,headers};
  }
  return{user,sessions,calls,request};
}
const tokenFrom=result=>result.headers['Set-Cookie'].split(';')[0];

for(const role of ['employee','admin']){
  test(role+' can reopen using the remembered session and renew its expiry',async()=>{
    const app=server(role);
    const login=await app.request(role+'-login','POST',{identifier:'48999999999',password,rememberMe:true});
    assert.equal(login.statusCode,200);
    assert.match(login.headers['Set-Cookie'],/HttpOnly; Secure; SameSite=Lax; Max-Age=2592000/);
    const cookie=tokenFrom(login),token=decodeURIComponent(cookie.split('=')[1]);
    const session=app.sessions.get(digest(token));session.expires=Date.now()+60000;
    const reopened=await app.request('me','GET',{},cookie);
    assert.equal(reopened.statusCode,200);
    assert.equal(reopened.data.user.role,role);
    assert.ok(session.expires>Date.now()+29*24*60*60*1000);
    assert.equal(tokenFrom(reopened),cookie);
    assert.equal(reopened.data.user.remember_me,undefined);
    assert.equal(reopened.data.token,undefined);
  });
}

test('opting out uses a browser session cookie and does not renew it',async()=>{
  const app=server();
  const login=await app.request('employee-login','POST',{identifier:'48999999999',password,rememberMe:false});
  assert.equal(login.statusCode,200);
  assert.doesNotMatch(login.headers['Set-Cookie'],/Max-Age|Expires/);
  const session=[...app.sessions.values()][0],expires=session.expires;
  assert.ok(expires<=Date.now()+8*60*60*1000);
  const reopened=await app.request('me','GET',{},tokenFrom(login));
  assert.equal(reopened.statusCode,200);
  assert.equal(reopened.headers['Set-Cookie'],undefined);
  assert.equal(session.expires,expires);
});

test('expired, revoked and inactive sessions cannot renew or sign back in',async()=>{
  for(const state of ['expired','revoked','inactive']){
    const app=server();
    const login=await app.request('employee-login','POST',{identifier:'48999999999',password});
    if(state==='expired')[...app.sessions.values()][0].expires=Date.now()-1000;
    if(state==='revoked')app.sessions.clear();
    if(state==='inactive')app.user.active=false;
    const reopened=await app.request('me','GET',{},tokenFrom(login));
    assert.equal(reopened.statusCode,401,state);
    assert.equal(reopened.headers['Set-Cookie'],undefined,state);
    assert.equal(app.calls.some(call=>call.query.startsWith('UPDATE leli_sessions s')),false,state);
  }
});

test('signing out clears the cookie and revokes the remembered login',async()=>{
  const app=server();
  const login=await app.request('employee-login','POST',{identifier:'48999999999',password});
  const cookie=tokenFrom(login),logout=await app.request('logout','POST',{},cookie);
  assert.equal(logout.statusCode,200);
  assert.equal(app.sessions.size,0);
  assert.ok(logout.headers['Set-Cookie'].every(value=>value.includes('Max-Age=0')));
  assert.equal((await app.request('me','GET',{},cookie)).statusCode,401);
});

test('an invalid password never creates a remembered session',async()=>{
  const app=server();
  const result=await app.request('employee-login','POST',{identifier:'48999999999',password:'wrong',rememberMe:true});
  assert.equal(result.statusCode,401);
  assert.equal(app.sessions.size,0);
  assert.equal(result.headers['Set-Cookie'],undefined);
});

test('opening the other role area preserves the current saved login',async()=>{
  const employee=await readFile(new URL('../pao-da-leli-ponto/app-real.js',import.meta.url),'utf8');
  const admin=await readFile(new URL('../pao-da-leli-ponto/admin-real.js',import.meta.url),'utf8');
  let calls=0,screen;
  const context=vm.createContext({currentUser:null,api:async()=>{calls++;},show:value=>{screen=value;}});
  vm.runInContext(employee.slice(employee.indexOf('async function enterEmployeeApp'),employee.indexOf("$('#loginForm')")),context);
  assert.equal(await context.enterEmployeeApp({role:'admin'}),false);
  assert.equal(screen,'login');
  vm.runInContext(admin.slice(admin.indexOf('async function enterAdminDashboard'),admin.indexOf('async function endAdminSession')),context);
  await assert.rejects(context.enterAdminDashboard({role:'employee'}),/não é administrador/);
  assert.equal(calls,0);
});
