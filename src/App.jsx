import { useState, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import AdminModal from './components/AdminModal';
import Dashboard2nd from './dashboards/Dashboard2nd';
import Dashboard110 from './dashboards/Dashboard110';
import DashboardShinjepum from './dashboards/DashboardShinjepum';
import DashboardSOP from './dashboards/DashboardSOP';
import DashboardMBO from './dashboards/DashboardMBO';
import DashboardPuldongdo from './dashboards/DashboardPuldongdo';
import DashboardCustomerStage from './dashboards/DashboardCustomerStage';
import DashboardDirectTrade from './dashboards/DashboardDirectTrade';
import DashboardHome from './dashboards/DashboardHome';
import ChatWidget from './components/ChatWidget';
import DashboardPerformance from './dashboards/DashboardPerformance';
import DashboardGlossary from './dashboards/DashboardGlossary';
import DashboardHospitalInfo from './dashboards/DashboardHospitalInfo';
import DashboardProductInfo from './dashboards/DashboardProductInfo';
import DashboardInsights from './dashboards/DashboardInsights';
import DashboardOrg360 from './dashboards/DashboardOrg360';

import { TASKS } from './config/tasks';
const EXTRA_TASKS = [
  { id: 'work_assignment', label: '업무분장', title: '업무분장', badge: '업무분장' },
  { id: 'home', label: '홈', title: '영업기획팀 대시보드', badge: '홈' },
  { id: 'perf_local', label: '로컬 실적', title: '로컬 실적', badge: '로컬 실적' },
  { id: 'perf_hospital', label: '병원 실적', title: '병원 실적', badge: '병원 실적' },
  { id: 'glossary', label: '용어사전', title: '용어사전', badge: '용어사전' },
  { id: 'hospital_info', label: '병의원 정보', title: '병의원 정보', badge: '병의원' },
  { id: 'product_info', label: '품목 정보', title: '품목 정보', badge: '품목' },
  { id: 'insights', label: '인사이트 리포트', title: '인사이트 리포트', badge: '인사이트' },
  { id: 'org360', label: '조직 360도 뷰', title: '조직 360도 뷰', badge: '조직360' },
];
const TASK_META = Object.fromEntries([...TASKS, ...EXTRA_TASKS].map(t => [t.id, t]));

export default function App() {
  const [activeTask, setActiveTask] = useState('home');
  const [period, setPeriod] = useState('26년 03월');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleAdminClick = useCallback(() => setShowAdminModal(true), []);
  const handleAdminLogout = useCallback(() => { setIsAdmin(false); setShowAdminModal(false); }, []);

  const meta = TASK_META[activeTask] || TASKS[0];
  const hasDashboard = ['home', 'hospital110', 'hospital2nd', 'new_product', 'sop', 'mbo_system', 'pool_dongdo', 'customer_stage', 'direct_sales', 'perf_local', 'perf_hospital', 'glossary', 'hospital_info', 'product_info', 'insights', 'org360'].includes(activeTask);
  const isHome = activeTask === 'home';

  return (
    <div className="flex h-screen bg-[var(--bg)] overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        activeTask={activeTask}
        onTaskChange={setActiveTask}
        period={period}
        onPeriodChange={setPeriod}
        isAdmin={isAdmin}
        onAdminClick={handleAdminClick}
        isMobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar — 홈 화면일 때는 미니멀하게 (홈 자체에 히어로 영역 있음) */}
        {!isHome && (
          <header className="bg-white border-b border-[var(--line)] flex-shrink-0 z-30">
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3">
                {/* Mobile menu button */}
                <button
                  className="lg:hidden p-2 rounded-lg hover:bg-[var(--line-2)] text-[var(--ink-3)]"
                  onClick={() => setMobileMenuOpen(true)}
                >
                  ☰
                </button>
                <button
                  onClick={() => setActiveTask('home')}
                  className="text-xs text-[var(--ink-4)] hover:text-[var(--ink-2)] transition-colors flex items-center gap-1"
                >
                  <span>←</span><span>홈</span>
                </button>
                <span className="text-[var(--line)]">|</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base text-[var(--ink-4)]">—</span>
                    <h1 className="text-base font-bold text-[var(--ink)]">{meta.title}</h1>
                    {isAdmin && (
                      <span className="text-[10px] font-bold bg-[#F59E0B]/15 text-[#B45309] px-2 py-0.5 rounded-full border border-[#F59E0B]/30">
                        관리자
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--ink-4)]">기준: {period}</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Period quick display */}
                <div className="hidden sm:flex items-center gap-1 text-xs text-[var(--ink-4)] bg-[var(--line-2)] px-3 py-1.5 rounded-lg">
                  <span>📅</span>
                  <span>{period}</span>
                </div>
                {/* Admin quick toggle */}
                <button
                  onClick={handleAdminClick}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                    isAdmin
                      ? 'bg-[#F59E0B]/10 text-[#B45309] border-[#F59E0B]/30 hover:bg-[#F59E0B]/20'
                      : 'bg-white text-[var(--ink-4)] border-[var(--line)] hover:border-[var(--ink-3)] hover:text-[var(--ink)]'
                  }`}
                >
                  {isAdmin ? '🔓 관리자' : '🔒 관리자'}
                </button>
              </div>
            </div>
          </header>
        )}

        {/* 홈 화면일 때 모바일 메뉴 버튼만 따로 (홈에는 별도 헤더가 있음) */}
        {isHome && (
          <div className="lg:hidden flex items-center justify-between px-6 py-3 bg-white border-b border-[var(--line)]">
            <button
              className="p-2 rounded-lg hover:bg-[var(--line-2)] text-[var(--ink-3)]"
              onClick={() => setMobileMenuOpen(true)}
            >☰</button>
            <span className="text-xs text-[var(--ink-4)]">{period}</span>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-6 py-8 scrollbar-thin">
          <div className="max-w-7xl mx-auto">
            {isHome && <DashboardHome period={period} onTaskChange={setActiveTask} onAdminClick={handleAdminClick} isAdmin={isAdmin} />}
            {activeTask === 'hospital2nd' && <Dashboard2nd isAdmin={isAdmin} period={period} />}
            {activeTask === 'hospital110' && <Dashboard110 isAdmin={isAdmin} period={period} />}
            {activeTask === 'new_product' && <DashboardShinjepum isAdmin={isAdmin} period={period} />}
            {activeTask === 'sop' && <DashboardSOP isAdmin={isAdmin} period={period} />}
            {activeTask === 'mbo_system' && <DashboardMBO isAdmin={isAdmin} period={period} />}
            {activeTask === 'pool_dongdo' && <DashboardPuldongdo isAdmin={isAdmin} period={period} />}
            {activeTask === 'customer_stage' && <DashboardCustomerStage isAdmin={isAdmin} period={period} />}
            {activeTask === 'direct_sales' && <DashboardDirectTrade isAdmin={isAdmin} period={period} />}
            {activeTask === 'perf_local' && <DashboardPerformance isAdmin={isAdmin} period={period} type="local" />}
            {activeTask === 'perf_hospital' && <DashboardPerformance isAdmin={isAdmin} period={period} type="hospital" />}
            {activeTask === 'glossary' && <DashboardGlossary isAdmin={isAdmin} />}
            {activeTask === 'hospital_info' && <DashboardHospitalInfo isAdmin={isAdmin} />}
            {activeTask === 'product_info' && <DashboardProductInfo />}
            {activeTask === 'insights' && <DashboardInsights />}
            {activeTask === 'org360' && <DashboardOrg360 />}
            {!hasDashboard && (
              <div className="flex flex-col items-center justify-center py-28 text-center">
                <div className="text-6xl mb-5">🧩</div>
                <div className="text-base font-bold text-[var(--ink-2)] mb-2">{meta.title} 과제 준비 중</div>
                <div className="text-sm text-[var(--ink-4)] leading-relaxed">
                  이 과제의 대시보드는 아직 준비되지 않았습니다.<br />
                  엑셀 양식이 확정되면 시각화를 추가할 수 있습니다.
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* AI 채팅 위젯 (모든 화면에 떠있음) */}
      <ChatWidget period={period} />

      {/* Admin Modal */}
      {showAdminModal && (
        <AdminModal
          isAdmin={isAdmin}
          onSuccess={() => setIsAdmin(true)}
          onLogout={handleAdminLogout}
          onClose={() => setShowAdminModal(false)}
        />
      )}
    </div>
  );
}
