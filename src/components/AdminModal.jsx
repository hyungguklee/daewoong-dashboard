import { useState, useEffect, useRef } from 'react';

const ADMIN_PW = '85557350';

export default function AdminModal({ onSuccess, onClose, isAdmin, onLogout }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef();

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (isAdmin) {
    return (
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="animate-in bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl text-center">
          <div className="text-4xl mb-4">🔓</div>
          <div className="text-base font-bold text-[var(--ink)] mb-2">관리자 모드 활성</div>
          <div className="text-sm text-[var(--ink-4)] mb-6">현재 관리자 권한으로 접속 중입니다.</div>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 border border-[var(--line)] rounded-xl text-sm text-[var(--ink-3)] hover:bg-[var(--bg)]">
              닫기
            </button>
            <button
              onClick={onLogout}
              className="flex-1 py-2.5 bg-[var(--neg)] text-white rounded-xl text-sm font-medium hover:opacity-90"
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pw === ADMIN_PW) {
      onSuccess();
      onClose();
    } else {
      setError('비밀번호가 올바르지 않습니다.');
      setPw('');
      inputRef.current?.focus();
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="animate-in bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        <div className="text-center mb-6">
          <div className="text-3xl mb-3">🔒</div>
          <div className="text-base font-bold text-[var(--ink)]">관리자 로그인</div>
          <div className="text-xs text-[var(--ink-4)] mt-1">비밀번호를 입력하면 파일 업로드 기능이 활성화됩니다.</div>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="password"
            value={pw}
            onChange={e => { setPw(e.target.value); setError(''); }}
            placeholder="비밀번호 입력"
            className="w-full border border-[var(--line)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--accent)] mb-2 text-center tracking-widest"
          />
          {error && <div className="text-xs text-[var(--neg)] text-center mb-2">{error}</div>}
          <button
            type="submit"
            className="w-full py-3 bg-[#0F172A] text-white rounded-xl text-sm font-semibold hover:opacity-90 transition mt-2"
          >
            확인
          </button>
        </form>
      </div>
    </div>
  );
}
