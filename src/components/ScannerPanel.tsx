/**
 * [표적지 업로드 & 1클릭 샘플 테스트 패널]
 * 작성자: 코다리 개발부장
 * 의도: 사용자가 폰 카메라로 찍거나 파일을 올릴 수도 있고,
 *       표적지가 없는 상황에서도 즉시 1클릭 프리셋으로 실전 테스트를 할 수 있도록 지원합니다.
 */

import React, { useRef } from 'react';
import { SAMPLE_PRESETS, SamplePreset } from '../utils/targetSamples';
import { Upload, Camera, Sparkles, Image as ImageIcon } from 'lucide-react';

interface ScannerPanelProps {
  onSelectPreset: (preset: SamplePreset) => void;
  onFileUpload: (file: File) => void;
  isLoading: boolean;
}

export const ScannerPanel: React.FC<ScannerPanelProps> = ({
  onSelectPreset,
  onFileUpload,
  isLoading,
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
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 shadow-lg">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-yellow-400" />
          빠른 테스트 샘플 (1클릭 즉시 로드)
        </span>
        <span className="text-[11px] text-slate-500">실제 종이 없어도 즉시 체험 가능</span>
      </div>

      {/* 1클릭 프리셋 버튼들 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {SAMPLE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onSelectPreset(preset)}
            disabled={isLoading}
            className="flex flex-col text-left p-2.5 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800 hover:border-slate-700 transition-all text-xs group disabled:opacity-50"
          >
            <span className="font-semibold text-slate-200 group-hover:text-yellow-400 flex items-center justify-between">
              {preset.name}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
              {preset.description}
            </span>
          </button>
        ))}
      </div>

      {/* 사진 업로드 및 카메라 촬영 액션바 */}
      <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition disabled:opacity-50"
        >
          <Upload className="w-3.5 h-3.5 text-slate-400" />
          내 표적 사진 올리기
        </button>

        <button
          onClick={() => cameraInputRef.current?.click()}
          disabled={isLoading}
          className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition shadow-md shadow-red-600/20 disabled:opacity-50"
        >
          <Camera className="w-3.5 h-3.5" />
          카메라 촬영
        </button>
      </div>
    </div>
  );
};
