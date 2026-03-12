-- Canvas Dashboard Schema
-- Run this in the Supabase SQL Editor to set up all tables and Row Level Security.

-- Enable UUID extension (usually already enabled)
create extension if not exists "uuid-ossp";

-- User settings (one row per user)
create table if not exists user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null unique,
  canvas_token text,
  canvas_url text default 'https://canvas.instructure.com',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Courses
create table if not exists courses (
  id bigserial primary key,
  user_id uuid references auth.users not null,
  canvas_id text not null,
  name text not null,
  code text not null,
  term text,
  instructor text,
  unique(user_id, canvas_id)
);

-- Assignments
create table if not exists assignments (
  id bigserial primary key,
  user_id uuid references auth.users not null,
  canvas_id text not null,
  course_id bigint references courses(id) on delete cascade,
  name text not null,
  due_at timestamptz,
  points_possible numeric,
  status text default 'pending',
  description text,
  html_url text,
  unique(user_id, canvas_id)
);

-- Lecture notes
create table if not exists notes (
  id bigserial primary key,
  user_id uuid references auth.users not null,
  course_id bigint references courses(id) on delete cascade,
  title text not null,
  content text,
  date date,
  created_at timestamptz default now()
);

-- Sync logs
create table if not exists sync_logs (
  id bigserial primary key,
  user_id uuid references auth.users not null,
  synced_at timestamptz default now(),
  courses_synced integer default 0,
  assignments_synced integer default 0,
  status text,
  error text
);

-- Enable Row Level Security on all tables
alter table user_settings enable row level security;
alter table courses enable row level security;
alter table assignments enable row level security;
alter table notes enable row level security;
alter table sync_logs enable row level security;

-- RLS Policies: users can only access their own data

-- user_settings
create policy "Users can view own settings"
  on user_settings for select using (auth.uid() = user_id);

create policy "Users can insert own settings"
  on user_settings for insert with check (auth.uid() = user_id);

create policy "Users can update own settings"
  on user_settings for update using (auth.uid() = user_id);

-- courses
create policy "Users can view own courses"
  on courses for select using (auth.uid() = user_id);

create policy "Users can insert own courses"
  on courses for insert with check (auth.uid() = user_id);

create policy "Users can update own courses"
  on courses for update using (auth.uid() = user_id);

create policy "Users can delete own courses"
  on courses for delete using (auth.uid() = user_id);

-- assignments
create policy "Users can view own assignments"
  on assignments for select using (auth.uid() = user_id);

create policy "Users can insert own assignments"
  on assignments for insert with check (auth.uid() = user_id);

create policy "Users can update own assignments"
  on assignments for update using (auth.uid() = user_id);

create policy "Users can delete own assignments"
  on assignments for delete using (auth.uid() = user_id);

-- notes
create policy "Users can view own notes"
  on notes for select using (auth.uid() = user_id);

create policy "Users can insert own notes"
  on notes for insert with check (auth.uid() = user_id);

create policy "Users can update own notes"
  on notes for update using (auth.uid() = user_id);

create policy "Users can delete own notes"
  on notes for delete using (auth.uid() = user_id);

-- sync_logs
create policy "Users can view own sync logs"
  on sync_logs for select using (auth.uid() = user_id);

create policy "Users can insert own sync logs"
  on sync_logs for insert with check (auth.uid() = user_id);
