create extension if not exists pgcrypto;

create table if not exists public.feedback_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null,
  type text not null check (type in ('mejora', 'idea', 'error')),
  status text not null default 'enviado' check (status in ('enviado', 'en_revision', 'planificado', 'en_progreso', 'implementado', 'rechazado')),
  historico_data jsonb not null default '{}'::jsonb,
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  is_primary boolean not null default true,
  parent_id uuid null references public.feedback_items(id) on delete set null,
  duplicate_count integer not null default 0,
  attachment_url text null,
  created_at timestamptz not null default now()
);

create index if not exists feedback_items_created_at_idx on public.feedback_items(created_at desc);
create index if not exists feedback_items_user_id_idx on public.feedback_items(user_id);
create index if not exists feedback_items_status_idx on public.feedback_items(status);

alter table public.feedback_items enable row level security;

drop policy if exists "feedback_items_select_own_or_public" on public.feedback_items;
create policy "feedback_items_select_own_or_public"
  on public.feedback_items
  for select
  using (auth.uid() = user_id or visibility = 'public');

drop policy if exists "feedback_items_insert_own" on public.feedback_items;
create policy "feedback_items_insert_own"
  on public.feedback_items
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "feedback_items_update_own" on public.feedback_items;
create policy "feedback_items_update_own"
  on public.feedback_items
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.feedback_messages (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback_items(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  attachments text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists feedback_messages_feedback_id_idx on public.feedback_messages(feedback_id, created_at asc);

alter table public.feedback_messages enable row level security;

drop policy if exists "feedback_messages_select_visible_threads" on public.feedback_messages;
create policy "feedback_messages_select_visible_threads"
  on public.feedback_messages
  for select
  using (
    exists (
      select 1
      from public.feedback_items fi
      where fi.id = feedback_id
      and (fi.user_id = auth.uid() or fi.visibility = 'public')
    )
  );

drop policy if exists "feedback_messages_insert_owner_or_sender" on public.feedback_messages;
create policy "feedback_messages_insert_owner_or_sender"
  on public.feedback_messages
  for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.feedback_items fi
      where fi.id = feedback_id
      and fi.user_id = auth.uid()
    )
  );

insert into storage.buckets (id, name, public)
values ('feedback-attachments', 'feedback-attachments', true)
on conflict (id) do nothing;

create or replace function public.feedback_items_status_history_sync()
returns trigger
language plpgsql
as $$
declare
  history_key text;
begin
  history_key := to_char((now() at time zone 'utc'), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');

  if tg_op = 'INSERT' then
    if new.historico_data is null or new.historico_data = '{}'::jsonb then
      new.historico_data := jsonb_build_object(
        to_char((coalesce(new.created_at, now()) at time zone 'utc'), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        new.status
      );
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    new.historico_data := coalesce(old.historico_data, '{}'::jsonb) || jsonb_build_object(history_key, new.status);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_feedback_items_status_history_sync on public.feedback_items;
create trigger trg_feedback_items_status_history_sync
before insert or update on public.feedback_items
for each row
execute function public.feedback_items_status_history_sync();

do $$
begin
  alter table public.feedback_items
    add column if not exists historico_data jsonb not null default '{}'::jsonb;

  update public.feedback_items
  set status = case status
    when 'inbox' then 'enviado'
    when 'under_review' then 'en_revision'
    when 'planned' then 'planificado'
    when 'in_progress' then 'en_progreso'
    when 'shipped' then 'implementado'
    when 'rejected' then 'rechazado'
    else status
  end
  where status in ('inbox', 'under_review', 'planned', 'in_progress', 'shipped', 'rejected');

  alter table public.feedback_items
    alter column status set default 'enviado';

  update public.feedback_items
  set historico_data = jsonb_build_object(
    to_char((created_at at time zone 'utc'), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    status
  )
  where historico_data is null
    or historico_data = '{}'::jsonb;

  if exists (
    select 1
    from pg_constraint
    where conname = 'feedback_items_status_check'
      and conrelid = 'public.feedback_items'::regclass
  ) then
    alter table public.feedback_items
      drop constraint feedback_items_status_check;
  end if;

  alter table public.feedback_items
    add constraint feedback_items_status_check
    check (status in ('enviado', 'en_revision', 'planificado', 'en_progreso', 'implementado', 'rechazado'));
end
$$;
