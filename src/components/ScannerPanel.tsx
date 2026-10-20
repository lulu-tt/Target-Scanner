/**
 * [영자 실장의 모바일 퍼스트 스캐너 패널]
 * 작성자: 디자인 실장 영자 & 코다리 부장
 * 의도: 두꺼운 사격 장갑이나 야외 조명에서도 한 손으로 시원하게 터치할 수 있는
 *       빅 터치 타겟(56px)과 수평 스와이프 프리셋 칩 구성
 */

import React, { useRef } from 'react';
import { TargetMode } from '../types/target';
import { Camera, Image as ImageIcon, Sparkles, RefreshCw, Key } from 'lucide-react';

interface ScannerPanelProps {
  onFileUpload: (file: File) => void;
  isLoading: boolean;
  targetMode: TargetMode;
  onModeChange: (mode: TargetMode) => void;
  onSelectPreset?: (preset: any) => void;
  activePresetId?: string;
  hasApiKey: boolean;
  onOpenSettings: () => void;
  onTriggerAiAnalysis?: () => void;
  hasFileToAnalyze: boolean;
  isAwaitingModeSelection?: boolean;
}

export const ScannerPanel: React.FC<ScannerPanelProps> = ({
  onFileUpload,
  isLoading,
  targetMode,
  onModeChange,
  hasApiKey,
  onOpenSettings,
  onTriggerAiAnalysis,
  hasFileToAnalyze,
  isAwaitingModeSelection = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 md:p-5 flex flex-col gap-4 shadow-xl shadow-slate-200/40 dark:shadow-none transition-colors">
      {/* 1. [STEP 1] 표적지 사진 촬영 / 불러오기 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs px-1">
          <span className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-[11px] font-black">1</span>
            <span>표적지 사진 등록 (먼저 사진을 올려주세요)</span>
          </span>
          {hasFileToAnalyze ? (
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
              ✓ 사진 등록 완료
            </span>
          ) : (
            <span className="text-[11px] text-slate-400 font-medium">카메라 촬영 또는 앨범 선택</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* 1) 실시간 카메라 촬영 버튼 (메인 강조) */}
          <button
            onClick={() => cameraInputRef.current?.click()}
            disabled={isLoading}
            className="h-14 md:h-16 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 active:scale-[0.98] text-white rounded-2xl font-black text-sm md:text-base flex items-center justify-center gap-2.5 shadow-lg shadow-red-500/25 transition-all disabled:opacity-50"
          >
            <Camera className="w-5 h-5 stroke-[2.5]" />
            <span>표적 카메라 촬영</span>
          </button>

          {/* 2) 앨범에서 사진 선택 버튼 */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="h-14 md:h-16 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-[0.98] text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm md:text-base flex items-center justify-center gap-2.5 transition-all disabled:opacity-50"
          >
            <ImageIcon className="w-5 h-5 text-slate-500 dark:text-slate-400 stroke-[2.2]" />
            <span>사진 불러오기</span>
          </button>
        </div>
      </div>

      {/* 2. AI 정밀 분석 엔진 상태 바 & 실행 버튼 */}
      <div className="flex items-center justify-between p-2.5 px-3 rounded-2xl bg-gradient-to-r from-indigo-50/80 via-purple-50/60 to-slate-50 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-slate-900 border border-indigo-100/80 dark:border-indigo-900/40">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${hasApiKey ? 'bg-indigo-500 shadow-sm shadow-indigo-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`} />
          <div className="flex flex-col">
            <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              {hasApiKey ? 'Gemini AI 비전 엔진' : '온디바이스 기본 엔진 v3.0'}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              {hasApiKey ? '손글씨/메모 100% 무시 · 밀집 탄흔 분리' : '무료 AI 키 등록 시 손글씨 100% 차단'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {hasFileToAnalyze && onTriggerAiAnalysis && (
            <button
              type="button"
              onClick={onTriggerAiAnalysis}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-black flex items-center gap-1 shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              <span>AI 재분석</span>
            </button>
          )}

          {!hasApiKey && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs font-bold flex items-center gap-1 transition-all"
            >
              <Key className="w-3 h-3" />
              <span>AI 키 등록</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. [STEP 2] 사격 목표 발수 / 유형 선택 (사진 등록 후 선택 시 즉시 분석) */}
      <div className={`flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 rounded-2xl p-2 transition-all ${
        isAwaitingModeSelection
          ? 'bg-red-500/10 border-2 border-red-500 shadow-lg shadow-red-500/20'
          : ''
      }`}>
        <div className="flex items-center justify-between text-xs px-1">
          <span className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black ${
              isAwaitingModeSelection ? 'bg-red-600 text-white animate-bounce' : 'bg-slate-700 text-white'
            }`}>2</span>
            <span>사격 목표 발수 / 유형 선택</span>
          </span>
          <span className={`text-[11px] ${
            isAwaitingModeSelection ? 'text-red-600 dark:text-red-400 font-extrabold animate-pulse' : 'text-slate-400 font-medium'
          }`}>
            {isAwaitingModeSelection
              ? '👉 발수를 터치하시면 즉시 정밀 분석됩니다!'
              : hasFileToAnalyze
              ? '터치 시 해당 발수로 즉시 재분석'
              : '사진 등록 후 발수 선택 시 분석 실행'}
          </span>
        </div>
        {/* 메인 정규 발수: 10발, 15발, 20발, 30발 */}
        <div className="grid grid-cols-4 gap-1.5 bg-slate-100 dark:bg-slate-800/90 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
          <button
            type="button"
            onClick={() => onModeChange('10shots')}
            className={`py-2 px-1 rounded-xl text-xs font-black transition-all text-center ${
              targetMode === '10shots'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            🎯 10발
          </button>
          <button
            type="button"
            onClick={() => onModeChange('15shots')}
            className={`py-2 px-1 rounded-xl text-xs font-black transition-all text-center ${
              targetMode === '15shots'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            🔥 15발
          </button>
          <button
            type="button"
            onClick={() => onModeChange('20shots')}
            className={`py-2 px-1 rounded-xl text-xs font-black transition-all text-center ${
              targetMode === '20shots'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            ⚡ 20발
          </button>
          <button
            type="button"
            onClick={() => onModeChange('30shots')}
            className={`py-2 px-1 rounded-xl text-xs font-black transition-all text-center ${
              targetMode === '30shots'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            🏆 30발
          </button>
        </div>

        {/* 보조 모드: 백지 사격 / 자유 발수 */}
        <div className="grid grid-cols-2 gap-1.5 pt-0.5">
          <button
            type="button"
            onClick={() => onModeChange('blank')}
            className={`py-2 px-2 rounded-xl text-xs font-bold transition-all text-center border ${
              targetMode === 'blank'
                ? 'bg-slate-900 text-white dark:bg-red-500 dark:border-red-400 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
            }`}
          >
            📄 백지 사격 (집탄 전용)
          </button>
          <button
            type="button"
            onClick={() => onModeChange('free')}
            className={`py-2 px-2 rounded-xl text-xs font-bold transition-all text-center border ${
              targetMode === 'free'
                ? 'bg-slate-900 text-white dark:bg-red-500 dark:border-red-400 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
            }`}
          >
            ♾️ 자유 발수 (무제한)
          </button>
        </div>
      </div>
    </div>
  );
};
