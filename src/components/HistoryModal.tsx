/**
 * [세션 히스토리 모달]
 * 작성자: 코다리 개발부장
 * 의도: 로컬스토리지에 저장된 사격 세션 기록을 열람하고 복원할 수 있습니다.
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
        {/* 헤더 */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-100 text-sm">사격 세션 기록 일지</h3>
            <p className="text-[11px] text-slate-400">브라우저 로컬 저장소에 누적된 사격 기록</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 세션 목록 */}
        <div className="p-4 overflow-y-auto flex flex-col gap-2.5">
          {sessions.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              저장된 사격 기록이 없습니다. <br />
              스캔 후 [세션 저장] 버튼을 눌러 기록을 남겨보세요!
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 hover:border-slate-700 flex items-center justify-between gap-3 transition"
              >
                <div className="flex flex-col">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {session.date}
                  </span>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm font-bold text-yellow-400 flex items-center gap-1">
                      <Award className="w-3.5 h-3.5" />
                      {session.stats.totalScore.toFixed(1)}점
                    </span>
                    <span className="text-xs text-slate-400">
                      평균 {session.stats.averageScore.toFixed(2)}점
                    </span>
                    <span className="text-xs text-cyan-400 flex items-center gap-1">
                      <Target className="w-3 h-3" />
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
                    className="py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1"
                  >
                    열기 <ArrowRight className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onDeleteSession(session.id)}
                    className="p-1 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded-lg"
                    title="기록 삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
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
