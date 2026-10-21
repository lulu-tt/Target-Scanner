import React from 'react';
import { Target, BookmarkCheck, History, Sun, Moon, SlidersHorizontal } from 'lucide-react';

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

export const Header: React.FC<HeaderProps> = ({ onSaveSession, onOpenHistory, hasShots, historyCount, theme, onToggleTheme, onOpenSettings, hasApiKey }) => (
  <header className="app-header sticky top-0 z-40 border-b border-slate-200/70 bg-white/95 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95">
    <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-white"><Target size={22} /></div>
        <div>
          <h1 className="text-base font-extrabold tracking-tight">TargetScan<span className="text-red-600">.ai</span></h1>
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">10m 공기소총 · 표적 분석</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <button onClick={onToggleTheme} className="icon-button" aria-label="테마 전환" title={theme === 'dark' ? '라이트 모드' : '다크 모드'}>{theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button>
        <button onClick={onOpenSettings} className="icon-button relative" aria-label="분석 설정" title="분석 설정"><SlidersHorizontal size={19} />{hasApiKey && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-emerald-500" />}</button>
        <button onClick={onOpenHistory} className="hidden min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 lg:flex"><History size={18} />기록 <span className="text-slate-500">{historyCount}</span></button>
        <button onClick={onSaveSession} disabled={!hasShots} className="hidden min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-40 dark:bg-red-600 lg:flex"><BookmarkCheck size={18} />저장</button>
      </div>
    </div>
  </header>
);
