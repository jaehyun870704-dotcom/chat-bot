-- PRD §5 신규 테이블. 기존 벡터 테이블(labor_chunks)은 건드리지 않는다.

-- 사용자 프로필 (auth.users 확장)
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  free_questions_used int not null default 0 check (free_questions_used >= 0),
  created_at timestamptz not null default now()
);

-- 구독
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan text not null check (plan in ('basic', 'plus')),
  status text not null check (status in ('active', 'past_due', 'canceled')),
  billing_key text,                      -- PG 빌링키 (암호화 저장, 로그 금지)
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  canceled_at timestamptz,
  created_at timestamptz not null default now()
);

-- 토큰 한도/사용량 (구독 주기 단위)
create table if not exists public.token_balances (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  period_end timestamptz not null,
  granted_tokens bigint not null default 0 check (granted_tokens >= 0),
  topup_tokens bigint not null default 0 check (topup_tokens >= 0),
  used_tokens bigint not null default 0 check (used_tokens >= 0)
);

-- 채팅방
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default '새 대화',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz                       -- 소프트 삭제 (30일 뒤 하드 삭제)
);

-- 메시지
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,                       -- assistant 는 면책 문구를 제외한 본문만 저장
  citations jsonb,                             -- 인용 청크 id·출처·유사도
  input_tokens int,
  output_tokens int,
  created_at timestamptz not null default now()
);

-- 결제 이력
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('subscription', 'topup')),
  amount int not null,
  pg_transaction_id text unique,               -- 웹훅 멱등 키
  status text not null check (status in ('paid', 'failed', 'refunded')),
  raw_response jsonb,
  created_at timestamptz not null default now()
);

-- 조회 경로 인덱스
create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);
create index if not exists subscriptions_user_active_idx on public.subscriptions (user_id, status);
create index if not exists conversations_user_updated_idx
  on public.conversations (user_id, updated_at desc) where deleted_at is null;
create index if not exists conversations_deleted_at_idx
  on public.conversations (deleted_at) where deleted_at is not null;
create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);
create index if not exists payments_user_created_idx on public.payments (user_id, created_at desc);
