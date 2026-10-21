import { VirtualPin, constrainVirtualPin } from '../utils/virtualPins';
import { UnresolvedRegion } from '../utils/overlapDetection';
import { shotStatus, statusLabel, statusColor, summarizeEvidence } from '../utils/shotEvidence';
/**
 * [영자 실장의 모던 인터랙티브 표적 캔버스 컴포넌트]
 * 작성자: 디자인 실장 영자 & 코다리 부장
 * 의도: 모바일 엄지손가락에 맞춘 대형 플로팅 툴바(42px 이상)와
 *       3.5배 돋보기 루페 및 부드러운 터치 인터랙션을 제공합니다.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { TargetCalibration, ShotPoint } from '../types/target';
import { ISSF_AIR_RIFLE, calculateShotScore } from '../utils/issfSpecs';
import { ZoomIn, ZoomOut, Trash2, Sliders, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Check, Pencil, CheckCheck, Settings2 } from 'lucide-react';

interface TargetCanvasProps {
  virtualPins: VirtualPin[];
  onMoveVirtualPin: (id:string,x:number,y:number)=>void;
  onDeleteVirtualPin: (id:string)=>void;
  imageUrl: string;
  unresolvedRegions: UnresolvedRegion[];
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
  virtualPins, onMoveVirtualPin, onDeleteVirtualPin,
  unresolvedRegions,
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
  const [isEditing, setIsEditing] = useState(false);
  const [showDisplayOptions, setShowDisplayOptions] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);

  // 과녁 중심(Bullseye) 및 링 크기 수동 미세조정 핸들러
  const handleAdjustCenter = (dx: number, dy: number) => {
    if (!onCalibrationChange) return;
    const newCalib: TargetCalibration = {
      ...calibration, verified: false, method: 'manual',
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
      ...calibration, verified: false, method: 'manual',
      pxPerMmY: (calibration.pxPerMmY ?? calibration.pxPerMm) * newPxPerMm / calibration.pxPerMm,
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
    if (showRings && calibration.targetType !== 'blank') {
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
        ctx.ellipse(calibration.centerX, calibration.centerY, radiusPx, radiusPx * (calibration.pxPerMmY ?? calibration.pxPerMm) / calibration.pxPerMm, 0, 0, Math.PI * 2);
        ctx.strokeStyle = r >= 4 ? 'rgba(255, 255, 255, 0.45)' : 'rgba(50, 50, 50, 0.4)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3. MPI(탄착군 중심) 표시 (옵션)
    if (showMpi && shots.length > 1) {
      const mpiPxX = calibration.centerX + mpi.x_mm * calibration.pxPerMm;
      const mpiPxY = calibration.centerY + mpi.y_mm * (calibration.pxPerMmY ?? calibration.pxPerMm);

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

    if (showShots) for (const [i, region] of unresolvedRegions.entries()) {
      ctx.save(); ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2; ctx.setLineDash([7,5]);
      ctx.strokeRect(region.centerX-region.width/2-5,region.centerY-region.height/2-5,region.width+10,region.height+10);
      ctx.fillStyle = '#cbd5e1'; ctx.font='bold 12px sans-serif';
      ctx.fillText(`미확정 영역 ${i+1}`,region.centerX-region.width/2,region.centerY+region.height/2+20); ctx.restore();
    }

    // 4. 감지된 탄착점 핀 렌더링 (옵션)
    if (showShots) {
      const pelletPxRadius = calibration.holeRadiusPx ?? ISSF_AIR_RIFLE.PELLET_RADIUS_MM * calibration.pxPerMm;

      shots.forEach((shot) => {
        const isSelected = shot.id === selectedShotId;
        const isDragging = shot.id === draggingShotId;
        const currentX = isDragging && dragCurrentPos ? dragCurrentPos.x : shot.pixelX;
        const currentY = isDragging && dragCurrentPos ? dragCurrentPos.y : shot.pixelY;

        ctx.save();

        // 4.5mm 납탄 구멍 외곽 테두리 (실제 탄착 범위)
        ctx.beginPath();
        ctx.arc(currentX, currentY, pelletPxRadius, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? 'rgba(239, 68, 68, 0.4)' : `${statusColor[shotStatus(shot)]}22`;
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#EF4444' : statusColor[shotStatus(shot)];
        if (shotStatus(shot) === 'estimated') ctx.setLineDash([5,4]);
        ctx.lineWidth = isSelected ? 3.5 : 2.2;
        ctx.stroke();
        ctx.setLineDash([]);

        // 중심 십자선 포인트
        ctx.beginPath();
        ctx.arc(currentX, currentY, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();

        // 탄환 번호 및 소수점 점수 뱃지 (시인성 강화 - 토글 지원)
        if (showScoreLabels) {
          ctx.fillStyle = isSelected ? '#EF4444' : '#0F172A';
          const labelText = `${statusLabel[shotStatus(shot)]} #${shot.shotNumber}`;
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
    if (showShots) virtualPins.forEach((pin,i)=>{
      const selected=pin.id===selectedShotId;
      const point=pin.id===draggingShotId&&dragCurrentPos?dragCurrentPos:{x:pin.pixelX,y:pin.pixelY};
      ctx.save();ctx.globalAlpha=selected?.95:.65;ctx.strokeStyle=selected?'#ef4444':'#a855f7';ctx.fillStyle='rgba(168,85,247,.14)';ctx.lineWidth=selected?3:2;ctx.setLineDash([3,4]);
      ctx.beginPath();ctx.arc(point.x,point.y,Math.max(6,(calibration.holeRadiusPx??12)*.65),0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);
      ctx.beginPath();ctx.moveTo(point.x-4,point.y);ctx.lineTo(point.x+4,point.y);ctx.moveTo(point.x,point.y-4);ctx.lineTo(point.x,point.y+4);ctx.stroke();
      if(showScoreLabels){ctx.font='bold 11px sans-serif';const text=`가상 V${i+1}`;ctx.fillStyle='rgba(255,255,255,.94)';ctx.fillRect(point.x+7,point.y+1,ctx.measureText(text).width+6,17);ctx.fillStyle='#7e22ce';ctx.fillText(text,point.x+10,point.y+14);}
      ctx.restore();
    });

  }, [virtualPins, unresolvedRegions, bgImage, calibration, showRings, showShots, showScoreLabels, showMpi, shots, selectedShotId, draggingShotId, dragCurrentPos, mpi]);

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

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
    return getCanvasCoordsFromClient(e.clientX, e.clientY);
  };

  // 마우스 클릭 & 드래그 시작 핸들러
  const handleMouseDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!e.isPrimary) return;
    if (e.button === 1 || e.altKey || (!isEditing && zoom > 1)) {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }
    if (!isEditing || !showShots || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);

    const { x, y } = getCanvasCoords(e);
    const pelletPxRadius = calibration.holeRadiusPx ?? ISSF_AIR_RIFLE.PELLET_RADIUS_MM * calibration.pxPerMm;

    const touchRadius = 22 * 800 / e.currentTarget.getBoundingClientRect().width;
    const hitRadius = Math.max(pelletPxRadius * 1.6, touchRadius);
    const candidates = [...shots, ...virtualPins];
    const chosen = virtualPins.find(s=>s.id===selectedShotId&&Math.hypot(s.pixelX-x,s.pixelY-y)<=hitRadius);
    const clickedShot = chosen ?? [...candidates].sort((a, b) => Math.hypot(a.pixelX - x, a.pixelY - y) - Math.hypot(b.pixelX - x, b.pixelY - y))
      .find(s => Math.hypot(s.pixelX - x, s.pixelY - y) <= hitRadius);

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
          detectionStatus: 'manual' as const,
          isManuallyAdjusted: true,
        };
        onShotsChange([...shots, newShot]);
        onSelectShot(newShot.id);
      }
    }
  };

  // 마우스 이동 핸들러
  const handleMouseMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }

    if (draggingShotId) {
      const { x, y } = getCanvasCoords(e);
      const pin=virtualPins.find(p=>p.id===draggingShotId),region=unresolvedRegions.find(r=>r.id===pin?.regionId);
      const point=region?constrainVirtualPin(region,x,y):{x,y};
      if(point){setDragCurrentPos(point);updateMagnifier(point.x,point.y);}
    }
  };

  // 마우스/터치 드래그 종료 핸들러
  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (draggingShotId && dragCurrentPos) {
      const virtual=virtualPins.find(p=>p.id===draggingShotId);
      if(virtual){
        if(Math.hypot(virtual.pixelX-dragCurrentPos.x,virtual.pixelY-dragCurrentPos.y)>.1)onMoveVirtualPin(virtual.id,dragCurrentPos.x,dragCurrentPos.y);
        setDraggingShotId(null);setDragCurrentPos(null);return;
      }
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
            detectionStatus: 'manual' as const,
            evidence: undefined,
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
    if(virtualPins.some(p=>p.id===selectedShotId)){onDeleteVirtualPin(selectedShotId);return;}
    if(!shots.some(p=>p.id===selectedShotId)){onSelectShot(null);return;}
    const filtered = shots
      .filter((s) => s.id !== selectedShotId)
      .map((s, idx) => ({ ...s, shotNumber: idx + 1 }));
    onShotsChange(filtered);
    onSelectShot(null);
  };

  const evidence = summarizeEvidence(shots, targetCount);
  const selectedVirtualIndex=virtualPins.findIndex(p=>p.id===selectedShotId);

  return (
    <div className="relative flex flex-col items-center select-none bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-3 sm:p-5 shadow-sm w-full transition-colors">
      <div className="mb-3 flex w-full flex-wrap items-center justify-between gap-2">
        <div><h3 className="text-sm font-bold">탄착점 확인</h3><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">후보 {shots.length}개{targetCount > 0 ? ` / 선택 ${targetCount}발` : ' / 자유 발수'}</p></div>
        <button aria-pressed={isEditing} onClick={() => { setIsEditing(!isEditing); setDraggingShotId(null); setDragCurrentPos(null); }} className={`flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-bold ${isEditing ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>{isEditing ? <CheckCheck size={16} /> : <Pencil size={16} />}{isEditing ? '수정 완료' : '위치 수정'}</button>
      </div>
      <p role="status" className={`mb-3 w-full rounded-xl px-3 py-2.5 text-xs leading-relaxed ${isEditing ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300' : 'bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>{isEditing ? '빈 곳을 탭해 추가 · 핀을 끌어 이동 · 선택 후 삭제. 가상 핀은 겹친 구멍 안에서만 이동합니다.' : zoom > 1 ? '확대 중에는 표적을 밀어 이동하세요. 초기화하면 화면을 스크롤할 수 있습니다.' : '사진을 살펴본 후 ‘위치 수정’을 눌러 탄착점을 보정하세요.'}</p>
      <div aria-label="핀 상태 범례" className="mb-3 flex w-full flex-wrap gap-x-3 gap-y-1 text-xs font-semibold"><span className="text-emerald-700 dark:text-emerald-400">● 감지 {evidence.detected}</span><span className="text-amber-700 dark:text-amber-400">◌ 추정 {evidence.estimated}</span><span className="text-slate-500">□ 좌표 미확정 {evidence.unresolved ?? '발수 미입력'}</span><span className="text-purple-600 dark:text-purple-400">⊕ 가상 {virtualPins.length} (실제 감지 아님)</span>{evidence.manual > 0 && <span className="text-indigo-600 dark:text-indigo-400">● 수동 {evidence.manual}</span>}</div>
      <div className="mb-3 w-full rounded-xl bg-slate-50 p-3 text-xs leading-relaxed dark:bg-slate-800">
        <p>표적 보정: {calibration.targetType === 'blank' ? '백지 · 자동 점수 기준 없음' : calibration.method === 'multi-ring' ? `다중 링 ${calibration.ringSupport}개 적합 · 가로/세로 배율 보정` : '초기 중심·크기 · 수동 검토 필요'}</p>
        {calibration.targetType === 'standard' && <p className="mt-1">가로 {calibration.pxPerMm.toFixed(2)} · 세로 {(calibration.pxPerMmY ?? calibration.pxPerMm).toFixed(2)} px/mm</p>}
        <p className="mt-1 text-slate-500">기울기가 큰 사진은 정면에서 다시 촬영하세요. 링 정렬을 원본과 확인해주세요.</p>
        {calibration.targetType === 'standard' && <label className="mt-2 flex min-h-11 items-center gap-2"><input aria-label="링 보정 확인" type="checkbox" className="h-5 w-5" checked={calibration.verified ?? false} onChange={e=>onCalibrationChange?.({...calibration, verified:e.target.checked})}/>중심과 링 크기를 확인했습니다</label>}
      </div>
      {/* 2. 캔버스 뷰포트 영역 (모바일 화면에 맞춰 100% 핏) */}
      <div
        ref={containerRef}
        style={{ touchAction: isEditing || zoom > 1 ? 'none' : 'pan-y', cursor: isEditing ? 'crosshair' : zoom > 1 ? 'grab' : 'auto' }}
        className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#E8DFD0] shadow-inner w-full max-w-[580px] aspect-square"
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
            aria-label="표적 사진과 탄착점"
            onPointerDown={handleMouseDown}
            onPointerMove={handleMouseMove}
            onPointerUp={handleMouseUp}
            onPointerCancel={() => { setDraggingShotId(null); setDragCurrentPos(null); setIsPanning(false); }}
          />
        </div>

        {selectedShotId && (selectedVirtualIndex>=0 || shots.some(p=>p.id===selectedShotId)) && isEditing && !draggingShotId && <div className="absolute left-2 top-2 flex items-center gap-2 rounded-xl bg-white/95 py-1 pl-3 pr-1 shadow-lg dark:bg-slate-900/95"><span className="text-xs font-bold">{selectedVirtualIndex>=0?`가상 V${selectedVirtualIndex+1}`:`#${shots.find(s => s.id === selectedShotId)?.shotNumber}`}</span><button onClick={handleDeleteSelected} className="flex min-h-11 items-center gap-1.5 rounded-lg bg-red-50 px-3 text-xs font-bold text-red-700 dark:bg-red-950/60 dark:text-red-300"><Trash2 size={16} />선택 핀 삭제</button></div>}

        {/* 손가락에 가려지지 않도록 상단 코너에 뜨는 3.5배 돋보기 */}
        {draggingShotId && (
          <div className="absolute top-3 right-3 pointer-events-none rounded-2xl border-2 border-red-500 shadow-2xl overflow-hidden bg-slate-900/90 backdrop-blur">
            <canvas ref={magnifierRef} width={136} height={136} className="w-[136px] h-[136px]" />
            <div className="absolute bottom-1 w-full text-center text-[10px] text-white font-extrabold bg-black/70 py-0.5 tracking-wider">
              3.5x 정밀 조준
            </div>
          </div>
        )}

      </div>
      {virtualPins.length>0 && <details className="mt-3 w-full" open={isEditing}><summary className="flex min-h-11 cursor-pointer items-center text-xs font-bold text-purple-700 dark:text-purple-400">가상 추정 핀 {virtualPins.length}개 선택·수정</summary><p className="mb-2 text-xs leading-relaxed text-slate-500">반투명 보라색 점선은 겹침 영역 안의 예시 위치입니다. 실제 감지 위치가 아닙니다. 아래에서 선택한 뒤 끌거나 삭제하세요. 집탄 통계에서 제외됩니다.</p><div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">{virtualPins.map((pin,i)=><button key={pin.id} data-virtual-pin={pin.id} data-x={pin.pixelX} data-y={pin.pixelY} aria-label={`가상 핀 V${i+1} 선택`} aria-pressed={pin.id===selectedShotId} onClick={()=>{onSelectShot(pin.id===selectedShotId?null:pin.id);setIsEditing(true);setShowShots(true);containerRef.current?.scrollIntoView({block:'center'});}} className={`min-h-11 rounded-xl border px-3 text-xs font-bold ${pin.id===selectedShotId?'border-purple-500 bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200':'border-purple-200 text-purple-700 dark:border-purple-800 dark:text-purple-400'}`}>V{i+1}{pin.moved?' · 수정':''}</button>)}</div></details>}
      <div className="mt-3 flex w-full flex-wrap items-center justify-between gap-2">
        <div className="flex items-center rounded-xl bg-slate-100 p-0.5 dark:bg-slate-800">
          <button onClick={() => setZoom(z => Math.max(z - .25, 1))} className="icon-button" aria-label="축소" disabled={zoom <= 1}><ZoomOut size={18} /></button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="min-h-11 min-w-14 text-xs font-bold" aria-label="확대 초기화">{Math.round(zoom * 100)}%</button>
          <button onClick={() => setZoom(z => Math.min(z + .25, 2.5))} className="icon-button" aria-label="확대" disabled={zoom >= 2.5}><ZoomIn size={18} /></button>
        </div>
        <button onClick={() => setShowDisplayOptions(!showDisplayOptions)} aria-expanded={showDisplayOptions} className="flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-xs font-semibold text-slate-600 dark:text-slate-300"><Settings2 size={17} />표시 설정</button>
      </div>
      {showDisplayOptions && calibration.targetType === 'standard' && <div className="mt-3 flex w-full flex-wrap items-center gap-2 text-xs"><span>세로 링 배율</span>{[-.05,.05].map(d=><button key={d} aria-label={d<0?'세로 링 줄이기':'세로 링 늘리기'} onClick={()=>onCalibrationChange?.({...calibration,pxPerMmY:Math.max(1,(calibration.pxPerMmY??calibration.pxPerMm)+d),method:'manual',verified:false})} className="min-h-11 rounded-xl border px-4">{d<0?'−':'+'}</button>)}</div>}
      {showDisplayOptions && <div className="mt-2 grid w-full grid-cols-2 gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        {[{ label: '동심원', enabled: showRings, toggle: () => setShowRings(!showRings) }, { label: '탄착 핀', enabled: showShots, toggle: () => setShowShots(!showShots) }, { label: '점수 라벨', enabled: showScoreLabels, toggle: () => setShowScoreLabels(!showScoreLabels) }, { label: '탄착 중심', enabled: showMpi, toggle: () => setShowMpi(!showMpi) }].map(option => <button key={option.label} onClick={option.toggle} aria-pressed={option.enabled} className={`flex min-h-11 items-center justify-between rounded-xl border px-3 text-xs font-semibold ${option.enabled ? 'border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-800' : 'border-slate-200 text-slate-500 dark:border-slate-700'}`}>{option.label}<span>{option.enabled ? '켬' : '끔'}</span></button>)}
        <button onClick={() => setIsCalibrating(!isCalibrating)} aria-expanded={isCalibrating} className="col-span-2 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-100 text-xs font-semibold dark:bg-slate-800"><Sliders size={16} />표적 중심·크기 보정</button>
      </div>}


      {/* 3. 과녁 중심 & 가상선 수동 미세조정 컨트롤러 */}
      {isCalibrating && (
        <div className="w-full max-w-[580px] mt-3.5 p-3.5 bg-gradient-to-r from-purple-50 via-indigo-50 to-slate-50 dark:from-purple-950/40 dark:via-indigo-950/30 dark:to-slate-900 border border-purple-200/80 dark:border-purple-900/60 rounded-2xl flex flex-col gap-2.5 text-xs shadow-lg animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-2 font-bold text-purple-900 dark:text-purple-200">
            <span className="flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              과녁 중심(초점) & 가상선 미세조정
            </span>
            <button
              onClick={() => setIsCalibrating(false)}
              className="min-h-11 px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-black text-xs flex items-center gap-1 shadow-sm transition active:scale-95"
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
                  className="w-11 h-11 rounded-lg bg-slate-100 hover:bg-purple-100 dark:bg-slate-700 dark:hover:bg-purple-900/50 flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-90 transition"
                  title="과녁 중심 위로 이동"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAdjustCenter(-2, 0)}
                    className="w-11 h-11 rounded-lg bg-slate-100 hover:bg-purple-100 dark:bg-slate-700 dark:hover:bg-purple-900/50 flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-90 transition"
                    title="과녁 중심 좌측으로 이동"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="w-4 h-4 rounded-full bg-amber-400 border-2 border-white dark:border-slate-800 shadow-sm" />
                  <button
                    type="button"
                    onClick={() => handleAdjustCenter(2, 0)}
                    className="w-11 h-11 rounded-lg bg-slate-100 hover:bg-purple-100 dark:bg-slate-700 dark:hover:bg-purple-900/50 flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-90 transition"
                    title="과녁 중심 우측으로 이동"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => handleAdjustCenter(0, 2)}
                  className="w-11 h-11 rounded-lg bg-slate-100 hover:bg-purple-100 dark:bg-slate-700 dark:hover:bg-purple-900/50 flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-90 transition"
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
                  className="min-h-11 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-black text-xs active:scale-90 transition"
                  title="가상 링 축소"
                >
                  링 축소 (-)
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustRadius(2)}
                  className="min-h-11 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-black text-xs active:scale-90 transition"
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
