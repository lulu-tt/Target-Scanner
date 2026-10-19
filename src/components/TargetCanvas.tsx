/**
 * [인터랙티브 2중 미세조정 표적 캔버스 컴포넌트]
 * 작성자: 코다리 개발부장
 * 의도: AI가 1차 감지한 탄착점을 사용자가 직접 눈으로 확인하고,
 *       마우스/터치 드래그로 0.1mm 단위 미세조정 및 클릭 추가/삭제를 수행할 수 있는 핵심 UX 캔버스입니다.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { TargetCalibration, ShotPoint } from '../types/target';
import { ISSF_AIR_RIFLE, calculateShotScore } from '../utils/issfSpecs';
import { ZoomIn, ZoomOut, RotateCcw, Eye, EyeOff, Crosshair, Trash2, PlusCircle, Sparkles } from 'lucide-react';

interface TargetCanvasProps {
  imageUrl: string;
  calibration: TargetCalibration;
  shots: ShotPoint[];
  selectedShotId: string | null;
  onShotsChange: (shots: ShotPoint[]) => void;
  onSelectShot: (id: string | null) => void;
  mpi: { x_mm: number; y_mm: number };
}

export const TargetCanvas: React.FC<TargetCanvasProps> = ({
  imageUrl,
  calibration,
  shots,
  selectedShotId,
  onShotsChange,
  onSelectShot,
  mpi,
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
  const [showMpi, setShowMpi] = useState(true);

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
      ctx.arc(calibration.centerX, calibration.centerY, (ISSF_AIR_RIFLE.RING_10_DIAMETER_MM / 2) * calibration.pxPerMm, 0, Math.PI * 2);
      ctx.fillStyle = '#FFD700';
      ctx.fill();

      // 9점 ~ 1점 링
      for (let r = 9; r >= 1; r--) {
        const ringDiameterMm = 0.5 + (10 - r) * 5.0;
        const radiusPx = (ringDiameterMm / 2) * calibration.pxPerMm;

        ctx.beginPath();
        ctx.arc(calibration.centerX, calibration.centerY, radiusPx, 0, Math.PI * 2);
        ctx.strokeStyle = r >= 4 ? 'rgba(255, 255, 255, 0.35)' : 'rgba(50, 50, 50, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3. MPI(탄착군 중심) 표시 (옵션)
    if (showMpi && shots.length > 1) {
      const mpiPxX = calibration.centerX + mpi.x_mm * calibration.pxPerMm;
      const mpiPxY = calibration.centerY + mpi.y_mm * calibration.pxPerMm;

      ctx.save();
      ctx.strokeStyle = '#00F0FF';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);

      // MPI 크로스헤어
      ctx.beginPath();
      ctx.moveTo(mpiPxX - 18, mpiPxY);
      ctx.lineTo(mpiPxX + 18, mpiPxY);
      ctx.moveTo(mpiPxX, mpiPxY - 18);
      ctx.lineTo(mpiPxX, mpiPxY + 18);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(mpiPxX, mpiPxY, 8, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#00F0FF';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('MPI', mpiPxX + 10, mpiPxY - 8);
      ctx.restore();
    }

    // 4. 감지된 탄착점 핀 렌더링
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
      ctx.fillStyle = isSelected ? 'rgba(255, 51, 75, 0.35)' : 'rgba(255, 215, 0, 0.2)';
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#FF334B' : shot.score >= 10.0 ? '#FFD700' : '#00E5FF';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.stroke();

      // 중심 십자선 포인트
      ctx.beginPath();
      ctx.arc(currentX, currentY, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      // 탄환 번호 및 소수점 점수 뱃지
      ctx.fillStyle = isSelected ? '#FF334B' : '#1A2128';
      const labelText = `#${shot.shotNumber} (${shot.score.toFixed(1)})`;
      ctx.font = 'bold 12px sans-serif';
      const textWidth = ctx.measureText(labelText).width;

      const badgeX = currentX - textWidth / 2 - 6;
      const badgeY = currentY - pelletPxRadius - 22;

      ctx.fillRect(badgeX, badgeY, textWidth + 12, 18);
      ctx.strokeStyle = isSelected ? '#FFFFFF' : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(badgeX, badgeY, textWidth + 12, 18);

      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, currentX, badgeY + 9);

      ctx.restore();
    });
  }, [bgImage, calibration, showRings, showMpi, shots, selectedShotId, draggingShotId, dragCurrentPos, mpi]);

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
    const magZoom = 3.5; // 3.5배 확대

    mCtx.clearRect(0, 0, magSize, magSize);

    // 원형 클리핑
    mCtx.save();
    mCtx.beginPath();
    mCtx.arc(magSize / 2, magSize / 2, magSize / 2 - 2, 0, Math.PI * 2);
    mCtx.clip();

    // 메인 캔버스의 해당 좌표 영역을 확대 렌더링
    const sourceW = magSize / magZoom;
    const sourceH = magSize / magZoom;
    const sourceX = canvasX - sourceW / 2;
    const sourceY = canvasY - sourceH / 2;

    mCtx.drawImage(mainCanvas, sourceX, sourceY, sourceW, sourceH, 0, 0, magSize, magSize);

    // 초정밀 크로스헤어 십자선
    mCtx.strokeStyle = 'rgba(255, 51, 75, 0.85)';
    mCtx.lineWidth = 1.5;
    mCtx.beginPath();
    mCtx.moveTo(0, magSize / 2);
    mCtx.lineTo(magSize, magSize / 2);
    mCtx.moveTo(magSize / 2, 0);
    mCtx.lineTo(magSize / 2, magSize);
    mCtx.stroke();

    // 중심 원
    mCtx.beginPath();
    mCtx.arc(magSize / 2, magSize / 2, 4, 0, Math.PI * 2);
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
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const { x, y } = getCanvasCoordsFromClient(touch.clientX, touch.clientY);
    const pelletPxRadius = ISSF_AIR_RIFLE.PELLET_RADIUS_MM * calibration.pxPerMm;

    const clickedShot = shots.find((s) => Math.hypot(s.pixelX - x, s.pixelY - y) <= pelletPxRadius * 1.8);

    if (clickedShot) {
      onSelectShot(clickedShot.id);
      setDraggingShotId(clickedShot.id);
      setDragCurrentPos({ x: clickedShot.pixelX, y: clickedShot.pixelY });
      updateMagnifier(clickedShot.pixelX, clickedShot.pixelY);
    } else if (shots.length < 10) {
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
      // 휠 클릭 or Alt 키: 팬 모드
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    const { x, y } = getCanvasCoords(e);
    const pelletPxRadius = ISSF_AIR_RIFLE.PELLET_RADIUS_MM * calibration.pxPerMm;

    // 클릭한 위치에 기존 탄착점이 있는지 확인
    const clickedShot = shots.find((s) => Math.hypot(s.pixelX - x, s.pixelY - y) <= pelletPxRadius * 1.5);

    if (clickedShot) {
      onSelectShot(clickedShot.id);
      setDraggingShotId(clickedShot.id);
      setDragCurrentPos({ x: clickedShot.pixelX, y: clickedShot.pixelY });
      updateMagnifier(clickedShot.pixelX, clickedShot.pixelY);
    } else {
      // 빈 공간 클릭 시: 새 탄착점 추가 (10발 미만일 때)
      if (shots.length < 10) {
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

  // 마우스 이동 핸들러 (드래그 미세조정)
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

  // 마우스 드래그 종료 핸들러 (좌표 확정 및 점수 재계산)
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
    <div className="relative flex flex-col items-center select-none bg-slate-950 rounded-2xl border border-slate-800 p-4 shadow-2xl">
      {/* 캔버스 상단 툴바 */}
      <div className="w-full flex items-center justify-between mb-3 px-1 text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-100 flex items-center gap-1.5">
            <Crosshair className="w-4 h-4 text-red-500" />
            표적지 인터랙티브 뷰
          </span>
          <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full text-[11px]">
            {shots.length}/10발 감지됨
          </span>
        </div>

        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
          <button
            onClick={() => setZoom((z) => Math.min(z + 0.25, 2.5))}
            className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white"
            title="확대"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(z - 0.25, 0.75))}
            className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white"
            title="축소"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white"
            title="초기화"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-3 bg-slate-700 mx-1" />

          <button
            onClick={() => setShowRings(!showRings)}
            className={`p-1 rounded flex items-center gap-1 ${
              showRings ? 'bg-red-500/20 text-red-400' : 'hover:bg-slate-800 text-slate-400'
            }`}
            title="공식 링 표시 토글"
          >
            {showRings ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => setShowMpi(!showMpi)}
            className={`p-1 rounded flex items-center gap-1 ${
              showMpi ? 'bg-cyan-500/20 text-cyan-400' : 'hover:bg-slate-800 text-slate-400'
            }`}
            title="MPI 중심 표시 토글"
          >
            <span className="font-bold text-[10px]">MPI</span>
          </button>

          {selectedShotId && (
            <button
              onClick={handleDeleteSelected}
              className="p-1 bg-red-600/30 hover:bg-red-600/50 text-red-300 rounded ml-1 flex items-center gap-1"
              title="선택한 탄착점 삭제"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="text-[10px]">삭제</span>
            </button>
          )}
        </div>
      </div>

      {/* 캔버스 뷰포트 영역 */}
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-xl border border-slate-800 bg-[#E8DFD0] shadow-inner cursor-crosshair touch-none"
        style={{ width: '100%', maxWidth: '580px', aspectRatio: '1/1' }}
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

        {/* 실시간 3.5배 돋보기(Magnifier Loupe) 오버레이 */}
        {draggingShotId && (
          <div className="absolute top-3 right-3 pointer-events-none rounded-full border-2 border-red-500 shadow-2xl overflow-hidden bg-slate-900/90 backdrop-blur">
            <canvas ref={magnifierRef} width={130} height={130} className="w-[130px] h-[130px]" />
            <div className="absolute bottom-1 w-full text-center text-[10px] text-white font-bold bg-black/60 py-0.5">
              3.5x 정밀 조준
            </div>
          </div>
        )}

        {/* 캔버스 하단 미세 안내 툴팁 */}
        <div className="absolute bottom-2 left-2 pointer-events-none bg-slate-900/80 backdrop-blur border border-slate-700/60 rounded-md px-2.5 py-1 text-[11px] text-slate-300 flex items-center gap-1.5 shadow">
          <Sparkles className="w-3 h-3 text-yellow-400" />
          <span>핀을 누르고 드래그하여 미세조정 | 빈 곳 클릭 시 핀 추가</span>
        </div>
      </div>
    </div>
  );
};
