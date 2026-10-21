import { completeScore } from './utils/scoreCompletion';
import { ScoreCompletion } from './components/ScoreCompletion';
import { RegionScoreReview } from './types/target';
import { UnresolvedRegion } from './utils/overlapDetection';
/**
 * [TargetScan AI 메인 애플리케이션 컴포넌트]
 * 작성자: 디자인 실장 영자 & 개발부장 코다리
 * 의도:
 *   1. [하이브리드 AI 비전 파이프라인]: Google Gemini 및 온디바이스 분석
 *   2. [손글씨/메모 완전 무시]: 코치 메모, 볼펜 손글씨 완벽 배제
 *   3. [모바일 퍼스트 레이아웃]: 한 손 터치, 라이트/다크 테마, 실시간 집탄 분석
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { CheckCircle2, Loader2, ScanLine, BarChart3, History, BookmarkPlus, ArrowRight, Target } from 'lucide-react';

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

  const [mobileView, setMobileView] = useState<'target' | 'results'>('target');
  const workspaceRef = useRef<HTMLDivElement>(null);

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
  const [scoreReviews, setScoreReviews] = useState<RegionScoreReview[]>([]);
  const [scoreAcknowledged, setScoreAcknowledged] = useState(false);
  const [cardTotal, setCardTotal] = useState<number | null>(null);
  const resetScoreReview = () => { setScoreReviews([]); setScoreAcknowledged(false); setCardTotal(null); };
  const [unresolvedRegions, setUnresolvedRegions] = useState<UnresolvedRegion[]>([]);
  const [analysisWarnings, setAnalysisWarnings] = useState<string[]>([]);
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  const [activePresetId, setActivePresetId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('표적지 왜곡 보정 및 탄흔 감지 중...');
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => getStoredGeminiApiKey());
  const [toast, setToast] = useState<string | null>(null);
  const [isAwaitingModeSelection, setIsAwaitingModeSelection] = useState<boolean>(false);

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
      setMobileView('target');
      setCurrentFile(null);
      setActivePresetId(preset.id);
      setIsAwaitingModeSelection(false);
      const generatedUrl = await generateSampleTargetImage(preset);
      const result = await processTargetImage(generatedUrl, preset.shotOffsetsMm);

      setImageUrl(result.normalizedImageUrl);
      setCalibration(result.calibration);
      setShots(result.detectedShots);
      resetScoreReview();
      setUnresolvedRegions(result.unresolvedRegions ?? []);
      setAnalysisWarnings(result.warnings ?? []);
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
            // AI suggestions share the same locally fitted calibration and overlap review regions.
            const geometry = await processTargetImage(file, undefined, { mode, targetCount: count });
            result = {
              ...geometry,
              detectedShots: result.detectedShots.map(shot => {
                const scored = calculateShotScore(shot.pixelX, shot.pixelY, geometry.calibration);
                return { ...shot, score: scored.score, distance_mm: scored.distanceMm, offsetX_mm: scored.offsetX_mm, offsetY_mm: scored.offsetY_mm };
              }),
              warnings: [...(geometry.warnings ?? []), 'AI의 위치 제안은 800px 사진 기반 추정입니다. 표적 보정과 겹침 영역은 원본 영역 분석 결과를 사용합니다.'],
            };
            showToast(`Gemini AI: 감지·추정 위치 ${result.detectedShots.length}개. 결과를 확인해주세요.`);
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
          showToast(`온디바이스: 감지·추정 위치 ${result.detectedShots.length}개. 결과를 확인해주세요.`);
        }

        setMobileView('target');
        setImageUrl(result.normalizedImageUrl);
        setCalibration(result.calibration);
        setShots(result.detectedShots);
        resetScoreReview();
        setUnresolvedRegions(result.unresolvedRegions ?? []);
        setAnalysisWarnings(result.warnings ?? []);
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

  // 파일 업로드 핸들러: [프로세스 개편] 사진 먼저 등록 -> 사격 목표 발수/유형 선택 순서
  const handleFileUpload = async (file: File) => {
    setMobileView('target');
    setAnalysisWarnings([]);
    setUnresolvedRegions([]);
    setCurrentFile(file);
    setActivePresetId('');
    setSelectedShotId(null);

    // 1단계: 사진을 즉시 캔버스에 프리뷰로 표시
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        setImageUrl(dataUrl);
        resetScoreReview();
        setShots([]); // 이전 핀 초기화하여 깨끗한 표적지 사진 표시
      }
    };
    reader.readAsDataURL(file);

    // 2단계 모드 선택 대기 상태 활성화
    setIsAwaitingModeSelection(true);
    showToast('📸 사진 등록 완료! [2단계] 사격 목표 발수를 선택해주세요.');
  };

  // 수동 AI 정밀 재분석 트리거
  const handleTriggerAiAnalysis = async () => {
    if (!currentFile) {
      showToast('분석할 표적지 사진이 없습니다.');
      return;
    }
    setIsAwaitingModeSelection(false);
    await executeAnalysis(currentFile, targetMode, targetShotCount, true);
  };

  // 사격 모드 변경 핸들러 (사진 등록 후 발수 선택 시 즉시 정밀 분석 실행)
  const handleModeChange = async (newMode: TargetMode) => {
    setTargetMode(newMode);
    setIsAwaitingModeSelection(false);

    let newCount = 10;
    if (newMode === '10shots') newCount = 10;
    else if (newMode === '15shots') newCount = 15;
    else if (newMode === '20shots') newCount = 20;
    else if (newMode === '30shots') newCount = 30;
    else if (newMode === 'blank') newCount = 20;
    else newCount = 0; // free

    if (currentFile) {
      await executeAnalysis(currentFile, newMode, newCount);
    } else {
      showToast(`'${newMode === 'blank' ? '백지 사격' : (newCount > 0 ? newCount + '발' : '자유 발수')}' 모드가 선택되었습니다. 표적지 사진을 먼저 등록해주세요.`);
    }
  };

  // 현재 세션 저장
  const handleSaveSession = () => {
    if (!imageUrl) return;

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
      analysisWarnings: [...analysisWarnings],
      calibration: { ...calibration },
      unresolvedRegions: [...unresolvedRegions],
      scoreReviews, scoreAcknowledged, cardTotal,
      reviewedScore: (()=>{ const r=completeScore(shots,unresolvedRegions,scoreReviews,targetShotCount,calibration,scoreAcknowledged,cardTotal);return {complete:r.complete,total:r.total,expected:targetShotCount,source:r.override?'card-total':'located-and-regions'}; })(),
    };

    const updated = [newSession, ...savedSessions];
    try {
      localStorage.setItem('targetscan_sessions', JSON.stringify(updated));
      setSavedSessions(updated);
    } catch (e) {
      showToast('저장 공간이 부족합니다. 이전 기록을 정리한 후 다시 저장해주세요.');
      return;
    }
    showToast('사격 세션이 기록 일지에 저장되었습니다!');
  };

  // 저장된 세션 복원
  const handleLoadSession = (session: SavedSession) => {
    setCurrentFile(null);
    setActivePresetId('');
    setIsAwaitingModeSelection(false);
    setTargetMode(session.mode ?? '10shots');
    if (session.calibration) setCalibration(session.calibration);
    setMobileView('target');
    if (session.targetImage) setImageUrl(session.targetImage);
    setShots(session.shots);
    setScoreReviews(session.scoreReviews ?? []); setScoreAcknowledged(session.scoreAcknowledged ?? false); setCardTotal(session.cardTotal ?? null);
    setUnresolvedRegions(session.unresolvedRegions ?? []);
    setAnalysisWarnings(session.analysisWarnings ?? ['이전 버전 기록은 임의 보충된 탄착점을 포함할 수 있습니다. 원본 사진으로 다시 분석해주세요.']);
    setSelectedShotId(null);
    showToast(`'${session.date}' 세션을 불러왔습니다.`);
  };

  // 세션 삭제
  const handleDeleteSession = (id: string) => {
    const updated = savedSessions.filter((s) => s.id !== id);
    try {
      localStorage.setItem('targetscan_sessions', JSON.stringify(updated));
      setSavedSessions(updated);
      showToast('세션 기록이 삭제되었습니다.');
    } catch {
      showToast('기록을 삭제하지 못했습니다. 브라우저 저장소 설정을 확인해주세요.');
    }
  };

  // 과녁 중심(초점) 및 가상선 보정 핸들러 (중심/반경 변경 시 모든 샷 점수 실시간 재계산)
  const handleCalibrationChange = (newCalib: TargetCalibration) => {
    const geometryChanged = newCalib.centerX !== calibration.centerX || newCalib.centerY !== calibration.centerY || newCalib.pxPerMm !== calibration.pxPerMm || newCalib.pxPerMmY !== calibration.pxPerMmY;
    if (geometryChanged) {
      resetScoreReview();
      if (scoreReviews.length || scoreAcknowledged || cardTotal !== null) showToast('보정값이 바뀌어 추가 점수와 총점 확인을 초기화했습니다.');
    } else setScoreAcknowledged(false);
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

  const goToWorkspace = (view: 'target' | 'results') => {
    setMobileView(view);
    requestAnimationFrame(() => workspaceRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' }));
  };

  useEffect(() => {
    if (imageUrl && !isLoading && !isAwaitingModeSelection) {
      workspaceRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  }, [imageUrl, isLoading, isAwaitingModeSelection]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0C1014] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* 상단 헤더 */}
      <Header
        onSaveSession={handleSaveSession}
        onOpenHistory={() => setIsHistoryOpen(true)}
        hasShots={!!imageUrl && !isLoading && !isAwaitingModeSelection}
        historyCount={savedSessions.length}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setIsSettingsOpen(true)}
        hasApiKey={!!geminiApiKey}
      />

      <main className="app-main mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 pt-6 sm:px-6 sm:pt-8">
        <div className="flex items-end justify-between gap-3">
          <div><p className="mb-1 text-[11px] font-bold uppercase tracking-[.2em] text-red-600 dark:text-red-400">TARGET SCANNER</p><h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">한 장으로 확인하는<br className="sm:hidden" /> 오늘의 사격</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">사진을 등록하고, 탄착점을 직접 확인하세요.</p></div>
          <span className="hidden rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900 sm:block">10m AIR RIFLE</span>
        </div>
        <ScannerPanel onFileUpload={handleFileUpload} isLoading={isLoading} targetMode={targetMode} onModeChange={handleModeChange} hasApiKey={!!geminiApiKey} onOpenSettings={() => setIsSettingsOpen(true)} onTriggerAiAnalysis={handleTriggerAiAnalysis} hasFileToAnalyze={!!currentFile} isAwaitingModeSelection={isAwaitingModeSelection} />
        <div ref={workspaceRef} className="analysis-workspace min-w-0">
          {isLoading ? (
            <div role="status" aria-live="polite" className="surface-card flex min-h-64 flex-col items-center justify-center gap-4 p-6 text-center"><Loader2 className="h-9 w-9 animate-spin text-red-600" /><p className="text-sm font-semibold">{loadingMessage}</p><p className="text-xs text-slate-500">분석이 끝나면 표적에서 후보 위치를 확인할 수 있습니다.</p></div>
          ) : !imageUrl ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white/40 p-7 text-center dark:border-slate-700 dark:bg-slate-900/40"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800"><ScanLine size={24} /></div><h3 className="text-sm font-bold">첫 표적을 등록해보세요</h3><p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">사진 촬영부터 탄착점 보정, 기록 저장까지<br />이 화면에서 이어서 할 수 있어요.</p><button onClick={() => handleSelectPreset(SAMPLE_PRESETS[0])} className="mx-auto mt-3 flex min-h-11 items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">샘플로 둘러보기 <ArrowRight size={14} /></button></div>
          ) : isAwaitingModeSelection ? (
            <div className="surface-card overflow-hidden"><img src={imageUrl} alt="분석할 표적 사진 미리보기" className="max-h-72 w-full bg-slate-100 object-contain dark:bg-slate-800" /><div role="status" className="p-4"><p className="text-sm font-bold">사진이 준비됐어요</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">위에서 사격 유형을 선택하면 분석을 시작합니다.</p></div></div>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-base font-bold"><Target size={18} className="text-red-600" />{activePresetId ? '샘플 분석' : '표적 분석'}</h2><span className="text-xs text-slate-500 dark:text-slate-400">탄착점 {shots.length}개 · 수동 확인 필요</span></div>
              <div role="group" aria-label="분석 화면 선택" className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-slate-200/60 p-1 dark:bg-slate-800 lg:hidden">
                <button aria-pressed={mobileView === 'target'} onClick={() => setMobileView('target')} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold ${mobileView === 'target' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}><ScanLine size={17} />표적 보정</button>
                <button aria-pressed={mobileView === 'results'} onClick={() => setMobileView('results')} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold ${mobileView === 'results' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}><BarChart3 size={17} />분석 결과</button>
              </div>
              <div className="grid min-w-0 items-start gap-5 lg:grid-cols-12">
                <div className={`min-w-0 lg:col-span-7 lg:block ${mobileView === 'target' ? 'block' : 'hidden'}`}>
                  <TargetCanvas unresolvedRegions={unresolvedRegions} imageUrl={imageUrl} calibration={calibration} onCalibrationChange={handleCalibrationChange} shots={shots} selectedShotId={selectedShotId} onShotsChange={(next) => { setShots(next); resetScoreReview(); }} onSelectShot={setSelectedShotId} mpi={{ x_mm: stats.mpiX_mm, y_mm: stats.mpiY_mm }} targetCount={targetShotCount} />
                  <button onClick={() => goToWorkspace('results')} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 text-sm font-bold text-white dark:bg-slate-800 lg:hidden">분석 결과 확인 <ArrowRight size={17} /></button>
                </div>
                <div className={`min-w-0 space-y-4 lg:col-span-5 lg:block ${mobileView === 'results' ? 'block' : 'hidden'}`}>
                  <ScoreCompletion shots={shots} regions={unresolvedRegions} reviews={scoreReviews} calibration={calibration} expected={targetShotCount} acknowledged={scoreAcknowledged} cardTotal={cardTotal} onReviews={setScoreReviews} onAcknowledge={setScoreAcknowledged} onCardTotal={setCardTotal}/>
                  <ScoreBoard unresolvedRegions={unresolvedRegions} shots={shots} stats={stats} targetCount={targetShotCount} analysisWarnings={analysisWarnings} selectedShotId={selectedShotId} onSelectShot={(id) => { setSelectedShotId(id); if (id) goToWorkspace('target'); }} />
                </div>
              </div>
            </>
          )}
        </div>
      </main>
      <nav aria-label="주요 작업" className="mobile-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-200 bg-white/95 px-2 pt-2 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95 lg:hidden">
        <button onClick={() => { setMobileView('target'); window.scrollTo({ top: 0, behavior: 'auto' }); }} className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold text-slate-500 dark:text-slate-400"><ScanLine size={20} />스캔</button>
        <button disabled={!imageUrl || isLoading || isAwaitingModeSelection} onClick={() => goToWorkspace('results')} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold disabled:opacity-30 ${mobileView === 'results' ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}><BarChart3 size={20} />결과</button>
        <button onClick={() => setIsHistoryOpen(true)} className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold text-slate-500 dark:text-slate-400"><History size={20} />기록 {savedSessions.length > 0 ? savedSessions.length : ''}</button>
        <button disabled={!imageUrl || isLoading || isAwaitingModeSelection} onClick={handleSaveSession} className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl bg-red-600 text-[11px] font-bold text-white disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-slate-800"><BookmarkPlus size={20} />기록 저장</button>
      </nav>

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
        <div role="status" className="app-toast fixed left-4 right-4 z-[80] sm:left-auto sm:max-w-md bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 px-4 py-3 rounded-2xl shadow-2xl text-xs font-black flex items-center gap-2 backdrop-blur-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 flex-shrink-0" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
};
