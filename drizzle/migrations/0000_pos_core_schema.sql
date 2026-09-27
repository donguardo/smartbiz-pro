create table public.profiles (
  id uuid primary key,
  business_name text not null default 'My Store',
  full_name text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());

create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  sku text not null,
  category text not null default 'General',
  price numeric(12,2) not null default 0,
  cost numeric(12,2) not null default 0,
  stock integer not null default 0,
  reorder_level integer not null default 5,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "own products" on public.products for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  receipt_no text not null,
  total numeric(12,2) not null,
  cost_total numeric(12,2) not null default 0,
  payment_method text not null,
  amount_tendered numeric(12,2),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.sales to authenticated;
grant all on public.sales to service_role;
alter table public.sales enable row level security;
create policy "own sales" on public.sales for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  category text not null default 'General',
  qty integer not null,
  price numeric(12,2) not null,
  cost numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.sale_items to authenticated;
grant all on public.sale_items to service_role;
alter table public.sale_items enable row level security;
create policy "own sale items" on public.sale_items for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.chat_threads to authenticated;
grant all on public.chat_threads to service_role;
alter table public.chat_threads enable row level security;
create policy "own threads" on public.chat_threads for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  message jsonb not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.chat_messages to authenticated;
grant all on public.chat_messages to service_role;
alter table public.chat_messages enable row level security;
create policy "own messages" on public.chat_messages for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.decrement_stock(_product_id uuid, _qty integer)
returns void language sql security invoker set search_path = public as $$
  update public.products set stock = stock - _qty where id = _product_id and user_id = auth.uid();
$$;
grant execute on function public.decrement_stock(uuid, integer) to authenticated;