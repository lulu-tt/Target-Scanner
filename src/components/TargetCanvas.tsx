/**
 * [영자 실장의 모던 인터랙티브 표적 캔버스 컴포넌트]
 * 작성자: 디자인 실장 영자 & 코다리 부장
 * 의도: 모바일 엄지손가락에 맞춘 대형 플로팅 툴바(42px 이상)와
 *       3.5배 돋보기 루페 및 부드러운 터치 인터랙션을 제공합니다.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { TargetCalibration, ShotPoint } from '../types/target';
import { ISSF_AIR_RIFLE, calculateShotScore } from '../utils/issfSpecs';
import { ZoomIn, ZoomOut, RotateCcw, Eye, EyeOff, Crosshair, Target, Trash2, Sparkles, Layers, Sliders, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Check, Tag } from 'lucide-react';

interface TargetCanvasProps {
  imageUrl: string;
  calibration: TargetCalibration;
  onCalibrationChange?: (calibration: TargetCalibration) => void;
  shots: ShotPoint[];
  selectedShotId: string | null;
  onShotsChange: (shots: ShotPoint[]) => void;
  onSelectShot: (id: string | null) => void;
  mpi: { x_mm: number; y_mm: number };
  targetCount?: number;
}

export const TargetCanvas: React.FC<TargetCanvasProps> = ({
  imageUrl,
  calibration,
  onCalibrationChange,
  shots,
  selectedShotId,
  onShotsChange,
  onSelectShot,
  mpi,
  targetCount = 10,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const magnifierRef = useRef<HTMLCanvasElement>(null);

  // 뷰포트 상태 (줌 & 팬)
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // 토글 옵션
  const [showRings, setShowRings] = useState(true);
  const [showShots, setShowShots] = useState(true);
  const [showScoreLabels, setShowScoreLabels] = useState(true);
  const [showMpi, setShowMpi] = useState(true);
  const [isCalibrating, setIsCalibrating] = useState(false);

  // 과녁 중심(Bullseye) 및 링 크기 수동 미세조정 핸들러
  const handleAdjustCenter = (dx: number, dy: number) => {
    if (!onCalibrationChange) return;
    const newCalib: TargetCalibration = {
      ...calibration,
      centerX: Math.round(calibration.centerX + dx),
      centerY: Math.round(calibration.centerY + dy),
    };
    onCalibrationChange(newCalib);
  };

  const handleAdjustRadius = (delta: number) => {
    if (!onCalibrationChange) return;
    const newRadius = Math.max(40, Math.min(250, calibration.blackRadiusPx + delta));
    const newPxPerMm = Number((newRadius / ISSF_AIR_RIFLE.BLACK_CIRCLE_RADIUS_MM).toFixed(3));
    const newCalib: TargetCalibration = {
      ...calibration,
      blackRadiusPx: newRadius,
      pxPerMm: newPxPerMm,
    };
    onCalibrationChange(newCalib);
  };

  // 드래그 중인 탄착점 상태
  const [draggingShotId, setDraggingShotId] = useState<string | null>(null);
  const [dragCurrentPos, setDragCurrentPos] = useState<{ x: number; y: number } | null>(null);

  // 로드된 이미지 캐시
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setBgImage(img);
    img.src = imageUrl;
  }, [imageUrl]);

  // 캔버스 렌더링 루프
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bgImage) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    ctx.clearRect(0, 0, size, size);

    // 1. 보정된 표적지 배경 렌더링
    ctx.drawImage(bgImage, 0, 0, size, size);

    // 2. ISSF 공식 동심원 오버레이 (옵션)
    if (showRings) {
      ctx.save();
      // 10점 중앙 점
      ctx.beginPath();
      ctx.arc(
        calibration.centerX,
        calibration.centerY,
        (ISSF_AIR_RIFLE.RING_10_DIAMETER_MM / 2) * calibration.pxPerMm,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = '#FFD700';
      ctx.fill();

      // 9점 ~ 1점 링
      for (let r = 9; r >= 1; r--) {
        const ringDiameterMm = 0.5 + (10 - r) * 5.0;
        const radiusPx = (ringDiameterMm / 2.0) * calibration.pxPerMm;

        ctx.beginPath();
        ctx.arc(calibration.centerX, calibration.centerY, radiusPx, 0, Math.PI * 2);
        ctx.strokeStyle = r >= 4 ? 'rgba(255, 255, 255, 0.45)' : 'rgba(50, 50, 50, 0.4)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3. MPI(탄착군 중심) 표시 (옵션)
    if (showMpi && shots.length > 1) {
      const mpiPxX = calibration.centerX + mpi.x_mm * calibration.pxPerMm;
      const mpiPxY = calibration.centerY + mpi.y_mm * calibration.pxPerMm;

      ctx.save();
      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 4]);

      // MPI 크로스헤어
      ctx.beginPath();
      ctx.moveTo(mpiPxX - 22, mpiPxY);
      ctx.lineTo(mpiPxX + 22, mpiPxY);
      ctx.moveTo(mpiPxX, mpiPxY - 22);
      ctx.lineTo(mpiPxX, mpiPxY + 22);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(mpiPxX, mpiPxY, 10, 0, Math.PI * 2);
      ctx.stroke();

      // MPI 뱃지
      ctx.fillStyle = '#00E5FF';
      ctx.font = 'black 12px sans-serif';
      ctx.fillText('MPI', mpiPxX + 12, mpiPxY - 10);
      ctx.restore();
    }

    // 4. 감지된 탄착점 핀 렌더링 (옵션)
    if (showShots) {
      const pelletPxRadius = ISSF_AIR_RIFLE.PELLET_RADIUS_MM * calibration.pxPerMm;

      shots.forEach((shot) => {
        const isSelected = shot.id === selectedShotId;
        const isDragging = shot.id === draggingShotId;
        const currentX = isDragging && dragCurrentPos ? dragCurrentPos.x : shot.pixelX;
        const currentY = isDragging && dragCurrentPos ? dragCurrentPos.y : shot.pixelY;

        ctx.save();

        // 4.5mm 납탄 구멍 외곽 테두리 (실제 탄착 범위)
        ctx.beginPath();
        ctx.arc(currentX, currentY, pelletPxRadius, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? 'rgba(239, 68, 68, 0.4)' : 'rgba(250, 204, 21, 0.25)';
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#EF4444' : shot.score >= 10.0 ? '#EAB308' : '#06B6D4';
        ctx.lineWidth = isSelected ? 3.5 : 2.2;
        ctx.stroke();

        // 중심 십자선 포인트
        ctx.beginPath();
        ctx.arc(currentX, currentY, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();

        // 탄환 번호 및 소수점 점수 뱃지 (시인성 강화 - 토글 지원)
        if (showScoreLabels) {
          ctx.fillStyle = isSelected ? '#EF4444' : '#0F172A';
          const labelText = `#${shot.shotNumber} (${shot.score.toFixed(1)})`;
          ctx.font = 'bold 13px sans-serif';
          const textWidth = ctx.measureText(labelText).width;

          const badgeX = currentX - textWidth / 2 - 8;
          const badgeY = currentY - pelletPxRadius - 26;

          ctx.beginPath();
          ctx.roundRect(badgeX, badgeY, textWidth + 16, 22, 6);
          ctx.fill();

          ctx.strokeStyle = isSelected ? '#FFFFFF' : 'rgba(255,255,255,0.25)';
          ctx.lineWidth = 1.2;
          ctx.stroke();

          ctx.fillStyle = '#FFFFFF';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(labelText, currentX, badgeY + 11);
        } else {
          // 점수 뱃지 OFF 시: 탄환 링 내부에 간결한 번호만 미니멀 표시 (탄착 구멍 가림 방지)
          ctx.fillStyle = isSelected ? '#FFFFFF' : '#0F172A';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${shot.shotNumber}`, currentX, currentY - 0.5);
        }

        ctx.restore();
      });
    }
  }, [bgImage, calibration, showRings, showShots, showScoreLabels, showMpi, shots, selectedShotId, draggingShotId, dragCurrentPos, mpi]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // 돋보기(Magnifier Loupe) 렌더링
  const updateMagnifier = useCallback((canvasX: number, canvasY: number) => {
    const magCanvas = magnifierRef.current;
    const mainCanvas = canvasRef.current;
    if (!magCanvas || !mainCanvas) return;
    const mCtx = magCanvas.getContext('2d');
    if (!mCtx) return;

    const magSize = magCanvas.width;
    const magZoom = 3.5;

    mCtx.clearRect(0, 0, magSize, magSize);

    mCtx.save();
    mCtx.beginPath();
    mCtx.arc(magSize / 2, magSize / 2, magSize / 2 - 2, 0, Math.PI * 2);
    mCtx.clip();

    const sourceW = magSize / magZoom;
    const sourceH = magSize / magZoom;
    const sourceX = canvasX - sourceW / 2;
    const sourceY = canvasY - sourceH / 2;

    mCtx.drawImage(mainCanvas, sourceX, sourceY, sourceW, sourceH, 0, 0, magSize, magSize);

    // 정밀 십자선
    mCtx.strokeStyle = '#EF4444';
    mCtx.lineWidth = 2;
    mCtx.beginPath();
    mCtx.moveTo(0, magSize / 2);
    mCtx.lineTo(magSize, magSize / 2);
    mCtx.moveTo(magSize / 2, 0);
    mCtx.lineTo(magSize / 2, magSize);
    mCtx.stroke();

    mCtx.beginPath();
    mCtx.arc(magSize / 2, magSize / 2, 5, 0, Math.PI * 2);
    mCtx.strokeStyle = '#FFFFFF';
    mCtx.lineWidth = 2;
    mCtx.stroke();

    mCtx.restore();
  }, []);

  // 마우스/터치 공통 좌표 변환
  const getCanvasCoordsFromClient = (clientX: number, clientY: number): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: cx * scaleX,
      y: cy * scaleY,
    };
  };

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    return getCanvasCoordsFromClient(e.clientX, e.clientY);
  };

  // 모바일 터치 시작 핸들러
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length !== 1 || !showShots) return;
    const touch = e.touches[0];
    const { x, y } = getCanvasCoordsFromClient(touch.clientX, touch.clientY);
    const pelletPxRadius = ISSF_AIR_RIFLE.PELLET_RADIUS_MM * calibration.pxPerMm;

    const clickedShot = shots.find((s) => Math.hypot(s.pixelX - x, s.pixelY - y) <= pelletPxRadius * 1.8);

    if (clickedShot) {
      onSelectShot(clickedShot.id);
      setDraggingShotId(clickedShot.id);
      setDragCurrentPos({ x: clickedShot.pixelX, y: clickedShot.pixelY });
      updateMagnifier(clickedShot.pixelX, clickedShot.pixelY);
    } else if (targetCount === 0 || shots.length < targetCount) {
      const newShotNumber = shots.length + 1;
      const scoreData = calculateShotScore(x, y, calibration);
      const newShot: ShotPoint = {
        id: `shot-${Date.now()}`,
        shotNumber: newShotNumber,
        pixelX: Math.round(x * 10) / 10,
        pixelY: Math.round(y * 10) / 10,
        offsetX_mm: scoreData.offsetX_mm,
        offsetY_mm: scoreData.offsetY_mm,
        distance_mm: scoreData.distanceMm,
        score: scoreData.score,
        isManuallyAdjusted: true,
      };
      onShotsChange([...shots, newShot]);
      onSelectShot(newShot.id);
    }
  };

  // 모바일 터치 드래그 핸들러
  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length !== 1 || !draggingShotId) return;
    const touch = e.touches[0];
    const { x, y } = getCanvasCoordsFromClient(touch.clientX, touch.clientY);
    setDragCurrentPos({ x, y });
    updateMagnifier(x, y);
  };

  // 마우스 클릭 & 드래그 시작 핸들러
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || e.altKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }
    if (!showShots) return;

    const { x, y } = getCanvasCoords(e);
    const pelletPxRadius = ISSF_AIR_RIFLE.PELLET_RADIUS_MM * calibration.pxPerMm;

    const clickedShot = shots.find((s) => Math.hypot(s.pixelX - x, s.pixelY - y) <= pelletPxRadius * 1.6);

    if (clickedShot) {
      onSelectShot(clickedShot.id);
      setDraggingShotId(clickedShot.id);
      setDragCurrentPos({ x: clickedShot.pixelX, y: clickedShot.pixelY });
      updateMagnifier(clickedShot.pixelX, clickedShot.pixelY);
    } else {
      if (targetCount === 0 || shots.length < targetCount) {
        const newShotNumber = shots.length + 1;
        const scoreData = calculateShotScore(x, y, calibration);
        const newShot: ShotPoint = {
          id: `shot-${Date.now()}`,
          shotNumber: newShotNumber,
          pixelX: Math.round(x * 10) / 10,
          pixelY: Math.round(y * 10) / 10,
          offsetX_mm: scoreData.offsetX_mm,
          offsetY_mm: scoreData.offsetY_mm,
          distance_mm: scoreData.distanceMm,
          score: scoreData.score,
          isManuallyAdjusted: true,
        };
        onShotsChange([...shots, newShot]);
        onSelectShot(newShot.id);
      }
    }
  };

  // 마우스 이동 핸들러
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }

    if (draggingShotId) {
      const { x, y } = getCanvasCoords(e);
      setDragCurrentPos({ x, y });
      updateMagnifier(x, y);
    }
  };

  // 마우스/터치 드래그 종료 핸들러
  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (draggingShotId && dragCurrentPos) {
      const updatedShots = shots.map((s) => {
        if (s.id === draggingShotId) {
          const scoreData = calculateShotScore(dragCurrentPos.x, dragCurrentPos.y, calibration);
          return {
            ...s,
            pixelX: Math.round(dragCurrentPos.x * 10) / 10,
            pixelY: Math.round(dragCurrentPos.y * 10) / 10,
            offsetX_mm: scoreData.offsetX_mm,
            offsetY_mm: scoreData.offsetY_mm,
            distance_mm: scoreData.distanceMm,
            score: scoreData.score,
            isManuallyAdjusted: true,
          };
        }
        return s;
      });

      onShotsChange(updatedShots);
      setDraggingShotId(null);
      setDragCurrentPos(null);
    }
  };

  // 선택된 탄착점 삭제
  const handleDeleteSelected = () => {
    if (!selectedShotId) return;
    const filtered = shots
      .filter((s) => s.id !== selectedShotId)
      .map((s, idx) => ({ ...s, shotNumber: idx + 1 }));
    onShotsChange(filtered);
    onSelectShot(null);
  };

  return (
    <div className="relative flex flex-col items-center select-none bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 md:p-5 shadow-xl shadow-slate-200/40 dark:shadow-none w-full transition-colors">
      {/* 1. 상단 모바일 툴바 (터치 영역 42px 보장) */}
      <div className="w-full flex items-center justify-between mb-3.5 px-0.5">
        {/* 좌측: 탄환 수 뱃지 (줄바꿈 방지) */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 font-extrabold px-3 py-1.5 rounded-xl text-xs whitespace-nowrap shadow-sm border border-slate-200/60 dark:border-slate-700/60">
          <Crosshair className="w-4 h-4 text-red-500 stroke-[2.5]" />
          <span>{shots.length} {targetCount > 0 ? `/ ${targetCount}발` : '발 (자유)'}</span>
        </div>

        {/* 플로팅 컨트롤 버튼 그룹 */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/90 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
          <button
            onClick={() => setZoom((z) => Math.min(z + 0.25, 2.5))}
            className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-xl bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm active:scale-95 transition"
            title="확대"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(z - 0.25, 0.75))}
            className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-xl bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm active:scale-95 transition"
            title="축소"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-xl bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm active:scale-95 transition"
            title="초기화"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-600 mx-0.5" />

          <button
            onClick={() => setShowRings(!showRings)}
            className={`w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-xl font-bold transition active:scale-95 ${
              showRings
                ? 'bg-red-500 text-white shadow-sm'
                : 'bg-white dark:bg-slate-700 text-slate-400'
            }`}
            title="공식 동심원 링 표시 토글"
          >
            {showRings ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setShowShots(!showShots)}
            className={`w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-xl font-bold transition active:scale-95 ${
              showShots
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-white dark:bg-slate-700 text-slate-400'
            }`}
            title="탄착 핀 표시 토글"
          >
            <Target className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowScoreLabels(!showScoreLabels)}
            className={`w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-xl font-bold transition active:scale-95 ${
              showScoreLabels
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-white dark:bg-slate-700 text-slate-400'
            }`}
            title="탄착 점수 라벨(배지) ON/OFF 토글"
          >
            <Tag className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowMpi(!showMpi)}
            className={`w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-xl font-black text-[11px] transition active:scale-95 ${
              showMpi
                ? 'bg-cyan-500 text-white shadow-sm'
                : 'bg-white dark:bg-slate-700 text-slate-400'
            }`}
            title="MPI 중심 표시 토글"
          >
            MPI
          </button>

          {/* 과녁 중심 & 가상선 초점 미세조정 모드 토글 */}
          <button
            onClick={() => setIsCalibrating(!isCalibrating)}
            className={`w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-xl font-bold transition active:scale-95 ${
              isCalibrating
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-2 ring-purple-400'
                : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}
            title="과녁 중심 및 가상선 초점 미세조정"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {selectedShotId && (
            <button
              onClick={handleDeleteSelected}
              className="h-8 md:h-9 px-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm active:scale-95 transition"
              title="선택 핀 삭제"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>삭제</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. 캔버스 뷰포트 영역 (모바일 화면에 맞춰 100% 핏) */}
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#E8DFD0] shadow-inner cursor-crosshair touch-none w-full max-w-[580px] aspect-square"
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isPanning ? 'none' : 'transform 0.05s ease-out',
            width: '100%',
            height: '100%',
          }}
        >
          <canvas
            ref={canvasRef}
            width={800}
            height={800}
            className="w-full h-full block"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUp}
            onTouchCancel={handleMouseUp}
          />
        </div>

        {/* 손가락에 가려지지 않도록 상단 코너에 뜨는 3.5배 돋보기 */}
        {draggingShotId && (
          <div className="absolute top-3 right-3 pointer-events-none rounded-2xl border-2 border-red-500 shadow-2xl overflow-hidden bg-slate-900/90 backdrop-blur">
            <canvas ref={magnifierRef} width={136} height={136} className="w-[136px] h-[136px]" />
            <div className="absolute bottom-1 w-full text-center text-[10px] text-white font-extrabold bg-black/70 py-0.5 tracking-wider">
              3.5x 정밀 조준
            </div>
          </div>
        )}

        {/* 캔버스 하단 미세 안내 툴팁 */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 pointer-events-none bg-slate-900/80 dark:bg-black/80 backdrop-blur-md border border-white/10 rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-200 flex items-center justify-center gap-1.5 shadow-lg">
          <Sparkles className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
          <span className="truncate">핀 터치 드래그 조정 | 툴바 ⚙️(슬라이더)로 과녁 중심 초점 보정</span>
        </div>
      </div>

      {/* 3. 과녁 중심 & 가상선 수동 미세조정 컨트롤러 */}
      {isCalibrating && (
        <div className="w-full max-w-[580px] mt-3.5 p-3.5 bg-gradient-to-r from-purple-50 via-indigo-50 to-slate-50 dark:from-purple-950/40 dark:via-indigo-950/30 dark:to-slate-900 border border-purple-200/80 dark:border-purple-900/60 rounded-2xl flex flex-col gap-2.5 text-xs shadow-lg animate-fadeIn">
          <div className="flex items-center justify-between font-bold text-purple-900 dark:text-purple-200">
            <span className="flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              과녁 중심(초점) & 가상선 미세조정
            </span>
            <button
              onClick={() => setIsCalibrating(false)}
              className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-black text-xs flex items-center gap-1 shadow-sm transition active:scale-95"
            >
              <Check className="w-3 h-3" />
              <span>보정 완료</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center pt-1">
            {/* 좌측: 중심 상하좌우 십자 이동 버튼 (1클릭당 2px) */}
            <div className="flex flex-col items-center gap-1.5 bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-purple-100 dark:border-purple-900/40">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                과녁 중심 좌표: ({calibration.centerX}, {calibration.centerY})
              </span>
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleAdjustCenter(0, -2)}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-purple-100 dark:bg-slate-700 dark:hover:bg-purple-900/50 flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-90 transition"
                  title="과녁 중심 위로 이동"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAdjustCenter(-2, 0)}
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-purple-100 dark:bg-slate-700 dark:hover:bg-purple-900/50 flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-90 transition"
                    title="과녁 중심 좌측으로 이동"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="w-4 h-4 rounded-full bg-amber-400 border-2 border-white dark:border-slate-800 shadow-sm" />
                  <button
                    type="button"
                    onClick={() => handleAdjustCenter(2, 0)}
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-purple-100 dark:bg-slate-700 dark:hover:bg-purple-900/50 flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-90 transition"
                    title="과녁 중심 우측으로 이동"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => handleAdjustCenter(0, 2)}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-purple-100 dark:bg-slate-700 dark:hover:bg-purple-900/50 flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-90 transition"
                  title="과녁 중심 아래로 이동"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 우측: 링 크기(반경) 스케일 미세조정 */}
            <div className="flex flex-col items-center gap-2 bg-white dark:bg-slate-800 p-3 rounded-xl border border-purple-100 dark:border-purple-900/40 h-full justify-center">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                가상 링 반경: {calibration.blackRadiusPx}px ({calibration.pxPerMm.toFixed(1)} px/mm)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAdjustRadius(-2)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-black text-xs active:scale-90 transition"
                  title="가상 링 축소"
                >
                  링 축소 (-)
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustRadius(2)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-black text-xs active:scale-90 transition"
                  title="가상 링 확대"
                >
                  링 확대 (+)
                </button>
              </div>
              <p className="text-[10px] text-slate-400 text-center leading-tight">
                실제 사진의 4점 검은 원 테두리에 가상선이 딱 맞도록 크기를 맞춰주세요.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
