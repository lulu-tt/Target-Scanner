import React, { useMemo, useState } from 'react';
import { ShotPoint, TargetCalibration } from '../types/target';
import { auditShotScore } from '../utils/scoringAudit';
import { VirtualPin } from '../utils/virtualPins';
import { calculateShotScore, ISSF_AIR_RIFLE } from '../utils/issfSpecs';

interface Props {
  imageUrl: string; shots: ShotPoint[]; virtualPins: VirtualPin[]; calibration: TargetCalibration;
  selectedShotId: string | null; onSelectShot: (id: string | null) => void;
}
export function ScoreBreakdown({ imageUrl, shots, virtualPins, calibration: c, selectedShotId, onSelectShot }: Props) {
  const blank = c.targetType === 'blank';
  const [original, setOriginal] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const rows = useMemo(() => [...shots.map(s => ({ ...s, displayId: `#${s.shotNumber}`, source: 'image' as const })),
    ...virtualPins.map((p, i) => { const v = calculateShotScore(p.pixelX, p.pixelY, c); return { ...p, displayId: `E${i + 1}`, source: 'estimate' as const,
      offsetX_mm: v.offsetX_mm, offsetY_mm: v.offsetY_mm, distance_mm: v.distanceMm }; })], [shots, virtualPins, c]);
  const audits = rows.map(row => auditShotScore(row, c));
  const integerSum = (items: typeof rows) => items.reduce((sum, row) => sum + (auditShotScore(row, c)?.integer ?? 0), 0);
  const boundaryRows = rows.filter((_, i) => audits[i]?.needsReview);
  const groups = [
    { source: 'image', label: '감지', color: '#047857', rows: rows.filter(r => r.source === 'image') },
    { source: 'estimate', label: '추정', color: '#9333ea', rows: rows.filter(r => r.source === 'estimate') },
  ];
  const margin = Math.max(c.blackRadiusPx * 1.4, ...rows.map(r => Math.hypot(r.pixelX - c.centerX, r.pixelY - c.centerY) + 15));
  const height = Math.max(420, Math.max(...groups.map(g => g.rows.length)) * 30 + 50);
  const imageY = (height - 370) / 2;
  const point = (r: { pixelX: number; pixelY: number }) => ({ x: 125 + (r.pixelX - c.centerX + margin) / (2 * margin) * 370,
    y: imageY + (r.pixelY - c.centerY + margin) / (2 * margin) * 370 });
  const select = (id: string) => onSelectShot(id === selectedShotId ? null : id);
  const sum = (a: typeof rows) => Math.round(a.reduce((s, r) => s + r.score, 0) * 10) / 10;
  return <section aria-label="원본과 핀별 점수" className="surface-card overflow-hidden p-3 sm:p-5">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">원본과 핀별 점수</h3>
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">{[false, true].map(v => <button key={String(v)} onClick={() => setOriginal(v)} aria-pressed={original === v} className={`min-h-11 rounded-lg px-3 text-xs font-bold ${original === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>{v ? '원본' : '핀·점수'}</button>)}</div><button aria-label="핀 표시 확대" aria-pressed={expanded} onClick={() => setExpanded(v => !v)} className="min-h-11 rounded-lg border border-slate-200 px-3 text-xs font-bold dark:border-slate-700">{expanded ? '화면에 맞춤' : '확대'}</button></div>
    <div className="overflow-x-auto rounded-xl bg-slate-50 dark:bg-slate-950" tabIndex={0} role="region" aria-label="확대 표적 · 좌우로 이동">
      <svg viewBox={original ? `125 ${imageY} 370 370` : `0 0 620 ${height}`} className={`w-full ${expanded ? 'min-w-[560px]' : ''}`} role="img" aria-label={original ? '핀 없는 원본 표적' : '감지와 추정 핀별 점수 연결선'}>
        <svg x="125" y={imageY} width="370" height="370" viewBox={`${c.centerX - margin} ${c.centerY - margin} ${margin * 2} ${margin * 2}`}>
          <image href={imageUrl} width="800" height="800" />
          {!original && c.targetType !== 'blank' && <g fill="none" stroke="#ef4444" strokeWidth={0.8}><path d={`M${c.centerX - 4} ${c.centerY}h8m-4-4v8`} /></g>}
        </svg>
        {!original && groups.map((g, gi) => <g key={g.source}>{g.rows.map((r, i) => {
          const p = point(r), y = 28 + i * 30, selected = r.id === selectedShotId;
          const radius = (blank ? c.holeRadiusPx ?? 3 : ISSF_AIR_RIFLE.PELLET_RADIUS_MM * c.pxPerMm) / (margin * 2) * 370;
          return <g key={r.id} data-score-label={r.displayId}>
            <path d={`M${p.x} ${p.y}L${gi ? 502 : 116} ${y - 4}`} stroke={g.color} strokeWidth={selected ? 2 : 0.8} opacity=".65" fill="none" />
            <ellipse cx={p.x} cy={p.y} rx={radius} ry={radius * (c.pxPerMmY ?? c.pxPerMm) / c.pxPerMm} fill={g.color} fillOpacity=".08" stroke={g.color} strokeWidth=".6" strokeDasharray={gi ? '2 2' : undefined} />
            <circle cx={p.x} cy={p.y} r={selected ? 5 : 3.5} fill={g.color} stroke="white" strokeWidth="1" strokeDasharray={gi ? '2 1' : undefined} />
            <text x={gi ? 508 : 6} y={y} fill={g.color} fontSize="20" fontWeight="700">{r.displayId} · {c.targetType === 'blank' ? '—' : r.score.toFixed(1)}</text>
          </g>;
        })}</g>)}
      </svg>
    </div>
    <p className="mt-2 text-[11px] text-slate-500">초록: 감지 · 보라: 추정 · {blank ? '좌표는 사진 왼쪽 위를 기준으로 한 비율입니다.' : '빨간 십자: 표적 중심'} {expanded && <span>· 좌우로 밀어 보기</span>}</p>
    {c.targetType !== 'blank' && <p className="mt-2 text-xs leading-relaxed text-slate-500">핀 옆 숫자는 소수점입니다. 4.5mm 탄환 가장자리가 닿는 높은 링으로 채점합니다. 정수는 각 핀의 링 점수를 합산하고, 소수점은 각 링을 10등분해 합산합니다.</p>}
    <div className="mt-4 space-y-5">
      {groups.map(g => <div key={g.source}><h4 className="mb-2 text-base font-extrabold" style={{ color: g.color }}>{g.label} {g.rows.length}개 · {c.targetType === 'blank' ? '—' : `${sum(g.rows).toFixed(1)}점 · 정수 ${integerSum(g.rows)}점`}</h4>
        <table className="w-full table-fixed text-right text-[11px] sm:text-xs"><thead className="bg-slate-100 text-slate-500 dark:bg-slate-800"><tr><th className="w-11 py-2 text-left">핀</th><th>{blank ? '점수' : '소수점'}</th>{blank ? <><th>사진 X %</th><th>사진 Y %</th></> : <><th>정수</th><th>거리 mm</th><th>X mm</th><th>Y mm</th></>}</tr></thead>
          <tbody>{g.rows.map(r => <tr key={r.id} data-detail-id={r.id} data-detail-source={r.source} data-detail-score={r.score} data-integer-score={blank ? undefined : auditShotScore(r,c)?.integer} data-boundary-review={!!auditShotScore(r,c)?.needsReview} tabIndex={0} aria-label={`${g.label} ${r.displayId} ${blank ? '점수 기준 없음' : `${r.score.toFixed(1)}점`}, 표적에서 확인`} aria-selected={selectedShotId === r.id}
            onClick={() => select(r.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(r.id); } }}
            className={`h-11 cursor-pointer border-b border-slate-100 tabular-nums dark:border-slate-800 ${selectedShotId === r.id ? 'bg-purple-50 dark:bg-purple-950' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            <td className="text-left font-bold" style={{ color: g.color }}>{r.displayId}</td><td className="font-bold">{c.targetType === 'blank' ? '—' : r.score.toFixed(1)}</td>{blank ? <><td>{(r.pixelX / 8).toFixed(1)}</td><td>{(r.pixelY / 8).toFixed(1)}</td></> : <><td className={auditShotScore(r,c)?.needsReview ? 'font-bold text-amber-700' : ''}>{auditShotScore(r,c)?.integer}{auditShotScore(r,c)?.needsReview ? '*' : ''}</td><td>{r.distance_mm.toFixed(2)}</td><td>{r.offsetX_mm.toFixed(2)}</td><td>{r.offsetY_mm.toFixed(2)}</td></>}
          </tr>)}</tbody><tfoot><tr className="h-11 font-extrabold"><td className="text-left">소계</td><td>{c.targetType === 'blank' ? '—' : sum(g.rows).toFixed(1)}</td>{!blank && <td>{integerSum(g.rows)}</td>}<td colSpan={blank ? 2 : 3}>{g.rows.length}발</td></tr></tfoot></table>
      </div>)}
    </div>
    <div className="mt-3 rounded-xl bg-slate-100 p-3 font-bold dark:bg-slate-800" data-breakdown-total={blank ? undefined : sum(rows)} data-integer-total={blank ? undefined : integerSum(rows)}>핀 위치 기준 합계: {c.targetType === 'blank' ? '점수 기준 없음' : `${sum(rows).toFixed(1)}점 (소수점) · ${integerSum(rows)}점 (정수)`}</div>
    {!blank && boundaryRows.length > 0 && <details className="mt-3 text-xs leading-relaxed text-amber-800 dark:text-amber-300"><summary className="flex min-h-11 cursor-pointer items-center font-bold">* 경계 확인 {boundaryRows.length}개</summary><p>감지 핀은 1픽셀 또는 원호 맞춤 오차, 추정 핀은 현재 가상 위치의 1픽셀 이동으로 정수 판정이 달라질 수 있습니다. 추정 위치 자체의 불확실성은 이보다 클 수 있으며, 실제 점수 범위나 확률을 뜻하지 않습니다.</p>{boundaryRows.map(r => { const a = auditShotScore(r,c)!; return <p key={r.id}>{r.source === 'image' ? '감지' : '추정'} {r.displayId}: 정수 {a.integer}점 · 링 판정 경계까지 {a.gapMm.toFixed(3)}mm · 위치 오차 검토 {a.reviewLow}–{a.reviewHigh}점</p>; })}</details>}
  </section>;
}
