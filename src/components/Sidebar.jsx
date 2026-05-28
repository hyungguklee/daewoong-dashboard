import { useState } from 'react';
import { TASKS } from '../config/tasks';
import logoImg from '../assets/logo.png';

const MONTHS = ['01','02','03','04','05','06','07','08','09','10','11','12'];
const CUR_YEAR = 26;

export default function Sidebar({ activeTask, onTaskChange, period, onPeriodChange, isAdmin, onAdminClick, isMobileOpen, onMobileClose }) {
  const [year, setYear] = useState(period?.split('년')[0] || String(CUR_YEAR));
  const [month, setMonth] = useState(period?.split('년 ')[1]?.replace('월','') || '03');

  const handlePeriod = (y, m) => {
    onPeriodChange(`${y}년 ${m}월`);
  };

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onMobileClose} />
      )}

      <aside className={`
        fixed left-0 top-0 bottom-0 w-60 z-50 flex flex-col
        bg-[#0F172A] text-white
        transition-transform duration-300
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        {/* Logo */}
        <div className="px-4 pt-5 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-24 h-24 rounded-xl bg-white flex-shrink-0 overflow-hidden flex items-center justify-center p-1">
              <img src={logoImg} alt="영업기획팀" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="text-sm font-extrabold text-white tracking-wide leading-tight">영업기획팀</div>
              <div className="text-[10px] text-[#F59E0B] font-semibold tracking-widest mt-0.5 uppercase">Daewoong</div>
            </div>
          </div>
        </div>

        {/* Period selector */}
        <div className="px-4 py-4 border-b border-white/10">
          <div className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-2">기준 기간</div>
          <div className="flex gap-2 mb-2">
            <select
              value={year}
              onChange={e => { setYear(e.target.value); handlePeriod(e.target.value, month); }}
              className="flex-1 bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-xs text-white appearance-none cursor-pointer focus:outline-none focus:border-[#F59E0B]"
            >
              {['26','27'].map(y => (
                <option key={y} value={y} className="bg-[#0F172A]">{y}년</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {MONTHS.map(m => (
              <button
                key={m}
                onClick={() => { setMonth(m); handlePeriod(year, m); }}
                className={`py-1 rounded text-xs font-medium transition-all ${
                  month === m
                    ? 'bg-[#F59E0B] text-[#0F172A] font-bold'
                    : 'bg-white/8 text-white/50 hover:bg-white/15 hover:text-white'
                }`}
              >
                {parseInt(m)}월
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar groups */}
        <div className="flex-1 px-3 py-4 overflow-y-auto">
          {/* 홈 버튼 */}
          <button
            onClick={() => { onTaskChange('home'); onMobileClose?.(); }}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all mb-4 ${
              activeTask === 'home'
                ? 'bg-[#F59E0B]/15 text-[#F59E0B]'
                : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className="text-sm">🏠</span>
            <span className="text-xs font-semibold leading-tight">홈</span>
            {activeTask === 'home' && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#F59E0B] flex-shrink-0" />
            )}
          </button>

          {/* 인사이트 리포트 버튼 */}
          <button
            onClick={() => { onTaskChange('insights'); onMobileClose?.(); }}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all mb-2 ${
              activeTask === 'insights'
                ? 'bg-[#F59E0B]/15 text-[#F59E0B]'
                : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className="text-sm">📊</span>
            <span className="text-xs font-semibold leading-tight">인사이트 리포트</span>
            {activeTask === 'insights' && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#F59E0B] flex-shrink-0" />
            )}
          </button>

          {/* 조직 360도 뷰 버튼 */}
          <button
            onClick={() => { onTaskChange('org360'); onMobileClose?.(); }}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all mb-2 ${
              activeTask === 'org360'
                ? 'bg-[#F59E0B]/15 text-[#F59E0B]'
                : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className="text-sm">🔎</span>
            <span className="text-xs font-semibold leading-tight">조직 360도 뷰</span>
            {activeTask === 'org360' && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#F59E0B] flex-shrink-0" />
            )}
          </button>

          {/* 용어사전 버튼 */}
          <button
            onClick={() => { onTaskChange('glossary'); onMobileClose?.(); }}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all mb-4 ${
              activeTask === 'glossary'
                ? 'bg-[#F59E0B]/15 text-[#F59E0B]'
                : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className="text-sm">📖</span>
            <span className="text-xs font-semibold leading-tight">용어사전</span>
            {activeTask === 'glossary' && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#F59E0B] flex-shrink-0" />
            )}
          </button>

          {/* 심평원 정보 그룹 */}
          <div className="text-[12px] font-semibold text-white/55 tracking-wider mb-2 px-2">심평원 정보</div>
          <nav className="space-y-1 mb-5">
            {[{ id: 'hospital_info', label: '병의원 정보' }, { id: 'product_info', label: '품목 정보' }].map(item => {
              const isActive = activeTask === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { onTaskChange(item.id); onMobileClose?.(); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${
                    isActive
                      ? 'bg-white/15 text-white'
                      : 'text-white/55 hover:bg-white/8 hover:text-white/80'
                  }`}
                >
                  <span className={`text-xs flex-shrink-0 ${isActive ? 'text-[#F59E0B]' : 'text-white/30'}`}>—</span>
                  <span className="text-xs font-medium leading-tight">{item.label}</span>
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#F59E0B] flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* 영업기획팀 그룹 */}
          <div className="text-[12px] font-semibold text-white/55 tracking-wider mb-2 px-2">영업기획팀</div>
          <nav className="space-y-1 mb-5">
            {[{ id: 'work_assignment', label: '업무분장' }].map(item => {
              const isActive = activeTask === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { onTaskChange(item.id); onMobileClose?.(); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${
                    isActive
                      ? 'bg-white/15 text-white'
                      : 'text-white/55 hover:bg-white/8 hover:text-white/80'
                  }`}
                >
                  <span className={`text-xs flex-shrink-0 ${isActive ? 'text-[#F59E0B]' : 'text-white/30'}`}>—</span>
                  <span className="text-xs font-medium leading-tight">{item.label}</span>
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#F59E0B] flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* 과제 목록 그룹 */}
          <div className="text-[12px] font-semibold text-white/55 tracking-wider mb-2 px-2">과제 목록</div>
          <nav className="space-y-1 mb-5">
            {TASKS.map(task => {
              const isActive = activeTask === task.id;
              return (
                <button
                  key={task.id}
                  onClick={() => { onTaskChange(task.id); onMobileClose?.(); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${
                    isActive
                      ? 'bg-white/15 text-white'
                      : 'text-white/55 hover:bg-white/8 hover:text-white/80'
                  }`}
                >
                  <span className={`text-xs flex-shrink-0 ${isActive ? 'text-[#F59E0B]' : 'text-white/30'}`}>—</span>
                  <span className="text-xs font-medium leading-tight">{task.label}</span>
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#F59E0B] flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* 실적 그룹 */}
          <div className="text-[12px] font-semibold text-white/55 tracking-wider mb-2 px-2">실적</div>
          <nav className="space-y-1">
            {[{ id: 'perf_local', label: '로컬' }, { id: 'perf_hospital', label: '병원' }].map(item => {
              const isActive = activeTask === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { onTaskChange(item.id); onMobileClose?.(); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${
                    isActive
                      ? 'bg-white/15 text-white'
                      : 'text-white/55 hover:bg-white/8 hover:text-white/80'
                  }`}
                >
                  <span className={`text-xs flex-shrink-0 ${isActive ? 'text-[#F59E0B]' : 'text-white/30'}`}>—</span>
                  <span className="text-xs font-medium leading-tight">{item.label}</span>
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#F59E0B] flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Admin / Footer */}
        <div className="px-4 py-4 border-t border-white/10">
          <button
            onClick={onAdminClick}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${
              isAdmin
                ? 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30'
                : 'text-white/40 hover:text-white/70 hover:bg-white/8'
            }`}
          >
            <span className="text-sm">{isAdmin ? '🔓' : '🔒'}</span>
            <span className="font-medium">{isAdmin ? '관리자 모드' : '관리자'}</span>
            {isAdmin && <span className="ml-auto text-[10px] opacity-70">로그아웃</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
