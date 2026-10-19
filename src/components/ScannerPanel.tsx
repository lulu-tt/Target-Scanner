/**
 * [영자 실장의 모바일 퍼스트 스캐너 패널]
 * 작성자: 디자인 실장 영자 & 코다리 부장
 * 의도: 두꺼운 사격 장갑이나 야외 조명에서도 한 손으로 시원하게 터치할 수 있는
 *       빅 터치 타겟(56px)과 수평 스와이프 프리셋 칩 구성
 */

import React, { useRef } from 'react';
import { TargetMode } from '../types/target';
import { Camera, Image as ImageIcon } from 'lucide-react';

interface ScannerPanelProps {
  onFileUpload: (file: File) => void;
  isLoading: boolean;
  targetMode: TargetMode;
  onModeChange: (mode: TargetMode) => void;
  onSelectPreset?: (preset: any) => void;
  activePresetId?: string;
}

export const ScannerPanel: React.FC<ScannerPanelProps> = ({
  onFileUpload,
  isLoading,
  targetMode,
  onModeChange,
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
      {/* 1. 최상단: 메인 카메라 & 앨범 빅 터치 액션 버튼 (모바일 높이 52px 보장) */}
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

      {/* 2. 사격 모드 선택 세그먼트 (10발 / 20발 / 자유 / 백지) */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center justify-between text-xs px-1">
          <span className="font-bold text-slate-700 dark:text-slate-300">
            사격 목표 발수 / 유형
          </span>
          <span className="text-[11px] text-slate-400 font-medium">선택 후 사진 촬영/업로드</span>
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
