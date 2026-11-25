import React, { useCallback, useEffect, useState } from 'react';
import { Check, RefreshCw, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { formatDateTime, formatKes } from '../lib/format.ts';

interface AdminOverviewData {
  kpis: {
    registeredUsers: number;
    activeUsers: number;
    completedTasks: number;
    totalGrossCents: number;
    totalUser80Cents: number;
    totalPaybill20Cents: number;
    totalAdRevenueCents: number;
    totalClientRevenueCents: number;
    pendingWithdrawalsCount: number;
    pendingAllocationsCount: number;
  };
  users: Array<{
    id: number;
    uid: string;
    email: string;
    fullName: string | null;
    role: string;
    kycStatus: string;
    accountStatus: string;
    userNetEarnedCents: number;
    tasksCompletedCount: number;
  }>;
  ledger: Array<{
    id: number;
    reference: string;
    userUid: string;
    grossCents: number;
    userCents: number;
    paybillCents: number;
    paybillNumber: string;
    paybillAccount: string;
    settlementStatus: string;
    createdAt: string;
  }>;
  withdrawals: Array<{
    id: number;
    reference: string;
    mpesaPhone: string;
    amountCents: number;
    netDisbursementCents: number;
    status: string;
    createdAt: string;
  }>;
  campaigns: Array<{
    id: number;
    companyName: string;
    campaignTitle: string;
    budgetCents: number;
    status: string;
  }>;
  projects: Array<{
    id: number;
    organizationName: string;
    projectName: string;
    targetLanguage: string;
    budgetCents: number;
    status: string;
  }>;
  auditLogs: Array<{
    id: number;
    actorEmail: string | null;
    action: string;
    targetType: string;
    targetId: string | null;
    createdAt: string;
  }>;
  settings: Record<string, string>;
}

export const AdminCommandCenter: React.FC = () => {
  const { apiFetch } = useAuth();
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [tab, setTab] = useState<'analytics' | 'financials' | 'users' | 'moderation' | 'security'>(
    'analytics'
  );
  const [error, setError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [settingsForm, setSettingsForm] = useState({
    minWithdrawalKsh: 100,
    withdrawalFeeKsh: 0,
    dailyWithdrawalLimitKsh: 150000,
  });
  const [newTask, setNewTask] = useState({
    department: 'ai_training',
    title: '',
    description: '',
    instructions: '',
    language: 'Kiswahili',
    grossRewardKsh: 100,
  });

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch<AdminOverviewData>('/api/admin/overview');
      setData(res);
      setSettingsForm({
        minWithdrawalKsh: Number(res.settings.min_withdrawal_cents || 10000) / 100,
        withdrawalFeeKsh: Number(res.settings.withdrawal_fee_cents || 0) / 100,
        dailyWithdrawalLimitKsh: Number(res.settings.daily_withdrawal_limit_cents || 15000000) / 100,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load admin command center.');
    }
  }, [apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const reconcileLedger = async (id: number, settlementStatus: string) => {
    await apiFetch(`/api/admin/ledger/${id}/reconcile`, {
      method: 'PATCH',
      body: JSON.stringify({ settlementStatus }),
    });
    await load();
  };

  const updateWithdrawal = async (id: number, status: string) => {
    await apiFetch(`/api/admin/withdrawals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    await load();
  };

  const updateUser = async (uid: string, patch: { role?: string; accountStatus?: string; kycStatus?: string }) => {
    await apiFetch(`/api/admin/users/${uid}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    await load();
  };

  const approveCampaign = async (id: number) => {
    await apiFetch(`/api/admin/campaigns/${id}/approve`, { method: 'POST' });
    await load();
  };

  const approveProject = async (id: number) => {
    await apiFetch(`/api/admin/projects/${id}/approve`, { method: 'POST' });
    await load();
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify(settingsForm),
    });
    await load();
  };

  const createAdminTask = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/admin/tasks', {
      method: 'POST',
      body: JSON.stringify(newTask),
    });
    setNewTask({ ...newTask, title: '', description: '', instructions: '' });
    await load();
  };

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">
        {error}
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-slate-400">Loading Administrator Command Center...</p>;
  }

  const filteredUsers = data.users.filter(
    (u) =>
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.fullName || '').toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-emerald-400">RBAC Governance · Immutable Audit Trail</p>
          <h2 className="mt-1 text-2xl font-bold text-white">Administrator Command Center</h2>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-white/10"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh Telemetry
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 rounded-xl border border-white/10 bg-[#0B1118] p-1.5">
        {(
          [
            ['analytics', 'Platform Analytics'],
            ['financials', '80/20 Ledger & Withdrawals'],
            ['users', 'User & KYC Management'],
            ['moderation', 'Tasks & Client Moderation'],
            ['security', 'Security Audit Logs'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              tab === k
                ? 'bg-emerald-500 font-semibold text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'analytics' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Registered Users', data.kpis.registeredUsers.toLocaleString()],
            ['Active Contributors', data.kpis.activeUsers.toLocaleString()],
            ['Completed Tasks', data.kpis.completedTasks.toLocaleString()],
            ['Total Gross Rewards', formatKes(data.kpis.totalGrossCents)],
            ['80% User Allocation', formatKes(data.kpis.totalUser80Cents)],
            ['20% Paybill 522522', formatKes(data.kpis.totalPaybill20Cents)],
            ['Advertiser Budgets', formatKes(data.kpis.totalAdRevenueCents)],
            ['AI Client Budgets', formatKes(data.kpis.totalClientRevenueCents)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-white/10 bg-[#0B1118] p-5">
              <p className="text-xs text-slate-400">{label}</p>
              <p className="mt-2 font-mono text-xl font-semibold text-white tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'financials' && (
        <div className="space-y-6">
          <form
            onSubmit={saveSettings}
            className="grid gap-4 rounded-2xl border border-white/10 bg-[#0B1118] p-6 sm:grid-cols-4 sm:items-end"
          >
            <div>
              <label className="block text-xs text-slate-300">Min Withdrawal (KES)</label>
              <input
                type="number"
                value={settingsForm.minWithdrawalKsh}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, minWithdrawalKsh: Number(e.target.value) })
                }
                className="mt-1 w-full rounded-lg border border-white/15 bg-[#05070A] px-3 py-2 font-mono text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300">Withdrawal Fee (KES)</label>
              <input
                type="number"
                value={settingsForm.withdrawalFeeKsh}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, withdrawalFeeKsh: Number(e.target.value) })
                }
                className="mt-1 w-full rounded-lg border border-white/15 bg-[#05070A] px-3 py-2 font-mono text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300">Daily Limit (KES)</label>
              <input
                type="number"
                value={settingsForm.dailyWithdrawalLimitKsh}
                onChange={(e) =>
                  setSettingsForm({
                    ...settingsForm,
                    dailyWithdrawalLimitKsh: Number(e.target.value),
                  })
                }
                className="mt-1 w-full rounded-lg border border-white/15 bg-[#05070A] px-3 py-2 font-mono text-sm text-white"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Save Financial Rules
            </button>
          </form>

          <div className="rounded-2xl border border-white/10 bg-[#0B1118] p-6">
            <h3 className="text-base font-semibold text-white">
              Paybill 522522 (Acc 1355643775) Allocation Ledger
            </h3>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/10 text-slate-400">
                  <tr>
                    <th className="py-2 pr-3">Reference</th>
                    <th className="py-2 pr-3 text-right">Gross</th>
                    <th className="py-2 pr-3 text-right">80% User</th>
                    <th className="py-2 pr-3 text-right">20% Paybill</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-200">
                  {data.ledger.map((l) => (
                    <tr key={l.id}>
                      <td className="py-2.5 pr-3 font-mono">{l.reference}</td>
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
                      <td className="py-2.5">
                        {l.settlementStatus !== 'settled' && (
                          <button
                            type="button"
                            onClick={() => reconcileLedger(l.id, 'settled')}
                            className="rounded bg-emerald-500/20 px-2.5 py-1 text-emerald-300 hover:bg-emerald-500/30"
                          >
                            Mark Settled
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0B1118] p-6">
            <h3 className="text-base font-semibold text-white">M-PESA Withdrawal Queue</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/10 text-slate-400">
                  <tr>
                    <th className="py-2 pr-3">Reference</th>
                    <th className="py-2 pr-3">M-PESA Phone</th>
                    <th className="py-2 pr-3 text-right">Net Payout</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2">Reconcile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-200">
                  {data.withdrawals.map((w) => (
                    <tr key={w.id}>
                      <td className="py-2.5 pr-3 font-mono">{w.reference}</td>
                      <td className="py-2.5 pr-3 font-mono">{w.mpesaPhone}</td>
                      <td className="py-2.5 pr-3 text-right font-mono tabular-nums">
                        {formatKes(w.netDisbursementCents)}
                      </td>
                      <td className="py-2.5 pr-3">{w.status}</td>
                      <td className="py-2.5 flex gap-2">
                        {w.status !== 'paid' && (
                          <button
                            type="button"
                            onClick={() => updateWithdrawal(w.id, 'paid')}
                            className="rounded bg-emerald-500/20 px-2.5 py-1 text-emerald-300"
                          >
                            Confirm Paid
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="rounded-2xl border border-white/10 bg-[#0B1118] p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h3 className="text-base font-semibold text-white">Accounts, Roles & KYC</h3>
            <input
              type="search"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search email or name..."
              className="rounded-lg border border-white/15 bg-[#05070A] px-3 py-1.5 text-xs text-white"
            />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 text-slate-400">
                <tr>
                  <th className="py-2 pr-3">Contributor</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">KYC</th>
                  <th className="py-2 pr-3">Account</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-200">
                {filteredUsers.map((u) => (
                  <tr key={u.uid}>
                    <td className="py-3 pr-3">
                      <p className="font-medium text-white">{u.fullName || 'Contributor'}</p>
                      <p className="text-slate-400">{u.email}</p>
                    </td>
                    <td className="py-3 pr-3">
                      <select
                        value={u.role}
                        onChange={(e) => updateUser(u.uid, { role: e.target.value })}
                        className="rounded border border-white/15 bg-[#05070A] px-2 py-1 text-xs"
                      >
                        {['contributor', 'advertiser', 'ai_client', 'moderator', 'finance_officer', 'support_agent', 'admin'].map(
                          (r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          )
                        )}
                      </select>
                    </td>
                    <td className="py-3 pr-3 capitalize">{u.kycStatus}</td>
                    <td className="py-3 pr-3 capitalize">{u.accountStatus}</td>
                    <td className="py-3 flex flex-wrap gap-2">
                      {u.kycStatus !== 'verified' && (
                        <button
                          type="button"
                          onClick={() => updateUser(u.uid, { kycStatus: 'verified' })}
                          className="rounded bg-cyan-500/20 px-2.5 py-1 text-cyan-300"
                        >
                          Verify KYC
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          updateUser(u.uid, {
                            accountStatus: u.accountStatus === 'active' ? 'suspended' : 'active',
                          })
                        }
                        className="rounded bg-white/10 px-2.5 py-1 text-slate-200"
                      >
                        {u.accountStatus === 'active' ? 'Suspend' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'moderation' && (
        <div className="space-y-6">
          <form
            onSubmit={createAdminTask}
            className="grid gap-4 rounded-2xl border border-white/10 bg-[#0B1118] p-6 sm:grid-cols-2"
          >
            <h3 className="sm:col-span-2 text-base font-semibold text-white">
              Publish New Marketplace Task
            </h3>
            <select
              value={newTask.department}
              onChange={(e) => setNewTask({ ...newTask, department: e.target.value })}
              className="rounded-lg border border-white/15 bg-[#05070A] px-3 py-2 text-sm text-white"
            >
              <option value="rewarded_ads">Rewarded Advertising</option>
              <option value="ai_training">AI Data Training</option>
              <option value="voice_intelligence">African Voice Intelligence</option>
              <option value="ai_evaluation">AI Evaluation</option>
              <option value="market_research">Market Research</option>
            </select>
            <input
              type="number"
              min={5}
              value={newTask.grossRewardKsh}
              onChange={(e) => setNewTask({ ...newTask, grossRewardKsh: Number(e.target.value) })}
              placeholder="Gross Reward KES"
              className="rounded-lg border border-white/15 bg-[#05070A] px-3 py-2 font-mono text-sm text-white"
            />
            <input
              type="text"
              required
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              placeholder="Task title"
              className="sm:col-span-2 rounded-lg border border-white/15 bg-[#05070A] px-3 py-2 text-sm text-white"
            />
            <input
              type="text"
              required
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              placeholder="Short description"
              className="sm:col-span-2 rounded-lg border border-white/15 bg-[#05070A] px-3 py-2 text-sm text-white"
            />
            <textarea
              rows={2}
              required
              value={newTask.instructions}
              onChange={(e) => setNewTask({ ...newTask, instructions: e.target.value })}
              placeholder="Contributor instructions..."
              className="sm:col-span-2 rounded-lg border border-white/15 bg-[#05070A] px-3 py-2 text-sm text-white"
            />
            <button
              type="submit"
              className="sm:col-span-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-slate-950"
            >
              Create Active Task
            </button>
          </form>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-[#0B1118] p-6">
              <h3 className="text-base font-semibold text-white">Advertiser Campaigns</h3>
              <div className="mt-4 space-y-3">
                {data.campaigns.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#05070A] p-3.5 text-xs"
                  >
                    <div>
                      <p className="font-medium text-white">{c.campaignTitle}</p>
                      <p className="text-slate-400">
                        {c.companyName} · {formatKes(c.budgetCents)} · {c.status}
                      </p>
                    </div>
                    {c.status === 'pending_approval' && (
                      <button
                        type="button"
                        onClick={() => approveCampaign(c.id)}
                        className="inline-flex items-center gap-1 rounded bg-emerald-500 px-3 py-1.5 font-semibold text-slate-950"
                      >
                        <Check className="h-3.5 w-3.5" /> Approve
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0B1118] p-6">
              <h3 className="text-base font-semibold text-white">AI Client Projects</h3>
              <div className="mt-4 space-y-3">
                {data.projects.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#05070A] p-3.5 text-xs"
                  >
                    <div>
                      <p className="font-medium text-white">{p.projectName}</p>
                      <p className="text-slate-400">
                        {p.organizationName} · {p.targetLanguage} · {p.status}
                      </p>
                    </div>
                    {p.status === 'pending_moderation' && (
                      <button
                        type="button"
                        onClick={() => approveProject(p.id)}
                        className="inline-flex items-center gap-1 rounded bg-emerald-500 px-3 py-1.5 font-semibold text-slate-950"
                      >
                        <Check className="h-3.5 w-3.5" /> Approve
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'security' && (
        <div className="rounded-2xl border border-white/10 bg-[#0B1118] p-6">
          <div className="flex items-center gap-2 text-white">
            <ShieldAlert className="h-4 w-4 text-emerald-400" />
            <h3 className="text-base font-semibold">Immutable Security & Financial Audit Log</h3>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 text-slate-400">
                <tr>
                  <th className="py-2 pr-3">Timestamp</th>
                  <th className="py-2 pr-3">Actor</th>
                  <th className="py-2 pr-3">Action</th>
                  <th className="py-2">Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-200">
                {data.auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2.5 pr-3 font-mono text-slate-400">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="py-2.5 pr-3">{log.actorEmail || 'system'}</td>
                    <td className="py-2.5 pr-3 font-mono text-emerald-400">{log.action}</td>
                    <td className="py-2.5 text-slate-300">
                      {log.targetType} #{log.targetId || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
