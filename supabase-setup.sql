-- Pause — tables Supabase.
-- À exécuter une seule fois dans l'éditeur SQL du projet Supabase « Aurora »
-- (le même que celui d'Aurora, Ironly et Osmosy : tables séparées,
-- préfixées "pause_", donc aucun risque pour les données des autres apps).
--
-- Archivage : rien n'est effacé, les éléments terminés reçoivent une date
-- "archived_at" et sont simplement masqués des listes courantes.

create extension if not exists pgcrypto;

-- Activités ajoutées à la main (les activités de départ sont dans js/activities.js).
create table if not exists pause_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null check (category in ('sport', 'detente', 'apprentissage')),
  created_at timestamptz not null default now()
);

-- Chaque appui sur « J'ai envie de scroller ».
create table if not exists pause_cravings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  need text not null check (need in ('souffler', 'occuper', 'decrocher', 'reflexe')),
  suggestion text,
  outcome text check (outcome in ('passed', 'scrolled')),
  answered_at timestamptz
);

-- Grille de la semaine : une activité par créneau et par jour.
create table if not exists pause_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  slot text not null check (slot in ('matin', 'midi', 'apres_midi', 'soir')),
  activity text not null,
  category text not null check (category in ('sport', 'detente', 'apprentissage')),
  status text check (status in ('done', 'not_done')),
  created_at timestamptz not null default now(),
  unique (user_id, date, slot)
);

-- Défis : courses (date + discipline) ou apprentissages (activité).
create table if not exists pause_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('race', 'learning')),
  name text not null,
  race_date date,
  discipline text,
  activity text,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

-- Jours pratiqués pour un défi d'apprentissage : un jour compte une seule fois.
create table if not exists pause_practice_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references pause_challenges(id) on delete cascade,
  date date not null,
  source text not null check (source in ('auto', 'manual')),
  created_at timestamptz not null default now(),
  unique (challenge_id, date)
);

-- To Do List.
create table if not exists pause_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  done_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

alter table pause_activities enable row level security;
alter table pause_cravings enable row level security;
alter table pause_plans enable row level security;
alter table pause_challenges enable row level security;
alter table pause_practice_days enable row level security;
alter table pause_tasks enable row level security;

-- Chacun ne peut lire/écrire que ses propres données.
create policy "pause_activities_select_own" on pause_activities for select using (auth.uid() = user_id);
create policy "pause_activities_insert_own" on pause_activities for insert with check (auth.uid() = user_id);
create policy "pause_activities_update_own" on pause_activities for update using (auth.uid() = user_id);
create policy "pause_activities_delete_own" on pause_activities for delete using (auth.uid() = user_id);

create policy "pause_cravings_select_own" on pause_cravings for select using (auth.uid() = user_id);
create policy "pause_cravings_insert_own" on pause_cravings for insert with check (auth.uid() = user_id);
create policy "pause_cravings_update_own" on pause_cravings for update using (auth.uid() = user_id);
create policy "pause_cravings_delete_own" on pause_cravings for delete using (auth.uid() = user_id);

create policy "pause_plans_select_own" on pause_plans for select using (auth.uid() = user_id);
create policy "pause_plans_insert_own" on pause_plans for insert with check (auth.uid() = user_id);
create policy "pause_plans_update_own" on pause_plans for update using (auth.uid() = user_id);
create policy "pause_plans_delete_own" on pause_plans for delete using (auth.uid() = user_id);

create policy "pause_challenges_select_own" on pause_challenges for select using (auth.uid() = user_id);
create policy "pause_challenges_insert_own" on pause_challenges for insert with check (auth.uid() = user_id);
create policy "pause_challenges_update_own" on pause_challenges for update using (auth.uid() = user_id);
create policy "pause_challenges_delete_own" on pause_challenges for delete using (auth.uid() = user_id);

create policy "pause_practice_days_select_own" on pause_practice_days for select using (auth.uid() = user_id);
create policy "pause_practice_days_insert_own" on pause_practice_days for insert with check (auth.uid() = user_id);
create policy "pause_practice_days_update_own" on pause_practice_days for update using (auth.uid() = user_id);
create policy "pause_practice_days_delete_own" on pause_practice_days for delete using (auth.uid() = user_id);

create policy "pause_tasks_select_own" on pause_tasks for select using (auth.uid() = user_id);
create policy "pause_tasks_insert_own" on pause_tasks for insert with check (auth.uid() = user_id);
create policy "pause_tasks_update_own" on pause_tasks for update using (auth.uid() = user_id);
create policy "pause_tasks_delete_own" on pause_tasks for delete using (auth.uid() = user_id);
