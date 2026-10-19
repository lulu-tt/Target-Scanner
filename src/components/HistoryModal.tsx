/**
 * [영자 실장의 모던 히스토리 모달]
 * 작성자: 디자인 실장 영자 & 코다리 부장
 * 의도: 모바일에서 부드럽게 열리는 바텀시트/모달과 시원한 카드형 사격 기록 일지
 */

import React from 'react';
import { SavedSession } from '../types/target';
import { X, Calendar, Award, Target, Trash2, ArrowRight } from 'lucide-react';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: SavedSession[];
  onLoadSession: (session: SavedSession) => void;
  onDeleteSession: (id: string) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  sessions,
  onLoadSession,
  onDeleteSession,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-md transition-all">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[82vh] transition-colors">
        {/* 헤더 */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-black text-slate-900 dark:text-white text-base">사격 세션 기록 일지</h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">스마트폰에 안전하게 누적된 사격 훈련 데이터</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 세션 목록 */}
        <div className="p-4 md:p-5 overflow-y-auto flex flex-col gap-3">
          {sessions.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs font-medium">
              저장된 사격 기록이 없습니다. <br />
              스캔 후 상단의 <strong className="text-emerald-500">[저장]</strong> 버튼을 눌러 기록을 남겨보세요!
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 hover:border-slate-300 dark:hover:border-slate-700 flex items-center justify-between gap-3 transition shadow-sm"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {session.date}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-base font-black text-slate-900 dark:text-white flex items-center gap-1">
                      <Award className="w-4 h-4 text-amber-500" />
                      {session.stats.totalScore.toFixed(1)}점
                    </span>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      평균 {session.stats.averageScore.toFixed(2)}
                    </span>
                    <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 flex items-center gap-1">
                      <Target className="w-3.5 h-3.5" />
                      집탄 {session.stats.extremeSpread_mm.toFixed(1)}mm
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      onLoadSession(session);
                      onClose();
                    }}
                    className="h-9 px-3 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm active:scale-95 transition"
                  >
                    열기 <ArrowRight className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onDeleteSession(session.id)}
                    className="w-9 h-9 flex items-center justify-center hover:bg-red-500/10 text-slate-400 hover:text-red-500 rounded-xl transition"
                    title="기록 삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
