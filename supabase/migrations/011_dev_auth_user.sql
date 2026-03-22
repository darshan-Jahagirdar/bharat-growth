-- =========================================================================
-- Migration 011: Dev Auth User for RLS bypass during development
-- Creates a Supabase Auth user + public.users row for Ganesh Tyres (Shop 1)
--
-- IMPORTANT: Run this in the Supabase Dashboard SQL Editor
-- This creates a user with email: dev@bharatgrowth.in / password: devpass123
-- =========================================================================

-- Step 1: Create auth user (Supabase Auth)
-- Using Supabase's built-in auth.users table
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'def00000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'dev@bharatgrowth.in',
  crypt('devpass123', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Dev Owner (Ganesh Tyres)"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
);

-- Step 1b: Create identity record (required by Supabase Auth)
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  'def00000-0000-0000-0000-000000000001',
  'def00000-0000-0000-0000-000000000001',
  jsonb_build_object('sub', 'def00000-0000-0000-0000-000000000001', 'email', 'dev@bharatgrowth.in'),
  'email',
  'dev@bharatgrowth.in',
  now(),
  now(),
  now()
);

-- Step 2: Link auth user to public.users table with Ganesh Tyres shop_id
INSERT INTO public.users (
  id,
  shop_id,
  full_name,
  phone,
  role,
  is_active
) VALUES (
  'def00000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',  -- Ganesh Tyres
  'Dev Owner',
  '9876500001',
  'owner',
  true
);
