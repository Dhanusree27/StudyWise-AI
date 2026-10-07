-- Run in Supabase: SQL Editor > New query > paste > Run
create table profiles(id uuid primary key references auth.users on delete cascade, name text, class text, board text, goal text,
 start_date date, days int default 80, school_start text, school_end text, travel_to int default 0, travel_from int default 0,
 wake text default '06:00', sleep text default '22:30', session_min int default 45, break_min int default 10,
 pref_time text default 'Evening', mock boolean default true);
create table subjects(id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade,
 name text not null, level text default 'Average', target int);
create table lessons(id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade,
 subject_id uuid not null references subjects on delete cascade, name text not null, done boolean default false, hours numeric,
 learned_min int default 0, difficult int default 0);
create table slots(id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade,
 kind text not null, day int not null, start text not null, "end" text not null, label text);
create table exams(id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade,
 name text not null, subject_id uuid references subjects on delete cascade, date date not null);
create table tasks(id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade,
 date date not null, start text, "end" text, subject_id uuid references subjects on delete cascade, lesson_id uuid references lessons on delete cascade,
 type text, minutes int, status text default 'pending', difficult boolean default false);
do $$ declare t text; begin
 foreach t in array array['profiles','subjects','lessons','slots','exams','tasks'] loop
  execute format('alter table %I enable row level security', t);
  execute format('create policy "own rows" on %I for all using (%s = auth.uid()) with check (%s = auth.uid())', t,
   case when t='profiles' then 'id' else 'user_id' end, case when t='profiles' then 'id' else 'user_id' end);
 end loop; end $$;
