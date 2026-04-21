create table if not exists public.user_medical_settings (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    office_id uuid references public.offices(id) on delete set null,
    crm text,
    crm_uf text,
    specialty text,
    appointment_duration integer default 30,
    doc_header text,
    doc_footer text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(user_id)
);

alter table public.user_medical_settings enable row level security;

create policy "Users can view their own medical settings"
    on public.user_medical_settings for select
    using (auth.uid() = user_id);

create policy "Users can insert their own medical settings"
    on public.user_medical_settings for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own medical settings"
    on public.user_medical_settings for update
    using (auth.uid() = user_id);
