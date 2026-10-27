
alter table public.services add column prof_share_pct numeric(5,2) check (prof_share_pct is null or (prof_share_pct >= 0 and prof_share_pct <= 100));
alter table public.companies add column closing_weekday int not null default 5;

create or replace function public.my_professional_id(_company uuid) returns uuid language sql stable security definer set search_path=public as $$
  select professional_id from company_members where company_id=_company and user_id=auth.uid() limit 1
$$;

create table public.weekly_closings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  period_start date not null, period_end date not null,
  status text not null default 'open' check (status in ('open','review','awaiting_approval','approved','partially_paid','paid','disputed')),
  services_count int not null default 0, gross numeric(12,2) not null default 0, discounts numeric(12,2) not null default 0,
  cash numeric(12,2) not null default 0, pix numeric(12,2) not null default 0, card numeric(12,2) not null default 0, other numeric(12,2) not null default 0,
  prof_total numeric(12,2) not null default 0, est_total numeric(12,2) not null default 0,
  adjustments_total numeric(12,2) not null default 0, advances_total numeric(12,2) not null default 0, paid_total numeric(12,2) not null default 0,
  dispute_reason text, approved_by uuid, approved_at timestamptz,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(),
  unique(professional_id, period_start)
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  professional_id uuid not null references public.professionals(id),
  client_id uuid references public.clients(id) on delete set null,
  client_name text,
  service_id uuid references public.services(id) on delete set null,
  service_name text not null,
  performed_at timestamptz not null default now(),
  amount numeric(12,2) not null check (amount >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  payment_method_id uuid references public.payment_methods(id),
  method_kind text not null default 'cash', method_name text,
  notes text,
  prof_pct numeric(5,2) not null default 0, prof_amount numeric(12,2) not null default 0, est_amount numeric(12,2) not null default 0,
  closing_id uuid references public.weekly_closings(id),
  status text not null default 'active' check (status in ('active','reversed')),
  reversed_reason text, reversed_by uuid,
  idempotency_key text unique,
  created_by uuid default auth.uid(), created_at timestamptz not null default now()
);
create index on public.tickets(company_id, professional_id, performed_at);

create table public.closing_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  closing_id uuid not null references public.weekly_closings(id) on delete cascade,
  kind text not null check (kind in ('adjustment','advance','payment')),
  amount numeric(12,2) not null, method text, reason text,
  occurred_at timestamptz not null default now(),
  created_by uuid default auth.uid(), created_at timestamptz not null default now()
);

grant select, insert, update on public.tickets, public.weekly_closings, public.closing_entries to authenticated;
grant all on public.tickets, public.weekly_closings, public.closing_entries to service_role;
alter table public.tickets enable row level security;
alter table public.weekly_closings enable row level security;
alter table public.closing_entries enable row level security;

create policy "tickets read" on public.tickets for select to authenticated using (
  public.has_crole(company_id, array['admin','manager']::member_role[]) or professional_id = public.my_professional_id(company_id));
create policy "tickets ins" on public.tickets for insert to authenticated with check (
  public.has_crole(company_id, array['admin','manager','receptionist']::member_role[]) or (public.has_crole(company_id, array['professional']::member_role[]) and professional_id = public.my_professional_id(company_id)));
create policy "tickets upd" on public.tickets for update to authenticated using (public.has_crole(company_id, array['admin','manager']::member_role[]));

create policy "closings read" on public.weekly_closings for select to authenticated using (
  public.has_crole(company_id, array['admin','manager']::member_role[]) or professional_id = public.my_professional_id(company_id));
create policy "entries read" on public.closing_entries for select to authenticated using (
  public.has_crole(company_id, array['admin','manager']::member_role[]) or exists(select 1 from weekly_closings c where c.id=closing_id and c.professional_id = public.my_professional_id(c.company_id)));
-- writes on closings/entries only via RPCs below

-- Backend computes the split; client-supplied values are ignored.
create or replace function public.tickets_before() returns trigger language plpgsql security definer set search_path=public as $$
declare pct numeric; net numeric; locked boolean;
begin
  if tg_op = 'UPDATE' then
    if old.status='reversed' then raise exception 'Comanda estornada não pode ser alterada'; end if;
    if old.closing_id is not null and exists(select 1 from weekly_closings where id=old.closing_id and status in ('approved','partially_paid','paid')) then
      if new.status='reversed' and old.status='active' and (new.amount, new.discount, new.professional_id, new.prof_pct) is not distinct from (old.amount, old.discount, old.professional_id, old.prof_pct) then
        raise exception 'Fechamento aprovado: registre um ajuste em vez de estornar';
      end if;
      raise exception 'Fechamento aprovado: alterações exigem ajuste rastreável';
    end if;
    if new.status='reversed' then new.reversed_by := auth.uid(); return new; end if;
    pct := old.prof_pct; -- keep recorded rule
  else
    if new.service_id is not null then
      select prof_share_pct, name into pct, new.service_name from services where id=new.service_id and company_id=new.company_id;
      if not found then raise exception 'Serviço inválido'; end if;
    end if;
    if pct is null then select default_commission_pct into pct from professionals where id=new.professional_id and company_id=new.company_id; end if;
    if pct is null then raise exception 'Profissional inválido'; end if;
    if new.payment_method_id is not null then
      select kind, name into new.method_kind, new.method_name from payment_methods where id=new.payment_method_id and company_id=new.company_id;
    end if;
    select exists(select 1 from weekly_closings where professional_id=new.professional_id and (new.performed_at at time zone 'America/Sao_Paulo')::date between period_start and period_end and status in ('approved','partially_paid','paid')) into locked;
    if locked then raise exception 'Semana já aprovada para este profissional: lance um ajuste no fechamento'; end if;
    new.created_by := auth.uid();
  end if;
  if new.discount > new.amount then raise exception 'Desconto maior que o valor'; end if;
  net := new.amount - new.discount;
  new.prof_pct := pct;
  new.prof_amount := round(net * pct / 100, 2);
  new.est_amount := net - new.prof_amount;
  return new;
end $$;
create trigger tickets_before before insert or update on public.tickets for each row execute function public.tickets_before();

create or replace function public.recalc_closing(_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare c weekly_closings;
begin
  select * into c from weekly_closings where id=_id;
  if c.status in ('open','review','awaiting_approval','disputed') then
    update tickets set closing_id=c.id where professional_id=c.professional_id and closing_id is null and status='active'
      and (performed_at at time zone 'America/Sao_Paulo')::date between c.period_start and c.period_end;
    update tickets set closing_id=null where closing_id=c.id and status='reversed';
  end if;
  update weekly_closings w set
    services_count = coalesce(t.n,0), gross = coalesce(t.gross,0), discounts = coalesce(t.disc,0),
    cash = coalesce(t.cash,0), pix = coalesce(t.pix,0), card = coalesce(t.card,0), other = coalesce(t.other,0),
    prof_total = coalesce(t.prof,0), est_total = coalesce(t.est,0),
    adjustments_total = coalesce(e.adj,0), advances_total = coalesce(e.adv,0), paid_total = coalesce(e.paid,0)
  from (select count(*) n, sum(amount) gross, sum(discount) disc,
          sum(amount-discount) filter (where method_kind='cash') cash, sum(amount-discount) filter (where method_kind='pix') pix,
          sum(amount-discount) filter (where method_kind in ('credit','debit')) card, sum(amount-discount) filter (where method_kind not in ('cash','pix','credit','debit')) other,
          sum(prof_amount) prof, sum(est_amount) est from tickets where closing_id=_id and status='active') t,
       (select sum(amount) filter (where kind='adjustment') adj, sum(amount) filter (where kind='advance') adv, sum(amount) filter (where kind='payment') paid from closing_entries where closing_id=_id) e
  where w.id=_id;
end $$;

create or replace function public.open_closing(_company uuid, _professional uuid, _start date, _end date) returns uuid language plpgsql security definer set search_path=public as $$
declare cid uuid;
begin
  if not (public.has_crole(_company, array['admin','manager']::member_role[]) or _professional = public.my_professional_id(_company)) then raise exception 'Sem permissão'; end if;
  if _end < _start then raise exception 'Período inválido'; end if;
  select id into cid from weekly_closings where professional_id=_professional and period_start=_start;
  if cid is null then
    if exists(select 1 from weekly_closings where professional_id=_professional and daterange(period_start, period_end, '[]') && daterange(_start,_end,'[]')) then
      raise exception 'Já existe fechamento sobreposto a este período';
    end if;
    insert into weekly_closings(company_id, professional_id, period_start, period_end) values (_company, _professional, _start, _end) returning id into cid;
  end if;
  perform public.recalc_closing(cid);
  return cid;
end $$;

create or replace function public.closing_balance(c weekly_closings) returns numeric language sql immutable as $$
  select round(c.prof_total + c.adjustments_total - c.advances_total - c.paid_total, 2)
$$;

create or replace function public.set_closing_status(_id uuid, _status text, _reason text default null) returns void language plpgsql security definer set search_path=public as $$
declare c weekly_closings; isowner boolean; ismgr boolean;
begin
  select * into c from weekly_closings where id=_id for update;
  if c.id is null then raise exception 'Fechamento não encontrado'; end if;
  isowner := public.has_crole(c.company_id, array['admin']::member_role[]);
  ismgr := public.has_crole(c.company_id, array['admin','manager']::member_role[]);
  if _status = 'disputed' then
    if not (ismgr or c.professional_id = public.my_professional_id(c.company_id)) then raise exception 'Sem permissão'; end if;
    if coalesce(trim(_reason),'')='' then raise exception 'Informe o motivo da contestação'; end if;
    update weekly_closings set status='disputed', dispute_reason=_reason where id=_id; return;
  end if;
  if _status in ('review','awaiting_approval','open') then
    if not ismgr then raise exception 'Sem permissão'; end if;
    if c.status in ('approved','partially_paid','paid') then raise exception 'Fechamento já aprovado'; end if;
    perform public.recalc_closing(_id);
    update weekly_closings set status=_status where id=_id; return;
  end if;
  if _status = 'approved' then
    if not isowner then raise exception 'Apenas o dono aprova fechamentos'; end if;
    if c.status not in ('review','awaiting_approval','disputed','open') then raise exception 'Status atual não permite aprovação'; end if;
    perform public.recalc_closing(_id);
    update weekly_closings set status='approved', approved_by=auth.uid(), approved_at=now() where id=_id; return;
  end if;
  raise exception 'Status inválido';
end $$;

create or replace function public.add_closing_entry(_id uuid, _kind text, _amount numeric, _method text, _reason text, _key text default null) returns void language plpgsql security definer set search_path=public as $$
declare c weekly_closings; bal numeric;
begin
  select * into c from weekly_closings where id=_id for update;
  if c.id is null then raise exception 'Fechamento não encontrado'; end if;
  if _kind='payment' then
    if not public.has_crole(c.company_id, array['admin']::member_role[]) then raise exception 'Apenas o dono registra pagamentos'; end if;
    if c.status not in ('approved','partially_paid') then raise exception 'Aprove o fechamento antes de pagar'; end if;
    if _amount <= 0 then raise exception 'Valor inválido'; end if;
    bal := public.closing_balance(c);
    if _amount > bal then raise exception 'Pagamento (R$ %) maior que o saldo devido (R$ %)', _amount, bal; end if;
    if _key is not null and exists(select 1 from closing_entries where closing_id=_id and reason = _reason and amount=_amount and created_at > now() - interval '10 seconds') then
      raise exception 'Pagamento duplicado detectado';
    end if;
  else
    if not public.has_crole(c.company_id, array['admin','manager']::member_role[]) then raise exception 'Sem permissão'; end if;
    if _kind='advance' and _amount <= 0 then raise exception 'Adiantamento deve ser positivo'; end if;
    if coalesce(trim(_reason),'')='' then raise exception 'Informe o motivo'; end if;
    if c.status='paid' then raise exception 'Fechamento já pago'; end if;
  end if;
  insert into closing_entries(company_id, closing_id, kind, amount, method, reason) values (c.company_id, _id, _kind, _amount, _method, _reason);
  perform public.recalc_closing(_id);
  select * into c from weekly_closings where id=_id;
  if c.status in ('approved','partially_paid') and c.paid_total > 0 then
    update weekly_closings set status = case when public.closing_balance(c) <= 0 then 'paid' else 'partially_paid' end where id=_id;
  end if;
end $$;

revoke execute on function public.open_closing, public.set_closing_status, public.add_closing_entry, public.recalc_closing from anon, public;
grant execute on function public.open_closing, public.set_closing_status, public.add_closing_entry to authenticated;

create trigger audit_tickets after insert or update or delete on public.tickets for each row execute function public.audit_trigger();
create trigger audit_weekly_closings after insert or update or delete on public.weekly_closings for each row execute function public.audit_trigger();
create trigger audit_closing_entries after insert or update or delete on public.closing_entries for each row execute function public.audit_trigger();
