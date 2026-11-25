import React, { useCallback, useEffect, useState } from 'react';
import { Download, PlusCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { formatKes, formatShortDate } from '../lib/format.ts';

interface CampaignRow {
  id: number;
  companyName: string;
  campaignTitle: string;
  adFormat: string;
  targetAudience: string;
  budgetCents: number;
  rewardPerViewCents: number;
  spentCents: number;
  verifiedCompletions: number;
  status: string;
  createdAt: string;
}

interface AiProjectRow {
  id: number;
  organizationName: string;
  projectName: string;
  taskCategory: string;
  targetLanguage: string;
  difficulty: string;
  datasetLicense: string;
  budgetCents: number;
  rewardPerItemCents: number;
  totalItems: number;
  completedItems: number;
  status: string;
  createdAt: string;
}

export const AdvertiserPortal: React.FC = () => {
  const { apiFetch } = useAuth();
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    companyName: '',
    campaignTitle: '',
    adFormat: 'video',
    targetAudience: 'Kenyan mobile earners (Nairobi, Mombasa, Kisumu)',
    mediaUrl: '',
    budgetKsh: 10000,
    rewardPerViewKsh: 45,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ campaigns: CampaignRow[] }>('/api/advertiser/campaigns');
      setCampaigns(data.campaigns);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load campaigns.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await apiFetch('/api/advertiser/campaigns', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setSuccess('Campaign created and queued for moderation approval before going live.');
      setForm({ ...form, campaignTitle: '', mediaUrl: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create campaign.');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium text-cyan-400">Direct Brand Campaigns · Verified Completions Only</p>
        <h2 className="mt-1 text-2xl font-bold text-white">Advertiser Portal</h2>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-2xl border border-white/10 bg-[#0B1118] p-6 sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <h3 className="text-base font-semibold text-white">Launch Rewarded Ad Campaign</h3>
        </div>
        <div>
          <label className="block text-xs text-slate-300">Company / Brand Name</label>
          <input
            type="text"
            required
            value={form.companyName}
            onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            placeholder="M-KOPA / Safaricom Partner"
            className="mt-1 w-full rounded-lg border border-white/15 bg-[#05070A] px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-300">Campaign Title</label>
          <input
            type="text"
            required
            value={form.campaignTitle}
            onChange={(e) => setForm({ ...form, campaignTitle: e.target.value })}
            placeholder="Nairobi Fiber Expansion Briefing"
            className="mt-1 w-full rounded-lg border border-white/15 bg-[#05070A] px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-300">Format</label>
          <select
            value={form.adFormat}
            onChange={(e) => setForm({ ...form, adFormat: e.target.value })}
            className="mt-1 w-full rounded-lg border border-white/15 bg-[#05070A] px-3 py-2 text-sm text-white"
          >
            <option value="video">Video Advertisement</option>
            <option value="image">Image Showcase</option>
            <option value="interactive">Interactive Product Brief</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-300">Target Audience</label>
          <input
            type="text"
            required
            value={form.targetAudience}
            onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
            className="mt-1 w-full rounded-lg border border-white/15 bg-[#05070A] px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-300">Total Campaign Budget (KES)</label>
          <input
            type="number"
            min={1000}
            required
            value={form.budgetKsh}
            onChange={(e) => setForm({ ...form, budgetKsh: Number(e.target.value) })}
            className="mt-1 w-full rounded-lg border border-white/15 bg-[#05070A] px-3 py-2 font-mono text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-300">Gross Reward per Verified View (KES)</label>
          <input
            type="number"
            min={10}
            required
            value={form.rewardPerViewKsh}
            onChange={(e) => setForm({ ...form, rewardPerViewKsh: Number(e.target.value) })}
            className="mt-1 w-full rounded-lg border border-white/15 bg-[#05070A] px-3 py-2 font-mono text-sm text-white"
          />
        </div>
        {error && <p className="sm:col-span-2 text-xs text-rose-400">{error}</p>}
        {success && <p className="sm:col-span-2 text-xs text-emerald-400">{success}</p>}
        <div className="sm:col-span-2 flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
          >
            <PlusCircle className="h-4 w-4" />
            Submit Campaign for Approval
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-white/10 bg-[#0B1118] p-6">
        <h3 className="text-base font-semibold text-white">Your Campaigns & Invoices</h3>
        {loading ? (
          <p className="mt-4 text-sm text-slate-400">Loading campaigns...</p>
        ) : campaigns.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">
            No campaigns created yet. Submit a campaign above to engage verified Kenyan contributors.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 text-slate-400">
                <tr>
                  <th className="py-2.5 pr-4">Campaign</th>
                  <th className="py-2.5 pr-4">Format</th>
                  <th className="py-2.5 pr-4 text-right">Budget</th>
                  <th className="py-2.5 pr-4 text-right">Completions</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-200">
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td className="py-3 pr-4">
                      <p className="font-medium text-white">{c.campaignTitle}</p>
                      <p className="text-slate-400">{c.companyName}</p>
                    </td>
                    <td className="py-3 pr-4 capitalize">{c.adFormat}</td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums">
                      {formatKes(c.budgetCents)}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums">
                      {c.verifiedCompletions}
                    </td>
                    <td className="py-3 pr-4 capitalize text-emerald-400">{c.status.replace('_', ' ')}</td>
                    <td className="py-3 text-slate-400">{formatShortDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export const AiClientPortal: React.FC = () => {
  const { apiFetch } = useAuth();
  const [projects, setProjects] = useState<AiProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    organizationName: '',
    projectName: '',
    taskCategory: 'voice_dataset',
    targetLanguage: 'Kiswahili',
    difficulty: 'Standard',
    instructions: '',
    datasetLicense: 'Commercial Research License (Kenya DPA Compliant)',
    budgetKsh: 25000,
    rewardPerItemKsh: 150,
    totalItems: 150,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ projects: AiProjectRow[] }>('/api/ai-client/projects');
      setProjects(data.projects);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load AI projects.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await apiFetch('/api/ai-client/projects', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setSuccess('AI training project created and queued for dataset moderation.');
      setForm({ ...form, projectName: '', instructions: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project.');
    }
  };

  const downloadProjectManifest = (project: AiProjectRow) => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `callidus-dataset-${project.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium text-violet-400">
          Human-in-the-Loop Datasets · African Speech & Alignment
        </p>
        <h2 className="mt-1 text-2xl font-bold text-white">AI Client Marketplace</h2>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-2xl border border-white/10 bg-[#0B1118] p-6 sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <h3 className="text-base font-semibold text-white">Commission AI Dataset Project</h3>
        </div>
        <div>
          <label className="block text-xs text-slate-300">Organization / Lab</label>
          <input
            type="text"
            required
            value={form.organizationName}
            onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
            placeholder="Savannah AI Research"
            className="mt-1 w-full rounded-lg border border-white/15 bg-[#05070A] px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-300">Project Title</label>
          <input
            type="text"
            required
            value={form.projectName}
            onChange={(e) => setForm({ ...form, projectName: e.target.value })}
            placeholder="Kiswahili Medical Triage Corpus"
            className="mt-1 w-full rounded-lg border border-white/15 bg-[#05070A] px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-300">Task Category</label>
          <select
            value={form.taskCategory}
            onChange={(e) => setForm({ ...form, taskCategory: e.target.value })}
            className="mt-1 w-full rounded-lg border border-white/15 bg-[#05070A] px-3 py-2 text-sm text-white"
          >
            <option value="voice_dataset">African Voice Intelligence</option>
            <option value="image_annotation">Image / Bounding Box Annotation</option>
            <option value="text_classification">NLP & Sentiment Classification</option>
            <option value="llm_evaluation">LLM Safety & Factuality Evaluation</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-300">Target Language</label>
          <select
            value={form.targetLanguage}
            onChange={(e) => setForm({ ...form, targetLanguage: e.target.value })}
            className="mt-1 w-full rounded-lg border border-white/15 bg-[#05070A] px-3 py-2 text-sm text-white"
          >
            {['English', 'Kiswahili', 'Sheng', 'Dholuo', 'Kikuyu', 'Kalenjin', 'Luhya', 'Somali', 'Maasai'].map(
              (lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              )
            )}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-300">Project Budget (KES)</label>
          <input
            type="number"
            min={1000}
            required
            value={form.budgetKsh}
            onChange={(e) => setForm({ ...form, budgetKsh: Number(e.target.value) })}
            className="mt-1 w-full rounded-lg border border-white/15 bg-[#05070A] px-3 py-2 font-mono text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-300">Gross Reward per Item (KES)</label>
          <input
            type="number"
            min={10}
            required
            value={form.rewardPerItemKsh}
            onChange={(e) => setForm({ ...form, rewardPerItemKsh: Number(e.target.value) })}
            className="mt-1 w-full rounded-lg border border-white/15 bg-[#05070A] px-3 py-2 font-mono text-sm text-white"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-slate-300">Annotation & Quality Instructions</label>
          <textarea
            rows={3}
            required
            value={form.instructions}
            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
            placeholder="Specify exact annotation rules, acoustic thresholds, and evaluation criteria..."
            className="mt-1 w-full rounded-lg border border-white/15 bg-[#05070A] px-3 py-2 text-sm text-white"
          />
        </div>
        {error && <p className="sm:col-span-2 text-xs text-rose-400">{error}</p>}
        {success && <p className="sm:col-span-2 text-xs text-emerald-400">{success}</p>}
        <div className="sm:col-span-2 flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
          >
            <PlusCircle className="h-4 w-4" />
            Submit AI Project
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-white/10 bg-[#0B1118] p-6">
        <h3 className="text-base font-semibold text-white">Commissioned Datasets</h3>
        {loading ? (
          <p className="mt-4 text-sm text-slate-400">Loading projects...</p>
        ) : projects.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No AI projects commissioned yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 text-slate-400">
                <tr>
                  <th className="py-2.5 pr-4">Project</th>
                  <th className="py-2.5 pr-4">Language</th>
                  <th className="py-2.5 pr-4 text-right">Budget</th>
                  <th className="py-2.5 pr-4 text-right">Progress</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5">Export</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-200">
                {projects.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 pr-4">
                      <p className="font-medium text-white">{p.projectName}</p>
                      <p className="text-slate-400">{p.organizationName}</p>
                    </td>
                    <td className="py-3 pr-4">{p.targetLanguage}</td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums">
                      {formatKes(p.budgetCents)}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums">
                      {p.completedItems} / {p.totalItems}
                    </td>
                    <td className="py-3 pr-4 capitalize text-cyan-400">{p.status.replace('_', ' ')}</td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => downloadProjectManifest(p)}
                        className="inline-flex items-center gap-1 text-emerald-400 hover:underline"
                      >
                        <Download className="h-3.5 w-3.5" />
                        JSON
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
