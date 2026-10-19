/**
 * [Supabase 클라이언트 인스턴스]
 * 작성자: 코다리 개발부장
 * 의도: 환경변수(.env)에 설정된 Project URL과 Anon Key를 통해
 *       PostgreSQL DB 및 인증/스토리지와 직접 보안 통신을 수행합니다.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
