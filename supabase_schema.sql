-- =======================================================
-- [TargetScan AI] Supabase PostgreSQL Database Schema
-- 작성자: 코다리 개발부장
-- 용도: 사수 프로필, 사격 세션 및 탄착점 저장 테이블 및 RLS 보안 정책
-- =======================================================

-- 1. 사수 프로필 테이블
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'AirRifle_10m', -- 'AirRifle_10m' or 'AirPistol_10m'
  affiliation TEXT,                     -- 소속 학교/클럽
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 사격 세션 테이블 (1회 사격 훈련 단위)
CREATE TABLE IF NOT EXISTS public.shooting_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  mode TEXT DEFAULT 'Official_AirRifle',
  total_shots INT DEFAULT 10,
  total_score NUMERIC(5, 1) NOT NULL,
  average_score NUMERIC(4, 2) NOT NULL,
  mpi_x_mm NUMERIC(5, 2) DEFAULT 0.0,
  mpi_y_mm NUMERIC(5, 2) DEFAULT 0.0,
  extreme_spread_mm NUMERIC(5, 2) DEFAULT 0.0,
  cep50_mm NUMERIC(5, 2) DEFAULT 0.0,
  target_image_url TEXT,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 개별 탄환(Shot) 데이터 테이블
CREATE TABLE IF NOT EXISTS public.shot_points (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.shooting_sessions ON DELETE CASCADE NOT NULL,
  shot_number INT NOT NULL,
  pixel_x NUMERIC(6, 1) NOT NULL,
  pixel_y NUMERIC(6, 1) NOT NULL,
  offset_x_mm NUMERIC(5, 2) NOT NULL,
  offset_y_mm NUMERIC(5, 2) NOT NULL,
  distance_mm NUMERIC(5, 2) NOT NULL,
  score NUMERIC(3, 1) NOT NULL,
  is_manually_adjusted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =======================================================
-- Row Level Security (RLS) 보안 정책
-- 의도: 각 선수는 오직 '본인'의 사격 데이터만 읽고 쓸 수 있도록 보호
-- =======================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shooting_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shot_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "사용자 본인 프로필 조회" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "사용자 본인 프로필 수정" ON public.profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "사용자 본인 세션 조회" ON public.shooting_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "사용자 본인 세션 추가/수정" ON public.shooting_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "사용자 본인 탄착점 조회" ON public.shot_points
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.shooting_sessions
      WHERE shooting_sessions.id = shot_points.session_id
      AND shooting_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "사용자 본인 탄착점 추가/수정" ON public.shot_points
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.shooting_sessions
      WHERE shooting_sessions.id = shot_points.session_id
      AND shooting_sessions.user_id = auth.uid()
    )
  );
