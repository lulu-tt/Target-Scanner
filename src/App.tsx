/**
 * [TargetScan AI 메인 애플리케이션 컴포넌트]
 * 작성자: 디자인 실장 영자 & 개발부장 코다리
 * 의도:
 *   1. [하이브리드 AI 비전 파이프라인]: Google Gemini 2.5 Flash(100% 정밀) + 온디바이스 v3.0(0초 즉시)
 *   2. [손글씨/메모 완전 무시]: 코치 메모, 볼펜 손글씨 완벽 배제
 *   3. [모바일 퍼스트 레이아웃]: 한 손 터치, 라이트/다크 테마, 실시간 집탄 분석
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { TargetCalibration, ShotPoint, SavedSession, TargetMode } from './types/target';
import { SAMPLE_PRESETS, SamplePreset, generateSampleTargetImage } from './utils/targetSamples';
import { processTargetImage, VisionProcessResult } from './utils/visionProcessor';
import { analyzeTargetWithGemini, getStoredGeminiApiKey } from './utils/geminiVision';
import { calculateGroupingStats, calculateShotScore } from './utils/issfSpecs';
import { Header } from './components/Header';
import { ScannerPanel } from './components/ScannerPanel';
import { TargetCanvas } from './components/TargetCanvas';
import { ScoreBoard } from './components/ScoreBoard';
import { HistoryModal } from './components/HistoryModal';
import { SettingsModal } from './components/SettingsModal';
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';

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

  // 사격 모드 (10발 / 15발 / 20발 / 30발 / 자유 / 백지)
  const [targetMode, setTargetMode] = useState<TargetMode>('10shots');

  const targetShotCount = useMemo(() => {
    if (targetMode === '10shots') return 10;
    if (targetMode === '15shots') return 15;
    if (targetMode === '20shots') return 20;
    if (targetMode === '30shots') return 30;
    if (targetMode === 'blank') return 20;
    return 0; // free (자유)
  }, [targetMode]);

  const [imageUrl, setImageUrl] = useState<string>('');
  const [currentFile, setCurrentFile] = useState<File | null>(null);
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
  const [loadingMessage, setLoadingMessage] = useState<string>('표적지 왜곡 보정 및 탄흔 감지 중...');
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => getStoredGeminiApiKey());
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
      setLoadingMessage('표준 샘플 표적지 생성 중...');
      setCurrentFile(null);
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

  // 통합 표적 분석 파이프라인 (AI 키가 있으면 Gemini AI 우선, 없거나 실패 시 온디바이스 v3.0 폴백)
  const executeAnalysis = useCallback(
    async (file: File, mode: TargetMode, count: number, forceAi = false) => {
      try {
        setIsLoading(true);

        let result: VisionProcessResult;

        if (forceAi && !geminiApiKey) {
          setIsSettingsOpen(true);
          showToast('Gemini API 키를 먼저 등록해주세요.');
          return;
        }

        if (geminiApiKey) {
          setLoadingMessage('✨ Google Gemini AI 멀티모달 비전 정밀 분석 중...');
          try {
            result = await analyzeTargetWithGemini(file, geminiApiKey, {
              mode,
              targetCount: count,
            });
            showToast(`✨ Gemini AI 정밀 분석 완료! (${result.detectedShots.length}발 감지됨)`);
          } catch (aiErr: any) {
            console.warn('Gemini AI 분석 실패, 온디바이스 v3.0 엔진으로 자동 폴백합니다:', aiErr);
            showToast('AI 분석 일시 지연: 온디바이스 v3.0 엔진으로 대체 분석합니다.');
            setLoadingMessage('온디바이스 고성능 비전 엔진으로 대체 분석 중...');
            result = await processTargetImage(file, undefined, {
              mode,
              targetCount: count,
            });
          }
        } else {
          setLoadingMessage('⚡ 온디바이스 컴퓨터 비전 v3.0 분석 중...');
          result = await processTargetImage(file, undefined, {
            mode,
            targetCount: count,
          });
          showToast(`온디바이스 분석 완료! (${result.detectedShots.length}발 감지됨)`);
        }

        setImageUrl(result.normalizedImageUrl);
        setCalibration(result.calibration);
        setShots(result.detectedShots);
        setSelectedShotId(null);
      } catch (err) {
        console.error(err);
        showToast('표적지 이미지 분석에 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    },
    [geminiApiKey]
  );

  // 파일 업로드 핸들러
  const handleFileUpload = async (file: File) => {
    setCurrentFile(file);
    setActivePresetId('');
    await executeAnalysis(file, targetMode, targetShotCount);
  };

  // 수동 AI 정밀 재분석 트리거
  const handleTriggerAiAnalysis = async () => {
    if (!currentFile) {
      showToast('분석할 표적지 사진이 없습니다.');
      return;
    }
    await executeAnalysis(currentFile, targetMode, targetShotCount, true);
  };

  // 사격 모드 변경 핸들러 (업로드된 파일이 있을 경우 즉시 새 발수로 자동 재분석)
  const handleModeChange = async (newMode: TargetMode) => {
    setTargetMode(newMode);

    let newCount = 10;
    if (newMode === '10shots') newCount = 10;
    else if (newMode === '15shots') newCount = 15;
    else if (newMode === '20shots') newCount = 20;
    else if (newMode === '30shots') newCount = 30;
    else if (newMode === 'blank') newCount = 20;
    else newCount = 0; // free

    if (currentFile) {
      await executeAnalysis(currentFile, newMode, newCount);
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

  // 과녁 중심(초점) 및 가상선 보정 핸들러 (중심/반경 변경 시 모든 샷 점수 실시간 재계산)
  const handleCalibrationChange = (newCalib: TargetCalibration) => {
    setCalibration(newCalib);
    setShots((prev) =>
      prev.map((shot) => {
        const scoreData = calculateShotScore(shot.pixelX, shot.pixelY, newCalib);
        return {
          ...shot,
          offsetX_mm: scoreData.offsetX_mm,
          offsetY_mm: scoreData.offsetY_mm,
          distance_mm: scoreData.distanceMm,
          score: scoreData.score,
        };
      })
    );
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
        onOpenSettings={() => setIsSettingsOpen(true)}
        hasApiKey={!!geminiApiKey}
      />

      {/* 메인 작업 영역 (모바일 최적화 패딩) */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 flex flex-col gap-5 pb-16">
        {/* 업로드 패널 */}
        <ScannerPanel
          onFileUpload={handleFileUpload}
          isLoading={isLoading}
          targetMode={targetMode}
          onModeChange={handleModeChange}
          hasApiKey={!!geminiApiKey}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onTriggerAiAnalysis={handleTriggerAiAnalysis}
          hasFileToAnalyze={!!currentFile}
        />

        {/* 로딩 인디케이터 */}
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-24 text-slate-500 dark:text-slate-400 gap-3">
            <div className="relative flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-indigo-500 animate-spin stroke-[2.5]" />
              <Sparkles className="w-4 h-4 text-amber-400 absolute animate-pulse" />
            </div>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              {loadingMessage}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* 좌측: 인터랙티브 표적 캔버스 (7열) */}
            <div className="lg:col-span-7 flex flex-col items-center w-full">
              <TargetCanvas
                imageUrl={imageUrl}
                calibration={calibration}
                onCalibrationChange={handleCalibrationChange}
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

      {/* AI 설정 모달 */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onApiKeySaved={(key) => {
          setGeminiApiKey(key);
          if (key) {
            showToast('Gemini API 키가 저장되었습니다! AI 모드가 활성화됩니다.');
          } else {
            showToast('API 키가 삭제되었습니다. 온디바이스 모드로 전환됩니다.');
          }
        }}
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
