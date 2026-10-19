/**
 * [TargetScan AI 메인 애플리케이션 컴포넌트]
 * 작성자: 디자인 실장 영자 & 개발부장 코다리
 * 의도: 모바일 퍼스트 반응형 레이아웃, 라이트/다크 듀얼 테마, 직관적인 시각적 피드백 제공
 */

import React, { useState, useEffect, useMemo } from 'react';
import { TargetCalibration, ShotPoint, SavedSession, TargetMode } from './types/target';
import { SAMPLE_PRESETS, SamplePreset, generateSampleTargetImage } from './utils/targetSamples';
import { processTargetImage } from './utils/visionProcessor';
import { calculateGroupingStats } from './utils/issfSpecs';
import { Header } from './components/Header';
import { ScannerPanel } from './components/ScannerPanel';
import { TargetCanvas } from './components/TargetCanvas';
import { ScoreBoard } from './components/ScoreBoard';
import { HistoryModal } from './components/HistoryModal';
import { CheckCircle2, Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  // 테마 상태 (기본값: 라이트 모드)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const stored = localStorage.getItem('targetscan_theme');
      if (stored === 'light' || stored === 'dark') return stored;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  // 사격 모드 (10발 / 20발 / 자유 / 백지)
  const [targetMode, setTargetMode] = useState<TargetMode>('10shots');

  const targetShotCount = useMemo(() => {
    if (targetMode === '10shots') return 10;
    if (targetMode === '20shots') return 20;
    if (targetMode === 'blank') return 20;
    return 0; // free (자유)
  }, [targetMode]);

  const [imageUrl, setImageUrl] = useState<string>('');
  const [calibration, setCalibration] = useState<TargetCalibration>({
    centerX: 400,
    centerY: 400,
    blackRadiusPx: 244,
    pxPerMm: 16.0,
  });
  const [shots, setShots] = useState<ShotPoint[]>([]);
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  const [activePresetId, setActivePresetId] = useState<string>(SAMPLE_PRESETS[0].id);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  // 로컬 저장소 세션 히스토리
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>(() => {
    try {
      const stored = localStorage.getItem('targetscan_sessions');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // 테마 동기화 (HTML root 태그에 'dark' 클래스 토글)
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('targetscan_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // 집탄 통계 계산 (목표 발수 동적 반영)
  const stats = useMemo(() => calculateGroupingStats(shots, targetShotCount), [shots, targetShotCount]);

  // 토스트 메시지
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // 프리셋 로드 핸들러
  const handleSelectPreset = async (preset: SamplePreset) => {
    try {
      setIsLoading(true);
      setActivePresetId(preset.id);
      const generatedUrl = await generateSampleTargetImage(preset);
      const result = await processTargetImage(generatedUrl, preset.shotOffsetsMm);

      setImageUrl(result.normalizedImageUrl);
      setCalibration(result.calibration);
      setShots(result.detectedShots);
      setSelectedShotId(null);
      showToast(`'${preset.name}' 샘플이 로드되었습니다.`);
    } catch (err) {
      console.error(err);
      showToast('샘플 생성 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 파일 업로드 핸들러
  const handleFileUpload = async (file: File) => {
    try {
      setIsLoading(true);
      setActivePresetId('');
      const result = await processTargetImage(file, undefined, {
        mode: targetMode,
        targetCount: targetShotCount,
      });

      setImageUrl(result.normalizedImageUrl);
      setCalibration(result.calibration);
      setShots(result.detectedShots);
      setSelectedShotId(null);
      showToast(`표적지 분석 완료! (${result.detectedShots.length}발 감지됨)`);
    } catch (err) {
      console.error(err);
      showToast('표적지 이미지 분석에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 현재 세션 저장
  const handleSaveSession = () => {
    if (shots.length === 0) return;

    const newSession: SavedSession = {
      id: `session-${Date.now()}`,
      date: new Date().toLocaleString('ko-KR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      mode: targetMode,
      shots: [...shots],
      stats: { ...stats },
      targetImage: imageUrl,
    };

    const updated = [newSession, ...savedSessions];
    setSavedSessions(updated);
    try {
      localStorage.setItem('targetscan_sessions', JSON.stringify(updated));
    } catch (e) {
      console.warn('LocalStorage 저장 한도 초과:', e);
    }
    showToast('사격 세션이 기록 일지에 저장되었습니다!');
  };

  // 저장된 세션 복원
  const handleLoadSession = (session: SavedSession) => {
    if (session.targetImage) setImageUrl(session.targetImage);
    setShots(session.shots);
    setSelectedShotId(null);
    showToast(`'${session.date}' 세션을 불러왔습니다.`);
  };

  // 세션 삭제
  const handleDeleteSession = (id: string) => {
    const updated = savedSessions.filter((s) => s.id !== id);
    setSavedSessions(updated);
    localStorage.setItem('targetscan_sessions', JSON.stringify(updated));
    showToast('세션 기록이 삭제되었습니다.');
  };

  // 초기 마운트 시 1번 프리셋 자동 로드
  useEffect(() => {
    handleSelectPreset(SAMPLE_PRESETS[0]);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0C1014] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* 상단 헤더 */}
      <Header
        onSaveSession={handleSaveSession}
        onOpenHistory={() => setIsHistoryOpen(true)}
        hasShots={shots.length > 0}
        historyCount={savedSessions.length}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* 메인 작업 영역 (모바일 최적화 패딩) */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 flex flex-col gap-5 pb-16">
        {/* 업로드 & 프리셋 패널 */}
        <ScannerPanel
          onSelectPreset={handleSelectPreset}
          onFileUpload={handleFileUpload}
          isLoading={isLoading}
          activePresetId={activePresetId}
          targetMode={targetMode}
          onModeChange={setTargetMode}
        />

        {/* 로딩 인디케이터 */}
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-24 text-slate-500 dark:text-slate-400 gap-3">
            <Loader2 className="w-9 h-9 text-red-500 animate-spin stroke-[2.5]" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              표적지 왜곡 보정 및 정밀 탄흔 감지 중...
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* 좌측: 인터랙티브 표적 캔버스 (7열) */}
            <div className="lg:col-span-7 flex flex-col items-center w-full">
              <TargetCanvas
                imageUrl={imageUrl}
                calibration={calibration}
                shots={shots}
                selectedShotId={selectedShotId}
                onShotsChange={setShots}
                onSelectShot={setSelectedShotId}
                mpi={{ x_mm: stats.mpiX_mm, y_mm: stats.mpiY_mm }}
                targetCount={targetShotCount}
              />
            </div>

            {/* 우측: 실시간 스코어보드 & 통계 분석 (5열) */}
            <div className="lg:col-span-5 flex flex-col w-full">
              <ScoreBoard
                shots={shots}
                stats={stats}
                selectedShotId={selectedShotId}
                onSelectShot={setSelectedShotId}
              />
            </div>
          </div>
        )}
      </main>

      {/* 히스토리 모달 */}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        sessions={savedSessions}
        onLoadSession={handleLoadSession}
        onDeleteSession={handleDeleteSession}
      />

      {/* 토스트 알림 */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 px-4 py-3 rounded-2xl shadow-2xl text-xs font-black flex items-center gap-2 backdrop-blur-md animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 flex-shrink-0" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
};
