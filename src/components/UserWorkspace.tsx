import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  Bell,
  Briefcase,
  Cpu,
  Download,
  HelpCircle,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Mic,
  PlayCircle,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { DEPARTMENT_LABELS, formatDateTime, formatKes, formatShortDate } from '../lib/format.ts';
import { MarketplaceTaskItem, TaskWorkbench } from './TaskWorkbench.tsx';
import { AdvertiserPortal, AiClientPortal } from './BusinessPortals.tsx';
import { AdminCommandCenter } from './AdminCommandCenter.tsx';

export type WorkspaceSection =
  | 'dashboard'
  | 'tasks'
  | 'ads'
  | 'ai-training'
  | 'voice'
  | 'ai-eval'
  | 'surveys'
  | 'wallet'
  | 'withdrawals'
  | 'badges'
  | 'referrals'
  | 'notifications'
  | 'profile'
  | 'advertiser'
  | 'ai-client'
  | 'admin'
  | 'support';

interface BadgeItem {
  code: string;
  name: string;
  description: string;
  tier: string;
  criteriaThreshold: number;
  earned: boolean;
  earnedAt: string | null;
}

interface RecommendedItem {
  task: MarketplaceTaskItem;
  matchScore: number;
  reason: string;
  aiPowered: boolean;
  splitPreview: { grossCents: number; userCents: number; paybillCents: number };
}

interface DashboardSummary {
  metrics: {
    grossEarnedCents: number;
    userNetEarnedCents: number;
    paybillAllocatedCents: number;
    availableBalanceCents: number;
    pendingBalanceCents: number;
    dailyNetCents: number;
    weeklyNetCents: number;
    monthlyNetCents: number;
    lifetimeNetCents: number;
    completedTasksCount: number;
    qualityScorePct: number;
  };
  earningsSeries: Array<{ date: string; userKsh: number; paybillKsh: number }>;
  recentLedger: Array<{
    id: number;
    reference: string;
    sourceType: string;
    grossCents: number;
    userCents: number;
    paybillCents: number;
    paybillNumber: string;
    paybillAccount: string;
    settlementStatus: string;
    createdAt: string;
  }>;
  notifications: Array<{
    id: number;
    category: string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: string;
  }>;
  badges: BadgeItem[];
  daraja: {
    mode: string;
    paybill: string;
    accountNumber: string;
    stkPushNote: string;
    b2cWithdrawalNote: string;
  };
}

interface WalletData {
  ledger: DashboardSummary['recentLedger'];
  withdrawals: Array<{
    id: number;
    reference: string;
    mpesaPhone: string;
    amountCents: number;
    feeCents: number;
    netDisbursementCents: number;
    status: string;
    createdAt: string;
  }>;
  config: {
    minWithdrawalCents: number;
    withdrawalFeeCents: number;
    dailyLimitCents: number;
    paybillNumber: string;
    paybillAccount: string;
  };
  daraja: DashboardSummary['daraja'];
}

export const UserWorkspace: React.FC<{
  initialSection?: WorkspaceSection;
  onExitToPublic: () => void;
}> = ({ initialSection = 'dashboard', onExitToPublic }) => {
  const { dbUser, signOut, refreshProfile, apiFetch } = useAuth();
  const [section, setSection] = useState<WorkspaceSection>(initialSection);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [tasks, setTasks] = useState<MarketplaceTaskItem[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendedItem[]>([]);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [activeTask, setActiveTask] = useState<MarketplaceTaskItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Withdrawal form
  const [withdrawAmountKsh, setWithdrawAmountKsh] = useState('100');
  const [withdrawPhone, setWithdrawPhone] = useState(dbUser?.mpesaNumber || dbUser?.phone || '');
  const [withdrawing, setWithdrawing] = useState(false);

  // Profile form
  const [profileForm, setProfileForm] = useState({
    fullName: dbUser?.fullName || '',
    phone: dbUser?.phone || '',
    mpesaNumber: dbUser?.mpesaNumber || '',
    referralCodeInput: '',
    preferredLanguages: dbUser?.preferredLanguages || ['English', 'Kiswahili'],
  });
  const [otpInput, setOtpInput] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  // Support form
  const [supportForm, setSupportForm] = useState({ subject: '', message: '' });

  useEffect(() => {
    if (dbUser) {
      setWithdrawPhone((prev) => prev || dbUser.mpesaNumber || dbUser.phone || '');
      setProfileForm((prev) => ({
        ...prev,
        fullName: dbUser.fullName || '',
        phone: dbUser.phone || '',
        mpesaNumber: dbUser.mpesaNumber || '',
        preferredLanguages: dbUser.preferredLanguages || ['English', 'Kiswahili'],
      }));
    }
  }, [dbUser]);

  const loadWorkspaceData = useCallback(async () => {
    try {
      const [sumRes, taskRes, recRes, walRes] = await Promise.all([
        apiFetch<DashboardSummary>('/api/dashboard/summary'),
        apiFetch<{ tasks: MarketplaceTaskItem[] }>('/api/tasks'),
        apiFetch<{ recommendations: RecommendedItem[] }>('/api/recommendations'),
        apiFetch<WalletData>('/api/wallet'),
      ]);
      setSummary(sumRes);
      setTasks(taskRes.tasks);
      setRecommendations(recRes.recommendations);
      setWalletData(walRes);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to sync workspace data.');
    }
  }, [apiFetch]);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  const handleAccept8020 = async () => {
    try {
      await apiFetch('/api/me/profile', {
        method: 'PATCH',
        body: JSON.stringify({ accepted8020Terms: true, acceptedDataPrivacy: true }),
      });
      await refreshProfile();
      await loadWorkspaceData();
      setToast('80/20 Earnings Allocation Agreement & Kenya DPA Privacy accepted.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to update consent.');
    }
  };

  const handleTaskSubmit = async (
    taskId: number,
    responsePayload: Record<string, unknown>,
    voiceConsentAccepted: boolean
  ) => {
    const res = await apiFetch<{
      split: { grossCents: number; userCents: number; paybillCents: number };
      newlyAwardedBadges: Array<{ name: string }>;
    }>(`/api/tasks/${taskId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ responsePayload, voiceConsentAccepted }),
    });
    setActiveTask(null);
    const badgeMsg =
      res.newlyAwardedBadges?.length > 0
        ? ` Unlocked badge: ${res.newlyAwardedBadges.map((b) => b.name).join(', ')}!`
        : '';
    setToast(
      `Credited ${formatKes(res.split.userCents)} (80%) to your wallet; ${formatKes(
        res.split.paybillCents
      )} (20%) allocated to Paybill 522522 Acc 1355643775.${badgeMsg}`
    );
    await refreshProfile();
    await loadWorkspaceData();
  };

  const handleRecFeedback = async (
    taskId: number,
    action: 'clicked' | 'thumbs_up' | 'thumbs_down' | 'dismissed'
  ) => {
    try {
      await apiFetch(`/api/recommendations/${taskId}/feedback`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      const recRes = await apiFetch<{ recommendations: RecommendedItem[] }>('/api/recommendations');
      setRecommendations(recRes.recommendations);
      if (action === 'thumbs_up') setToast('Recommender updated: prioritizing similar tasks.');
      if (action === 'dismissed' || action === 'thumbs_down') {
        setToast('Recommender adapted: hiding this task type.');
      }
    } catch {
      // Ignore transient feedback errors
    }
  };

  const handleWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setWithdrawing(true);
    try {
      const res = await apiFetch<{ darajaNote: string }>('/api/withdrawals', {
        method: 'POST',
        body: JSON.stringify({
          amountKsh: Number(withdrawAmountKsh),
          mpesaPhone: withdrawPhone,
        }),
      });
      setToast(res.darajaNote);
      await refreshProfile();
      await loadWorkspaceData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Withdrawal failed.');
    } finally {
      setWithdrawing(false);
    }
  };

  const handleDownloadStatement = async () => {
    try {
      const csv = await apiFetch<string>('/api/wallet/statement.csv');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'callidus-80-20-statement.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to export statement.');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await apiFetch('/api/me/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          ...profileForm,
          verifyPhoneOtp: otpSent && otpInput.trim().length >= 4,
        }),
      });
      await refreshProfile();
      await loadWorkspaceData();
      setToast('Profile & preferences saved.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update profile.');
    }
  };

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inquiryType: 'support',
          name: dbUser?.fullName || dbUser?.email || 'Contributor',
          email: dbUser?.email || '',
          subject: supportForm.subject,
          message: supportForm.message,
        }),
      });
      setSupportForm({ subject: '', message: '' });
      setToast('Support ticket submitted to our Nairobi support desk.');
    } catch {
      setErrorMsg('Unable to submit support ticket.');
    }
  };

  const departmentFilterMap: Partial<Record<WorkspaceSection, string>> = {
    ads: 'rewarded_ads',
    'ai-training': 'ai_training',
    voice: 'voice_intelligence',
    'ai-eval': 'ai_evaluation',
    surveys: 'market_research',
  };

  const unreadCount = summary?.notifications.filter((n) => !n.isRead).length || 0;
  const isStaff = ['admin', 'finance_officer', 'moderator', 'support_agent'].includes(
    dbUser?.role || ''
  );

  const navItems: Array<{ id: WorkspaceSection; label: string; icon: React.ReactNode }> = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'tasks', label: 'Available Tasks', icon: <ListChecks className="h-4 w-4" /> },
    { id: 'ads', label: 'Watch Ads', icon: <PlayCircle className="h-4 w-4" /> },
    { id: 'ai-training', label: 'AI Training Lab', icon: <Cpu className="h-4 w-4" /> },
    { id: 'voice', label: 'Voice Intelligence', icon: <Mic className="h-4 w-4" /> },
    { id: 'ai-eval', label: 'AI Evaluation', icon: <ShieldCheck className="h-4 w-4" /> },
    { id: 'surveys', label: 'Surveys', icon: <ListChecks className="h-4 w-4" /> },
    { id: 'wallet', label: 'Wallet & 80/20', icon: <Wallet className="h-4 w-4" /> },
    { id: 'withdrawals', label: 'Withdrawals', icon: <Download className="h-4 w-4" /> },
    { id: 'badges', label: 'Badges', icon: <Award className="h-4 w-4" /> },
    { id: 'referrals', label: 'Referrals', icon: <Users className="h-4 w-4" /> },
    {
      id: 'notifications',
      label: unreadCount > 0 ? `Notifications (${unreadCount})` : 'Notifications',
      icon: <Bell className="h-4 w-4" />,
    },
    { id: 'profile', label: 'Profile & KYC', icon: <UserCheck className="h-4 w-4" /> },
    { id: 'advertiser', label: 'Advertiser Portal', icon: <Briefcase className="h-4 w-4" /> },
    { id: 'ai-client', label: 'AI Client Portal', icon: <Cpu className="h-4 w-4" /> },
    ...(isStaff
      ? [{ id: 'admin' as WorkspaceSection, label: 'Admin Center', icon: <ShieldCheck className="h-4 w-4" /> }]
      : []),
    { id: 'support', label: 'Support', icon: <HelpCircle className="h-4 w-4" /> },
  ];

  const activeDept = departmentFilterMap[section];
  const visibleTasks = activeDept ? tasks.filter((t) => t.department === activeDept) : tasks;

  const maxSeriesVal = Math.max(
    10,
    ...(summary?.earningsSeries.map((d) => d.userKsh + d.paybillKsh) || [10])
  );

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="border-b border-white/10 bg-[#080C12] p-4 lg:min-h-[calc(100vh-65px)] lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="mb-4 flex items-center justify-between px-2">
          <div>
            <p className="truncate text-xs font-semibold text-white">
              {dbUser?.fullName || dbUser?.email}
            </p>
            <p className="text-xs capitalize text-emerald-400">{dbUser?.role || 'contributor'}</p>
          </div>
          <button
            type="button"
            onClick={onExitToPublic}
            className="text-xs text-slate-400 hover:text-white"
          >
            Public Site
          </button>
        </div>

        <nav className="flex gap-1.5 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                section === item.id
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white border border-transparent'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={signOut}
            className="mt-2 flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-rose-300 hover:bg-rose-500/10 whitespace-nowrap shrink-0"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="min-w-0 flex-1 p-5 sm:p-8">
        {dbUser && !dbUser.accepted8020Terms && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-500/35 bg-emerald-500/10 p-5">
            <div>
              <p className="text-sm font-semibold text-white">
                Action Required: Accept 80/20 Earnings Allocation & Kenya DPA Consent
              </p>
              <p className="mt-1 text-xs text-slate-300">
                Every eligible gross reward credits 80% to your wallet and allocates 20% once to
                M-PESA Paybill 522522 (Account 1355643775).
              </p>
            </div>
            <button
              type="button"
              onClick={handleAccept8020}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 whitespace-nowrap shrink-0"
            >
              Accept 80/20 Agreement
            </button>
          </div>
        )}

        {toast && (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">
            <span>{toast}</span>
            <button type="button" onClick={() => setToast(null)} className="text-emerald-400">
              Dismiss
            </button>
          </div>
        )}
        {errorMsg && (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
            <span>{errorMsg}</span>
            <button type="button" onClick={() => setErrorMsg(null)} className="text-rose-300">
              Dismiss
            </button>
          </div>
        )}

        {/* DASHBOARD */}
        {section === 'dashboard' && summary && (
          <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-white">Contributor Intelligence Dashboard</h1>
                <p className="mt-1 text-xs text-slate-400">
                  KES Wallet · 80% Net Contributor Share · 20% Paybill 522522 (Acc 1355643775)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSection('tasks')}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
              >
                Browse Open Tasks
              </button>
            </div>

            {/* Primary KPI Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-[#0B1118] p-5">
                <p className="text-xs text-slate-400">Available Balance (80% Net)</p>
                <p className="mt-2 font-mono text-2xl font-semibold text-emerald-400 tabular-nums">
                  {formatKes(summary.metrics.availableBalanceCents)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Pending: {formatKes(summary.metrics.pendingBalanceCents)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0B1118] p-5">
                <p className="text-xs text-slate-400">Total Gross Earnings</p>
                <p className="mt-2 font-mono text-2xl font-semibold text-white tabular-nums">
                  {formatKes(summary.metrics.grossEarnedCents)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  80% User: {formatKes(summary.metrics.userNetEarnedCents)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0B1118] p-5">
                <p className="text-xs text-slate-400">20% Paybill 522522 Allocated</p>
                <p className="mt-2 font-mono text-2xl font-semibold text-cyan-400 tabular-nums">
                  {formatKes(summary.metrics.paybillAllocatedCents)}
                </p>
                <p className="mt-1 text-xs text-slate-500">Acc 1355643775</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0B1118] p-5">
                <p className="text-xs text-slate-400">Completed Tasks</p>
                <p className="mt-2 font-mono text-2xl font-semibold text-violet-400 tabular-nums">
                  {summary.metrics.completedTasksCount}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Quality Score: {summary.metrics.qualityScorePct}%
                </p>
              </div>
            </div>

            {/* Time Windows & Chart */}
            <div className="grid gap-6 lg:grid-cols-12">
              <div className="rounded-2xl border border-white/10 bg-[#0B1118] p-6 lg:col-span-8">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-white">7-Day 80/20 Allocation Chart (KES)</h2>
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span className="text-emerald-400">80% User Net</span>
                    <span className="text-cyan-400">20% Paybill</span>
                  </div>
                </div>
                <div className="mt-6 grid h-44 grid-cols-7 items-end gap-3">
                  {summary.earningsSeries.map((day) => {
                    const userH = Math.max(4, Math.round((day.userKsh / maxSeriesVal) * 120));
                    const pbH = Math.max(2, Math.round((day.paybillKsh / maxSeriesVal) * 120));
                    return (
                      <div key={day.date} className="flex flex-col items-center gap-2">
                        <div className="flex w-full max-w-[36px] flex-col justify-end overflow-hidden rounded-md bg-white/5">
                          <div
                            style={{ height: `${pbH}px` }}
                            className="w-full bg-cyan-500/80 transition-all"
                            title={`20% Paybill: KSh ${day.paybillKsh}`}
                          />
                          <div
                            style={{ height: `${userH}px` }}
                            className="w-full bg-emerald-500 transition-all"
                            title={`80% User: KSh ${day.userKsh}`}
                          />
                        </div>
                        <span className="font-mono text-[11px] text-slate-400">{day.date}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0B1118] p-6 lg:col-span-4">
                <h2 className="text-base font-semibold text-white">Earnings Cadence (80% Net)</h2>
                <div className="mt-4 space-y-3 text-xs">
                  <div className="flex justify-between border-b border-white/10 pb-2.5">
                    <span className="text-slate-400">Daily Net</span>
                    <span className="font-mono font-semibold text-white tabular-nums">
                      {formatKes(summary.metrics.dailyNetCents)}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-2.5">
                    <span className="text-slate-400">Weekly Net</span>
                    <span className="font-mono font-semibold text-white tabular-nums">
                      {formatKes(summary.metrics.weeklyNetCents)}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-2.5">
                    <span className="text-slate-400">Monthly Net</span>
                    <span className="font-mono font-semibold text-white tabular-nums">
                      {formatKes(summary.metrics.monthlyNetCents)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Lifetime Net</span>
                    <span className="font-mono font-semibold text-emerald-400 tabular-nums">
                      {formatKes(summary.metrics.lifetimeNetCents)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* AI-POWERED ADAPTIVE TASK RECOMMENDER */}
            <div className="rounded-2xl border border-violet-500/25 bg-[#0B1118] p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-violet-400">
                    Adaptive AI Recommender · Personalized to Your History & Feedback
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-white">
                    Recommended Earning Opportunities
                  </h2>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {recommendations.map((rec) => (
                  <div
                    key={rec.task.id}
                    className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#05070A] p-5"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>{DEPARTMENT_LABELS[rec.task.department]}</span>
                        <span className="font-mono text-violet-300 tabular-nums">
                          {rec.matchScore}% match
                        </span>
                      </div>
                      <h3 className="mt-2 text-base font-semibold text-white">{rec.task.title}</h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{rec.reason}</p>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
                      <span className="font-mono text-sm font-semibold text-emerald-400 tabular-nums">
                        {formatKes(rec.splitPreview.userCents)} net
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleRecFeedback(rec.task.id, 'thumbs_up')}
                          title="Prefer tasks like this"
                          className="rounded-lg border border-white/10 p-1.5 text-slate-400 hover:border-emerald-500/40 hover:text-emerald-400"
                        >
                          <ThumbsUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRecFeedback(rec.task.id, 'dismissed')}
                          title="Show fewer like this"
                          className="rounded-lg border border-white/10 p-1.5 text-slate-400 hover:border-rose-500/40 hover:text-rose-400"
                        >
                          <ThumbsDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleRecFeedback(rec.task.id, 'clicked');
                            setActiveTask(rec.task);
                          }}
                          className="rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                        >
                          Start Task
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Earned Badges Preview + Recent Transactions */}
            <div className="grid gap-6 lg:grid-cols-12">
              <div className="rounded-2xl border border-white/10 bg-[#0B1118] p-6 lg:col-span-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-white">Achievement Badges</h2>
                  <button
                    type="button"
                    onClick={() => setSection('badges')}
                    className="text-xs text-emerald-400 hover:underline"
                  >
                    View all
                  </button>
                </div>
                <div className="mt-4 space-y-2.5">
                  {summary.badges.slice(0, 4).map((b) => (
                    <div
                      key={b.code}
                      className={`flex items-center justify-between rounded-xl border p-3 text-xs ${
                        b.earned
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-white'
                          : 'border-white/5 bg-[#05070A] text-slate-400'
                      }`}
                    >
                      <div>
                        <p className="font-semibold">{b.name}</p>
                        <p className="text-[11px] opacity-80">{b.tier}</p>
                      </div>
                      <span className="font-mono text-[11px]">
                        {b.earned ? 'Earned' : 'Locked'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#0B1118] p-6 lg:col-span-7">
                <h2 className="text-base font-semibold text-white">Recent 80/20 Transactions</h2>
                {summary.recentLedger.length === 0 ? (
                  <p className="mt-4 text-xs text-slate-400">
                    Complete any marketplace task to generate your first immutable 80/20 ledger record.
                  </p>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-white/10 text-slate-400">
                        <tr>
                          <th className="py-2 pr-3">Ref</th>
                          <th className="py-2 pr-3 text-right">Gross</th>
                          <th className="py-2 pr-3 text-right">80% You</th>
                          <th className="py-2 pr-3 text-right">20% Paybill</th>
                          <th className="py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-slate-200">
                        {summary.recentLedger.slice(0, 6).map((row) => (
                          <tr key={row.id}>
                            <td className="py-2.5 pr-3 font-mono">{row.reference}</td>
                            <td className="py-2.5 pr-3 text-right font-mono tabular-nums">
                              {formatKes(row.grossCents)}
                            </td>
                            <td className="py-2.5 pr-3 text-right font-mono text-emerald-400 tabular-nums">
                              {formatKes(row.userCents)}
                            </td>
                            <td className="py-2.5 pr-3 text-right font-mono text-cyan-400 tabular-nums">
                              {formatKes(row.paybillCents)}
                            </td>
                            <td className="py-2.5 text-slate-400">{row.settlementStatus}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TASK MARKETPLACE & DEPARTMENT VIEWS */}
        {(['tasks', 'ads', 'ai-training', 'voice', 'ai-eval', 'surveys'] as WorkspaceSection[]).includes(
          section
        ) && (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-medium text-emerald-400">
                Verified Microtasks · Automatic 80/20 KES Split
              </p>
              <h2 className="mt-1 text-2xl font-bold text-white">
                {activeDept ? DEPARTMENT_LABELS[activeDept] : 'Available Marketplace Tasks'}
              </h2>
            </div>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {visibleTasks.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0B1118] p-6"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{DEPARTMENT_LABELS[t.department]}</span>
                      <span>
                        {t.language} · {t.estimatedMinutes} min
                      </span>
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-white">{t.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-slate-300">{t.description}</p>
                    <p className="mt-3 text-[11px] text-slate-400">
                      Eligibility: {t.eligibilityRequirement}
                    </p>
                  </div>

                  <div className="mt-5 border-t border-white/10 pt-4">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-400">Your 80% Net</span>
                      <span className="font-mono text-base font-semibold text-emerald-400 tabular-nums">
                        {formatKes(t.splitPreview.userCents)}
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-slate-500 tabular-nums">
                      Gross {formatKes(t.grossRewardCents)} · 20% Paybill {formatKes(t.splitPreview.paybillCents)}
                    </p>
                    <button
                      type="button"
                      disabled={t.userCompleted}
                      onClick={() => setActiveTask(t)}
                      className={`mt-4 w-full rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                        t.userCompleted
                          ? 'border border-white/10 bg-white/5 text-slate-400 cursor-not-allowed'
                          : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                      }`}
                    >
                      {t.userCompleted ? 'Completed & Allocated' : 'Open Task Workbench'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WALLET & WITHDRAWALS */}
        {(section === 'wallet' || section === 'withdrawals') && walletData && dbUser && (
          <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-emerald-400">
                  Kenyan Shilling Ledger · Paybill {walletData.config.paybillNumber} Acc{' '}
                  {walletData.config.paybillAccount}
                </p>
                <h2 className="mt-1 text-2xl font-bold text-white">M-PESA Wallet & Withdrawals</h2>
              </div>
              <button
                type="button"
                onClick={handleDownloadStatement}
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-white hover:bg-white/10"
              >
                <Download className="h-4 w-4" />
                Download Statement (CSV)
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-[#0B1118] p-5">
                <p className="text-xs text-slate-400">Available Balance</p>
                <p className="mt-2 font-mono text-2xl font-semibold text-emerald-400 tabular-nums">
                  {formatKes(dbUser.availableBalanceCents)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0B1118] p-5">
                <p className="text-xs text-slate-400">Pending Withdrawal Queue</p>
                <p className="mt-2 font-mono text-2xl font-semibold text-amber-300 tabular-nums">
                  {formatKes(dbUser.pendingBalanceCents)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0B1118] p-5">
                <p className="text-xs text-slate-400">Gross Lifetime Earnings</p>
                <p className="mt-2 font-mono text-2xl font-semibold text-white tabular-nums">
                  {formatKes(dbUser.grossEarnedCents)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0B1118] p-5">
                <p className="text-xs text-slate-400">20% Paybill Allocated</p>
                <p className="mt-2 font-mono text-2xl font-semibold text-cyan-400 tabular-nums">
                  {formatKes(dbUser.paybillAllocatedCents)}
                </p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-12">
              <form
                onSubmit={handleWithdrawal}
                className="space-y-4 rounded-2xl border border-white/10 bg-[#0B1118] p-6 lg:col-span-5"
              >
                <h3 className="text-base font-semibold text-white">Request M-PESA B2C Withdrawal</h3>
                <p className="text-xs leading-relaxed text-slate-400">
                  {walletData.daraja.b2cWithdrawalNote}
                </p>
                <div>
                  <label className="block text-xs text-slate-300">M-PESA Phone Number</label>
                  <input
                    type="text"
                    required
                    value={withdrawPhone}
                    onChange={(e) => setWithdrawPhone(e.target.value)}
                    placeholder="0712345678 or 254712345678"
                    className="mt-1 w-full rounded-lg border border-white/15 bg-[#05070A] px-3 py-2 font-mono text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300">
                    Amount in KES (Min {formatKes(walletData.config.minWithdrawalCents)})
                  </label>
                  <input
                    type="number"
                    min={walletData.config.minWithdrawalCents / 100}
                    required
                    value={withdrawAmountKsh}
                    onChange={(e) => setWithdrawAmountKsh(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-[#05070A] px-3 py-2 font-mono text-sm text-white"
                  />
                </div>
                <p className="text-xs text-slate-400">
                  Platform Fee: {formatKes(walletData.config.withdrawalFeeCents)} · Daily Limit:{' '}
                  {formatKes(walletData.config.dailyLimitCents, false)}
                </p>
                <button
                  type="submit"
                  disabled={withdrawing}
                  className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                >
                  {withdrawing ? 'Queueing M-PESA Payout...' : 'Submit Withdrawal Request'}
                </button>
              </form>

              <div className="rounded-2xl border border-white/10 bg-[#0B1118] p-6 lg:col-span-7">
                <h3 className="text-base font-semibold text-white">Withdrawal History</h3>
                {walletData.withdrawals.length === 0 ? (
                  <p className="mt-4 text-xs text-slate-400">No withdrawal requests yet.</p>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-white/10 text-slate-400">
                        <tr>
                          <th className="py-2 pr-3">Ref</th>
                          <th className="py-2 pr-3">M-PESA</th>
                          <th className="py-2 pr-3 text-right">Net KES</th>
                          <th className="py-2 pr-3">Status</th>
                          <th className="py-2">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-slate-200">
                        {walletData.withdrawals.map((w) => (
                          <tr key={w.id}>
                            <td className="py-2.5 pr-3 font-mono">{w.reference}</td>
                            <td className="py-2.5 pr-3 font-mono">{w.mpesaPhone}</td>
                            <td className="py-2.5 pr-3 text-right font-mono tabular-nums">
                              {formatKes(w.netDisbursementCents)}
                            </td>
                            <td className="py-2.5 pr-3 text-amber-300">{w.status}</td>
                            <td className="py-2.5 text-slate-400">{formatShortDate(w.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0B1118] p-6">
              <h3 className="text-base font-semibold text-white">
                Immutable 80/20 Allocation History (Paybill 522522 · Acc 1355643775)
              </h3>
              <p className="mt-1 text-xs text-slate-400">{walletData.daraja.stkPushNote}</p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/10 text-slate-400">
                    <tr>
                      <th className="py-2 pr-3">Reference</th>
                      <th className="py-2 pr-3">Source</th>
                      <th className="py-2 pr-3 text-right">Gross</th>
                      <th className="py-2 pr-3 text-right">80% Net</th>
                      <th className="py-2 pr-3 text-right">20% Paybill</th>
                      <th className="py-2 pr-3">Settlement State</th>
                      <th className="py-2">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-200">
                    {walletData.ledger.map((l) => (
                      <tr key={l.id}>
                        <td className="py-2.5 pr-3 font-mono">{l.reference}</td>
                        <td className="py-2.5 pr-3">{l.sourceType}</td>
                        <td className="py-2.5 pr-3 text-right font-mono tabular-nums">
                          {formatKes(l.grossCents)}
                        </td>
                        <td className="py-2.5 pr-3 text-right font-mono text-emerald-400 tabular-nums">
                          {formatKes(l.userCents)}
                        </td>
                        <td className="py-2.5 pr-3 text-right font-mono text-cyan-400 tabular-nums">
                          {formatKes(l.paybillCents)}
                        </td>
                        <td className="py-2.5 pr-3">{l.settlementStatus}</td>
                        <td className="py-2.5 text-slate-400">{formatDateTime(l.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* BADGES & GAMIFICATION */}
        {section === 'badges' && summary && (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-medium text-violet-400">
                Gamification Achievements · Profile Trophy Room
              </p>
              <h2 className="mt-1 text-2xl font-bold text-white">Contributor Badges</h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {summary.badges.map((b) => (
                <div
                  key={b.code}
                  className={`rounded-2xl border p-6 ${
                    b.earned
                      ? 'border-emerald-500/40 bg-[#0B1118]'
                      : 'border-white/10 bg-[#080C12] opacity-75'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Award
                      className={`h-6 w-6 ${b.earned ? 'text-emerald-400' : 'text-slate-500'}`}
                    />
                    <span className="font-mono text-xs text-slate-400">{b.tier}</span>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-white">{b.name}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{b.description}</p>
                  <p className="mt-4 font-mono text-xs text-emerald-400">
                    {b.earned && b.earnedAt
                      ? `Unlocked ${formatShortDate(b.earnedAt)}`
                      : 'In Progress'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* REFERRALS */}
        {section === 'referrals' && dbUser && (
          <div className="max-w-2xl space-y-6">
            <div>
              <p className="text-xs font-medium text-emerald-400">
                KSh 50 Gross Referral Bonus (KSh 40 Net / KSh 10 Paybill)
              </p>
              <h2 className="mt-1 text-2xl font-bold text-white">Referral Program</h2>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0B1118] p-6 space-y-4">
              <p className="text-xs text-slate-400">Your Unique Contributor Referral Code</p>
              <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-[#05070A] px-4 py-3">
                <span className="font-mono text-lg font-semibold text-emerald-400">
                  {dbUser.referralCode}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(dbUser.referralCode || '');
                    setToast('Referral code copied to clipboard.');
                  }}
                  className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950"
                >
                  Copy Code
                </button>
              </div>
              <p className="text-xs text-slate-300">
                Verified Referrals: <strong className="font-mono">{dbUser.referralCount}</strong>{' '}
                (Invite 3 contributors to unlock the <strong>Referral Master</strong> badge!)
              </p>
            </div>
          </div>
        )}

        {/* NOTIFICATIONS */}
        {section === 'notifications' && summary && (
          <div className="max-w-3xl space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Notifications</h2>
              <button
                type="button"
                onClick={async () => {
                  await apiFetch('/api/notifications/read-all', { method: 'POST' });
                  await loadWorkspaceData();
                }}
                className="text-xs text-emerald-400 hover:underline"
              >
                Mark all read
              </button>
            </div>
            {summary.notifications.length === 0 ? (
              <p className="text-sm text-slate-400">No notifications yet.</p>
            ) : (
              <div className="space-y-3">
                {summary.notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`rounded-xl border p-4 ${
                      n.isRead
                        ? 'border-white/10 bg-[#080C12]'
                        : 'border-emerald-500/35 bg-[#0B1118]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">{n.title}</p>
                      <span className="text-[11px] text-slate-400">
                        {formatDateTime(n.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-300">{n.message}</p>
                    {!n.isRead && (
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/notifications/${n.id}/read`, { method: 'POST' });
                          await loadWorkspaceData();
                        }}
                        className="mt-2 text-[11px] text-emerald-400 hover:underline"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PROFILE, VERIFICATION & DISPLAYED BADGES */}
        {section === 'profile' && dbUser && summary && (
          <div className="max-w-4xl space-y-8">
            <h2 className="text-2xl font-bold text-white">Profile, Verification & Badges</h2>

            <div className="rounded-2xl border border-white/10 bg-[#0B1118] p-6">
              <h3 className="text-base font-semibold text-white">Earned Profile Badges</h3>
              <div className="mt-4 flex flex-wrap gap-3">
                {summary.badges.filter((b) => b.earned).length === 0 ? (
                  <p className="text-xs text-slate-400">
                    Complete tasks or referrals to display unlocked achievement badges on your profile.
                  </p>
                ) : (
                  summary.badges
                    .filter((b) => b.earned)
                    .map((b) => (
                      <div
                        key={b.code}
                        className="flex items-center gap-2.5 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-2.5 text-xs"
                      >
                        <Award className="h-4 w-4 text-emerald-400" />
                        <div>
                          <p className="font-semibold text-white">{b.name}</p>
                          <p className="text-[11px] text-emerald-300">{b.tier}</p>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>

            <form
              onSubmit={handleSaveProfile}
              className="grid gap-4 rounded-2xl border border-white/10 bg-[#0B1118] p-6 sm:grid-cols-2"
            >
              <div>
                <label className="block text-xs text-slate-300">Full Name</label>
                <input
                  type="text"
                  value={profileForm.fullName}
                  onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-[#05070A] px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300">
                  Phone Number ({dbUser.phoneVerified ? 'Verified' : 'Unverified'})
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="text"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    placeholder="0712345678"
                    className="w-full rounded-lg border border-white/15 bg-[#05070A] px-3 py-2 font-mono text-sm text-white"
                  />
                  {!dbUser.phoneVerified && (
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(true);
                        setToast('Verification code dispatched to your Kenyan mobile session (enter 4+ digits to confirm).');
                      }}
                      className="rounded-lg border border-white/15 px-3 text-xs text-cyan-300 whitespace-nowrap shrink-0"
                    >
                      Verify
                    </button>
                  )}
                </div>
              </div>

              {otpSent && !dbUser.phoneVerified && (
                <div className="sm:col-span-2">
                  <label className="block text-xs text-cyan-300">Enter 6-Digit SMS Verification Code</label>
                  <input
                    type="text"
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value)}
                    placeholder="123456"
                    className="mt-1 w-48 rounded-lg border border-cyan-500/40 bg-[#05070A] px-3 py-2 font-mono text-sm text-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-300">Default M-PESA Payout Number</label>
                <input
                  type="text"
                  value={profileForm.mpesaNumber}
                  onChange={(e) => setProfileForm({ ...profileForm, mpesaNumber: e.target.value })}
                  placeholder="254712345678"
                  className="mt-1 w-full rounded-lg border border-white/15 bg-[#05070A] px-3 py-2 font-mono text-sm text-white"
                />
              </div>

              {!dbUser.referredByUid && (
                <div>
                  <label className="block text-xs text-slate-300">Apply Referrer Code (Optional)</label>
                  <input
                    type="text"
                    value={profileForm.referralCodeInput}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, referralCodeInput: e.target.value })
                    }
                    placeholder="CAL-XXXXXX"
                    className="mt-1 w-full rounded-lg border border-white/15 bg-[#05070A] px-3 py-2 font-mono text-sm text-white"
                  />
                </div>
              )}

              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-300">
                  Preferred Languages (feeds AI Task Recommender)
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {['English', 'Kiswahili', 'Sheng', 'Dholuo', 'Kikuyu', 'Kalenjin', 'Luhya', 'Somali', 'Maasai'].map(
                    (lang) => {
                      const active = profileForm.preferredLanguages.includes(lang);
                      return (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => {
                            setProfileForm((prev) => ({
                              ...prev,
                              preferredLanguages: active
                                ? prev.preferredLanguages.filter((l) => l !== lang)
                                : [...prev.preferredLanguages, lang],
                            }));
                          }}
                          className={`rounded-lg border px-3 py-1.5 text-xs ${
                            active
                              ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                              : 'border-white/10 bg-[#05070A] text-slate-400'
                          }`}
                        >
                          {lang}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-4">
                <div className="text-xs text-slate-400">
                  KYC Status: <span className="capitalize text-white">{dbUser.kycStatus}</span> ·
                  Email: <span className="text-white">{dbUser.emailVerified ? 'Verified' : 'Connected'}</span>
                </div>
                <div className="flex gap-3">
                  {dbUser.kycStatus === 'unverified' && (
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch('/api/me/profile', {
                          method: 'PATCH',
                          body: JSON.stringify({ kycAction: 'submit_verification' }),
                        });
                        await refreshProfile();
                        setToast('Identity verification submitted for compliance review.');
                      }}
                      className="rounded-lg border border-cyan-500/40 px-4 py-2 text-xs font-medium text-cyan-300"
                    >
                      Request KYC Verification
                    </button>
                  )}
                  <button
                    type="submit"
                    className="rounded-lg bg-emerald-500 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                  >
                    Save Profile
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {section === 'advertiser' && <AdvertiserPortal />}
        {section === 'ai-client' && <AiClientPortal />}
        {section === 'admin' && <AdminCommandCenter />}

        {section === 'support' && (
          <form
            onSubmit={handleSupportSubmit}
            className="max-w-xl space-y-4 rounded-2xl border border-white/10 bg-[#0B1118] p-6"
          >
            <h2 className="text-xl font-bold text-white">Contributor Support Desk</h2>
            <p className="text-xs text-slate-400">
              Need help with M-PESA payouts, KYC verification, or task disputes? Reach our Nairobi team.
            </p>
            <input
              type="text"
              required
              value={supportForm.subject}
              onChange={(e) => setSupportForm({ ...supportForm, subject: e.target.value })}
              placeholder="Subject"
              className="w-full rounded-lg border border-white/15 bg-[#05070A] px-3 py-2 text-sm text-white"
            />
            <textarea
              rows={4}
              required
              value={supportForm.message}
              onChange={(e) => setSupportForm({ ...supportForm, message: e.target.value })}
              placeholder="Describe your issue or transaction reference..."
              className="w-full rounded-lg border border-white/15 bg-[#05070A] px-3 py-2 text-sm text-white"
            />
            <button
              type="submit"
              className="rounded-lg bg-emerald-500 px-5 py-2.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Submit Support Ticket
            </button>
          </form>
        )}
      </main>

      {activeTask && dbUser && (
        <TaskWorkbench
          task={activeTask}
          accepted8020Terms={dbUser.accepted8020Terms}
          onAccept8020Terms={handleAccept8020}
          onClose={() => setActiveTask(null)}
          onSubmit={handleTaskSubmit}
        />
      )}
    </div>
  );
};
