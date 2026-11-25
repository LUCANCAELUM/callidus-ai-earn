import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Award,
  BarChart3,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Globe2,
  Languages,
  Lock,
  Mic,
  PlayCircle,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { HeroLogo3D } from './HeroLogo3D.tsx';
import { DEPARTMENT_LABELS, formatKes } from '../lib/format.ts';

export type PublicPageId =
  | 'home'
  | 'about'
  | 'how-it-works'
  | 'opportunities'
  | 'businesses'
  | 'contact'
  | 'faq'
  | 'legal';

interface PublicStats {
  registeredUsers: number;
  activeTasks: number;
  completedTasks: number;
  totalGrossCents: number;
  totalUserCents: number;
  totalPaybillCents: number;
  supportedLanguagesCount: number;
}

interface PublicTaskItem {
  id: number;
  department: string;
  title: string;
  description: string;
  language: string;
  difficulty: string;
  estimatedMinutes: number;
  grossRewardCents: number;
  splitPreview: { grossCents: number; userCents: number; paybillCents: number };
}

interface PublicPagesProps {
  page: PublicPageId;
  onNavigate: (page: PublicPageId) => void;
  onStartAuth: () => void;
  onEnterWorkspace: (section?: string) => void;
  isAuthenticated: boolean;
}

export const PublicPages: React.FC<PublicPagesProps> = ({
  page,
  onNavigate,
  onStartAuth,
  onEnterWorkspace,
  isAuthenticated,
}) => {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [tasksPreview, setTasksPreview] = useState<PublicTaskItem[]>([]);
  const [calcTasksPerDay, setCalcTasksPerDay] = useState(8);
  const [calcDeptRateKsh, setCalcDeptRateKsh] = useState(120);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [legalTab, setLegalTab] = useState<
    'terms' | 'privacy' | 'cookies' | 'allocation' | 'licensing'
  >('allocation');

  // Contact form state
  const [contactForm, setContactForm] = useState({
    inquiryType: 'business',
    name: '',
    email: '',
    organization: '',
    subject: '',
    message: '',
  });
  const [contactStatus, setContactStatus] = useState<{
    submitting: boolean;
    success: string | null;
    error: string | null;
  }>({ submitting: false, success: null, error: null });

  useEffect(() => {
    fetch('/api/public/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setStats(data);
      })
      .catch(() => {});

    fetch('/api/tasks')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.tasks) setTasksPreview(data.tasks);
      })
      .catch(() => {});
  }, []);

  const primaryAction = () => {
    if (isAuthenticated) onEnterWorkspace('dashboard');
    else onStartAuth();
  };

  // Integer math in KES cents for earning calculator
  const dailyGrossCents = calcTasksPerDay * calcDeptRateKsh * 100;
  const dailyPaybillCents = Math.floor((dailyGrossCents * 20) / 100);
  const dailyUserCents = dailyGrossCents - dailyPaybillCents;
  const monthlyGrossCents = dailyGrossCents * 26;
  const monthlyPaybillCents = dailyPaybillCents * 26;
  const monthlyUserCents = dailyUserCents * 26;

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactStatus({ submitting: true, success: null, error: null });
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed.');
      setContactStatus({
        submitting: false,
        success: data.message || 'Inquiry submitted successfully.',
        error: null,
      });
      setContactForm({
        inquiryType: 'business',
        name: '',
        email: '',
        organization: '',
        subject: '',
        message: '',
      });
    } catch (err) {
      setContactStatus({
        submitting: false,
        success: null,
        error: err instanceof Error ? err.message : 'Unable to send message.',
      });
    }
  };

  const faqItems = [
    {
      q: 'How does the mandatory 80/20 earnings allocation work?',
      a: 'Every verified gross task reward is deterministically split once at allocation time: 80% is credited directly to your available KES balance (for example, KSh 800 out of KSh 1,000), and 20% (KSh 200) is transparently recorded in the immutable ledger for automated settlement to designated M-PESA Paybill 522522, Account 1355643775. There is never any double deduction.',
    },
    {
      q: 'How do M-PESA withdrawals and Safaricom Daraja settlements work?',
      a: 'Once your available balance reaches the configurable minimum threshold (currently KSh 100), you can request an M-PESA withdrawal to your verified Kenyan phone number. Requests enter our server-side Safaricom Daraja B2C queue. When live Daraja merchant credentials are active, payouts execute via official B2C APIs; in sandbox or unconfigured environments, requests remain transparently in pending_daraja_b2c status and are never faked.',
    },
    {
      q: 'Which African languages are supported in Voice Intelligence?',
      a: 'Callidus Earn AI currently supports English, Kiswahili, Sheng, Dholuo, Kikuyu, Kalenjin, Luhya, Somali, and Maasai, with modular dataset pipelines designed to add additional East and pan-African languages.',
    },
    {
      q: 'How is task quality verified before rewards are allocated?',
      a: 'Rewarded advertisements verify completion checks, AI annotation tasks validate bounding coordinates and consensus, voice contributions require explicit licensing consent and acoustic verification, and AI evaluations undergo server-side coherence and accuracy scoring.',
    },
    {
      q: 'How does Callidus Earn AI comply with Kenya’s Data Protection Act?',
      a: 'Contributors explicitly accept the 80/20 Earnings Allocation Agreement and Kenya DPA privacy policy before earning, and provide separate explicit consent before recording or licensing any African voice intelligence audio.',
    },
  ];

  if (page === 'about') {
    return (
      <section className="mx-auto max-w-6xl px-6 py-16">
        <p className="text-xs font-medium tracking-wide text-emerald-400">
          Nairobi, Kenya · Pan-African AI Infrastructure
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Building Africa’s Human Intelligence Backbone
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-relaxed text-slate-300">
          CALLIDUS EARN AI is a Kenyan-founded digital earning and human-powered artificial
          intelligence training marketplace. We connect contributors across Kenya and East Africa
          with global AI researchers, enterprises, and verified advertisers who rely on authentic
          human judgment, African linguistic fluency, and real-world evaluation.
        </p>

        <div className="mt-12 grid gap-8 lg:grid-cols-2 lg:items-stretch">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0B1118]">
            <img
              src="/src/assets/images/hero_nairobi_ai_lab_1795098094650.jpg"
              alt="Callidus Earn AI Research Studio in Nairobi"
              referrerPolicy="no-referrer"
              className="h-72 w-full object-cover lg:h-full"
            />
          </div>
          <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0B1118] p-8">
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-white">01. Mission & Real Opportunity</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  Every citizen with a smartphone or computer can monetize verified cognitive
                  work—training local vision models, recording underserved African dialects, auditing
                  AI hallucinations, and reviewing legitimate brand campaigns in Kenyan Shillings (KES).
                </p>
              </div>
              <div className="border-t border-white/10 pt-6">
                <h2 className="text-xl font-semibold text-white">02. Transparent 80/20 Economics</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  Our centralized integer ledger enforces an immutable 80/20 split on every eligible
                  reward: 80% accrues directly to the contributor’s wallet, while 20% is allocated to
                  designated M-PESA Paybill 522522 (Account 1355643775) to sustain platform
                  infrastructure, quality audits, and ecosystem operations.
                </p>
              </div>
              <div className="border-t border-white/10 pt-6">
                <h2 className="text-xl font-semibold text-white">03. Built for Continental Scale</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  Engineered on stateless Cloud Run services, Cloud SQL PostgreSQL financial ledgers,
                  and progressive web standards to perform cleanly even on Kenyan 3G/4G mobile networks.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (page === 'how-it-works') {
    const steps = [
      {
        num: '01',
        title: 'Create Your Account',
        desc: 'Sign in securely with Google Authentication, verify your Kenyan phone number, and review the transparent 80/20 allocation disclosure.',
      },
      {
        num: '02',
        title: 'Explore Approved Tasks',
        desc: 'Browse five specialized departments or follow our Gemini-powered adaptive task recommender tailored to your languages and accuracy.',
      },
      {
        num: '03',
        title: 'Complete Verified Activities',
        desc: 'Record Kiswahili or Dholuo voice clips, annotate Nairobi traffic images, evaluate AI outputs, or complete sponsored brand briefs.',
      },
      {
        num: '04',
        title: 'Pass Quality Verification',
        desc: 'Automated comprehension checks, explicit consent gates, and server-side AI quality scoring validate your submission immediately.',
      },
      {
        num: '05',
        title: 'Earn 80/20 Allocated Rewards',
        desc: 'Our integer ledger splits gross KES rewards once: 80% credits to your available balance and 20% records to Paybill 522522 Acc 1355643775.',
      },
      {
        num: '06',
        title: 'Withdraw via M-PESA',
        desc: 'Request payouts directly to your M-PESA number once you pass the KSh 100 threshold, tracked end-to-end with downloadable CSV statements.',
      },
    ];

    return (
      <section className="mx-auto max-w-6xl px-6 py-16">
        <p className="text-xs font-medium tracking-wide text-cyan-400">
          End-to-End Contributor Workflow
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          How Callidus Earn AI Works
        </h1>
        <p className="mt-4 max-w-2xl text-base text-slate-300">
          Six verifiable steps from registration to Kenyan Shilling M-PESA settlement.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {steps.map((s) => (
            <div
              key={s.num}
              className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0B1118] p-7"
            >
              <div>
                <span className="font-mono text-sm font-semibold text-emerald-400">{s.num}</span>
                <h2 className="mt-3 text-lg font-semibold text-white">{s.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-emerald-500/25 bg-[#0B1118] p-8">
          <div>
            <h3 className="text-xl font-semibold text-white">Ready to activate your contributor ledger?</h3>
            <p className="mt-1 text-sm text-slate-300">
              Start with starter tasks paying KSh 45–200 gross per verified completion.
            </p>
          </div>
          <button
            type="button"
            onClick={primaryAction}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 whitespace-nowrap shrink-0"
          >
            {isAuthenticated ? 'Open Dashboard' : 'Create Account'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>
    );
  }

  if (page === 'opportunities') {
    return (
      <section className="mx-auto max-w-6xl px-6 py-16">
        <p className="text-xs font-medium tracking-wide text-emerald-400">
          Five Specialized Earning Departments
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Earning Opportunities in KES
        </h1>
        <p className="mt-4 max-w-3xl text-base text-slate-300">
          Every task displays clear instructions, gross KES reward, your exact 80% net share,
          estimated duration, and eligibility requirements prior to starting.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {tasksPreview.map((task) => (
            <div
              key={task.id}
              className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0B1118] p-6"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{DEPARTMENT_LABELS[task.department] || task.department}</span>
                  <span>{task.language} · {task.estimatedMinutes} min</span>
                </div>
                <h2 className="mt-3 text-lg font-semibold text-white">{task.title}</h2>
                <p className="mt-2 text-sm text-slate-300">{task.description}</p>
              </div>
              <div className="mt-6 border-t border-white/10 pt-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-slate-400">Your 80% Net Reward</span>
                  <span className="font-mono text-lg font-semibold text-emerald-400 tabular-nums">
                    {formatKes(task.splitPreview.userCents)}
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs text-slate-500 tabular-nums">
                  Gross {formatKes(task.grossRewardCents)} · 20% Paybill {formatKes(task.splitPreview.paybillCents)}
                </p>
                <button
                  type="button"
                  onClick={() => (isAuthenticated ? onEnterWorkspace('marketplace') : onStartAuth())}
                  className="mt-4 w-full rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/15"
                >
                  {isAuthenticated ? 'Open in Marketplace' : 'Sign In to Complete Task'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (page === 'businesses') {
    return (
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-stretch">
          <div className="flex flex-col justify-center">
            <p className="text-xs font-medium tracking-wide text-violet-400">
              Advertiser Portal & AI Client Marketplace
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Verified Human Intelligence & Brand Engagement in Africa
            </h1>
            <p className="mt-5 text-base leading-relaxed text-slate-300">
              Launch rewarded brand campaigns with verified Kenyan comprehension or commission
              high-accuracy Kiswahili, Sheng, Dholuo, Kikuyu, Kalenjin, Luhya, Somali, and Maasai
              AI training datasets with explicit contributor licensing.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={() => (isAuthenticated ? onEnterWorkspace('advertiser') : onStartAuth())}
                className="rounded-lg bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 whitespace-nowrap shrink-0"
              >
                Launch Advertiser Portal
              </button>
              <button
                type="button"
                onClick={() => (isAuthenticated ? onEnterWorkspace('ai-client') : onStartAuth())}
                className="rounded-lg border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 whitespace-nowrap shrink-0"
              >
                Open AI Client Lab
              </button>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0B1118]">
            <img
              src="/src/assets/images/enterprise_partner_hq_1795098094047.jpg"
              alt="Callidus Enterprise Partner Headquarters in Upper Hill Nairobi"
              referrerPolicy="no-referrer"
              className="h-80 w-full object-cover lg:h-full"
            />
          </div>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#0B1118] p-8">
            <h2 className="text-xl font-semibold text-white">01. Rewarded Advertising Portal</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Publish video, image, or interactive product campaigns billed in KES. Budgets only
              settle after valid comprehension verification—never fabricated impressions.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm text-slate-300">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Self-service campaign builder & audience targeting</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Real-time engagement analytics & invoice tracking</span>
              </li>
            </ul>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0B1118] p-8">
            <h2 className="text-xl font-semibold text-white">02. AI Client Dataset Marketplace</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Commission image bounding-box labeling, LLM evaluation rubrics, and consented East
              African speech corpora with dataset licensing controls and moderation.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm text-slate-300">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0" />
                <span>9 African & regional languages supported out of the box</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0" />
                <span>Kenya Data Protection Act compliant voice consent audit trail</span>
              </li>
            </ul>
          </div>
        </div>
      </section>
    );
  }

  if (page === 'contact') {
    return (
      <section className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-xs font-medium tracking-wide text-emerald-400">
          Nairobi Support & Commercial Partnerships
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white">Contact Callidus Earn AI</h1>
        <p className="mt-3 text-base text-slate-300">
          Reach our contributor support desk, advertiser onboarding team, or AI research partners.
        </p>

        <form
          onSubmit={handleContactSubmit}
          className="mt-10 space-y-5 rounded-2xl border border-white/10 bg-[#0B1118] p-8"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-300">Inquiry Department</label>
              <select
                value={contactForm.inquiryType}
                onChange={(e) => setContactForm({ ...contactForm, inquiryType: e.target.value })}
                className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#05070A] px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="support">Contributor Support</option>
                <option value="business">AI Research Client</option>
                <option value="advertiser">Brand & Advertiser Onboarding</option>
                <option value="partnership">Strategic & M-PESA Partnership</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300">Full Name</label>
              <input
                type="text"
                required
                value={contactForm.name}
                onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                placeholder="Wanjiku Kamau"
                className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#05070A] px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-300">Email Address</label>
              <input
                type="email"
                required
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                placeholder="name@company.co.ke"
                className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#05070A] px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300">Organization (Optional)</label>
              <input
                type="text"
                value={contactForm.organization}
                onChange={(e) => setContactForm({ ...contactForm, organization: e.target.value })}
                placeholder="Company or Research Lab"
                className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#05070A] px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">Subject</label>
            <input
              type="text"
              required
              value={contactForm.subject}
              onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
              placeholder="Dataset project inquiry or payout assistance"
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#05070A] px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">Message</label>
            <textarea
              required
              rows={4}
              value={contactForm.message}
              onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
              placeholder="Describe your inquiry..."
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#05070A] px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {contactStatus.error && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300">
              {contactStatus.error}
            </p>
          )}
          {contactStatus.success && (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
              {contactStatus.success}
            </p>
          )}

          <button
            type="submit"
            disabled={contactStatus.submitting}
            className="rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
          >
            {contactStatus.submitting ? 'Submitting Inquiry...' : 'Send Inquiry'}
          </button>
        </form>
      </section>
    );
  }

  if (page === 'faq') {
    return (
      <section className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-xs font-medium tracking-wide text-cyan-400">
          Platform Transparency & Operations
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white">
          Frequently Asked Questions
        </h1>
        <div className="mt-10 divide-y divide-white/10 rounded-2xl border border-white/10 bg-[#0B1118]">
          {faqItems.map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={item.q} className="p-6">
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between gap-4 text-left"
                >
                  <span className="text-base font-semibold text-white">{item.q}</span>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-emerald-400 shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">{item.a}</p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  if (page === 'legal') {
    const legalContent: Record<string, { title: string; body: string[] }> = {
      allocation: {
        title: '80/20 Earnings Allocation Agreement',
        body: [
          'Every eligible gross contributor reward on CALLIDUS EARN AI is subject to a transparent, single-pass 80/20 deterministic split calculated in integer KES cents.',
          '80% of every verified gross reward is credited directly to the Contributor Available Wallet Balance (e.g., KSh 800 out of KSh 1,000 gross).',
          '20% of every verified gross reward (e.g., KSh 200 out of KSh 1,000 gross) is automatically allocated in the immutable ledger to designated M-PESA Paybill 522522, Account Number 1355643775.',
          'This allocation is calculated strictly once per eligible reward and is never double-deducted upon withdrawal. Explicit acceptance of this agreement is mandatory before performing payable marketplace activities.',
        ],
      },
      privacy: {
        title: 'Privacy Policy & Kenya Data Protection Act Compliance',
        body: [
          'CALLIDUS EARN AI processes personal data in strict alignment with the Kenya Data Protection Act (2019) and applicable international privacy principles.',
          'We collect only account identity, verified M-PESA payout destination, task quality telemetry, and explicitly consented voice/annotation submissions.',
          'All sensitive operations execute server-side with encrypted transport, role-based access control, and immutable audit logging. Contributors may request profile review or data export through Support.',
        ],
      },
      licensing: {
        title: 'Voice & AI Dataset Licensing Disclosures',
        body: [
          'African Voice Intelligence contributions require explicit, per-submission contributor consent before any audio is recorded, stored, or licensed.',
          'Approved voice and annotation datasets are licensed to authorized AI research clients under transparent commercial or academic dataset licenses, while contributor identity remains decoupled from public training corpora.',
        ],
      },
      terms: {
        title: 'Terms of Service',
        body: [
          'Contributors must submit authentic human work. Automated bots, duplicate accounts, or fabricated ad completions result in account suspension under our Fraud & Security Management rules.',
          'M-PESA withdrawals are processed through authorized Safaricom Daraja B2C workflows subject to identity verification, minimum threshold rules, and merchant credential availability.',
        ],
      },
      cookies: {
        title: 'Cookie & Progressive Web App Storage Policy',
        body: [
          'CALLIDUS EARN AI uses essential session authentication state and service-worker asset caching to support fast loading and PWA installability on Kenyan mobile networks.',
          'Firebase ID tokens are held strictly in memory and are never persisted to insecure browser localStorage.',
        ],
      },
    };
    const active = legalContent[legalTab];

    return (
      <section className="mx-auto max-w-5xl px-6 py-16">
        <p className="text-xs font-medium tracking-wide text-emerald-400">
          Governance & Compliance Documentation
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white">Legal & Disclosures</h1>

        <div className="mt-8 flex flex-wrap gap-2 rounded-xl border border-white/10 bg-[#0B1118] p-1.5">
          {(
            [
              ['allocation', '80/20 Allocation Agreement'],
              ['privacy', 'Privacy & Kenya DPA'],
              ['licensing', 'Data & Voice Licensing'],
              ['terms', 'Terms of Service'],
              ['cookies', 'Cookie Policy'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setLegalTab(key)}
              className={`rounded-lg px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                legalTab === key
                  ? 'bg-emerald-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-[#0B1118] p-8">
          <h2 className="text-2xl font-semibold text-white">{active.title}</h2>
          <div className="mt-5 space-y-4 text-sm leading-relaxed text-slate-300">
            {active.body.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // HOMEPAGE ("home")
  return (
    <div>
      {/* HERO SECTION */}
      <section className="mx-auto max-w-7xl px-6 pb-16 pt-12 lg:pt-16">
        <div className="grid items-stretch gap-10 lg:grid-cols-12">
          <div className="flex flex-col justify-center lg:col-span-7">
            <p className="text-xs font-medium tracking-wide text-emerald-400">
              Nairobi, Kenya · Human Intelligence · KES M-PESA Marketplace
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
              YOUR INTELLIGENCE HAS VALUE.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Earn by helping train artificial intelligence, evaluating AI systems, completing
              sponsored tasks and contributing to the next generation of digital innovation.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={primaryAction}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-6 py-3.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 whitespace-nowrap shrink-0"
              >
                {isAuthenticated ? 'Open Your Dashboard' : 'Start Earning in KES'}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('opportunities')}
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10 whitespace-nowrap shrink-0"
              >
                Explore 5 Earning Departments
              </button>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-400">
              <span>80% Contributor Earnings</span>
              <span aria-hidden="true">·</span>
              <span>20% Automated Paybill 522522 (Acc 1355643775)</span>
              <span aria-hidden="true">·</span>
              <span>9 African & Regional Languages</span>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0B1118] p-4 lg:col-span-5">
            <HeroLogo3D />
            <div className="mt-2 flex items-center justify-between border-t border-white/10 px-2 pt-3 text-xs text-slate-400">
              <span>CALLIDUS EARN AI Core</span>
              <span className="font-mono text-emerald-400 tabular-nums">KES · 80/20 Ledger</span>
            </div>
          </div>
        </div>

        {/* VERIFIED PLATFORM STATS STRIP */}
        <div className="mt-10 grid grid-cols-2 gap-4 rounded-2xl border border-white/10 bg-[#0B1118] p-6 lg:grid-cols-4">
          <div>
            <p className="text-xs text-slate-400">Registered Contributors</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-white tabular-nums">
              {stats ? stats.registeredUsers.toLocaleString('en-KE') : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Active Marketplace Tasks</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-emerald-400 tabular-nums">
              {stats ? stats.activeTasks.toLocaleString('en-KE') : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Verified Task Completions</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-cyan-400 tabular-nums">
              {stats ? stats.completedTasks.toLocaleString('en-KE') : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Total Verified Gross Allocated</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-violet-400 tabular-nums">
              {stats ? formatKes(stats.totalGrossCents, false) : '—'}
            </p>
          </div>
        </div>
      </section>

      {/* INTERACTIVE KES EARNING & 80/20 CALCULATOR */}
      <section className="border-y border-white/10 bg-[#080C12] py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-5">
              <p className="text-xs font-medium tracking-wide text-emerald-400">
                Transparent 80/20 Allocation Engine
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">
                Interactive KES Earning Calculator
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                Simulate your daily and monthly Kenyan Shilling earnings. Every gross reward
                splits cleanly once: 80% directly to your M-PESA wallet and 20% to Paybill{' '}
                <span className="font-mono text-slate-100">522522</span> Account{' '}
                <span className="font-mono text-slate-100">1355643775</span>.
              </p>

              <div className="mt-8 space-y-6">
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">Verified Tasks per Day</span>
                    <span className="font-mono font-semibold text-emerald-400 tabular-nums">
                      {calcTasksPerDay} tasks/day
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={30}
                    value={calcTasksPerDay}
                    onChange={(e) => setCalcTasksPerDay(Number(e.target.value))}
                    className="mt-2 w-full accent-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300">Primary Task Track</label>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {[
                      { label: 'Ads · KSh 45', rate: 45 },
                      { label: 'Surveys · KSh 75', rate: 75 },
                      { label: 'AI Vision · KSh 120', rate: 120 },
                      { label: 'Voice · KSh 150', rate: 150 },
                      { label: 'AI Eval · KSh 180', rate: 180 },
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setCalcDeptRateKsh(opt.rate)}
                        className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          calcDeptRateKsh === opt.rate
                            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                            : 'border-white/10 bg-[#0B1118] text-slate-300 hover:border-white/25'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:col-span-7">
              <div className="rounded-2xl border border-white/10 bg-[#0B1118] p-6">
                <p className="text-xs text-slate-400">Daily Gross Output</p>
                <p className="mt-2 font-mono text-2xl font-semibold text-white tabular-nums">
                  {formatKes(dailyGrossCents)}
                </p>
                <div className="mt-4 space-y-2 border-t border-white/10 pt-4 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">80% Your Wallet</span>
                    <span className="font-mono text-emerald-400 tabular-nums">
                      {formatKes(dailyUserCents)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">20% Paybill 522522</span>
                    <span className="font-mono text-cyan-400 tabular-nums">
                      {formatKes(dailyPaybillCents)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-500/30 bg-[#0B1118] p-6">
                <p className="text-xs text-emerald-400">Monthly Estimate (26 Active Days)</p>
                <p className="mt-2 font-mono text-3xl font-semibold text-emerald-400 tabular-nums">
                  {formatKes(monthlyUserCents, false)}
                </p>
                <p className="mt-1 text-xs text-slate-400">Your 80% Net Take-Home in KES</p>
                <div className="mt-4 space-y-2 border-t border-white/10 pt-4 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Monthly Gross</span>
                    <span className="font-mono text-slate-200 tabular-nums">
                      {formatKes(monthlyGrossCents, false)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">20% Acc 1355643775</span>
                    <span className="font-mono text-cyan-400 tabular-nums">
                      {formatKes(monthlyPaybillCents, false)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FIVE EARNING DEPARTMENTS BENTO */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-cyan-400">
              Five Verified Revenue Tracks
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-white">
              AI & Digital Earning Departments
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('opportunities')}
            className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
          >
            View all open tasks →
          </button>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0B1118] lg:col-span-2">
            <div className="grid h-full sm:grid-cols-2">
              <img
                src="/src/assets/images/dept_voice_studio_1795098094283.jpg"
                alt="African Voice Intelligence Recording Booth"
                referrerPolicy="no-referrer"
                className="h-56 w-full object-cover sm:h-full"
              />
              <div className="flex flex-col justify-between p-7">
                <div>
                  <Mic className="h-5 w-5 text-emerald-400" />
                  <h3 className="mt-4 text-xl font-semibold text-white">
                    African Voice Intelligence
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    Record natural speech, verify pronunciation, and transcribe audio in English,
                    Kiswahili, Sheng, Dholuo, Kikuyu, Kalenjin, Luhya, Somali, and Maasai with
                    explicit dataset consent.
                  </p>
                </div>
                <p className="mt-6 font-mono text-xs text-emerald-400">
                  Up to KSh 200 gross · 9 Languages
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0B1118] p-7">
            <div>
              <PlayCircle className="h-5 w-5 text-cyan-400" />
              <h3 className="mt-4 text-xl font-semibold text-white">Rewarded Advertising</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Engage with verified Kenyan brand video, image, and interactive campaigns from
                direct advertising partners. Rewards unlock only after completion checks.
              </p>
            </div>
            <p className="mt-6 font-mono text-xs text-cyan-400">Direct Advertiser Campaigns</p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0B1118] lg:col-span-2">
            <div className="grid h-full sm:grid-cols-2">
              <img
                src="/src/assets/images/dept_ai_vision_1795098094620.jpg"
                alt="AI Computer Vision Annotation Workstation"
                referrerPolicy="no-referrer"
                className="h-56 w-full object-cover sm:h-full"
              />
              <div className="flex flex-col justify-between p-7">
                <div>
                  <Cpu className="h-5 w-5 text-violet-400" />
                  <h3 className="mt-4 text-xl font-semibold text-white">AI Data Training Lab</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    Draw bounding boxes on East African street scenes, classify Sheng & Kiswahili
                    e-commerce sentiment, and label multi-modal training corpora.
                  </p>
                </div>
                <p className="mt-6 font-mono text-xs text-violet-400">
                  Vision · NLP · Transcription
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0B1118] p-7">
            <div className="space-y-5">
              <div>
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                <h3 className="mt-3 text-lg font-semibold text-white">AI Evaluation</h3>
                <p className="mt-1.5 text-sm text-slate-300">
                  Compare model outputs, detect hallucinations, and verify educational translations.
                </p>
              </div>
              <div className="border-t border-white/10 pt-5">
                <BarChart3 className="h-5 w-5 text-cyan-400" />
                <h3 className="mt-3 text-lg font-semibold text-white">Market Research</h3>
                <p className="mt-1.5 text-sm text-slate-300">
                  Complete sponsored Kenyan consumer surveys and fintech product testing.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS SUMMARY & BUSINESS CTA */}
      <section className="border-t border-white/10 bg-[#080C12] py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-xs font-medium tracking-wide text-emerald-400">
                Gamification & AI Recommender Built In
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">
                Smarter Task Matching, Badges & M-PESA Payouts
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                Our Gemini-powered adaptive task recommender learns from your language strengths and
                feedback to surface your highest-earning opportunities first, while milestone
                badges reward consistency and referrals.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2.5 text-slate-200">
                  <Award className="h-4 w-4 text-violet-400 shrink-0" />
                  <span>Milestone Achievement Badges</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-200">
                  <Languages className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>9 African & Regional Languages</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-200">
                  <Wallet className="h-4 w-4 text-cyan-400 shrink-0" />
                  <span>Kenyan Shilling M-PESA Ledger</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-200">
                  <Lock className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Kenya DPA Privacy Controls</span>
                </div>
              </div>
              <div className="mt-8 flex flex-wrap gap-4">
                <button
                  type="button"
                  onClick={primaryAction}
                  className="rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
                >
                  {isAuthenticated ? 'Enter Workspace' : 'Sign In with Google'}
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('businesses')}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-3 text-sm font-medium text-white hover:bg-white/5"
                >
                  <Briefcase className="h-4 w-4" />
                  For Businesses & AI Labs
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0B1118]">
              <img
                src="/src/assets/images/enterprise_partner_hq_1795098094047.jpg"
                alt="Callidus Enterprise Partner Tower in Upper Hill Nairobi"
                referrerPolicy="no-referrer"
                className="h-72 w-full object-cover"
              />
              <div className="flex items-center justify-between p-5 text-xs text-slate-400">
                <span className="flex items-center gap-2 text-slate-200">
                  <Globe2 className="h-4 w-4 text-emerald-400" />
                  Kenya First · Pan-African Expansion Ready
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate('faq')}
                  className="text-emerald-400 hover:underline"
                >
                  Read FAQ
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
