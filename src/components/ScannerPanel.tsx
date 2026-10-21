import React, { useRef } from 'react';
import { TargetMode } from '../types/target';
import { Camera, Image as ImageIcon, ArrowUpRight, Check, RefreshCw } from 'lucide-react';

interface ScannerPanelProps {
  onFileUpload: (file: File) => void;
  isLoading: boolean;
  targetMode: TargetMode;
  onModeChange: (mode: TargetMode) => void;
  hasApiKey: boolean;
  onOpenSettings: () => void;
  onTriggerAiAnalysis?: () => void;
  hasFileToAnalyze: boolean;
  isAwaitingModeSelection?: boolean;
}
const modes: { value: TargetMode; label: string }[] = [
  { value: '10shots', label: '10발' }, { value: '15shots', label: '15발' },
  { value: '20shots', label: '20발' }, { value: '30shots', label: '30발' },
  { value: 'blank', label: '백지 표적' }, { value: 'free', label: '자유 발수' },
];

export const ScannerPanel: React.FC<ScannerPanelProps> = ({ onFileUpload, isLoading, targetMode, onModeChange, hasApiKey, onOpenSettings, onTriggerAiAnalysis, hasFileToAnalyze, isAwaitingModeSelection = false }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileUpload(file);
    e.target.value = ''; // 같은 사진도 다시 선택할 수 있도록 초기화
  };
  return (
    <section aria-label="표적 사진 분석" className="surface-card overflow-hidden">
      <div className="p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5"><span className="step-number">1</span><h2 className="text-sm font-bold">표적 사진 등록</h2></div>
          {hasFileToAnalyze && <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400"><Check size={14} />등록 완료</span>}
        </div>
        <input ref={cameraInputRef} aria-label="카메라 사진 선택" type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
        <input ref={fileInputRef} aria-label="앨범 사진 선택" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        <div className="grid grid-cols-[1.15fr_1fr] gap-2.5">
          <button disabled={isLoading} onClick={() => cameraInputRef.current?.click()} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-red-600 px-3 text-sm font-bold text-white shadow-sm shadow-red-600/20 transition active:scale-[.98] hover:bg-red-700 disabled:opacity-40"><Camera size={21} />{hasFileToAnalyze ? '다시 촬영' : '표적 촬영'}</button>
          <button disabled={isLoading} onClick={() => fileInputRef.current?.click()} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold transition active:scale-[.98] dark:border-slate-700 dark:bg-slate-800"><ImageIcon size={20} />사진 선택</button>
        </div>
        {!hasFileToAnalyze && <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">표적 전체가 보이도록 정면에서 촬영해주세요.</p>}
      </div>
      <div className={`border-t p-4 sm:px-6 ${isAwaitingModeSelection ? 'border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20' : 'border-slate-100 dark:border-slate-800'}`}>
        <div className="mb-3 flex items-center gap-2.5"><span className={`step-number ${!hasFileToAnalyze ? 'opacity-40' : ''}`}>2</span><h2 className="text-sm font-bold">사격 유형 선택</h2><span className="ml-auto text-xs text-slate-500 dark:text-slate-400">{!hasFileToAnalyze ? '사진을 먼저 등록해주세요' : isAwaitingModeSelection ? '선택하면 분석 시작' : '선택한 발수는 참고용'}</span></div>
        <div className="grid grid-cols-4 gap-2" role="group" aria-label="사격 발수">
          {modes.slice(0, 4).map(mode => <button key={mode.value} disabled={isLoading || !hasFileToAnalyze} aria-pressed={hasFileToAnalyze && targetMode === mode.value && !isAwaitingModeSelection} onClick={() => onModeChange(mode.value)} className={`mode-button ${hasFileToAnalyze && targetMode === mode.value && !isAwaitingModeSelection ? 'mode-selected' : ''}`}>{mode.label}</button>)}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label="추가 사격 유형">
          {modes.slice(4).map(mode => <button key={mode.value} disabled={isLoading || !hasFileToAnalyze} aria-pressed={hasFileToAnalyze && targetMode === mode.value && !isAwaitingModeSelection} onClick={() => onModeChange(mode.value)} className={`mode-button ${hasFileToAnalyze && targetMode === mode.value && !isAwaitingModeSelection ? 'mode-selected' : ''}`}>{mode.label}<span className="ml-2 text-[11px] font-normal opacity-70">{mode.value === 'blank' ? '집탄 확인' : '개수 제한 없이'}</span></button>)}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-1 border-t border-slate-100 bg-slate-50/70 px-4 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-950/40 sm:px-6">
        <button onClick={onOpenSettings} className="flex min-h-11 items-center gap-2 font-medium text-slate-600 dark:text-slate-400"><span className={`h-1.5 w-1.5 rounded-full ${hasApiKey ? 'bg-emerald-500' : 'bg-slate-400'}`} />{hasApiKey ? 'Gemini AI 분석' : '기기에서 분석'}<ArrowUpRight size={13} /></button>
        {hasApiKey && hasFileToAnalyze && onTriggerAiAnalysis && <button onClick={onTriggerAiAnalysis} disabled={isLoading} className="flex min-h-11 items-center gap-1.5 font-semibold text-red-600 disabled:opacity-40"><RefreshCw size={14} />AI 재분석</button>}
        {!hasApiKey && <span className="text-slate-500 dark:text-slate-400">API 키 없이 시작할 수 있어요</span>}
      </div>
    </section>
  );
};
