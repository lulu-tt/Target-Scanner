/**
 * [TargetScan AI 메인 애플리케이션 컴포넌트]
 * 작성자: 코다리 개발부장
 * 의도: Phase 1 코어 MVP 통합 - 10m 공기소총 표적 스캐너, 인터랙티브 캔버스,
 *       실시간 ISSF 10.9 소수점 채점 및 로컬 세션 저장 기능을 통합 제공합니다.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { TargetCalibration, ShotPoint, SavedSession } from './types/target';
import { SAMPLE_PRESETS, SamplePreset, generateSampleTargetImage } from './utils/targetSamples';
import { processTargetImage } from './utils/visionProcessor';
import { calculateGroupingStats } from './utils/issfSpecs';
import { Header } from './components/Header';
import { ScannerPanel } from './components/ScannerPanel';
import { TargetCanvas } from './components/TargetCanvas';
import { ScoreBoard } from './components/ScoreBoard';
import { HistoryModal } from './components/HistoryModal';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [calibration, setCalibration] = useState<TargetCalibration>({
    centerX: 400,
    centerY: 400,
    blackRadiusPx: 244,
    pxPerMm: 16.0,
  });
  const [shots, setShots] = useState<ShotPoint[]>([]);
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
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

  // 집탄 통계 계산
  const stats = useMemo(() => calculateGroupingStats(shots), [shots]);

  // 토스트 메시지 도우미
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // 프리셋 로드 핸들러
  const handleSelectPreset = async (preset: SamplePreset) => {
    try {
      setIsLoading(true);
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
      const result = await processTargetImage(file);

      setImageUrl(result.normalizedImageUrl);
      setCalibration(result.calibration);
      setShots(result.detectedShots);
      setSelectedShotId(null);
      showToast(`표적지 이미지 분석 완료! (${result.detectedShots.length}발 감지됨)`);
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
    <div className="min-h-screen bg-[#0C1014] text-slate-100 flex flex-col font-sans">
      {/* 상단 헤더 */}
      <Header
        onSaveSession={handleSaveSession}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onReset={() => handleSelectPreset(SAMPLE_PRESETS[0])}
        hasShots={shots.length > 0}
        historyCount={savedSessions.length}
      />

      {/* 메인 작업 영역 */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col gap-5">
        {/* 업로드 & 프리셋 패널 */}
        <ScannerPanel
          onSelectPreset={handleSelectPreset}
          onFileUpload={handleFileUpload}
          isLoading={isLoading}
        />

        {/* 로딩 인디케이터 */}
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
            <p className="text-sm font-semibold">표적지 기하 왜곡 보정 및 탄흔 분석 중...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* 좌측: 인터랙티브 표적 캔버스 (7열) */}
            <div className="lg:col-span-7 flex flex-col items-center">
              <TargetCanvas
                imageUrl={imageUrl}
                calibration={calibration}
                shots={shots}
                selectedShotId={selectedShotId}
                onShotsChange={setShots}
                onSelectShot={setSelectedShotId}
                mpi={{ x_mm: stats.mpiX_mm, y_mm: stats.mpiY_mm }}
              />
            </div>

            {/* 우측: 실시간 스코어보드 & 통계 분석 (5열) */}
            <div className="lg:col-span-5 flex flex-col">
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
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-slate-700 text-slate-100 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
};
