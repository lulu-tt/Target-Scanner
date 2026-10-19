/**
 * [영자 실장의 모던 스포티 헤더 컴포넌트]
 * 작성자: 디자인 실장 영자 & 코다리 부장
 * 의도: 모바일 한 손 터치에 최적화된 44px 이상 터치 타겟과 시원한 라이트/다크 듀얼 테마 지원
 */

import React from 'react';
import { Target, BookmarkCheck, History, Sun, Moon, Sparkles } from 'lucide-react';

interface HeaderProps {
  onSaveSession: () => void;
  onOpenHistory: () => void;
  hasShots: boolean;
  historyCount: number;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  hasApiKey: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onSaveSession,
  onOpenHistory,
  hasShots,
  historyCount,
  theme,
  onToggleTheme,
  onOpenSettings,
  hasApiKey,
}) => {
  return (
    <header className="w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 py-3 px-4 md:px-8 flex items-center justify-between sticky top-0 z-40 transition-colors">
      {/* 로고 & 타이틀 */}
      <div className="flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-red-500 via-rose-500 to-amber-500 flex items-center justify-center shadow-md shadow-red-500/20 text-white">
          <Target className="w-5 h-5 stroke-[2.5]" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="font-black text-base md:text-lg tracking-tight text-slate-900 dark:text-white">
              TargetScan<span className="text-red-500">.ai</span>
            </h1>
            <span className="text-[10px] font-bold bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full border border-red-200 dark:border-red-500/30">
              10m 소총
            </span>
          </div>
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hidden sm:block">
            스마트폰 표적 촬영 & ISSF 공식 정밀 채점
          </p>
        </div>
      </div>

      {/* 액션 버튼 바 (터치 영역 44px 이상 확보) */}
      <div className="flex items-center gap-2">
        {/* AI 엔진 설정 버튼 */}
        <button
          onClick={onOpenSettings}
          className={`h-10 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
            hasApiKey
              ? 'bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
          }`}
          title="Google Gemini AI 정밀 비전 설정"
        >
          <Sparkles className={`w-4 h-4 ${hasApiKey ? 'text-indigo-500 fill-indigo-500/20' : 'text-slate-500'}`} />
          <span className="hidden sm:inline">AI 엔진</span>
          {hasApiKey ? (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="AI 활성화됨" />
          ) : (
            <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1 rounded">OFF</span>
          )}
        </button>

        {/* 라이트/다크 모드 토글 */}
        <button
          onClick={onToggleTheme}
          className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
          title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          aria-label="테마 전환"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600" />
          )}
        </button>

        {/* 기록 목록 열기 */}
        <button
          onClick={onOpenHistory}
          className="h-10 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
        >
          <History className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <span className="hidden xs:inline">기록</span>
          <span className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
            {historyCount}
          </span>
        </button>

        {/* 현재 세션 저장 */}
        <button
          onClick={onSaveSession}
          disabled={!hasShots}
          className="h-10 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-slate-900/10 dark:shadow-emerald-600/20 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
        >
          <BookmarkCheck className="w-4 h-4 text-emerald-400 dark:text-white" />
          <span>저장</span>
        </button>
      </div>
    </header>
  );
};
