import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { buildMonthlyReport, getMonthBounds } from './leli-report.js';

const sql = neon(process.env.DATABASE_URL);
const SESSION_COOKIE = 'leli_session';
const BOOTSTRAP_HASH = '01258930c8e560ff164c8b6d29170d573a61327f4df7ec5facc15e39b443e75e';
const TZ = 'America/Sao_Paulo';
const EMPLOYEE_UNITS = new Set(['Pão da Leli Café','Pão da Leli Produção']);
const ACCESS_RADIUS_METERS = 20;

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
function requestIp(req){
  let value=String(req.headers['x-forwarded-for']||req.headers['x-real-ip']||'').split(',')[0].trim();
  if(value.startsWith('[')&&value.includes(']'))value=value.slice(1,value.indexOf(']'));
  if(/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(value))value=value.replace(/:\d+$/,'');
  return value.replace(/^::ffff:/i,'').split('%')[0].toLowerCase();
}
function ipv6Prefix64(value){
  const halves=String(value).split('::');
  if(halves.length>2)return'';
  const left=halves[0]?halves[0].split(':'):[],right=halves[1]?halves[1].split(':'):[];
  const missing=8-left.length-right.length;
  if(missing<0||(halves.length===1&&missing!==0))return'';
  const parts=[...left,...Array(missing).fill('0'),...right];
  if(parts.length!==8||parts.some(part=>!/^[0-9a-f]{0,4}$/i.test(part)))return'';
  return parts.slice(0,4).map(part=>(part||'0').padStart(4,'0')).join(':');
}
function networkIdentity(req){
  const ip=requestIp(req);
  if(/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip))return`ipv4:${ip}`;
  if(ip.includes(':')){const prefix=ipv6Prefix64(ip);if(prefix)return`ipv6:${prefix}`}
  return'';
}
function networkFingerprint(req){const identity=networkIdentity(req);return identity?sha(`leli-network:${identity}`):''}
function parseLocation(payload){
  const location=payload?.location||{},latitude=Number(location.latitude),longitude=Number(location.longitude),accuracy=Number(location.accuracy),capturedAt=Number(location.capturedAt);
  if(!Number.isFinite(latitude)||latitude<-90||latitude>90||!Number.isFinite(longitude)||longitude<-180||longitude>180)return{ok:false,error:'Ative a localização do celular para registrar o ponto.'};
  if(!Number.isFinite(accuracy)||accuracy<=0||accuracy>100)return{ok:false,error:'Não foi possível confirmar sua localização. Ative a localização precisa e tente novamente.'};
  if(!Number.isFinite(capturedAt)||Math.abs(Date.now()-capturedAt)>120000)return{ok:false,error:'A localização ficou desatualizada. Tente registrar o ponto novamente.'};
  return{ok:true,latitude,longitude,accuracy,capturedAt};
}
function distanceMeters(lat1,lon1,lat2,lon2){
  const toRad=value=>value*Math.PI/180,dLat=toRad(lat2-lat1),dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 6371000*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
async function accessPolicy(){
  const rows=await sql`SELECT p.mode,p.latitude,p.longitude,p.radius_m,p.network_fingerprint,p.network_name,p.active_profile_id,p.updated_at,u.name AS updated_by_name
    FROM leli_access_policy p LEFT JOIN leli_users u ON u.id=p.updated_by WHERE p.id=1 LIMIT 1`;
  return rows[0]||{mode:'free',radius_m:ACCESS_RADIUS_METERS};
}
async function accessProfiles(){
  return sql`SELECT id,network_name,latitude,longitude,radius_m,network_fingerprint,created_at,updated_at
    FROM leli_access_profiles ORDER BY updated_at DESC,created_at DESC`;
}
function accessProfileView(profile){
  return{
    id:profile.id,
    networkName:profile.network_name,
    latitude:Number(profile.latitude),
    longitude:Number(profile.longitude),
    radiusMeters:Number(profile.radius_m)||ACCESS_RADIUS_METERS,
    networkCode:String(profile.network_fingerprint).slice(0,8).toUpperCase(),
    createdAt:profile.created_at,
    updatedAt:profile.updated_at
  };
}
function accessPolicyView(policy,admin=false){
  const view={mode:policy?.mode==='restricted'?'restricted':'free',radiusMeters:Number(policy?.radius_m)||ACCESS_RADIUS_METERS,updatedAt:policy?.updated_at||null};
  if(admin){
    const hasLocation=policy?.latitude!==null&&policy?.latitude!==undefined&&policy?.longitude!==null&&policy?.longitude!==undefined;
    view.updatedByName=policy?.updated_by_name||null;
    view.configured=Boolean(hasLocation&&policy?.network_fingerprint);
    view.latitude=hasLocation?Number(policy.latitude):null;
    view.longitude=hasLocation?Number(policy.longitude):null;
    view.networkCode=policy?.network_fingerprint?String(policy.network_fingerprint).slice(0,8).toUpperCase():null;
    view.networkName=policy?.network_name||null;
    view.activeProfileId=policy?.active_profile_id||null;
  }
  return view;
}
async function validatePunchAccess(req,payload){
  const policy=await accessPolicy();
  if(policy.mode!=='restricted')return{ok:true,mode:'free',latitude:null,longitude:null,accuracy:null,distance:null,networkFingerprint:null};
  const fingerprint=networkFingerprint(req);
  if(!fingerprint||fingerprint!==policy.network_fingerprint)return{ok:false,status:403,error:'Conecte-se à rede do Pão da Leli para registrar o ponto.',reason:'network'};
  const location=parseLocation(payload);
  if(!location.ok)return{ok:false,status:403,error:location.error,reason:'location'};
  const distance=distanceMeters(Number(policy.latitude),Number(policy.longitude),location.latitude,location.longitude);
  if(distance>Number(policy.radius_m||ACCESS_RADIUS_METERS))return{ok:false,status:403,error:'Você precisa estar no Pão da Leli para registrar o ponto.',reason:'distance'};
  return{ok:true,mode:'restricted',latitude:location.latitude,longitude:location.longitude,accuracy:location.accuracy,distance:Math.round(distance),networkFingerprint:fingerprint};
}

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
  await sql`CREATE TABLE IF NOT EXISTS leli_access_policy (
    id smallint PRIMARY KEY CHECK (id=1),
    mode text NOT NULL DEFAULT 'free' CHECK (mode IN ('free','restricted')),
    latitude double precision,
    longitude double precision,
    radius_m integer NOT NULL DEFAULT 20 CHECK (radius_m BETWEEN 10 AND 500),
    network_fingerprint text,
    network_name text,
    updated_by uuid REFERENCES leli_users(id),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS leli_access_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    network_name text NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    radius_m integer NOT NULL DEFAULT 20 CHECK (radius_m BETWEEN 10 AND 500),
    network_fingerprint text UNIQUE NOT NULL,
    created_by uuid REFERENCES leli_users(id),
    updated_by uuid REFERENCES leli_users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`ALTER TABLE leli_access_policy ADD COLUMN IF NOT EXISTS network_name text`;
  await sql`ALTER TABLE leli_access_policy ADD COLUMN IF NOT EXISTS active_profile_id uuid REFERENCES leli_access_profiles(id) ON DELETE SET NULL`;
  await sql`ALTER TABLE leli_access_policy ALTER COLUMN radius_m SET DEFAULT 20`;
  await sql`ALTER TABLE leli_access_policy DROP CONSTRAINT IF EXISTS leli_access_policy_radius_m_check`;
  await sql`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='leli_access_policy_radius_m_range') THEN
      ALTER TABLE leli_access_policy ADD CONSTRAINT leli_access_policy_radius_m_range CHECK (radius_m BETWEEN 10 AND 500);
    END IF;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`;
  await sql`INSERT INTO leli_access_policy(id,mode,radius_m) VALUES(1,'free',20) ON CONFLICT(id) DO NOTHING`;
  await sql`UPDATE leli_access_policy SET radius_m=20 WHERE radius_m<>20`;
  await sql`UPDATE leli_access_policy SET network_name='Wi-Fi Pão da Leli' WHERE network_fingerprint IS NOT NULL AND (network_name IS NULL OR btrim(network_name)='')`;
  await sql`INSERT INTO leli_access_profiles(network_name,latitude,longitude,radius_m,network_fingerprint,created_by,updated_by,created_at,updated_at)
    SELECT network_name,latitude,longitude,radius_m,network_fingerprint,updated_by,updated_by,updated_at,updated_at
    FROM leli_access_policy p
    WHERE p.id=1 AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL AND p.network_fingerprint IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM leli_access_profiles saved WHERE saved.network_fingerprint=p.network_fingerprint)
    ON CONFLICT(network_fingerprint) DO NOTHING`;
  await sql`UPDATE leli_access_policy p SET active_profile_id=saved.id
    FROM leli_access_profiles saved
    WHERE p.id=1 AND p.active_profile_id IS NULL AND p.network_fingerprint=saved.network_fingerprint`;
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
  await sql`CREATE TABLE IF NOT EXISTS leli_schedule_versions (
    id bigserial PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES leli_users(id) ON DELETE CASCADE,
    effective_from date NOT NULL,
    schedule jsonb NOT NULL DEFAULT '[]'::jsonb,
    updated_by uuid REFERENCES leli_users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(user_id, effective_from)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS leli_checklist_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    unit text NOT NULL,
    question text NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    active boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES leli_users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS leli_checklist_missing_options (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    unit text NOT NULL,
    label text NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    active boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES leli_users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS leli_checklist_submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES leli_users(id),
    work_date date NOT NULL,
    unit text NOT NULL,
    answers jsonb NOT NULL,
    missing_items jsonb NOT NULL DEFAULT '[]'::jsonb,
    message text,
    message_audience text NOT NULL DEFAULT 'individual',
    recipient_user_id uuid REFERENCES leli_users(id) ON DELETE SET NULL,
    read_at timestamptz,
    punch_id uuid NOT NULL UNIQUE REFERENCES leli_punches(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(user_id, work_date)
  )`;
  await sql`ALTER TABLE leli_checklist_submissions ADD COLUMN IF NOT EXISTS missing_items jsonb NOT NULL DEFAULT '[]'::jsonb`;
  await sql`ALTER TABLE leli_checklist_submissions ADD COLUMN IF NOT EXISTS message_audience text NOT NULL DEFAULT 'individual'`;
  await sql`CREATE TABLE IF NOT EXISTS leli_checklist_message_reads (
    submission_id uuid NOT NULL REFERENCES leli_checklist_submissions(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES leli_users(id) ON DELETE CASCADE,
    read_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (submission_id,user_id)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS leli_missing_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id uuid NOT NULL REFERENCES leli_checklist_submissions(id) ON DELETE CASCADE,
    unit text NOT NULL,
    item_name text NOT NULL,
    reported_by uuid NOT NULL REFERENCES leli_users(id),
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','purchased','resolved')),
    resolved_by uuid REFERENCES leli_users(id),
    resolved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`ALTER TABLE leli_users ADD COLUMN IF NOT EXISTS activation_code text`;
  await sql`ALTER TABLE leli_punches ADD COLUMN IF NOT EXISTS access_mode text NOT NULL DEFAULT 'free'`;
  await sql`ALTER TABLE leli_punches ADD COLUMN IF NOT EXISTS location_lat double precision`;
  await sql`ALTER TABLE leli_punches ADD COLUMN IF NOT EXISTS location_lng double precision`;
  await sql`ALTER TABLE leli_punches ADD COLUMN IF NOT EXISTS location_accuracy double precision`;
  await sql`ALTER TABLE leli_punches ADD COLUMN IF NOT EXISTS distance_m integer`;
  await sql`ALTER TABLE leli_punches ADD COLUMN IF NOT EXISTS network_fingerprint text`;
  await sql`UPDATE leli_users SET position='Colaborador',updated_at=now() WHERE role='employee' AND position IN ('Funcionária','Funcionário')`;
  await sql`UPDATE leli_users SET unit='Pão da Leli Café',updated_at=now()
    WHERE role='employee' AND unit IN ('Pão da Leli','Pão da Leli atendimento')`;
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
  await sql`CREATE INDEX IF NOT EXISTS leli_checklist_items_unit_idx ON leli_checklist_items(unit,active,sort_order)`;
  await sql`CREATE INDEX IF NOT EXISTS leli_checklist_missing_options_unit_idx ON leli_checklist_missing_options(unit,active,sort_order)`;
  await sql`CREATE INDEX IF NOT EXISTS leli_checklist_submissions_recipient_idx ON leli_checklist_submissions(recipient_user_id,read_at,created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS leli_checklist_message_reads_user_idx ON leli_checklist_message_reads(user_id,read_at)`;
  await sql`CREATE INDEX IF NOT EXISTS leli_missing_reports_open_idx ON leli_missing_reports(status,unit,created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS leli_schedule_versions_user_date_idx ON leli_schedule_versions(user_id,effective_from)`;
  await sql`INSERT INTO leli_schedule_versions(user_id,effective_from,schedule)
    SELECT s.user_id,
      min((s.updated_at AT TIME ZONE ${TZ})::date),
      jsonb_agg(jsonb_build_object(
        'weekday',s.weekday,
        'start_time',to_char(s.start_time,'HH24:MI'),
        'break_start_time',to_char(s.break_start_time,'HH24:MI'),
        'break_end_time',to_char(s.break_end_time,'HH24:MI'),
        'end_time',to_char(s.end_time,'HH24:MI')
      ) ORDER BY s.weekday)
    FROM leli_schedules s
    WHERE NOT EXISTS (SELECT 1 FROM leli_schedule_versions v WHERE v.user_id=s.user_id)
    GROUP BY s.user_id`;
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
    const employeeActions=['photo','today','history','punch','checklist','checkout','messages-read','correction-batch','correction'];
    if(employeeActions.includes(action)&&user.role!=='employee')return json(res,403,{error:'Esta área é exclusiva para colaboradores.'});
    if(req.method==='POST'&&action==='photo'){
      const b=body(req),photo=String(b.photo||'');if(photo.length>220000||!photo.startsWith('data:image/'))return json(res,400,{error:'Foto inválida ou muito grande.'});
      await sql`UPDATE leli_users SET photo_data=${photo},updated_at=now() WHERE id=${user.id}`;return json(res,200,{ok:true});
    }
    if(req.method==='GET'&&action==='today'){
      const date=localDate(),punches=await effectivePunches(user.id,date);
      const pending=await sql`SELECT id,kind,status,reason,requested_at,created_at FROM leli_corrections WHERE user_id=${user.id} AND work_date=${date} ORDER BY created_at DESC`;
      const policy=await accessPolicy();
      return json(res,200,{date,state:stateFrom(punches),punches,corrections:pending,accessPolicy:accessPolicyView(policy)});
    }
    if(req.method==='GET'&&action==='history'){
      const month=String(req.query?.month||localDate().slice(0,7)).trim();let bounds;
      try{bounds=getMonthBounds(month)}catch{return json(res,400,{error:'Escolha um mês válido.'})}
      if(month>localDate().slice(0,7))return json(res,400,{error:'Escolha o mês atual ou um mês anterior.'});
      const rows=await sql`SELECT work_date::text AS work_date,kind,occurred_at FROM leli_punches
        WHERE user_id=${user.id} AND work_date BETWEEN ${bounds.start}::date AND ${bounds.end}::date
        ORDER BY work_date DESC,occurred_at ASC`;
      const corr=await sql`SELECT work_date::text AS work_date,kind,status,requested_at,decided_at FROM leli_corrections
        WHERE user_id=${user.id} AND work_date BETWEEN ${bounds.start}::date AND ${bounds.end}::date
        ORDER BY created_at DESC`;
      return json(res,200,{month,punches:rows,corrections:corr});
    }
    if(req.method==='GET'&&action==='checklist'){
      const items=await sql`SELECT id,question,sort_order FROM leli_checklist_items WHERE unit=${user.unit} AND active=true ORDER BY sort_order,id`;
      const missingOptions=await sql`SELECT id,label,sort_order FROM leli_checklist_missing_options WHERE unit=${user.unit} AND active=true ORDER BY sort_order,id`;
      const recipients=await sql`SELECT id,name,unit FROM leli_users WHERE role='employee' AND active=true AND id<>${user.id} ORDER BY name`;
      const unreadMessages=await sql`SELECT s.id,s.work_date::text AS work_date,s.message,s.message_audience,s.created_at,u.name AS sender_name,u.unit AS sender_unit
        FROM leli_checklist_submissions s JOIN leli_users u ON u.id=s.user_id
        WHERE s.message IS NOT NULL AND s.user_id<>${user.id} AND (
          (s.message_audience='individual' AND s.recipient_user_id=${user.id} AND s.read_at IS NULL)
          OR (s.message_audience='team' AND NOT EXISTS (
            SELECT 1 FROM leli_checklist_message_reads mr WHERE mr.submission_id=s.id AND mr.user_id=${user.id}
          ))
        )
        ORDER BY s.created_at ASC LIMIT 30`;
      return json(res,200,{unit:user.unit,items,missingOptions,recipients,unreadMessages});
    }
    if(req.method==='POST'&&action==='messages-read'){
      const b=body(req),ids=Array.isArray(b.ids)?[...new Set(b.ids.map(id=>String(id)))]:[];
      if(!ids.length||ids.length>30||ids.some(id=>!/^[0-9a-f-]{36}$/i.test(id)))return json(res,400,{error:'Recados inválidos.'});
      const direct=await sql`WITH selected AS (
          SELECT value::uuid AS id FROM jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb)
        ) UPDATE leli_checklist_submissions s SET read_at=now() FROM selected
        WHERE s.id=selected.id AND s.message_audience='individual' AND s.recipient_user_id=${user.id} AND s.read_at IS NULL RETURNING s.id`;
      const team=await sql`WITH selected AS (
          SELECT value::uuid AS id FROM jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb)
        ) INSERT INTO leli_checklist_message_reads(submission_id,user_id)
        SELECT s.id,${user.id} FROM leli_checklist_submissions s JOIN selected ON selected.id=s.id
        WHERE s.message_audience='team' AND s.message IS NOT NULL AND s.user_id<>${user.id}
        ON CONFLICT DO NOTHING RETURNING submission_id`;
      const count=direct.length+team.length;
      await audit(user.id,'read_checklist_messages','checklist_message',null,{count});
      return json(res,200,{ok:true,count});
    }
    if(req.method==='POST'&&action==='punch'){
      const date=localDate(),current=await effectivePunches(user.id,date),state=stateFrom(current),kind=expectedKind(state);
      if(!kind)return json(res,409,{error:'A jornada de hoje já foi encerrada.'});
      if(kind==='out')return json(res,428,{error:'Preencha o checklist antes de registrar a saída.',needsChecklist:true});
      const access=await validatePunchAccess(req,body(req));
      if(!access.ok)return json(res,access.status,{error:access.error,accessDenied:true,reason:access.reason});
      try{
        const rows=await sql`INSERT INTO leli_punches(user_id,kind,work_date,user_agent,access_mode,location_lat,location_lng,location_accuracy,distance_m,network_fingerprint)
          VALUES(${user.id},${kind},${date},${String(req.headers['user-agent']||'').slice(0,300)},${access.mode},${access.latitude},${access.longitude},${access.accuracy},${access.distance},${access.networkFingerprint})
          RETURNING id,kind,occurred_at,work_date`;
        await audit(user.id,'punch','punch',rows[0].id,{kind,date,accessMode:access.mode,distanceMeters:access.distance,accuracyMeters:access.accuracy});return json(res,201,{punch:rows[0],state:stateFrom([...current,rows[0]])});
      }catch(e){if(String(e?.message||'').includes('unique'))return json(res,409,{error:'Essa batida já foi registrada.'});throw e}
    }
    if(req.method==='POST'&&action==='checkout'){
      const date=localDate(),current=await effectivePunches(user.id,date),state=stateFrom(current);
      if(expectedKind(state)!=='out')return json(res,409,{error:state==='out'?'A jornada de hoje já foi encerrada.':'A saída só pode ser registrada depois da volta do intervalo.'});
      const items=await sql`SELECT id,question FROM leli_checklist_items WHERE unit=${user.unit} AND active=true ORDER BY sort_order,id`;
      const missingOptions=await sql`SELECT id,label FROM leli_checklist_missing_options WHERE unit=${user.unit} AND active=true ORDER BY sort_order,id`;
      if(!items.length)return json(res,409,{error:'O checklist desta área ainda não foi configurado. Avise o administrador.'});
      const b=body(req),submitted=Array.isArray(b.answers)?b.answers:[],answerMap=new Map();
      for(const answer of submitted){
        const id=String(answer?.id||'');
        if(!/^[0-9a-f-]{36}$/i.test(id)||typeof answer?.answer!=='boolean'||answerMap.has(id))return json(res,400,{error:'Responda todas as perguntas com Sim ou Não.'});
        answerMap.set(id,answer.answer);
      }
      if(answerMap.size!==items.length||items.some(item=>!answerMap.has(String(item.id))))return json(res,409,{error:'O checklist foi atualizado. Abra novamente e responda às perguntas atuais.',checklistChanged:true});
      const snapshot=items.map(item=>({itemId:item.id,question:item.question,answer:answerMap.get(String(item.id))}));
      const rawMissing=Array.isArray(b.missingItemIds)?b.missingItemIds:[];
      if(rawMissing.length>60)return json(res,400,{error:'A lista do que está faltando é muito grande.'});
      const missingIds=[...new Set(rawMissing.map(id=>String(id)))];
      if(missingIds.some(id=>!/^[0-9a-f-]{36}$/i.test(id)))return json(res,400,{error:'Revise os itens que estão faltando.'});
      const missingById=new Map(missingOptions.map(item=>[String(item.id),item]));
      if(missingIds.some(id=>!missingById.has(id)))return json(res,409,{error:'A lista do que está faltando foi atualizada. Abra o checklist novamente.',checklistChanged:true});
      const nothingMissing=b.nothingMissing===true;
      if(missingOptions.length&&!missingIds.length&&!nothingMissing)return json(res,400,{error:'Marque o que está faltando ou escolha “Nada está faltando”.'});
      if(missingIds.length&&nothingMissing)return json(res,400,{error:'Escolha os itens que faltam ou “Nada está faltando”, não os dois.'});
      const missingSnapshot=missingIds.map(id=>({optionId:id,label:missingById.get(id).label}));
      const message=String(b.message||'').trim();let recipientId=String(b.recipientId||'').trim()||null,messageAudience=String(b.messageAudience||'individual');
      if(message.length>1000)return json(res,400,{error:'O recado pode ter no máximo 1.000 caracteres.'});
      if(message){
        if(!['team','individual'].includes(messageAudience))return json(res,400,{error:'Escolha para quem o recado deve ser enviado.'});
        if(messageAudience==='team')recipientId=null;
        else{
          if(!recipientId||!/^[0-9a-f-]{36}$/i.test(recipientId)||recipientId===user.id)return json(res,400,{error:'Escolha o colaborador que receberá o recado.'});
          const recipient=await sql`SELECT id FROM leli_users WHERE id=${recipientId} AND role='employee' AND active=true LIMIT 1`;
          if(!recipient[0])return json(res,400,{error:'O destinatário do recado não está disponível.'});
        }
      }else{recipientId=null;messageAudience='individual'}
      const access=await validatePunchAccess(req,b);
      if(!access.ok)return json(res,access.status,{error:access.error,accessDenied:true,reason:access.reason});
      try{
        const rows=await sql`WITH new_punch AS (
            INSERT INTO leli_punches(user_id,kind,work_date,user_agent,access_mode,location_lat,location_lng,location_accuracy,distance_m,network_fingerprint)
            VALUES(${user.id},'out',${date},${String(req.headers['user-agent']||'').slice(0,300)},${access.mode},${access.latitude},${access.longitude},${access.accuracy},${access.distance},${access.networkFingerprint})
            RETURNING id,kind,occurred_at,work_date
          ), saved AS (
            INSERT INTO leli_checklist_submissions(user_id,work_date,unit,answers,missing_items,message,message_audience,recipient_user_id,punch_id)
            SELECT ${user.id},${date},${user.unit},${JSON.stringify(snapshot)}::jsonb,${JSON.stringify(missingSnapshot)}::jsonb,${message||null},${messageAudience},${recipientId}::uuid,p.id FROM new_punch p
            RETURNING id,punch_id
          ), missing AS (
            INSERT INTO leli_missing_reports(submission_id,unit,item_name,reported_by)
            SELECT s.id,${user.unit},x.label,${user.id} FROM saved s
            CROSS JOIN jsonb_to_recordset(${JSON.stringify(missingSnapshot)}::jsonb) AS x(label text)
            RETURNING id
          ) SELECT p.id,p.kind,p.occurred_at,p.work_date,s.id AS submission_id,
              (SELECT count(*)::int FROM missing) AS missing_count
            FROM new_punch p JOIN saved s ON s.punch_id=p.id`;
        if(!rows[0])return json(res,409,{error:'Não foi possível registrar a saída.'});
        await audit(user.id,'checkout_with_checklist','checklist_submission',rows[0].submission_id,{date,unit:user.unit,answers:snapshot.length,missingItems:missingSnapshot.length,hasMessage:Boolean(message),messageAudience:message?messageAudience:null,accessMode:access.mode,distanceMeters:access.distance,accuracyMeters:access.accuracy});
        return json(res,201,{punch:rows[0],submissionId:rows[0].submission_id,state:'out'});
      }catch(e){if(String(e?.message||'').includes('unique'))return json(res,409,{error:'A saída ou o checklist de hoje já foi registrado.'});throw e}
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
      const [policy,profiles]=await Promise.all([accessPolicy(),accessProfiles()]);
      return json(res,200,{date,users,punches,corrections,accessPolicy:accessPolicyView(policy,true),accessProfiles:profiles.map(accessProfileView)});
    }
    if(req.method==='POST'&&action==='admin-access-policy'){
      const b=body(req),mode=String(b.mode||'');
      if(!['free','restricted'].includes(mode))return json(res,400,{error:'Escolha se o ponto ficará livre ou restrito.'});
      if(mode==='free'){
        await sql`UPDATE leli_access_policy SET mode='free',updated_by=${user.id},updated_at=now() WHERE id=1`;
        await audit(user.id,'change_access_policy','access_policy','1',{mode:'free'});
      }else if(b.profileId){
        const profileId=String(b.profileId||'');
        if(!/^[0-9a-f-]{36}$/i.test(profileId))return json(res,400,{error:'Configuração salva inválida.'});
        const profiles=await sql`SELECT id,network_name,latitude,longitude,radius_m,network_fingerprint FROM leli_access_profiles WHERE id=${profileId} LIMIT 1`;
        const profile=profiles[0];
        if(!profile)return json(res,404,{error:'Esta configuração salva não foi encontrada.'});
        await sql`UPDATE leli_access_policy SET mode='restricted',latitude=${profile.latitude},longitude=${profile.longitude},radius_m=${profile.radius_m},network_fingerprint=${profile.network_fingerprint},network_name=${profile.network_name},active_profile_id=${profile.id},updated_by=${user.id},updated_at=now() WHERE id=1`;
        await audit(user.id,'activate_access_profile','access_profile',profile.id,{networkName:profile.network_name,radiusMeters:profile.radius_m});
      }else{
        const location=parseLocation(b),networkName=String(b.networkName||'').trim().slice(0,80);
        if(!location.ok)return json(res,400,{error:location.error});
        if(!networkName)return json(res,400,{error:'Digite um nome para identificar esta rede.'});
        const fingerprint=networkFingerprint(req);
        if(!fingerprint)return json(res,400,{error:'Não foi possível identificar esta rede. Conecte-se ao Wi-Fi do Pão da Leli e tente novamente.'});
        const profiles=await sql`INSERT INTO leli_access_profiles(network_name,latitude,longitude,radius_m,network_fingerprint,created_by,updated_by)
          VALUES(${networkName},${location.latitude},${location.longitude},${ACCESS_RADIUS_METERS},${fingerprint},${user.id},${user.id})
          ON CONFLICT(network_fingerprint) DO UPDATE SET network_name=excluded.network_name,latitude=excluded.latitude,longitude=excluded.longitude,radius_m=excluded.radius_m,updated_by=excluded.updated_by,updated_at=now()
          RETURNING id`;
        await sql`UPDATE leli_access_policy SET mode='restricted',latitude=${location.latitude},longitude=${location.longitude},radius_m=${ACCESS_RADIUS_METERS},network_fingerprint=${fingerprint},network_name=${networkName},active_profile_id=${profiles[0].id},updated_by=${user.id},updated_at=now() WHERE id=1`;
        await audit(user.id,'save_access_profile','access_profile',profiles[0].id,{networkName,radiusMeters:ACCESS_RADIUS_METERS,accuracyMeters:location.accuracy});
      }
      const [policy,profiles]=await Promise.all([accessPolicy(),accessProfiles()]);
      return json(res,200,{ok:true,accessPolicy:accessPolicyView(policy,true),accessProfiles:profiles.map(accessProfileView)});
    }
    if(req.method==='GET'&&action==='admin-checklist'){
      const items=await sql`SELECT id,unit,question,sort_order,active,updated_at FROM leli_checklist_items WHERE active=true ORDER BY unit,sort_order,id`;
      const missingOptions=await sql`SELECT id,unit,label,sort_order,active,updated_at FROM leli_checklist_missing_options WHERE active=true ORDER BY unit,sort_order,id`;
      const submissions=await sql`SELECT s.id,s.work_date::text AS work_date,s.unit,s.answers,s.missing_items,s.message,s.message_audience,s.read_at,s.created_at,
          u.name AS employee_name,r.name AS recipient_name,
          CASE WHEN s.message_audience='team' THEN (SELECT count(*)::int FROM leli_users x WHERE x.role='employee' AND x.active=true AND x.id<>s.user_id) ELSE CASE WHEN s.recipient_user_id IS NULL THEN 0 ELSE 1 END END AS recipient_count,
          CASE WHEN s.message_audience='team' THEN (SELECT count(*)::int FROM leli_checklist_message_reads mr WHERE mr.submission_id=s.id) ELSE CASE WHEN s.read_at IS NULL THEN 0 ELSE 1 END END AS read_count
        FROM leli_checklist_submissions s JOIN leli_users u ON u.id=s.user_id
        LEFT JOIN leli_users r ON r.id=s.recipient_user_id ORDER BY s.created_at DESC LIMIT 120`;
      const missingReports=await sql`SELECT m.unit,lower(trim(m.item_name)) AS item_key,(array_agg(m.item_name ORDER BY m.created_at DESC))[1] AS item_name,
          count(*)::int AS report_count,max(m.created_at) AS last_reported_at,array_agg(DISTINCT u.name ORDER BY u.name) AS reporter_names
        FROM leli_missing_reports m JOIN leli_users u ON u.id=m.reported_by
        WHERE m.status='open' GROUP BY m.unit,lower(trim(m.item_name)) ORDER BY max(m.created_at) DESC`;
      return json(res,200,{items,missingOptions,submissions,missingReports});
    }
    if(req.method==='POST'&&action==='admin-save-checklist'){
      const b=body(req),unit=String(b.unit||'').trim(),raw=Array.isArray(b.questions)?b.questions:[],missingRaw=Array.isArray(b.missingItems)?b.missingItems:[];
      if(!EMPLOYEE_UNITS.has(unit)||raw.length>30||missingRaw.length>60)return json(res,400,{error:'Checklist inválido.'});
      const questions=raw.map(value=>String(value||'').trim());
      const missingItems=missingRaw.map(value=>String(value||'').trim());
      if(questions.some(value=>value.length<3||value.length>220))return json(res,400,{error:'Cada pergunta precisa ter entre 3 e 220 caracteres.'});
      if(missingItems.some(value=>value.length<2||value.length>120))return json(res,400,{error:'Cada item que pode faltar precisa ter entre 2 e 120 caracteres.'});
      if(new Set(questions.map(value=>value.toLocaleLowerCase('pt-BR'))).size!==questions.length)return json(res,400,{error:'Existem perguntas repetidas neste checklist.'});
      if(new Set(missingItems.map(value=>value.toLocaleLowerCase('pt-BR'))).size!==missingItems.length)return json(res,400,{error:'Existem itens repetidos na lista do que pode faltar.'});
      const payload=questions.map((question,sort_order)=>({question,sort_order}));
      const missingPayload=missingItems.map((label,sort_order)=>({label,sort_order}));
      await sql`WITH removed_questions AS (
          DELETE FROM leli_checklist_items WHERE unit=${unit}
        ), checklist_rows AS (
          SELECT * FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) AS x(question text,sort_order integer)
        ), saved_questions AS (
          INSERT INTO leli_checklist_items(unit,question,sort_order,created_by)
          SELECT ${unit},question,sort_order,${user.id} FROM checklist_rows RETURNING id
        ), removed_missing AS (
          DELETE FROM leli_checklist_missing_options WHERE unit=${unit}
        ), missing_rows AS (
          SELECT * FROM jsonb_to_recordset(${JSON.stringify(missingPayload)}::jsonb) AS x(label text,sort_order integer)
        ), saved_missing AS (
          INSERT INTO leli_checklist_missing_options(unit,label,sort_order,created_by)
          SELECT ${unit},label,sort_order,${user.id} FROM missing_rows RETURNING id
        ) SELECT (SELECT count(*)::int FROM saved_questions) AS questions,(SELECT count(*)::int FROM saved_missing) AS missing_items`;
      await audit(user.id,'save_checklist','checklist',unit,{questions:questions.length,missingItems:missingItems.length});
      return json(res,200,{ok:true,count:questions.length,missingCount:missingItems.length});
    }
    if(req.method==='POST'&&action==='admin-resolve-missing'){
      const b=body(req),unit=String(b.unit||'').trim(),itemKey=String(b.itemKey||'').trim().toLocaleLowerCase('pt-BR'),status=String(b.status||'');
      if(!EMPLOYEE_UNITS.has(unit)||!itemKey||itemKey.length>120||!['purchased','resolved'].includes(status))return json(res,400,{error:'Pendência inválida.'});
      const rows=await sql`UPDATE leli_missing_reports SET status=${status},resolved_by=${user.id},resolved_at=now()
        WHERE status='open' AND unit=${unit} AND lower(trim(item_name))=${itemKey} RETURNING id`;
      if(!rows.length)return json(res,404,{error:'Essa pendência já foi resolvida.'});
      await audit(user.id,'resolve_missing_item','missing_item',itemKey,{unit,status,count:rows.length});
      return json(res,200,{ok:true,count:rows.length});
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
    if(req.method==='GET'&&action==='admin-monthly-report'){
      const month=String(req.query?.month||'').trim(),employeeId=String(req.query?.employeeId||'').trim();
      if(employeeId&&!/^[0-9a-f-]{36}$/i.test(employeeId))return json(res,400,{error:'Colaborador inválido.'});
      let bounds;
      try{bounds=getMonthBounds(month)}catch{return json(res,400,{error:'Escolha um mês válido.'})}
      if(month>localDate().slice(0,7))return json(res,400,{error:'Escolha o mês atual ou um mês anterior.'});
      const employeeFilter=employeeId||null;
      const employees=await sql`SELECT id,name,email,unit,active,created_at
        FROM leli_users
        WHERE role='employee' AND (${employeeFilter}::uuid IS NULL OR id=${employeeFilter}::uuid)
        ORDER BY name`;
      if(employeeId&&!employees[0])return json(res,404,{error:'Colaborador não encontrado.'});
      const punches=await sql`SELECT p.user_id,p.work_date::text AS work_date,p.kind,p.occurred_at
        FROM leli_punches p JOIN leli_users u ON u.id=p.user_id
        WHERE u.role='employee' AND p.work_date BETWEEN ${bounds.start}::date AND ${bounds.end}::date
          AND (${employeeFilter}::uuid IS NULL OR p.user_id=${employeeFilter}::uuid)
        ORDER BY p.work_date,p.occurred_at`;
      const corrections=await sql`SELECT c.id,c.user_id,c.work_date::text AS work_date,c.kind,c.status,c.requested_at,c.decided_at,c.request_group
        FROM leli_corrections c JOIN leli_users u ON u.id=c.user_id
        WHERE u.role='employee' AND c.work_date BETWEEN ${bounds.start}::date AND ${bounds.end}::date
          AND (${employeeFilter}::uuid IS NULL OR c.user_id=${employeeFilter}::uuid)
        ORDER BY c.work_date,c.created_at`;
      const scheduleVersions=await sql`SELECT v.user_id,v.effective_from::text AS effective_from,v.schedule
        FROM leli_schedule_versions v JOIN leli_users u ON u.id=v.user_id
        WHERE u.role='employee' AND v.effective_from<=${bounds.end}::date
          AND (${employeeFilter}::uuid IS NULL OR v.user_id=${employeeFilter}::uuid)
        ORDER BY v.user_id,v.effective_from`;
      const report=buildMonthlyReport({month,employees,punches,corrections,scheduleVersions});
      await audit(user.id,'view_monthly_report','month',month,{employeeId:employeeFilter});
      return json(res,200,report);
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
      await sql`INSERT INTO leli_schedule_versions(user_id,effective_from,schedule,updated_by)
        VALUES(${id},${localDate()}::date,${JSON.stringify(normalized)}::jsonb,${user.id})
        ON CONFLICT(user_id,effective_from) DO UPDATE SET schedule=excluded.schedule,updated_by=excluded.updated_by,created_at=now()`;
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
    if(req.method==='POST'&&action==='admin-reset-correction-decision'){
      const b=body(req),id=String(b.id||'');
      if(!/^[0-9a-f-]{36}$/i.test(id))return json(res,400,{error:'Correção inválida.'});
      const rows=await sql`UPDATE leli_corrections SET status='pending',decided_by=NULL,decided_at=NULL,decision_note=NULL
        WHERE id=${id} AND status IN ('approved','rejected') RETURNING id,user_id`;
      if(!rows[0])return json(res,404,{error:'Decisão não encontrada ou já está pendente.'});
      await audit(user.id,'reset_correction_decision','correction',id);
      return json(res,200,{ok:true});
    }

    return json(res,404,{error:'Operação não encontrada.'});
  }catch(e){console.error('leli-api',e);return json(res,500,{error:'Erro interno do sistema.'})}
}
