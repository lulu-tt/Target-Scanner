/**
 * [영자 실장의 모바일 퍼스트 스캐너 패널]
 * 작성자: 디자인 실장 영자 & 코다리 부장
 * 의도: 두꺼운 사격 장갑이나 야외 조명에서도 한 손으로 시원하게 터치할 수 있는
 *       빅 터치 타겟(56px)과 수평 스와이프 프리셋 칩 구성
 */

import React, { useRef } from 'react';
import { SAMPLE_PRESETS, SamplePreset } from '../utils/targetSamples';
import { Camera, Image as ImageIcon, Sparkles } from 'lucide-react';

interface ScannerPanelProps {
  onSelectPreset: (preset: SamplePreset) => void;
  onFileUpload: (file: File) => void;
  isLoading: boolean;
  activePresetId?: string;
}

export const ScannerPanel: React.FC<ScannerPanelProps> = ({
  onSelectPreset,
  onFileUpload,
  isLoading,
  activePresetId,
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

      {/* 2. 하단: 빠른 테스트 샘플 (모바일 가로 스크롤 칩) */}
      <div className="flex flex-col gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center justify-between text-xs px-1">
          <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            빠른 표적지 샘플 체험
          </span>
          <span className="text-[11px] text-slate-400 font-medium">터치 시 즉시 로드</span>
        </div>

        {/* 모바일 최적화 가로 스크롤 칩 바 */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          {SAMPLE_PRESETS.map((preset) => {
            const isActive = preset.id === activePresetId;
            return (
              <button
                key={preset.id}
                onClick={() => onSelectPreset(preset)}
                disabled={isLoading}
                className={`flex-shrink-0 h-11 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 border ${
                  isActive
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-red-500 dark:border-red-400 shadow-md shadow-slate-900/10'
                    : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                } disabled:opacity-50`}
              >
                <span>{preset.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
