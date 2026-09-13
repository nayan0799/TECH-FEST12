-- MIND RIZZ single-event schema. Run on a NEW Supabase project, then 002_seed.sql.
begin;
create extension if not exists pgcrypto;
revoke create on schema public from public,anon,authenticated;
create sequence public.team_number_seq;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text not null,
 role text not null default 'student' check(role in ('student','admin')),
 data jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create table public.events (id integer primary key check(id=1), config jsonb not null);
create table public.levels (id integer primary key check(id between 1 and 3), data jsonb not null);
create table public.teams (
 id uuid primary key default gen_random_uuid(),
 code text unique not null,
 name text not null check(length(trim(name)) between 2 and 80),
 owner_id uuid unique not null references public.profiles(id),
 members jsonb not null check(jsonb_typeof(members)='array' and jsonb_array_length(members)=2),
 status text not null default 'confirmed' check(status in ('confirmed','disqualified')),
 qr_token uuid unique not null default gen_random_uuid(),
 tie_order integer check(tie_order>0),
 created_at timestamptz not null default now()
);
create table public.team_members (
 team_id uuid not null references public.teams(id) on delete cascade,
 position integer not null check(position in (1,2)),
 email text not null unique,
 college_id text not null unique,
 data jsonb not null,
 primary key(team_id,position)
);
create table public.attendance (
 team_id uuid primary key references public.teams(id) on delete cascade,
 checked_in_at timestamptz not null default now(),
 checked_in_by uuid not null references public.profiles(id)
);
create table public.scores (
 team_id uuid not null references public.teams(id) on delete cascade,
 level_id integer not null references public.levels(id),
 score numeric not null check(score>=0),
 entered_by uuid not null references public.profiles(id),
 updated_at timestamptz not null default now(),
 primary key(team_id,level_id)
);
create table public.team_change_requests (
 id uuid primary key default gen_random_uuid(),
 team_id uuid not null references public.teams(id) on delete cascade,
 member jsonb not null,
 reason text not null,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now()
);
create unique index one_pending_request on public.team_change_requests(team_id) where status='pending';
create table public.announcements (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 message text not null,
 audience text not null check(audience in ('everyone','checked-in','team')),
 team_id uuid references public.teams(id) on delete cascade,
 published boolean not null default false,
 publish_at timestamptz not null default now(),
 check(audience<>'team' or team_id is not null)
);
create table public.activity_logs (
 id bigint generated always as identity primary key,
 actor_id uuid references public.profiles(id),
 action text not null,
 created_at timestamptz not null default now()
);
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path=public,pg_temp
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin'); $$;
create or replace function public.owns_team(tid uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp
as $$ select exists(select 1 from public.teams t join public.profiles p on p.id=auth.uid() where t.id=tid and (t.owner_id=p.id or exists(select 1 from jsonb_array_elements(t.members) m where lower(m->>'email')=lower(p.email)))); $$;
create or replace function public.on_new_user() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.profiles(id,email,data) values(new.id,lower(new.email),jsonb_build_object('name',coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),'Participant'),'phone','','college_id','','college','','branch','','semester','','theme','dark'));
 return new;
end $$;
create trigger auth_user_created after insert on auth.users for each row execute function public.on_new_user();
create or replace function public.sync_members() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 delete from public.team_members where team_id=new.id;
 insert into public.team_members(team_id,position,email,college_id,data)
 select new.id,ord::integer,lower(trim(m->>'email')),lower(trim(m->>'college_id')),m from jsonb_array_elements(new.members) with ordinality a(m,ord);
 return new;
end $$;
create trigger members_sync after insert or update of members on public.teams for each row execute function public.sync_members();
create or replace function public.validate_member(m jsonb) returns jsonb
language plpgsql immutable set search_path=public,pg_temp as $$
declare k text; result jsonb:='{}';
begin
 if jsonb_typeof(m) is distinct from 'object' then raise exception 'Invalid member details'; end if;
 foreach k in array array['name','email','phone','college_id','college','branch','semester'] loop
  if length(trim(coalesce(m->>k,'')))<1 or length(m->>k)>180 then raise exception 'Complete every member field (maximum 180 characters)'; end if;
  result:=result||jsonb_build_object(k,trim(m->>k));
 end loop;
 if (result->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid member email'; end if;
 return result||jsonb_build_object('email',lower(result->>'email'));
end $$;
create or replace function public.score_guard() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
 if new.score>(select (data->>'maximum')::numeric from public.levels where id=new.level_id) then raise exception 'Score cannot exceed maximum'; end if;
 return new;
end $$;
create trigger validate_score before insert or update on public.scores for each row execute function public.score_guard();

-- No direct client writes. All writes use validated, authenticated RPCs below.
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.levels enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.attendance enable row level security;
alter table public.scores enable row level security;
alter table public.team_change_requests enable row level security;
alter table public.announcements enable row level security;
alter table public.activity_logs enable row level security;
create policy profiles_read on public.profiles for select using(id=auth.uid() or public.is_admin());
create policy events_read on public.events for select using(true);
create policy levels_read on public.levels for select using(true);
create policy teams_read on public.teams for select using(public.is_admin() or public.owns_team(id));
create policy members_read on public.team_members for select using(public.is_admin() or public.owns_team(team_id));
create policy attendance_read on public.attendance for select using(public.is_admin() or public.owns_team(team_id));
-- Student results are projected by get_state only. Direct score rows are admin-only.
create policy scores_read on public.scores for select using(public.is_admin());
create policy requests_read on public.team_change_requests for select using(public.is_admin() or public.owns_team(team_id));
create policy logs_read on public.activity_logs for select using(public.is_admin());
create policy announcement_read on public.announcements for select using(public.is_admin() or (published and publish_at<=now() and (audience='everyone' or (audience='team' and public.owns_team(team_id)) or (audience='checked-in' and exists(select 1 from public.attendance a where public.owns_team(a.team_id))))));
revoke all on public.profiles,public.events,public.levels,public.teams,public.team_members,public.attendance,public.scores,public.team_change_requests,public.announcements,public.activity_logs from anon,authenticated;
grant select on public.profiles,public.events,public.levels,public.teams,public.team_members,public.attendance,public.scores,public.team_change_requests,public.announcements,public.activity_logs to anon,authenticated;
revoke all on sequence public.team_number_seq from anon,authenticated;

-- A private ranking projection. No member names, emails, or QR tokens.
create or replace function public.ranked_teams() returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 with c as (select config from public.events where id=1), raw as (
  select t.id,t.code,t.name,t.tie_order,
    (select score from public.scores s where s.team_id=t.id and level_id=1) s1,
    (select score from public.scores s where s.team_id=t.id and level_id=2) s2,
    (select score from public.scores s where s.team_id=t.id and level_id=3) s3
  from public.teams t where status='confirmed'
 ), totals as (select *,coalesce(s1,0)+coalesce(s2,0)+coalesce(s3,0) total,array[coalesce(s1,0),coalesce(s2,0),coalesce(s3,0)] parts from raw), ranks as (
 select totals.*,rank() over(order by total desc,parts[(c.config->'tiebreak'->>0)::integer] desc,parts[(c.config->'tiebreak'->>1)::integer] desc,parts[(c.config->'tiebreak'->>2)::integer] desc,tie_order asc nulls last) rank from totals cross join c
 ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'scores',jsonb_build_array(s1,s2,s3),'total',total,'rank',rank,'tie_order',tie_order) order by rank,code),'[]') from ranks;
$$;
create or replace function public.get_state() returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare c jsonb; admin boolean:=public.is_admin(); p jsonb; ts jsonb; ls jsonb; anns jsonb; reqs jsonb; logs jsonb; standings jsonb:='[]';
begin
 select config into c from public.events where id=1;
 if c is null then raise exception 'Run the seed migration before opening the website'; end if;
 select data||jsonb_build_object('id',id,'email',email,'role',role) into p from public.profiles where id=auth.uid();
 select coalesce(jsonb_agg(data||jsonb_build_object('id',id) order by id),'[]') into ls from public.levels;
 select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('checked_in_at',(select a.checked_in_at from public.attendance a where a.team_id=t.id),'scores',case when admin or (c->>'published')::boolean then jsonb_build_array((select s.score from public.scores s where s.team_id=t.id and level_id=1),(select s.score from public.scores s where s.team_id=t.id and level_id=2),(select s.score from public.scores s where s.team_id=t.id and level_id=3)) else '[null,null,null]'::jsonb end) order by t.created_at desc),'[]') into ts from public.teams t where admin or public.owns_team(t.id);
 select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('team_id',coalesce(a.team_id::text,'')) order by a.publish_at desc),'[]') into anns from public.announcements a where admin or (a.published and a.publish_at<=now() and (a.audience='everyone' or (a.audience='team' and public.owns_team(a.team_id)) or (a.audience='checked-in' and exists(select 1 from public.attendance att where public.owns_team(att.team_id)))));
 select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc),'[]') into reqs from public.team_change_requests r where admin or public.owns_team(r.team_id);
 select coalesce(jsonb_agg(jsonb_build_object('action',q.action,'created_at',q.created_at) order by q.created_at desc),'[]') into logs from (select * from public.activity_logs where admin order by created_at desc limit 100) q;
 if admin or (c->>'published')::boolean or c->>'leaderboard'='public' then standings:=public.ranked_teams(); end if;
 return jsonb_build_object('config',c,'levels',ls,'profile',p,'teams',ts,'announcements',anns,'requests',reqs,'logs',logs,'standings',standings,'team_count',(select count(*) from public.teams));
end $$;

create or replace function public.mutate(action text,payload jsonb default '{}') returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare
 uid uuid:=auth.uid(); admin boolean:=public.is_admin(); c jsonb; n jsonb; m1 jsonb; m2 jsonb; l jsonb; p public.profiles%rowtype; t public.teams%rowtype; r public.team_change_requests%rowtype; tid uuid; lid integer; k text; arr jsonb; remaining_seconds integer; old_status text; val numeric; ranks jsonb;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 -- Serialize the small single-event control plane, including concurrent capacity checks.
 perform pg_advisory_xact_lock(904521);
 select config into c from public.events where id=1 for update;
 if c is null then raise exception 'Event is not configured'; end if;
 select * into p from public.profiles where id=uid;
 if not found then raise exception 'Profile is missing'; end if;
 if action not in ('profile','create_team','request_change') and not admin then raise exception 'Administrator access required'; end if;
 if octet_length(payload::text)>1048576 then raise exception 'Request is too large'; end if;

 if action='profile' then
  n:=p.data;
  foreach k in array array['name','phone','college_id','college','branch','semester','theme'] loop
   if payload ? k then
    if jsonb_typeof(payload->k) is distinct from 'string' or length(payload->>k)>180 then raise exception 'Invalid profile field'; end if;
    n:=n||jsonb_build_object(k,trim(payload->>k));
   end if;
  end loop;
  if coalesce(n->>'name','')='' or n->>'theme' not in ('dark','light') then raise exception 'Name and valid theme are required'; end if;
  update public.profiles set data=n where id=uid;

 elsif action='create_team' then
  if not (c->>'registration_open')::boolean or now()<(c->>'opens_at')::timestamptz or now()>(c->>'deadline')::timestamptz then raise exception 'Registration is closed'; end if;
  if (select count(*) from public.teams)>=(c->>'capacity')::integer then raise exception 'Team capacity has been reached'; end if;
  if exists(select 1 from public.teams where owner_id=uid) then raise exception 'You already registered a team'; end if;
  if jsonb_typeof(payload->'members') is distinct from 'array' then raise exception 'Exactly two members are required'; end if;
  if jsonb_array_length(payload->'members')<>2 or (payload->>'agreed')::boolean is distinct from true then raise exception 'Exactly two members and rules agreement are required'; end if;
  if length(trim(coalesce(payload->>'name',''))) not between 2 and 80 then raise exception 'Team name must contain 2 to 80 characters'; end if;
  m1:=public.validate_member((payload->'members'->0)||jsonb_build_object('name',p.data->>'name','email',p.email));
  m2:=public.validate_member(payload->'members'->1);
  if m1->>'email'=m2->>'email' or lower(m1->>'college_id')=lower(m2->>'college_id') then raise exception 'Team members must be different participants'; end if;
  if exists(select 1 from public.team_members where email in (m1->>'email',m2->>'email') or college_id in (lower(m1->>'college_id'),lower(m2->>'college_id'))) then raise exception 'A participant is already registered'; end if;
  k:=nextval('public.team_number_seq')::text;
  insert into public.teams(code,name,owner_id,members) values('MR-'||(c->>'edition')||'-T'||lpad(k,greatest(3,length(k)),'0'),trim(payload->>'name'),uid,jsonb_build_array(m1,m2));

 elsif action='request_change' then
  select * into t from public.teams where owner_id=uid;
  if not found then raise exception 'Only a registered team leader may request a replacement'; end if;
  if t.status<>'confirmed' then raise exception 'Team is not confirmed'; end if;
  m2:=public.validate_member(payload->'member');
  if length(trim(coalesce(payload->>'reason',''))) not between 3 and 1500 then raise exception 'Provide a reason between 3 and 1500 characters'; end if;
  if exists(select 1 from public.team_change_requests where team_id=t.id and status='pending') then raise exception 'Your team already has a pending request'; end if;
  insert into public.team_change_requests(team_id,member,reason) values(t.id,m2,trim(payload->>'reason'));

 elsif action='save_config' then
  n:=payload->'config';
  if jsonb_typeof(n) is distinct from 'object' then raise exception 'Invalid configuration'; end if;
  n:=c||n;
  -- The publication gate cannot be bypassed through the CMS.
  n:=jsonb_set(n,'{published}',c->'published');
  if (c->>'published')::boolean and n->'tiebreak' is distinct from c->'tiebreak' then raise exception 'Unpublish results before changing tie-break rules'; end if;
  if jsonb_typeof(n->'tiebreak') is distinct from 'array' then raise exception 'Invalid tie-break order'; end if;
  if jsonb_array_length(n->'tiebreak')<>3 or (select count(distinct value) from jsonb_array_elements_text(n->'tiebreak'))<>3 or exists(select 1 from jsonb_array_elements_text(n->'tiebreak') a where a.value not in ('1','2','3')) then raise exception 'Tie-break order must be a permutation of 1, 2, 3'; end if;
  foreach k in array array['name','logo_name','tagline','college','edition','venue','browser_title','about_title','about','description','register_label','explore_label'] loop
   if jsonb_typeof(n->k) is distinct from 'string' or length(n->>k)>10000 then raise exception 'Invalid content field: %',k; end if;
  end loop;
  if trim(n->>'name')='' or (n->>'edition') !~ '^[A-Za-z0-9-]{1,16}$' then raise exception 'Use an event name and an alphanumeric edition'; end if;
  if (n->>'capacity')::integer<1 or (n->>'capacity')::integer<(select count(*) from public.teams) or (n->>'capacity')::integer>10000 then raise exception 'Capacity must cover existing teams and be at most 10000'; end if;
  if (n->>'radius')::integer not between 0 and 40 then raise exception 'Button radius must be between 0 and 40'; end if;
  foreach k in array array['starts_at','opens_at','deadline','checkin_open','checkin_close','results_time'] loop
   if n->>k is null then raise exception 'Missing event time'; end if;
   perform (n->>k)::timestamptz;
  end loop;
  if (n->>'opens_at')::timestamptz >= (n->>'deadline')::timestamptz or (n->>'checkin_open')::timestamptz >= (n->>'checkin_close')::timestamptz then raise exception 'Opening time must be before closing time'; end if;
  if not exists(select 1 from pg_timezone_names where name=n->>'timezone') then raise exception 'Use a valid IANA timezone'; end if;
  if n->>'theme' not in ('dark','light') or n->>'leaderboard' not in ('hidden','admin','public','after-results') or n->>'after_countdown' not in ('hide','EVENT IS LIVE','EVENT COMPLETED') then raise exception 'Invalid theme, countdown, or leaderboard setting'; end if;
  foreach k in array array['objectives','benefits','steps','rules','nav'] loop
   if jsonb_typeof(n->k) is distinct from 'array' then raise exception 'Content lists must be arrays'; end if;
   if jsonb_array_length(n->k)>100 then raise exception 'Maximum 100 items per content list'; end if;
   if exists(select 1 from jsonb_array_elements(n->k) x where jsonb_typeof(x->'title') is distinct from 'string' or jsonb_typeof(x->'description') is distinct from 'string' or jsonb_typeof(x->'icon') is distinct from 'string' or jsonb_typeof(x->'visible') is distinct from 'boolean') then raise exception 'Invalid content item'; end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(n->'nav') x where x->>'description' not in ('home','about','levels','rules')) then raise exception 'Navigation anchors must be home, about, levels, or rules'; end if;
  foreach k in array array['logo_url','hero_image','favicon','banner'] loop
   if coalesce(n->>k,'')<>'' and (n->>k) !~ '^https://' then raise exception 'Production asset URLs must use HTTPS'; end if;
  end loop;
  if jsonb_typeof(n->'colors') is distinct from 'object' then raise exception 'Invalid colors'; end if;
  if exists(select 1 from jsonb_each_text(n->'colors') a where a.value !~ '^#[0-9a-fA-F]{6}$') then raise exception 'Colors must be six-digit hex values'; end if;
  if jsonb_typeof(n->'level_starts') is distinct from 'array' or jsonb_array_length(n->'level_starts')<>3 then raise exception 'Provide three level schedule times'; end if;
  for k in select jsonb_array_elements_text(n->'level_starts') loop perform k::timestamptz; end loop;
  update public.events set config=n where id=1;

 elsif action='save_level' then
  lid:=(payload->'level'->>'id')::integer;
  select data into l from public.levels where id=lid;
  if not found then raise exception 'Level not found'; end if;
  n:=payload->'level';
  if (n->>'maximum')::numeric<1 or (n->>'maximum')::numeric>100000 or (n->>'minutes')::integer not between 1 and 1440 or length(trim(n->>'name'))<1 then raise exception 'Invalid level limits or name'; end if;
  if exists(select 1 from public.scores where level_id=lid and score>(n->>'maximum')::numeric) then raise exception 'Maximum cannot be lower than an existing score'; end if;
  foreach k in array array['name','short','description','instructions','rules','difficulty'] loop
   if jsonb_typeof(n->k) is distinct from 'string' then raise exception 'Level text fields must be strings'; end if;
  end loop;
  if jsonb_typeof(n->'visible') is distinct from 'boolean' then raise exception 'Visibility must be true or false'; end if;
  n:=n||jsonb_build_object('status',l->>'status','started_at',l->'started_at','remaining',case when l->>'status'='upcoming' then (n->>'minutes')::integer*60 else (l->>'remaining')::integer end);
  update public.levels set data=n where id=lid;

 elsif action='level_control' then
  lid:=(payload->>'id')::integer;
  select data into l from public.levels where id=lid;
  if not found then raise exception 'Level not found'; end if;
  old_status:=l->>'status';
  if payload->>'command'='start' and old_status='upcoming' then
   if exists(select 1 from public.levels where id<>lid and data->>'status' in ('active','paused')) then raise exception 'Complete the current level first'; end if;
   if exists(select 1 from public.levels where id<lid and data->>'status'<>'completed') then raise exception 'Complete earlier levels first'; end if;
   l:=l||jsonb_build_object('status','active','started_at',now(),'remaining',(l->>'minutes')::integer*60);
  elsif payload->>'command'='pause' and old_status='active' then
   remaining_seconds:=greatest(0,ceil((l->>'remaining')::numeric-extract(epoch from now()-(l->>'started_at')::timestamptz))::integer);
   l:=l||jsonb_build_object('status','paused','remaining',remaining_seconds,'started_at',null);
  elsif payload->>'command'='resume' and old_status='paused' then
   l:=l||jsonb_build_object('status','active','started_at',now());
  elsif payload->>'command'='end' and old_status in ('active','paused') then
   l:=l||jsonb_build_object('status','completed','remaining',0,'started_at',null);
  else raise exception 'Invalid level transition'; end if;
  update public.levels set data=l where id=lid;

 elsif action='checkin' then
  select * into t from public.teams where id=(payload->>'id')::uuid;
  if not found or t.status<>'confirmed' then raise exception 'Team is not confirmed'; end if;
  if now()<(c->>'checkin_open')::timestamptz or now()>(c->>'checkin_close')::timestamptz then raise exception 'Outside the check-in window'; end if;
  if exists(select 1 from public.attendance where team_id=t.id) then raise exception 'Team already checked in'; end if;
  insert into public.attendance(team_id,checked_in_by) values(t.id,uid);

 elsif action='score' then
  if (c->>'published')::boolean then raise exception 'Unpublish results before editing scores'; end if;
  select * into t from public.teams where id=(payload->>'id')::uuid;
  if not found or t.status<>'confirmed' or not exists(select 1 from public.attendance where team_id=t.id) then raise exception 'Only checked-in confirmed teams can be scored'; end if;
  arr:=payload->'scores';
  if jsonb_typeof(arr) is distinct from 'array' then raise exception 'Three scores are required'; end if;
  if jsonb_array_length(arr)<>3 then raise exception 'Three scores are required'; end if;
  for lid in 1..3 loop
   if jsonb_typeof(arr->(lid-1)) is distinct from 'number' then raise exception 'All scores must be numeric'; end if;
   val:=(arr->>(lid-1))::numeric;
   if mod(val,1)<>0 or val<0 or val>(select (data->>'maximum')::numeric from public.levels where id=lid) then raise exception 'Score outside level range'; end if;
   insert into public.scores(team_id,level_id,score,entered_by) values(t.id,lid,val,uid)
    on conflict(team_id,level_id) do update set score=excluded.score,entered_by=excluded.entered_by,updated_at=now();
  end loop;
  if payload->>'tie_order' is not null and (payload->>'tie_order') !~ '^[1-9][0-9]*$' then raise exception 'Tie order must be a positive integer'; end if;
  update public.teams set tie_order=(payload->>'tie_order')::integer where id=t.id;

 elsif action='team_status' then
  if (c->>'published')::boolean then raise exception 'Unpublish results before changing team eligibility'; end if;
  if payload->>'status' not in ('confirmed','disqualified') then raise exception 'Invalid team status'; end if;
  update public.teams set status=payload->>'status' where id=(payload->>'id')::uuid;
  if not found then raise exception 'Team not found'; end if;

 elsif action='review_change' then
  select * into r from public.team_change_requests where id=(payload->>'id')::uuid for update;
  if not found or r.status<>'pending' then raise exception 'Pending request not found'; end if;
  if (payload->>'approve')::boolean then
   m2:=public.validate_member(r.member);
   select * into t from public.teams where id=r.team_id;
   -- Unique member registry also checks the leader and all other teams.
   if exists(select 1 from public.team_members where (team_id<>t.id or position=1) and (email=m2->>'email' or college_id=lower(m2->>'college_id'))) then raise exception 'Participant already registered'; end if;
   update public.teams set members=jsonb_build_array(t.members->0,m2) where id=t.id;
   update public.team_change_requests set status='approved' where id=r.id;
  else update public.team_change_requests set status='rejected' where id=r.id;
  end if;

 elsif action='announcement' then
  n:=payload->'item';
  if length(trim(coalesce(n->>'title',''))) not between 1 and 180 or length(trim(coalesce(n->>'message',''))) not between 1 and 10000 then raise exception 'Title and message are required'; end if;
  if n->>'audience' not in ('everyone','checked-in','team') then raise exception 'Invalid audience'; end if;
  insert into public.announcements(id,title,message,audience,team_id,published,publish_at)
  values(coalesce(nullif(n->>'id','')::uuid,gen_random_uuid()),trim(n->>'title'),n->>'message',n->>'audience',case when n->>'audience'='team' then nullif(n->>'team_id','')::uuid else null end,(n->>'published')::boolean,(n->>'publish_at')::timestamptz)
  on conflict(id) do update set title=excluded.title,message=excluded.message,audience=excluded.audience,team_id=excluded.team_id,published=excluded.published,publish_at=excluded.publish_at;

 elsif action='delete_announcement' then
  delete from public.announcements where id=(payload->>'id')::uuid;

 elsif action='publish' then
  if (payload->>'published')::boolean then
   if not exists(select 1 from public.teams where status='confirmed') then raise exception 'No eligible teams'; end if;
   if exists(select 1 from public.levels where data->>'status'<>'completed') or (select count(*) from public.levels)<>3 then raise exception 'Complete all three levels first'; end if;
   if exists(select 1 from public.teams t where t.status='confirmed' and ((select count(*) from public.scores s where s.team_id=t.id)<>3 or not exists(select 1 from public.attendance a where a.team_id=t.id))) then raise exception 'Every confirmed team needs attendance and three scores. Disqualify absent teams.'; end if;
   ranks:=public.ranked_teams();
   if exists(select 1 from jsonb_array_elements(ranks) x group by x->>'rank' having count(*)>1) then raise exception 'Resolve exact ties with manual tie-order values'; end if;
  end if;
  if jsonb_typeof(payload->'published') is distinct from 'boolean' then raise exception 'Invalid publication state'; end if;
  update public.events set config=jsonb_set(config,'{published}',payload->'published') where id=1;
 else raise exception 'Unknown action';
 end if;
 insert into public.activity_logs(actor_id,action) values(uid,action);
end $$;

-- Revoke PostgreSQL's default PUBLIC execution grant for all application functions.
revoke all on function public.is_admin(),public.owns_team(uuid),public.on_new_user(),public.sync_members(),public.validate_member(jsonb),public.score_guard(),public.ranked_teams(),public.get_state(),public.mutate(text,jsonb) from public,anon,authenticated;
grant execute on function public.is_admin(),public.owns_team(uuid),public.get_state() to anon,authenticated;
grant execute on function public.mutate(text,jsonb) to authenticated;

-- Admin-managed public event assets, maximum 5 MB. No SVG/HTML uploads.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('event-assets','event-assets',true,5242880,array['image/png','image/jpeg','image/webp','image/gif','image/x-icon','image/vnd.microsoft.icon']) on conflict(id) do nothing;
create policy event_assets_read on storage.objects for select using(bucket_id='event-assets');
create policy event_assets_insert on storage.objects for insert to authenticated with check(bucket_id='event-assets' and public.is_admin());
create policy event_assets_update on storage.objects for update to authenticated using(bucket_id='event-assets' and public.is_admin()) with check(bucket_id='event-assets' and public.is_admin());
create policy event_assets_delete on storage.objects for delete to authenticated using(bucket_id='event-assets' and public.is_admin());
commit;
