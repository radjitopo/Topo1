import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const SESSION_COOKIE = 'leli_session';
const BOOTSTRAP_HASH = '01258930c8e560ff164c8b6d29170d573a61327f4df7ec5facc15e39b443e75e';
const TZ = 'America/Sao_Paulo';
const EMPLOYEE_UNITS = new Set(['Pão da Leli Café','Pão da Leli Produção']);

function json(res,status,body){res.setHeader('Cache-Control','no-store');return res.status(status).json(body)}
function body(req){if(typeof req.body==='string'){try{return JSON.parse(req.body||'{}')}catch{return{}}}return req.body||{}}
function cookie(req,name){const raw=String(req.headers.cookie||'');for(const p of raw.split(';')){const [k,...v]=p.trim().split('=');if(k===name)return decodeURIComponent(v.join('='))}return''}
function sha(v){return createHash('sha256').update(String(v)).digest('hex')}
function normEmail(v){return String(v||'').trim().toLowerCase()}
function hashPassword(password,saltHex){return scryptSync(String(password),Buffer.from(saltHex,'hex'),64).toString('hex')}
function safeEqualHex(a,b){try{const A=Buffer.from(a,'hex'),B=Buffer.from(b,'hex');return A.length===B.length&&timingSafeEqual(A,B)}catch{return false}}
function newPasswordHash(password){const salt=randomBytes(16).toString('hex');return{salt,hash:hashPassword(password,salt)}}
function activationCode(){return randomBytes(7).toString('base64url')}
function setSessionCookie(res,token){res.setHeader('Set-Cookie',`${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`)}
function clearSessionCookie(res){res.setHeader('Set-Cookie',[`${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,`${SESSION_COOKIE}=; Path=/pao-da-leli-ponto; HttpOnly; Secure; SameSite=Lax; Max-Age=0`])}
function validPassword(p){return typeof p==='string'&&p.length>=8&&p.length<=100}
function localDate(){return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}

async function ensureSchema(){
  await sql`CREATE TABLE IF NOT EXISTS leli_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text UNIQUE NOT NULL,
    name text NOT NULL,
    role text NOT NULL CHECK (role IN ('employee','admin')),
    position text NOT NULL DEFAULT 'Colaborador',
    unit text NOT NULL DEFAULT 'Pão da Leli',
    active boolean NOT NULL DEFAULT true,
    password_salt text,
    password_hash text,
    must_change_password boolean NOT NULL DEFAULT false,
    activation_hash text,
    activation_code text,
    activation_expires_at timestamptz,
    failed_login_count integer NOT NULL DEFAULT 0,
    locked_until timestamptz,
    photo_data text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS leli_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES leli_users(id) ON DELETE CASCADE,
    token_hash text UNIQUE NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS leli_punches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES leli_users(id),
    kind text NOT NULL CHECK (kind IN ('in','breakOut','breakIn','out')),
    occurred_at timestamptz NOT NULL DEFAULT now(),
    work_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date),
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(user_id, work_date, kind)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS leli_corrections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES leli_users(id),
    punch_id uuid REFERENCES leli_punches(id),
    work_date date NOT NULL,
    kind text NOT NULL CHECK (kind IN ('in','breakOut','breakIn','out')),
    original_at timestamptz,
    requested_at timestamptz NOT NULL,
    reason text NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    decided_by uuid REFERENCES leli_users(id),
    decided_at timestamptz,
    decision_note text,
    request_group uuid,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS leli_audit_log (
    id bigserial PRIMARY KEY,
    actor_user_id uuid REFERENCES leli_users(id),
    action text NOT NULL,
    target_type text,
    target_id text,
    details jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS leli_schedules (
    user_id uuid NOT NULL REFERENCES leli_users(id) ON DELETE CASCADE,
    weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    start_time time NOT NULL,
    break_start_time time NOT NULL,
    break_end_time time NOT NULL,
    end_time time NOT NULL,
    updated_by uuid REFERENCES leli_users(id),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, weekday)
  )`;
  await sql`ALTER TABLE leli_users ADD COLUMN IF NOT EXISTS activation_code text`;
  await sql`UPDATE leli_users SET position='Colaborador',updated_at=now() WHERE role='employee' AND position IN ('Funcionária','Funcionário')`;
  const missingCodes = await sql`SELECT id FROM leli_users WHERE activation_hash IS NOT NULL AND activation_code IS NULL`;
  for (const row of missingCodes) {
    const code = activationCode();
    await sql`UPDATE leli_users SET activation_code=${code}, activation_hash=${sha(code)}, activation_expires_at=NULL, updated_at=now() WHERE id=${row.id}`;
  }
  await sql`CREATE INDEX IF NOT EXISTS leli_punches_user_date_idx ON leli_punches(user_id, work_date)`;
  await sql`ALTER TABLE leli_corrections ADD COLUMN IF NOT EXISTS request_group uuid`;
  await sql`CREATE INDEX IF NOT EXISTS leli_corrections_status_idx ON leli_corrections(status, created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS leli_corrections_group_idx ON leli_corrections(request_group)`;
  await sql`CREATE INDEX IF NOT EXISTS leli_sessions_token_idx ON leli_sessions(token_hash)`;
}

async function sessionUser(req){
  const tok=cookie(req,SESSION_COOKIE);if(!tok)return null;
  const rows=await sql`SELECT u.id,u.email,u.name,u.role,u.position,u.unit,u.active,u.must_change_password,u.photo_data
    FROM leli_sessions s JOIN leli_users u ON u.id=s.user_id
    WHERE s.token_hash=${sha(tok)} AND s.expires_at>now() AND u.active=true LIMIT 1`;
  return rows[0]||null;
}
async function audit(actor,action,targetType=null,targetId=null,details=null){
  await sql`INSERT INTO leli_audit_log(actor_user_id,action,target_type,target_id,details)
    VALUES(${actor||null},${action},${targetType},${targetId},${details?JSON.stringify(details):null}::jsonb)`;
}
async function effectivePunches(userId,date){
  const punches=await sql`SELECT id,kind,occurred_at FROM leli_punches WHERE user_id=${userId} AND work_date=${date} ORDER BY occurred_at`;
  const corr=await sql`SELECT kind,requested_at,status FROM leli_corrections
    WHERE user_id=${userId} AND work_date=${date} AND status='approved' ORDER BY decided_at DESC`;
  const latest={};for(const c of corr){if(!latest[c.kind])latest[c.kind]=c.requested_at}
  return punches.map(p=>({...p,effective_at:latest[p.kind]||p.occurred_at,corrected:Boolean(latest[p.kind])}));
}
function stateFrom(punches){
  const kinds=new Set(punches.map(p=>p.kind));
  if(kinds.has('out'))return'out'; if(kinds.has('breakIn'))return'afterbreak'; if(kinds.has('breakOut'))return'break'; if(kinds.has('in'))return'working'; return'idle';
}
function expectedKind(state){return state==='idle'?'in':state==='working'?'breakOut':state==='break'?'breakIn':state==='afterbreak'?'out':null}

export default async function handler(req,res){
  try{
    await ensureSchema();
    const action=String(req.query?.action||'').trim();

    if(req.method==='GET'&&action==='health'){
      const a=await sql`SELECT count(*)::int AS n FROM leli_users WHERE role='admin'`;
      const s=await sql`SELECT count(*)::int AS users, count(*) FILTER (WHERE password_hash IS NOT NULL)::int AS password_users, count(*) FILTER (WHERE activation_hash IS NOT NULL)::int AS pending_activation, count(*) FILTER (WHERE locked_until IS NOT NULL AND locked_until>now())::int AS locked_users FROM leli_users`;
      return json(res,200,{ok:true,hasAdmin:a[0].n>0,authStats:s[0]});
    }

    if(req.method==='POST'&&action==='bootstrap'){
      const b=body(req),token=String(b.token||''),email=normEmail(b.email),name=String(b.name||'').trim(),password=String(b.password||'');
      const cnt=await sql`SELECT count(*)::int AS n FROM leli_users WHERE role='admin'`;
      if(cnt[0].n>0)return json(res,409,{error:'O administrador inicial já foi criado.'});
      if(sha(token)!==BOOTSTRAP_HASH)return json(res,403,{error:'Código de configuração inválido.'});
      if(!email||!name||!validPassword(password))return json(res,400,{error:'Informe nome, e-mail e uma senha de pelo menos 8 caracteres.'});
      const ph=newPasswordHash(password);
      const rows=await sql`INSERT INTO leli_users(email,name,role,position,password_salt,password_hash,must_change_password)
        VALUES(${email},${name},'admin','Administrador',${ph.salt},${ph.hash},false)
        RETURNING id,email,name,role`;
      await audit(rows[0].id,'bootstrap_admin','user',rows[0].id,{email});
      return json(res,201,{ok:true});
    }

    if(req.method==='POST'&&action==='login'){
      const b=body(req),email=normEmail(b.email),password=String(b.password||'');
      const rows=await sql`SELECT * FROM leli_users WHERE email=${email} LIMIT 1`;const u=rows[0];
      if(!u||!u.active)return json(res,401,{error:'E-mail ou senha inválidos.'});
      if(u.activation_hash&&!u.password_hash)return json(res,428,{error:'Conta ainda não ativada.',needsActivation:true});
      if(u.locked_until&&new Date(u.locked_until)>new Date())return json(res,429,{error:'Muitas tentativas. Tente novamente mais tarde.'});
      const ok=u.password_salt&&u.password_hash&&safeEqualHex(hashPassword(password,u.password_salt),u.password_hash);
      if(!ok){
        const next=(u.failed_login_count||0)+1;
        await sql`UPDATE leli_users SET failed_login_count=${next}, locked_until=CASE WHEN ${next}>=5 THEN now()+interval '15 minutes' ELSE locked_until END WHERE id=${u.id}`;
        return json(res,401,{error:'E-mail ou senha inválidos.'});
      }
      await sql`UPDATE leli_users SET failed_login_count=0,locked_until=NULL WHERE id=${u.id}`;
      const tok=randomBytes(32).toString('base64url');
      await sql`INSERT INTO leli_sessions(user_id,token_hash,expires_at) VALUES(${u.id},${sha(tok)},now()+interval '30 days')`;
      setSessionCookie(res,tok);await audit(u.id,'login','user',u.id);
      return json(res,200,{ok:true,user:{id:u.id,email:u.email,name:u.name,role:u.role,position:u.position,unit:u.unit,mustChangePassword:u.must_change_password,photo_data:u.photo_data}});
    }

    if(req.method==='POST'&&action==='activate'){
      const b=body(req),email=normEmail(b.email),code=String(b.code||'').trim(),password=String(b.password||'');
      if(!validPassword(password))return json(res,400,{error:'A senha precisa ter pelo menos 8 caracteres.'});
      const rows=await sql`SELECT * FROM leli_users WHERE email=${email} AND active=true LIMIT 1`;const u=rows[0];
      if(!u||!u.activation_hash||!safeEqualHex(sha(code),u.activation_hash)||(u.activation_expires_at&&new Date(u.activation_expires_at)<new Date()))return json(res,400,{error:'Código de ativação inválido.'});
      const ph=newPasswordHash(password);
      await sql`UPDATE leli_users SET password_salt=${ph.salt},password_hash=${ph.hash},activation_hash=NULL,activation_code=NULL,activation_expires_at=NULL,must_change_password=false,updated_at=now() WHERE id=${u.id}`;
      await audit(u.id,'activate_account','user',u.id);return json(res,200,{ok:true});
    }

    if(req.method==='POST'&&action==='logout'){
      const tok=cookie(req,SESSION_COOKIE);if(tok)await sql`DELETE FROM leli_sessions WHERE token_hash=${sha(tok)}`;clearSessionCookie(res);return json(res,200,{ok:true});
    }

    const user=await sessionUser(req);
    if(!user)return json(res,401,{error:'Faça login novamente.'});

    if(req.method==='GET'&&action==='me')return json(res,200,{user});
    if(req.method==='POST'&&action==='change-password'){
      const b=body(req),current=String(b.current||''),next=String(b.next||'');if(!validPassword(next))return json(res,400,{error:'A nova senha precisa ter pelo menos 8 caracteres.'});
      const rows=await sql`SELECT password_salt,password_hash FROM leli_users WHERE id=${user.id}`;const u=rows[0];
      if(!u?.password_salt||!safeEqualHex(hashPassword(current,u.password_salt),u.password_hash))return json(res,400,{error:'Senha atual incorreta.'});
      const ph=newPasswordHash(next);await sql`UPDATE leli_users SET password_salt=${ph.salt},password_hash=${ph.hash},must_change_password=false,updated_at=now() WHERE id=${user.id}`;
      await audit(user.id,'change_password','user',user.id);return json(res,200,{ok:true});
    }
    const employeeActions=['photo','today','history','punch','correction-batch','correction'];
    if(employeeActions.includes(action)&&user.role!=='employee')return json(res,403,{error:'Esta área é exclusiva para colaboradores.'});
    if(req.method==='POST'&&action==='photo'){
      const b=body(req),photo=String(b.photo||'');if(photo.length>220000||!photo.startsWith('data:image/'))return json(res,400,{error:'Foto inválida ou muito grande.'});
      await sql`UPDATE leli_users SET photo_data=${photo},updated_at=now() WHERE id=${user.id}`;return json(res,200,{ok:true});
    }
    if(req.method==='GET'&&action==='today'){
      const date=localDate(),punches=await effectivePunches(user.id,date);
      const pending=await sql`SELECT id,kind,status,reason,requested_at,created_at FROM leli_corrections WHERE user_id=${user.id} AND work_date=${date} ORDER BY created_at DESC`;
      return json(res,200,{date,state:stateFrom(punches),punches,corrections:pending});
    }
    if(req.method==='GET'&&action==='history'){
      const rows=await sql`SELECT work_date::text AS work_date,kind,occurred_at FROM leli_punches WHERE user_id=${user.id} ORDER BY work_date DESC,occurred_at ASC LIMIT 240`;
      const corr=await sql`SELECT work_date::text AS work_date,kind,status,requested_at,decided_at FROM leli_corrections WHERE user_id=${user.id} ORDER BY created_at DESC LIMIT 120`;
      return json(res,200,{punches:rows,corrections:corr});
    }
    if(req.method==='POST'&&action==='punch'){
      const date=localDate(),current=await effectivePunches(user.id,date),state=stateFrom(current),kind=expectedKind(state);
      if(!kind)return json(res,409,{error:'A jornada de hoje já foi encerrada.'});
      try{
        const rows=await sql`INSERT INTO leli_punches(user_id,kind,work_date,user_agent) VALUES(${user.id},${kind},${date},${String(req.headers['user-agent']||'').slice(0,300)}) RETURNING id,kind,occurred_at,work_date`;
        await audit(user.id,'punch','punch',rows[0].id,{kind,date});return json(res,201,{punch:rows[0],state:stateFrom([...current,rows[0]])});
      }catch(e){if(String(e?.message||'').includes('unique'))return json(res,409,{error:'Essa batida já foi registrada.'});throw e}
    }
    if(req.method==='POST'&&action==='correction-batch'){
      const b=body(req),date=String(b.date||localDate()),reason=String(b.reason||'').trim(),times=b.times||{};
      const kinds=['in','breakOut','breakIn','out'];
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||reason.length<3)return json(res,400,{error:'Explique rapidamente o motivo da correção.'});
      for(const kind of kinds){if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(times[kind]||'')))return json(res,400,{error:'Preencha os quatro horários.'})}
      const minutes=kinds.map(kind=>{const value=String(times[kind]);return Number(value.slice(0,2))*60+Number(value.slice(3))});
      if(minutes.some((value,index)=>index>0&&value<minutes[index-1]))return json(res,400,{error:'Confira os horários: o intervalo não pode ser antes da chegada, a volta não pode ser antes do intervalo e a saída não pode ser antes da volta.'});
      const punches=await sql`SELECT id,kind,occurred_at FROM leli_punches WHERE user_id=${user.id} AND work_date=${date}`;
      const byKind=Object.fromEntries(punches.map(p=>[p.kind,p]));
      for(const kind of kinds){if(!byKind[kind])return json(res,400,{error:'A jornada precisa ter as quatro batidas antes de solicitar a correção.'})}
      const open=await sql`SELECT 1 FROM leli_corrections WHERE user_id=${user.id} AND work_date=${date} AND status='pending' LIMIT 1`;
      if(open[0])return json(res,409,{error:'Já existe uma correção pendente para esta jornada.'});
      const payload=kinds.map(kind=>({kind,requested_time:String(times[kind])}));
      const inserted=await sql`WITH group_id AS (SELECT gen_random_uuid() AS id), requested AS (
          SELECT x.kind,x.requested_time FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) AS x(kind text,requested_time text)
        ), saved AS (
          INSERT INTO leli_corrections(user_id,punch_id,work_date,kind,original_at,requested_at,reason,request_group)
          SELECT ${user.id},p.id,${date}::date,p.kind,p.occurred_at,((${date}::date+r.requested_time::time) AT TIME ZONE ${TZ}),${reason},g.id
          FROM requested r JOIN leli_punches p ON p.user_id=${user.id} AND p.work_date=${date} AND p.kind=r.kind CROSS JOIN group_id g
          RETURNING request_group
        ) SELECT request_group,count(*)::int AS count FROM saved GROUP BY request_group`;
      if(inserted[0]?.count!==4)throw new Error('Não foi possível registrar a jornada completa.');
      const groupId=inserted[0].request_group;
      await audit(user.id,'request_correction_group','correction_group',groupId,{date});
      return json(res,201,{ok:true,groupId});
    }

    if(req.method==='POST'&&action==='correction'){
      const b=body(req),kind=String(b.kind||''),requestedTime=String(b.requestedTime||''),reason=String(b.reason||'').trim(),date=String(b.date||localDate());
      if(!['in','breakOut','breakIn','out'].includes(kind)||!/^[0-2]\d:[0-5]\d$/.test(requestedTime)||reason.length<3)return json(res,400,{error:'Revise o horário e informe o motivo.'});
      const punches=await sql`SELECT id,occurred_at FROM leli_punches WHERE user_id=${user.id} AND work_date=${date} AND kind=${kind} LIMIT 1`;const p=punches[0];
      if(!p)return json(res,400,{error:'Não existe uma batida original para esse horário.'});
      const requested=await sql`SELECT ((${date}::date + ${requestedTime}::time) AT TIME ZONE 'America/Sao_Paulo') AS ts`;
      const rows=await sql`INSERT INTO leli_corrections(user_id,punch_id,work_date,kind,original_at,requested_at,reason)
        VALUES(${user.id},${p.id},${date},${kind},${p.occurred_at},${requested[0].ts},${reason}) RETURNING id`;
      await audit(user.id,'request_correction','correction',rows[0].id,{kind,date,requestedTime});return json(res,201,{ok:true});
    }

    if(user.role!=='admin')return json(res,403,{error:'Acesso restrito aos administradores.'});

    if(req.method==='GET'&&action==='admin-overview'){
      const date=localDate();
      const users=await sql`SELECT id,email,name,role,position,unit,active,activation_hash IS NOT NULL AS pending_activation,activation_code,created_at FROM leli_users ORDER BY role DESC,name ASC`;
      const punches=await sql`SELECT p.user_id,p.kind,p.occurred_at,p.work_date::text,u.name,u.email FROM leli_punches p JOIN leli_users u ON u.id=p.user_id WHERE p.work_date=${date} ORDER BY p.occurred_at`;
      const corrections=await sql`SELECT c.id,c.user_id,c.kind,c.work_date::text,c.original_at,c.requested_at,c.reason,c.status,c.request_group,c.created_at,c.decided_at,c.decision_note,u.name,u.email,d.name AS decided_by_name
        FROM leli_corrections c JOIN leli_users u ON u.id=c.user_id LEFT JOIN leli_users d ON d.id=c.decided_by ORDER BY c.created_at DESC LIMIT 100`;
      return json(res,200,{date,users,punches,corrections});
    }
    if(req.method==='GET'&&action==='admin-employee-detail'){
      const id=String(req.query?.id||'');
      if(!/^[0-9a-f-]{36}$/i.test(id))return json(res,400,{error:'Colaborador inválido.'});
      const employees=await sql`SELECT id,email,name,position,unit,active,activation_hash IS NOT NULL AS pending_activation,created_at
        FROM leli_users WHERE id=${id} AND role='employee' LIMIT 1`;
      if(!employees[0])return json(res,404,{error:'Colaborador não encontrado.'});
      const schedule=await sql`SELECT weekday,
          to_char(start_time,'HH24:MI') AS start_time,
          to_char(break_start_time,'HH24:MI') AS break_start_time,
          to_char(break_end_time,'HH24:MI') AS break_end_time,
          to_char(end_time,'HH24:MI') AS end_time,
          updated_at
        FROM leli_schedules WHERE user_id=${id} ORDER BY weekday`;
      const punches=await sql`SELECT work_date::text AS work_date,kind,occurred_at
        FROM leli_punches WHERE user_id=${id} ORDER BY work_date DESC,occurred_at ASC`;
      const corrections=await sql`SELECT id,work_date::text AS work_date,kind,status,requested_at,decided_at,request_group
        FROM leli_corrections WHERE user_id=${id} ORDER BY created_at DESC`;
      return json(res,200,{employee:employees[0],schedule,punches,corrections});
    }
    if(req.method==='POST'&&action==='admin-save-schedule'){
      const b=body(req),id=String(b.id||''),days=Array.isArray(b.days)?b.days:[];
      if(!/^[0-9a-f-]{36}$/i.test(id)||days.length>7)return json(res,400,{error:'Escala inválida.'});
      const employees=await sql`SELECT id FROM leli_users WHERE id=${id} AND role='employee' LIMIT 1`;
      if(!employees[0])return json(res,404,{error:'Colaborador não encontrado.'});
      const seen=new Set(),normalized=[];
      for(const day of days){
        const weekday=Number(day.weekday),times=['startTime','breakStartTime','breakEndTime','endTime'].map(key=>String(day[key]||''));
        if(!Number.isInteger(weekday)||weekday<0||weekday>6||seen.has(weekday)||times.some(value=>!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)))return json(res,400,{error:'Revise os dias e horários da escala.'});
        const minutes=times.map(value=>Number(value.slice(0,2))*60+Number(value.slice(3)));
        if(minutes.some((value,index)=>index>0&&value<=minutes[index-1]))return json(res,400,{error:'Em cada dia, os horários devem seguir a ordem: entrada, intervalo, volta e saída.'});
        seen.add(weekday);normalized.push({weekday,start_time:times[0],break_start_time:times[1],break_end_time:times[2],end_time:times[3]});
      }
      await sql`WITH removed AS (
          DELETE FROM leli_schedules WHERE user_id=${id}
        ), schedule_rows AS (
          SELECT * FROM jsonb_to_recordset(${JSON.stringify(normalized)}::jsonb)
          AS x(weekday integer,start_time text,break_start_time text,break_end_time text,end_time text)
        )
        INSERT INTO leli_schedules(user_id,weekday,start_time,break_start_time,break_end_time,end_time,updated_by)
        SELECT ${id},weekday,start_time::time,break_start_time::time,break_end_time::time,end_time::time,${user.id}
        FROM schedule_rows`;
      await audit(user.id,'save_schedule','user',id,{weekdays:normalized.map(day=>day.weekday)});
      return json(res,200,{ok:true,schedule:normalized});
    }
    if(req.method==='POST'&&action==='admin-create-user'){
      const b=body(req),email=normEmail(b.email),name=String(b.name||'').trim(),role=b.role==='admin'?'admin':'employee',position=role==='admin'?'Administrador':'Colaborador',unit=role==='admin'?'Pão da Leli':String(b.unit||'').trim();
      if(!email||!name)return json(res,400,{error:'Informe nome e e-mail.'});
      if(role==='employee'&&!EMPLOYEE_UNITS.has(unit))return json(res,400,{error:'Escolha Pão da Leli Café ou Pão da Leli Produção.'});
      if(role==='admin'){const c=await sql`SELECT count(*)::int AS n FROM leli_users WHERE role='admin' AND active=true`;if(c[0].n>=2)return json(res,409,{error:'O limite é de 2 administradores.'})}
      const code=activationCode(),codeHash=sha(code);
      try{
        const rows=await sql`INSERT INTO leli_users(email,name,role,position,unit,activation_hash,activation_code,activation_expires_at)
          VALUES(${email},${name},${role},${position},${unit},${codeHash},${code},NULL)
          RETURNING id,email,name,role`;
        await audit(user.id,'create_user','user',rows[0].id,{email,role});return json(res,201,{user:rows[0],activationCode:code});
      }catch(e){if(String(e?.message||'').includes('unique'))return json(res,409,{error:'Este e-mail já está cadastrado.'});throw e}
    }
    if(req.method==='POST'&&action==='admin-toggle-user'){
      const b=body(req),id=String(b.id||'');if(id===user.id)return json(res,400,{error:'Você não pode desativar a própria conta.'});
      const rows=await sql`UPDATE leli_users SET active=NOT active,updated_at=now() WHERE id=${id} RETURNING id,email,active`;if(!rows[0])return json(res,404,{error:'Usuário não encontrado.'});
      if(!rows[0].active)await sql`DELETE FROM leli_sessions WHERE user_id=${id}`;
      await audit(user.id,'toggle_user','user',id,{active:rows[0].active});return json(res,200,{user:rows[0]});
    }
    if(req.method==='POST'&&action==='admin-reset-activation'){
      const b=body(req),id=String(b.id||''),code=activationCode();const rows=await sql`UPDATE leli_users SET activation_hash=${sha(code)},activation_code=${code},activation_expires_at=NULL,password_hash=NULL,password_salt=NULL WHERE id=${id} RETURNING id,email`;if(!rows[0])return json(res,404,{error:'Usuário não encontrado.'});await sql`DELETE FROM leli_sessions WHERE user_id=${id}`;await audit(user.id,'reset_activation','user',id);return json(res,200,{activationCode:code});
    }
    if(req.method==='POST'&&action==='admin-decide-correction-group'){
      const b=body(req),groupId=String(b.groupId||''),status=String(b.status||''),note=String(b.note||'').trim();
      if(!['approved','rejected'].includes(status)||!/^[0-9a-f-]{36}$/i.test(groupId))return json(res,400,{error:'Decisão inválida.'});
      const rows=await sql`UPDATE leli_corrections SET status=${status},decided_by=${user.id},decided_at=now(),decision_note=${note}
        WHERE request_group=${groupId}::uuid AND status='pending' RETURNING id`;
      if(!rows.length)return json(res,404,{error:'Solicitação não encontrada ou já decidida.'});
      await audit(user.id,'decide_correction_group','correction_group',groupId,{status,count:rows.length});
      return json(res,200,{ok:true,count:rows.length});
    }
    if(req.method==='POST'&&action==='admin-decide-correction'){
      const b=body(req),id=String(b.id||''),status=String(b.status||''),note=String(b.note||'').trim();if(!['approved','rejected'].includes(status))return json(res,400,{error:'Decisão inválida.'});
      const rows=await sql`UPDATE leli_corrections SET status=${status},decided_by=${user.id},decided_at=now(),decision_note=${note} WHERE id=${id} AND status='pending' RETURNING id,user_id`;if(!rows[0])return json(res,404,{error:'Solicitação não encontrada ou já decidida.'});await audit(user.id,'decide_correction','correction',id,{status});return json(res,200,{ok:true});
    }

    return json(res,404,{error:'Operação não encontrada.'});
  }catch(e){console.error('leli-api',e);return json(res,500,{error:'Erro interno do sistema.'})}
}
