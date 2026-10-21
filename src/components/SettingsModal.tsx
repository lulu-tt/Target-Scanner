import { Dialog } from './Dialog';
/**
 * [영자 실장 & 코다리 부장의 AI 엔진 설정 모달]
 * 작성자: 디자인 실장 영자 & 코다리 개발부장
 * 의도:
 *   1. 무료 Google AI Studio Gemini API 키 등록/관리
 *   2. 로컬 브라우저 보안 보관 안내 및 원클릭 발급 가이드 제공
 *   3. API 키 연결 테스트 및 온디바이스/클라우드 하이브리드 엔진 상태 안내
 */

import React, { useState, useEffect } from 'react';
import { X, Key, ExternalLink, ShieldCheck, Sparkles, Check, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { getStoredGeminiApiKey, setStoredGeminiApiKey } from '../utils/geminiVision';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApiKeySaved?: (key: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onApiKeySaved }) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setApiKey(getStoredGeminiApiKey());
      setTestStatus('idle');
      setErrorMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    setStoredGeminiApiKey(apiKey);
    onApiKeySaved?.(apiKey.trim());
    onClose();
  };

  const handleClear = () => {
    setApiKey('');
    setStoredGeminiApiKey('');
    setTestStatus('idle');
    onApiKeySaved?.('');
  };

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      setTestStatus('error');
      setErrorMessage('API 키를 먼저 입력해주세요.');
      return;
    }

    try {
      setIsTesting(true);
      setTestStatus('idle');
      setErrorMessage('');

      // 최신 gemini-3.8-flash 우선 연결 테스트
      const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-flash'];
      let isSuccess = false;
      let lastErrMsg = '';

      for (const model of candidateModels) {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'ping' }] }],
            generationConfig: { maxOutputTokens: 2 },
          }),
        });

        if (response.ok) {
          isSuccess = true;
          break;
        } else {
          const err = await response.json().catch(() => ({}));
          lastErrMsg = err?.error?.message || `인증 실패 (HTTP ${response.status})`;
          if (response.status === 404) continue;
          break;
        }
      }

      if (isSuccess) {
        setTestStatus('success');
      } else {
        setTestStatus('error');
        setErrorMessage(lastErrMsg || '연결 실패');
      }
    } catch (e: any) {
      setTestStatus('error');
      setErrorMessage(e.message || '네트워크 연결 오류');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} label="분석 설정">
        {/* 모달 헤더 */}
        <div className="shrink-0 p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 shrink-0 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                AI 분석 설정
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gemini 연결 및 API 키 관리
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="설정 닫기"
            className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 모달 바디 */}
        <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 flex flex-col gap-4 text-sm">
          {/* AI 무료 혜택 안내 배너 */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-100 dark:border-indigo-900/50 flex flex-col gap-2">
            <div className="flex items-center justify-between font-bold text-indigo-950 dark:text-indigo-200">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-500" />
                Google Gemini 연결
              </span>
              <span className="text-[10px] bg-indigo-200/60 dark:bg-indigo-500/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-black">
                사용량·요금은 계정별 확인
              </span>
            </div>
            <p className="text-[11px] text-indigo-700 dark:text-indigo-300 leading-relaxed">
              Google AI Studio에서 발급한 API 키를 등록할 수 있습니다. AI 분석 시 표적 사진이 Google로 전송됩니다. 겹친 탄착점은 직접 확인해주세요.
            </p>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline pt-0.5"
            >
              Google AI Studio에서 키 발급
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* API Key 입력 폼 */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="gemini-api-key" className="font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Gemini API Key</span>
              <span className="text-[10px] text-slate-400 font-normal">
                이 브라우저에 저장
              </span>
            </label>
            <div className="relative flex items-center">
              <input
                id="gemini-api-key"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setTestStatus('idle');
                }}
                placeholder="AIzaSy..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 pr-20 text-base font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="absolute right-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="flex min-h-11 min-w-11 items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  title={showKey ? '가리기' : '키 보기'}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* 연결 테스트 결과 */}
          {testStatus === 'success' && (
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span className="font-bold">Google Gemini API 연결 성공! 정상 작동합니다.</span>
            </div>
          )}

          {testStatus === 'error' && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">연결 실패</p>
                <p className="text-[11px] opacity-90">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* 엔진 동작 정책 안내 */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-3 text-[11px] text-slate-500 dark:text-slate-400 flex flex-col gap-1">
            <p>
              💡 <strong className="text-slate-700 dark:text-slate-200">하이브리드 엔진 안내:</strong>
            </p>
            <p>• API 키 등록 시: <strong>Google Gemini AI 비전 엔진</strong>으로 탄착 후보 분석</p>
            <p>• API 키 미등록 또는 오프라인 시: <strong>온디바이스 컴퓨터 비전 v3.0 엔진</strong> 자동 폴백</p>
          </div>
        </div>

        {/* 모달 푸터 버튼 바 */}
        <div className="shrink-0 p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting || !apiKey.trim()}
              className="min-h-11 px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
              <span>연결 테스트</span>
            </button>
            {apiKey && (
              <button
                type="button"
                onClick={handleClear}
                className="min-h-11 px-2.5 py-2 text-slate-400 hover:text-rose-500 text-xs font-medium transition-colors"
              >
                키 삭제
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-all"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="min-h-11 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs shadow-md shadow-indigo-600/25 transition-all"
            >
              설정 저장
            </button>
          </div>
        </div>
    </Dialog>
  );
};
