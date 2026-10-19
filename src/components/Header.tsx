/**
 * [상단 헤더 네비게이션 컴포넌트]
 * 작성자: 코다리 개발부장
 * 의도: 앱 브랜드 타이틀, 저장/히스토리 액션 및 상태 표시를 담당합니다.
 */

import React from 'react';
import { Target, BookmarkCheck, History, RotateCcw } from 'lucide-react';

interface HeaderProps {
  onSaveSession: () => void;
  onOpenHistory: () => void;
  onReset: () => void;
  hasShots: boolean;
  historyCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  onSaveSession,
  onOpenHistory,
  onReset,
  hasShots,
  historyCount,
}) => {
  return (
    <header className="w-full bg-slate-900/95 backdrop-blur border-b border-slate-800 py-3 px-4 md:px-8 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center shadow-lg shadow-red-600/30">
          <Target className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-extrabold text-base md:text-lg text-white tracking-tight">
              TargetScan AI
            </h1>
            <span className="text-[10px] uppercase font-bold bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded">
              Phase 1 MVP
            </span>
          </div>
          <p className="text-[11px] text-slate-400 hidden sm:block">
            10m 공기소총 정밀 표적 스캐너 & ISSF 소수점 채점
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenHistory}
          className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition"
        >
          <History className="w-3.5 h-3.5" />
          <span>기록 ({historyCount})</span>
        </button>

        <button
          onClick={onReset}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs transition"
          title="초기화"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          onClick={onSaveSession}
          disabled={!hasShots}
          className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-md shadow-emerald-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <BookmarkCheck className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">세션 저장</span>
        </button>
      </div>
    </header>
  );
};
