
create extension if not exists btree_gist;

create type public.member_role as enum ('admin','manager','receptionist','professional');
create type public.appt_status as enum ('scheduled','confirmed','completed','cancelled','no_show');

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text, phone text, created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile upd" on public.profiles for update to authenticated using (id = auth.uid());
create policy "own profile ins" on public.profiles for insert to authenticated with check (id = auth.uid());

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- COMPANIES
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null, slug text not null unique,
  phone text, address text, accent_color text default '#c9a227',
  opening_time text not null default '08:00', closing_time text not null default '20:00',
  slot_minutes int not null default 15,
  created_at timestamptz not null default now()
);
create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null,
  role public.member_role not null default 'professional',
  professional_id uuid,
  created_at timestamptz not null default now(),
  unique(company_id, user_id)
);
grant select, insert, update, delete on public.companies, public.company_members to authenticated;
grant all on public.companies, public.company_members to service_role;

create or replace function public.is_member(_company uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from company_members where company_id=_company and user_id=auth.uid())
$$;
create or replace function public.has_crole(_company uuid, _roles public.member_role[]) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from company_members where company_id=_company and user_id=auth.uid() and role = any(_roles))
$$;

alter table public.companies enable row level security;
alter table public.company_members enable row level security;
create policy "members read company" on public.companies for select to authenticated using (public.is_member(id));
create policy "admins update company" on public.companies for update to authenticated using (public.has_crole(id, array['admin','manager']::public.member_role[]));
create policy "members read members" on public.company_members for select to authenticated using (public.is_member(company_id));
create policy "admin manage members ins" on public.company_members for insert to authenticated with check (public.has_crole(company_id, array['admin']::public.member_role[]));
create policy "admin manage members upd" on public.company_members for update to authenticated using (public.has_crole(company_id, array['admin']::public.member_role[]));
create policy "admin manage members del" on public.company_members for delete to authenticated using (public.has_crole(company_id, array['admin']::public.member_role[]) and user_id <> auth.uid());

-- Generic helper to create standard tenant tables policies
create or replace function public._tenant_policies(_t text, _write_roles text) returns void language plpgsql as $$
begin
  execute format('grant select, insert, update, delete on public.%I to authenticated', _t);
  execute format('grant all on public.%I to service_role', _t);
  execute format('alter table public.%I enable row level security', _t);
  execute format('create policy "tenant read" on public.%I for select to authenticated using (public.is_member(company_id))', _t);
  execute format('create policy "tenant ins" on public.%I for insert to authenticated with check (public.has_crole(company_id, %L::public.member_role[]))', _t, _write_roles);
  execute format('create policy "tenant upd" on public.%I for update to authenticated using (public.has_crole(company_id, %L::public.member_role[]))', _t, _write_roles);
  execute format('create policy "tenant del" on public.%I for delete to authenticated using (public.has_crole(company_id, %L::public.member_role[]))', _t, _write_roles);
end $$;

create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null, phone text, email text, photo_url text, color text default '#c9a227',
  default_commission_pct numeric(5,2) not null default 40,
  monthly_goal numeric(12,2) default 0,
  work_hours jsonb not null default '[{"weekday":1,"start":"09:00","end":"18:00","break_start":"12:00","break_end":"13:00"},{"weekday":2,"start":"09:00","end":"18:00","break_start":"12:00","break_end":"13:00"},{"weekday":3,"start":"09:00","end":"18:00","break_start":"12:00","break_end":"13:00"},{"weekday":4,"start":"09:00","end":"18:00","break_start":"12:00","break_end":"13:00"},{"weekday":5,"start":"09:00","end":"18:00","break_start":"12:00","break_end":"13:00"},{"weekday":6,"start":"09:00","end":"14:00"}]',
  active boolean not null default true, online_booking boolean not null default true,
  created_at timestamptz not null default now()
);
select public._tenant_policies('professionals','{admin,manager}');

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null, type text not null, active boolean not null default true, notes text,
  created_at timestamptz not null default now()
);
select public._tenant_policies('resources','{admin,manager}');

create table public.services (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null, description text, category text default 'Geral',
  price numeric(12,2) not null default 0 check (price >= 0),
  commission_pct numeric(5,2), commission_fixed numeric(12,2),
  buffer_after_min int not null default 0,
  online_booking boolean not null default true, active boolean not null default true,
  created_at timestamptz not null default now()
);
select public._tenant_policies('services','{admin,manager}');

create table public.service_steps (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  position int not null default 0, name text not null,
  duration_min int not null check (duration_min > 0),
  occupies_professional boolean not null default true,
  resource_type text
);
select public._tenant_policies('service_steps','{admin,manager}');

create table public.service_professionals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  commission_pct numeric(5,2), commission_fixed numeric(12,2),
  unique(service_id, professional_id)
);
select public._tenant_policies('service_professionals','{admin,manager}');

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null, phone text, whatsapp text, email text, birth_date date, notes text,
  consent_marketing boolean not null default false, consent_reminders boolean not null default true,
  preferred_professional_id uuid references public.professionals(id) on delete set null,
  return_reminder_days int,
  created_at timestamptz not null default now()
);
create index on public.clients(company_id, phone);
select public._tenant_policies('clients','{admin,manager,receptionist,professional}');

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  professional_id uuid references public.professionals(id) on delete set null,
  start_at timestamptz not null, end_at timestamptz not null,
  status public.appt_status not null default 'scheduled',
  source text not null default 'manual', notes text, is_fit_in boolean not null default false,
  recurrence_group uuid, cancel_reason text, total_price numeric(12,2) not null default 0,
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.appointments(company_id, start_at);
select public._tenant_policies('appointments','{admin,manager,receptionist,professional}');

create table public.appointment_services (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  professional_id uuid references public.professionals(id) on delete set null,
  name text not null, price numeric(12,2) not null default 0,
  start_at timestamptz not null, end_at timestamptz not null
);
select public._tenant_policies('appointment_services','{admin,manager,receptionist,professional}');

-- Segments: the real occupancy. DB-level exclusion prevents double booking.
create table public.schedule_segments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  appointment_service_id uuid references public.appointment_services(id) on delete cascade,
  kind text not null default 'step', -- step | block
  label text,
  professional_id uuid references public.professionals(id) on delete cascade,
  resource_id uuid references public.resources(id) on delete cascade,
  occupies_professional boolean not null default true,
  start_at timestamptz not null, end_at timestamptz not null check (end_at > start_at),
  active boolean not null default true,
  period tstzrange generated always as (tstzrange(start_at, end_at, '[)')) stored
);
alter table public.schedule_segments add constraint no_prof_overlap exclude using gist (professional_id with =, period with &&) where (active and occupies_professional and professional_id is not null);
alter table public.schedule_segments add constraint no_resource_overlap exclude using gist (resource_id with =, period with &&) where (active and resource_id is not null);
create index on public.schedule_segments(company_id, start_at);
select public._tenant_policies('schedule_segments','{admin,manager,receptionist}');

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_name text not null, phone text, service_id uuid references public.services(id) on delete set null,
  professional_id uuid references public.professionals(id) on delete set null,
  preferred_date date, notes text, status text not null default 'waiting',
  created_at timestamptz not null default now()
);
select public._tenant_policies('waitlist','{admin,manager,receptionist}');

-- PRODUCTS & STOCK
create table public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null, sku text, category text, supplier text, kind text not null default 'retail',
  cost numeric(12,2) not null default 0, price numeric(12,2) not null default 0,
  commission_pct numeric(5,2) default 10,
  quantity numeric(12,3) not null default 0, min_quantity numeric(12,3) not null default 0,
  unit text default 'un', expiry_date date, active boolean not null default true,
  created_at timestamptz not null default now()
);
select public._tenant_policies('products','{admin,manager}');

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  type text not null, quantity numeric(12,3) not null, reason text, sale_id uuid,
  created_by uuid default auth.uid(), created_at timestamptz not null default now()
);
select public._tenant_policies('stock_movements','{admin,manager,receptionist}');

create or replace function public.apply_stock_movement() returns trigger language plpgsql security definer set search_path=public as $$
declare q numeric; p record;
begin
  q := case when new.type in ('in','adjust_in','refund') then new.quantity else -new.quantity end;
  update products set quantity = quantity + q where id = new.product_id returning * into p;
  if p.quantity <= p.min_quantity then
    insert into notifications(company_id, type, title, body) values (p.company_id, 'low_stock', 'Estoque baixo', p.name || ': ' || p.quantity || ' ' || coalesce(p.unit,''));
  end if;
  return new;
end $$;

create table public.service_supplies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity numeric(12,3) not null check (quantity > 0),
  unique(service_id, product_id)
);
select public._tenant_policies('service_supplies','{admin,manager}');

-- FINANCE
create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null, kind text not null default 'other',
  fee_pct numeric(6,3) not null default 0, fee_fixed numeric(12,2) not null default 0,
  installment_fee_pct numeric(6,3) not null default 0,
  anticipation_pct numeric(6,3) not null default 0,
  receive_days int not null default 0, active boolean not null default true
);
select public._tenant_policies('payment_methods','{admin,manager}');

create table public.cash_registers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null default 'Caixa principal', shared boolean not null default true,
  opened_by uuid default auth.uid(), opened_at timestamptz not null default now(),
  opening_balance numeric(12,2) not null default 0,
  closed_by uuid, closed_at timestamptz, expected_cash numeric(12,2), counted_cash numeric(12,2),
  difference numeric(12,2), justification text, status text not null default 'open'
);
create unique index one_open_register on public.cash_registers(company_id, name) where status='open';
select public._tenant_policies('cash_registers','{admin,manager,receptionist}');

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  appointment_id uuid unique references public.appointments(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  register_id uuid references public.cash_registers(id),
  subtotal numeric(12,2) not null, discount numeric(12,2) not null default 0, tip numeric(12,2) not null default 0,
  total numeric(12,2) not null, fees numeric(12,2) not null default 0, net numeric(12,2) not null,
  status text not null default 'completed', refund_reason text,
  created_by uuid default auth.uid(), created_at timestamptz not null default now()
);
select public._tenant_policies('sales','{admin,manager}');

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  kind text not null, service_id uuid, product_id uuid, professional_id uuid,
  description text not null, quantity numeric(12,3) not null default 1,
  unit_price numeric(12,2) not null, discount numeric(12,2) not null default 0, total numeric(12,2) not null
);
select public._tenant_policies('sale_items','{admin,manager}');

create table public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  payment_method_id uuid references public.payment_methods(id),
  method_name text not null, method_kind text not null,
  amount numeric(12,2) not null, installments int not null default 1,
  fee_amount numeric(12,2) not null default 0, net_amount numeric(12,2) not null, expected_date date
);
select public._tenant_policies('sale_payments','{admin,manager}');

create table public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  register_id uuid not null references public.cash_registers(id) on delete cascade,
  type text not null, -- sale | withdrawal | supply | expense | income | refund
  method_kind text not null default 'cash',
  amount numeric(12,2) not null, description text, sale_id uuid references public.sales(id) on delete set null,
  created_by uuid default auth.uid(), created_at timestamptz not null default now()
);
select public._tenant_policies('cash_movements','{admin,manager,receptionist}');

create table public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  type text not null, -- receivable | payable
  category text not null default 'Geral', description text not null,
  amount numeric(12,2) not null check (amount >= 0), due_date date not null,
  paid_at timestamptz, status text not null default 'open',
  sale_id uuid references public.sales(id) on delete cascade, sale_payment_id uuid unique references public.sale_payments(id) on delete cascade,
  created_at timestamptz not null default now()
);
select public._tenant_policies('financial_entries','{admin,manager}');

create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  sale_item_id uuid not null references public.sale_items(id) on delete cascade,
  professional_id uuid not null references public.professionals(id),
  base_amount numeric(12,2) not null, rate_pct numeric(6,2) not null default 0, fixed_amount numeric(12,2) not null default 0,
  amount numeric(12,2) not null, rule jsonb not null default '{}',
  status text not null default 'pending', paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique(sale_item_id, professional_id)
);
select public._tenant_policies('commissions','{admin,manager}');

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid, type text not null, title text not null, body text,
  read_at timestamptz, created_at timestamptz not null default now()
);
select public._tenant_policies('notifications','{admin,manager,receptionist,professional}');

create trigger trg_stock after insert on public.stock_movements for each row execute function public.apply_stock_movement();

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid, action text not null, entity text not null, entity_id uuid, data jsonb,
  created_at timestamptz not null default now()
);
grant select on public.audit_logs to authenticated; grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy "admins read audit" on public.audit_logs for select to authenticated using (public.has_crole(company_id, array['admin','manager']::public.member_role[]));

create or replace function public.audit_trigger() returns trigger language plpgsql security definer set search_path=public as $$
declare r jsonb;
begin
  r := case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  insert into audit_logs(company_id, user_id, action, entity, entity_id, data)
  values ((r->>'company_id')::uuid, auth.uid(), lower(tg_op), tg_table_name, (r->>'id')::uuid,
    case when tg_op='UPDATE' then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new)) else r end);
  return null;
end $$;
do $$ declare t text; begin
  foreach t in array array['appointments','sales','cash_registers','cash_movements','commissions','financial_entries','services','professionals','company_members','products','payment_methods'] loop
    execute format('create trigger audit_%s after insert or update or delete on public.%I for each row execute function public.audit_trigger()', t, t);
  end loop;
end $$;

-- Appointment notifications
create or replace function public.appt_notify() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    insert into notifications(company_id,type,title,body) values (new.company_id,'appointment_new','Novo agendamento', to_char(new.start_at at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') || ' • origem: ' || new.source);
  elsif new.status='cancelled' and old.status<>'cancelled' then
    insert into notifications(company_id,type,title,body) values (new.company_id,'appointment_cancelled','Agendamento cancelado', to_char(new.start_at at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI'));
  elsif new.start_at <> old.start_at then
    insert into notifications(company_id,type,title,body) values (new.company_id,'appointment_moved','Agendamento reagendado', 'Novo horário: ' || to_char(new.start_at at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI'));
  end if;
  return new;
end $$;
create trigger appt_notify after insert or update on public.appointments for each row execute function public.appt_notify();

-- ===== RPCs =====
create or replace function public.create_company(_name text, _slug text) returns uuid language plpgsql security definer set search_path=public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  if _slug !~ '^[a-z0-9-]{3,40}$' then raise exception 'Link inválido: use letras minúsculas, números e hífen (3 a 40)'; end if;
  insert into companies(name, slug) values (_name, _slug) returning id into cid;
  insert into company_members(company_id, user_id, role) values (cid, auth.uid(), 'admin');
  insert into payment_methods(company_id,name,kind,fee_pct,receive_days) values
    (cid,'Dinheiro','cash',0,0),(cid,'Pix','pix',0,0),(cid,'Débito','debit',1.99,1),(cid,'Crédito à vista','credit',3.49,30);
  return cid;
end $$;
revoke execute on function public.create_company from anon, public;
grant execute on function public.create_company to authenticated;

-- book: p = {company_id, client_id, professional_id, start_at, end_at, source, notes, is_fit_in, recurrence_group, created_by,
--   services:[{service_id, professional_id, name, price, start_at, end_at, segments:[{label,professional_id,resource_id,occupies_professional,start_at,end_at}]}]}
create or replace function public.book_appointment(p jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare aid uuid; asid uuid; s jsonb; g jsonb; cid uuid := (p->>'company_id')::uuid; total numeric := 0;
begin
  if auth.uid() is not null and not public.has_crole(cid, array['admin','manager','receptionist','professional']::member_role[]) then
    raise exception 'Sem permissão';
  end if;
  select coalesce(sum((x->>'price')::numeric),0) into total from jsonb_array_elements(p->'services') x;
  insert into appointments(company_id, client_id, professional_id, start_at, end_at, source, notes, is_fit_in, recurrence_group, total_price, created_by)
  values (cid, (p->>'client_id')::uuid, (p->>'professional_id')::uuid, (p->>'start_at')::timestamptz, (p->>'end_at')::timestamptz,
    coalesce(p->>'source','manual'), p->>'notes', coalesce((p->>'is_fit_in')::boolean,false), (p->>'recurrence_group')::uuid, total, auth.uid())
  returning id into aid;
  for s in select * from jsonb_array_elements(p->'services') loop
    insert into appointment_services(company_id, appointment_id, service_id, professional_id, name, price, start_at, end_at)
    values (cid, aid, (s->>'service_id')::uuid, (s->>'professional_id')::uuid, s->>'name', (s->>'price')::numeric, (s->>'start_at')::timestamptz, (s->>'end_at')::timestamptz)
    returning id into asid;
    for g in select * from jsonb_array_elements(s->'segments') loop
      insert into schedule_segments(company_id, appointment_id, appointment_service_id, kind, label, professional_id, resource_id, occupies_professional, start_at, end_at)
      values (cid, aid, asid, 'step', g->>'label', (g->>'professional_id')::uuid, (g->>'resource_id')::uuid, coalesce((g->>'occupies_professional')::boolean,true), (g->>'start_at')::timestamptz, (g->>'end_at')::timestamptz);
    end loop;
  end loop;
  return aid;
exception when exclusion_violation then
  raise exception 'Conflito de horário: profissional ou recurso já ocupado neste período' using errcode = 'P0001';
end $$;
revoke execute on function public.book_appointment from anon, public;
grant execute on function public.book_appointment to authenticated, service_role;

-- reschedule: replaces services/segments atomically
create or replace function public.reschedule_appointment(_id uuid, p jsonb) returns void language plpgsql security definer set search_path=public as $$
declare a appointments; s jsonb; g jsonb; asid uuid;
begin
  select * into a from appointments where id=_id for update;
  if a.id is null then raise exception 'Agendamento não encontrado'; end if;
  if auth.uid() is not null and not public.has_crole(a.company_id, array['admin','manager','receptionist']::member_role[]) then raise exception 'Sem permissão'; end if;
  if a.status in ('completed','cancelled') then raise exception 'Agendamento não pode ser alterado'; end if;
  delete from appointment_services where appointment_id=_id;
  update appointments set start_at=(p->>'start_at')::timestamptz, end_at=(p->>'end_at')::timestamptz,
    professional_id=(p->>'professional_id')::uuid, updated_at=now() where id=_id;
  for s in select * from jsonb_array_elements(p->'services') loop
    insert into appointment_services(company_id, appointment_id, service_id, professional_id, name, price, start_at, end_at)
    values (a.company_id, _id, (s->>'service_id')::uuid, (s->>'professional_id')::uuid, s->>'name', (s->>'price')::numeric, (s->>'start_at')::timestamptz, (s->>'end_at')::timestamptz)
    returning id into asid;
    for g in select * from jsonb_array_elements(s->'segments') loop
      insert into schedule_segments(company_id, appointment_id, appointment_service_id, kind, label, professional_id, resource_id, occupies_professional, start_at, end_at)
      values (a.company_id, _id, asid, 'step', g->>'label', (g->>'professional_id')::uuid, (g->>'resource_id')::uuid, coalesce((g->>'occupies_professional')::boolean,true), (g->>'start_at')::timestamptz, (g->>'end_at')::timestamptz);
    end loop;
  end loop;
exception when exclusion_violation then
  raise exception 'Conflito de horário: profissional ou recurso já ocupado neste período' using errcode = 'P0001';
end $$;
revoke execute on function public.reschedule_appointment from anon, public;
grant execute on function public.reschedule_appointment to authenticated, service_role;

create or replace function public.set_appointment_status(_id uuid, _status public.appt_status, _reason text default null) returns void language plpgsql security definer set search_path=public as $$
declare a appointments;
begin
  select * into a from appointments where id=_id for update;
  if a.id is null then raise exception 'Agendamento não encontrado'; end if;
  if auth.uid() is not null and not public.has_crole(a.company_id, array['admin','manager','receptionist','professional']::member_role[]) then raise exception 'Sem permissão'; end if;
  if a.status='completed' then raise exception 'Atendimento já finalizado'; end if;
  if _status='completed' then raise exception 'Use a finalização do atendimento'; end if;
  update appointments set status=_status, cancel_reason=coalesce(_reason,cancel_reason), updated_at=now() where id=_id;
  if _status in ('cancelled','no_show') then update schedule_segments set active=false where appointment_id=_id; end if;
end $$;
revoke execute on function public.set_appointment_status from anon, public;
grant execute on function public.set_appointment_status to authenticated, service_role;

-- record_sale: atomic finalization. Values precomputed + validated by server function.
create or replace function public.record_sale(p jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare sid uuid; cid uuid := (p->>'company_id')::uuid; it jsonb; pay jsonb; c jsonb; iid uuid; pid uuid; reg uuid; sup record; idx int := 0; ids uuid[] := '{}';
begin
  if not public.has_crole(cid, array['admin','manager','receptionist']::member_role[]) then raise exception 'Sem permissão'; end if;
  select id into reg from cash_registers where company_id=cid and status='open' order by opened_at desc limit 1;
  if reg is null then raise exception 'Abra o caixa antes de finalizar a venda'; end if;
  if p->>'appointment_id' is not null then
    perform 1 from appointments where id=(p->>'appointment_id')::uuid and company_id=cid and status not in ('completed','cancelled') for update;
    if not found then raise exception 'Atendimento já finalizado ou cancelado'; end if;
  end if;
  insert into sales(company_id, appointment_id, client_id, register_id, subtotal, discount, tip, total, fees, net)
  values (cid, (p->>'appointment_id')::uuid, (p->>'client_id')::uuid, reg, (p->>'subtotal')::numeric, (p->>'discount')::numeric, (p->>'tip')::numeric, (p->>'total')::numeric, (p->>'fees')::numeric, (p->>'net')::numeric)
  returning id into sid;
  for it in select * from jsonb_array_elements(p->'items') loop
    insert into sale_items(company_id, sale_id, kind, service_id, product_id, professional_id, description, quantity, unit_price, discount, total)
    values (cid, sid, it->>'kind', (it->>'service_id')::uuid, (it->>'product_id')::uuid, (it->>'professional_id')::uuid, it->>'description', (it->>'quantity')::numeric, (it->>'unit_price')::numeric, (it->>'discount')::numeric, (it->>'total')::numeric)
    returning id into iid;
    ids := ids || iid;
    if it->>'kind'='product' then
      insert into stock_movements(company_id, product_id, type, quantity, reason, sale_id) values (cid, (it->>'product_id')::uuid, 'sale', (it->>'quantity')::numeric, 'Venda', sid);
    elsif it->>'kind'='service' then
      for sup in select * from service_supplies where service_id=(it->>'service_id')::uuid loop
        insert into stock_movements(company_id, product_id, type, quantity, reason, sale_id) values (cid, sup.product_id, 'consumption', sup.quantity * (it->>'quantity')::numeric, 'Insumo: ' || (it->>'description'), sid);
      end loop;
    end if;
    for c in select * from jsonb_array_elements(coalesce(it->'commissions','[]')) loop
      insert into commissions(company_id, sale_id, sale_item_id, professional_id, base_amount, rate_pct, fixed_amount, amount, rule)
      values (cid, sid, iid, (c->>'professional_id')::uuid, (c->>'base_amount')::numeric, (c->>'rate_pct')::numeric, (c->>'fixed_amount')::numeric, (c->>'amount')::numeric, coalesce(c->'rule','{}'));
    end loop;
  end loop;
  for pay in select * from jsonb_array_elements(p->'payments') loop
    insert into sale_payments(company_id, sale_id, payment_method_id, method_name, method_kind, amount, installments, fee_amount, net_amount, expected_date)
    values (cid, sid, (pay->>'payment_method_id')::uuid, pay->>'method_name', pay->>'method_kind', (pay->>'amount')::numeric, (pay->>'installments')::int, (pay->>'fee_amount')::numeric, (pay->>'net_amount')::numeric, (pay->>'expected_date')::date)
    returning id into pid;
    insert into cash_movements(company_id, register_id, type, method_kind, amount, description, sale_id) values (cid, reg, 'sale', pay->>'method_kind', (pay->>'amount')::numeric, 'Venda • ' || (pay->>'method_name'), sid);
    if (pay->>'method_kind') in ('credit','debit') then
      insert into financial_entries(company_id, type, category, description, amount, due_date, status, sale_id, sale_payment_id)
      values (cid, 'receivable', 'Cartões', 'Recebível ' || (pay->>'method_name'), (pay->>'net_amount')::numeric, (pay->>'expected_date')::date, 'open', sid, pid);
    end if;
  end loop;
  if p->>'appointment_id' is not null then
    update appointments set status='completed', updated_at=now() where id=(p->>'appointment_id')::uuid;
  end if;
  return sid;
end $$;
revoke execute on function public.record_sale from anon, public;
grant execute on function public.record_sale to authenticated;

create or replace function public.refund_sale(_id uuid, _reason text) returns void language plpgsql security definer set search_path=public as $$
declare s sales; reg uuid; m record;
begin
  select * into s from sales where id=_id for update;
  if s.id is null then raise exception 'Venda não encontrada'; end if;
  if not public.has_crole(s.company_id, array['admin','manager']::member_role[]) then raise exception 'Sem permissão'; end if;
  if s.status='refunded' then raise exception 'Venda já estornada'; end if;
  select id into reg from cash_registers where company_id=s.company_id and status='open' order by opened_at desc limit 1;
  if reg is null then raise exception 'Abra o caixa para registrar o estorno'; end if;
  update sales set status='refunded', refund_reason=_reason where id=_id;
  update commissions set status='cancelled' where sale_id=_id and status in ('pending','approved');
  if exists(select 1 from commissions where sale_id=_id and status='paid') then
    insert into notifications(company_id,type,title,body) values (s.company_id,'commission_refund','Comissão paga em venda estornada','Revise o ajuste com o profissional.');
  end if;
  update financial_entries set status='cancelled' where sale_id=_id and status='open';
  for m in select * from sale_payments where sale_id=_id loop
    insert into cash_movements(company_id, register_id, type, method_kind, amount, description, sale_id) values (s.company_id, reg, 'refund', m.method_kind, -m.amount, 'Estorno • ' || m.method_name, _id);
  end loop;
  insert into stock_movements(company_id, product_id, type, quantity, reason, sale_id)
    select s.company_id, product_id, 'refund', quantity, 'Estorno', _id from sale_items where sale_id=_id and kind='product';
end $$;
revoke execute on function public.refund_sale from anon, public;
grant execute on function public.refund_sale to authenticated;

create or replace function public.close_cash_register(_id uuid, _counted numeric, _justification text) returns jsonb language plpgsql security definer set search_path=public as $$
declare r cash_registers; exp numeric; diff numeric;
begin
  select * into r from cash_registers where id=_id for update;
  if r.id is null or r.status<>'open' then raise exception 'Caixa não está aberto'; end if;
  if not public.has_crole(r.company_id, array['admin','manager','receptionist']::member_role[]) then raise exception 'Sem permissão'; end if;
  select r.opening_balance + coalesce(sum(case when type in ('withdrawal','expense') then -abs(amount) else amount end),0) into exp
    from cash_movements where register_id=_id and method_kind='cash';
  diff := round(_counted - exp, 2);
  if diff <> 0 and coalesce(trim(_justification),'')='' then raise exception 'Informe a justificativa da diferença de R$ %', diff; end if;
  update cash_registers set status='closed', closed_at=now(), closed_by=auth.uid(), expected_cash=exp, counted_cash=_counted, difference=diff, justification=_justification where id=_id;
  insert into notifications(company_id,type,title,body) values (r.company_id,'cash_closed','Caixa fechado', 'Esperado R$ ' || exp || ' • contado R$ ' || _counted);
  return jsonb_build_object('expected', exp, 'difference', diff);
end $$;
revoke execute on function public.close_cash_register from anon, public;
grant execute on function public.close_cash_register to authenticated;
