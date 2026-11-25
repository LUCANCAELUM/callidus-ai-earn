import 'dotenv/config';
import crypto from 'crypto';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { GoogleGenAI } from '@google/genai';
import { db } from './src/db/index.ts';
import {
  advertiserCampaigns,
  aiClientProjects,
  allocationLedger,
  auditLogs,
  contactInquiries,
  marketplaceTasks,
  notifications,
  platformSettings,
  recommendationFeedback,
  taskSubmissions,
  users,
  withdrawals,
} from './src/db/schema.ts';
import { ensureSeeded } from './src/db/seedMarketplace.ts';
import {
  AuthRequest,
  optionalAuth,
  requireAuth,
  requireRoles,
} from './src/middleware/auth.ts';
import {
  DESIGNATED_ACCOUNT,
  DESIGNATED_PAYBILL,
  calculate8020Allocation,
  getDarajaStatusMetadata,
  isDarajaLiveConfigured,
  recordRewardAllocation,
} from './src/services/allocationEngine.ts';
import {
  evaluateAndAwardBadges,
  getUserBadgesWithCatalog,
  markNotificationRead,
} from './src/services/gamificationEngine.ts';
import { getAdaptiveTaskRecommendations } from './src/services/recommenderEngine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const portFlagIdx = process.argv.indexOf('--port');
const cliPort = portFlagIdx !== -1 ? Number(process.argv[portFlagIdx + 1]) : NaN;
const PORT = Number.isFinite(cliPort) && cliPort > 0 ? cliPort : Number(process.env.PORT || 3000);

// Security headers & payload limits
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'microphone=(self)');
  next();
});
app.use(express.json({ limit: '4mb' }));

// Sliding-window API rate limiter for DDoS / abuse protection
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + 60_000 });
    return next();
  }
  entry.count += 1;
  if (entry.count > 240) {
    return res.status(429).json({
      error: 'Too many requests. Please slow down and try again shortly.',
    });
  }
  next();
});

// Optional Gemini helper for server-side submission quality evaluation
const geminiClient =
  process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
    ? new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      })
    : null;

async function getSettingNumber(key: string, fallback: number): Promise<number> {
  const rows = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, key))
    .limit(1);
  if (!rows.length) return fallback;
  const parsed = Number(rows[0].value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeKenyanPhone(phone: string): string | null {
  const digits = phone.replace(/[\s\-+]/g, '');
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`;
  return null;
}

// ---------------------------------------------------------------------------
// PUBLIC ROUTES
// ---------------------------------------------------------------------------
app.get('/api/health', async (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'callidus-earn-ai',
    currency: 'KES',
    allocation: { userPct: 80, paybillPct: 20, paybill: DESIGNATED_PAYBILL, account: DESIGNATED_ACCOUNT },
    daraja: getDarajaStatusMetadata(),
  });
});

app.get('/api/public/stats', async (_req: Request, res: Response) => {
  try {
    await ensureSeeded();
    const [
      [userStats],
      [taskStats],
      [submissionStats],
      [ledgerStats],
    ] = await Promise.all([
      db.select({ totalUsers: count() }).from(users),
      db
        .select({ activeTasks: count() })
        .from(marketplaceTasks)
        .where(eq(marketplaceTasks.status, 'active')),
      db.select({ completedSubmissions: count() }).from(taskSubmissions),
      db
        .select({
          totalGrossCents: sql<number>`COALESCE(SUM(${allocationLedger.grossCents}), 0)`,
          totalUserCents: sql<number>`COALESCE(SUM(${allocationLedger.userCents}), 0)`,
          totalPaybillCents: sql<number>`COALESCE(SUM(${allocationLedger.paybillCents}), 0)`,
        })
        .from(allocationLedger),
    ]);

    res.json({
      registeredUsers: Number(userStats?.totalUsers || 0),
      activeTasks: Number(taskStats?.activeTasks || 0),
      completedTasks: Number(submissionStats?.completedSubmissions || 0),
      totalGrossCents: Number(ledgerStats?.totalGrossCents || 0),
      totalUserCents: Number(ledgerStats?.totalUserCents || 0),
      totalPaybillCents: Number(ledgerStats?.totalPaybillCents || 0),
      supportedLanguagesCount: 9,
      allocationRule: {
        userPct: 80,
        paybillPct: 20,
        paybill: DESIGNATED_PAYBILL,
        account: DESIGNATED_ACCOUNT,
      },
    });
  } catch (error) {
    console.error('Public stats error:', error);
    res.status(500).json({ error: 'Unable to load verified platform metrics.' });
  }
});

app.post('/api/contact', async (req: Request, res: Response) => {
  try {
    const { inquiryType, name, email, organization, subject, message } = req.body || {};
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'Name, email, subject, and message are required.' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(email))) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const [created] = await db
      .insert(contactInquiries)
      .values({
        inquiryType: String(inquiryType || 'support').slice(0, 40),
        name: String(name).trim().slice(0, 120),
        email: String(email).trim().slice(0, 160),
        organization: organization ? String(organization).trim().slice(0, 160) : null,
        subject: String(subject).trim().slice(0, 200),
        message: String(message).trim().slice(0, 3000),
      })
      .returning();

    res.status(201).json({ inquiry: created, message: 'Your inquiry has been logged for our Nairobi team.' });
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ error: 'Failed to submit inquiry.' });
  }
});

// ---------------------------------------------------------------------------
// AUTHENTICATED USER & PROFILE ROUTES
// ---------------------------------------------------------------------------
app.get('/api/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await ensureSeeded();
    const dbUser = req.dbUser!;
    // Bootstrap primary workspace owner as admin if configured
    if (
      dbUser.email.toLowerCase() === 'abuyabyron@gmail.com' &&
      dbUser.role === 'contributor'
    ) {
      const [promoted] = await db
        .update(users)
        .set({ role: 'admin', updatedAt: new Date() })
        .where(eq(users.uid, dbUser.uid))
        .returning();
      return res.json({ user: promoted, daraja: getDarajaStatusMetadata() });
    }
    res.json({ user: dbUser, daraja: getDarajaStatusMetadata() });
  } catch (error) {
    console.error('/api/me error:', error);
    res.status(500).json({ error: 'Failed to load profile.' });
  }
});

app.patch('/api/me/profile', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.dbUser!.uid;
    const {
      fullName,
      phone,
      mpesaNumber,
      accepted8020Terms,
      acceptedDataPrivacy,
      preferredLanguages,
      preferredDepartments,
      kycAction,
      referralCodeInput,
      verifyPhoneOtp,
    } = req.body || {};

    const updates: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (typeof fullName === 'string' && fullName.trim().length >= 2) {
      updates.fullName = fullName.trim().slice(0, 120);
    }

    if (typeof phone === 'string' && phone.trim()) {
      const normalized = normalizeKenyanPhone(phone.trim());
      if (!normalized) {
        return res.status(400).json({ error: 'Enter a valid Kenyan phone number (e.g. 0712345678 or 254712345678).' });
      }
      updates.phone = normalized;
    }

    if (typeof mpesaNumber === 'string' && mpesaNumber.trim()) {
      const normalized = normalizeKenyanPhone(mpesaNumber.trim());
      if (!normalized) {
        return res.status(400).json({ error: 'Enter a valid Kenyan M-PESA number (e.g. 0712345678 or 254712345678).' });
      }
      updates.mpesaNumber = normalized;
    }

    if (verifyPhoneOtp === true && (updates.phone || req.dbUser!.phone)) {
      updates.phoneVerified = true;
    }

    if (accepted8020Terms === true && !req.dbUser!.accepted8020Terms) {
      updates.accepted8020Terms = true;
      updates.accepted8020At = new Date();
    }

    if (acceptedDataPrivacy === true) {
      updates.acceptedDataPrivacy = true;
    }

    if (Array.isArray(preferredLanguages)) {
      updates.preferredLanguages = preferredLanguages.slice(0, 10).map(String);
    }

    if (Array.isArray(preferredDepartments)) {
      updates.preferredDepartments = preferredDepartments.slice(0, 5).map(String);
    }

    if (kycAction === 'submit_verification') {
      updates.kycStatus = 'pending';
    }

    // Apply referral code once if user hasn't been referred yet
    if (
      typeof referralCodeInput === 'string' &&
      referralCodeInput.trim() &&
      !req.dbUser!.referredByUid
    ) {
      const code = referralCodeInput.trim().toUpperCase();
      const [referrer] = await db
        .select()
        .from(users)
        .where(eq(users.referralCode, code))
        .limit(1);
      if (referrer && referrer.uid !== uid) {
        updates.referredByUid = referrer.uid;
        await db
          .update(users)
          .set({
            referralCount: sql`${users.referralCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(users.uid, referrer.uid));

        // Grant referral bonus through the exact same 80/20 allocation engine
        await recordRewardAllocation({
          userUid: referrer.uid,
          submissionId: null,
          sourceType: 'referral_bonus',
          grossCents: 5000, // KSh 50 gross -> KSh 40 user / KSh 10 Paybill
          reference: `REF-${referrer.id}-${req.dbUser!.id}`,
          taskTitle: `Referral Onboarding Bonus (${req.dbUser!.email})`,
        });
        await evaluateAndAwardBadges(referrer.uid);
      }
    }

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.uid, uid))
      .returning();

    await db.insert(auditLogs).values({
      actorUid: uid,
      actorEmail: req.dbUser!.email,
      action: 'profile_updated',
      targetType: 'users',
      targetId: String(updated.id),
      details: { kycStatus: updated.kycStatus, accepted8020Terms: updated.accepted8020Terms },
    });

    res.json({ user: updated });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// ---------------------------------------------------------------------------
// DASHBOARD & NOTIFICATIONS & GAMIFICATION BADGES
// ---------------------------------------------------------------------------
app.get('/api/dashboard/summary', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await ensureSeeded();
    const uid = req.dbUser!.uid;
    const [userRows, recentLedger, recentSubmissions, userNotifications, badgesCatalog] =
      await Promise.all([
        db.select().from(users).where(eq(users.uid, uid)).limit(1),
        db
          .select()
          .from(allocationLedger)
          .where(eq(allocationLedger.userUid, uid))
          .orderBy(desc(allocationLedger.createdAt))
          .limit(20),
        db
          .select()
          .from(taskSubmissions)
          .where(eq(taskSubmissions.userUid, uid))
          .orderBy(desc(taskSubmissions.createdAt))
          .limit(30),
        db
          .select()
          .from(notifications)
          .where(eq(notifications.userUid, uid))
          .orderBy(desc(notifications.createdAt))
          .limit(25),
        getUserBadgesWithCatalog(uid),
      ]);

    const user = userRows[0];
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let dailyNetCents = 0;
    let weeklyNetCents = 0;
    let monthlyNetCents = 0;

    // Aggregate time-window earnings from ledger entries
    const allUserLedger = await db
      .select()
      .from(allocationLedger)
      .where(eq(allocationLedger.userUid, uid))
      .orderBy(desc(allocationLedger.createdAt));

    const chartMap = new Map<string, { date: string; userKsh: number; paybillKsh: number }>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const label = d.toISOString().slice(5, 10);
      chartMap.set(label, { date: label, userKsh: 0, paybillKsh: 0 });
    }

    for (const row of allUserLedger) {
      const created = new Date(row.createdAt);
      if (created >= startOfToday) dailyNetCents += row.userCents;
      if (created >= startOfWeek) weeklyNetCents += row.userCents;
      if (created >= startOfMonth) monthlyNetCents += row.userCents;

      const label = created.toISOString().slice(5, 10);
      const bucket = chartMap.get(label);
      if (bucket) {
        bucket.userKsh += Math.round(row.userCents) / 100;
        bucket.paybillKsh += Math.round(row.paybillCents) / 100;
      }
    }

    res.json({
      user,
      metrics: {
        grossEarnedCents: user.grossEarnedCents,
        userNetEarnedCents: user.userNetEarnedCents,
        paybillAllocatedCents: user.paybillAllocatedCents,
        availableBalanceCents: user.availableBalanceCents,
        pendingBalanceCents: user.pendingBalanceCents,
        dailyNetCents,
        weeklyNetCents,
        monthlyNetCents,
        lifetimeNetCents: user.userNetEarnedCents,
        completedTasksCount: user.tasksCompletedCount,
        qualityScorePct: user.qualityScorePct,
      },
      earningsSeries: Array.from(chartMap.values()),
      recentLedger,
      recentSubmissions,
      notifications: userNotifications,
      badges: badgesCatalog,
      daraja: getDarajaStatusMetadata(),
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({ error: 'Unable to load dashboard summary.' });
  }
});

app.get('/api/badges', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const list = await getUserBadgesWithCatalog(req.dbUser!.uid);
    res.json({ badges: list });
  } catch (error) {
    console.error('Badges error:', error);
    res.status(500).json({ error: 'Unable to load badges.' });
  }
});

app.post('/api/notifications/:id/read', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid ID' });
    await markNotificationRead(req.dbUser!.uid, id);
    res.json({ ok: true });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to update notification.' });
  }
});

app.post('/api/notifications/read-all', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userUid, req.dbUser!.uid));
    res.json({ ok: true });
  } catch (error) {
    console.error('Read all notifications error:', error);
    res.status(500).json({ error: 'Failed to mark notifications read.' });
  }
});

// ---------------------------------------------------------------------------
// MARKETPLACE TASKS & AI RECOMMENDER & SUBMISSIONS
// ---------------------------------------------------------------------------
app.get('/api/tasks', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    await ensureSeeded();
    const department = typeof req.query.department === 'string' ? req.query.department : '';
    const language = typeof req.query.language === 'string' ? req.query.language : '';

    const allTasks = await db
      .select()
      .from(marketplaceTasks)
      .where(eq(marketplaceTasks.status, 'active'))
      .orderBy(desc(marketplaceTasks.createdAt));

    const filtered = allTasks.filter((t) => {
      if (department && department !== 'all' && t.department !== department) return false;
      if (language && language !== 'all' && t.language !== language) return false;
      return true;
    });

    let completedTaskIds: number[] = [];
    if (req.dbUser) {
      const subs = await db
        .select({ taskId: taskSubmissions.taskId })
        .from(taskSubmissions)
        .where(eq(taskSubmissions.userUid, req.dbUser.uid));
      completedTaskIds = subs.map((s) => s.taskId);
    }

    res.json({
      tasks: filtered.map((t) => ({
        ...t,
        splitPreview: calculate8020Allocation(t.grossRewardCents),
        userCompleted: completedTaskIds.includes(t.id),
      })),
    });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Unable to fetch marketplace tasks.' });
  }
});

app.get('/api/recommendations', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await ensureSeeded();
    const recommendations = await getAdaptiveTaskRecommendations(req.dbUser!.uid);
    res.json({
      recommendations: recommendations.map((r) => ({
        ...r,
        splitPreview: calculate8020Allocation(r.task.grossRewardCents),
      })),
    });
  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({ error: 'Unable to generate task recommendations.' });
  }
});

app.post(
  '/api/recommendations/:taskId/feedback',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const taskId = Number(req.params.taskId);
      const { action, reason } = req.body || {};
      if (!Number.isInteger(taskId) || !['clicked', 'thumbs_up', 'thumbs_down', 'dismissed', 'completed'].includes(action)) {
        return res.status(400).json({ error: 'Invalid recommendation feedback payload.' });
      }
      await db.insert(recommendationFeedback).values({
        userUid: req.dbUser!.uid,
        taskId,
        action,
        reason: reason ? String(reason).slice(0, 200) : null,
      });
      res.status(201).json({ ok: true });
    } catch (error) {
      console.error('Recommendation feedback error:', error);
      res.status(500).json({ error: 'Failed to save feedback.' });
    }
  }
);

app.post('/api/tasks/:id/submit', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await ensureSeeded();
    const taskId = Number(req.params.id);
    if (!Number.isInteger(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID.' });
    }

    const user = req.dbUser!;
    if (!user.accepted8020Terms) {
      return res.status(400).json({
        error: 'Please review and accept the 80/20 Earnings Allocation Agreement before completing payable tasks.',
      });
    }

    const [task] = await db
      .select()
      .from(marketplaceTasks)
      .where(eq(marketplaceTasks.id, taskId))
      .limit(1);

    if (!task || task.status !== 'active') {
      return res.status(404).json({ error: 'Task not found or no longer active.' });
    }
    if (task.completedSlots >= task.totalSlots) {
      return res.status(400).json({ error: 'Task slots are currently full.' });
    }

    // Prevent duplicate submissions per user per task
    const prior = await db
      .select()
      .from(taskSubmissions)
      .where(
        and(
          eq(taskSubmissions.taskId, taskId),
          eq(taskSubmissions.userUid, user.uid)
        )
      )
      .limit(1);

    if (prior.length > 0) {
      return res.status(409).json({
        error: 'You have already submitted and received allocation for this task.',
      });
    }

    const { responsePayload, voiceConsentAccepted } = req.body || {};
    if (!responsePayload || typeof responsePayload !== 'object') {
      return res.status(400).json({ error: 'Submission payload is required.' });
    }

    if (task.department === 'voice_intelligence' && voiceConsentAccepted !== true) {
      return res.status(400).json({
        error: 'Explicit voice recording, storage, and dataset licensing consent is required.',
      });
    }

    // Verify rewarded ad comprehension check if present
    if (
      task.department === 'rewarded_ads' &&
      task.payload?.correctOption &&
      responsePayload.selectedOption !== task.payload.correctOption
    ) {
      return res.status(400).json({
        error: 'Campaign verification failed: please review the sponsored brief and select the accurate answer.',
      });
    }

    let qualityScore = 96;
    if (geminiClient && task.department === 'ai_evaluation' && responsePayload.rationale) {
      try {
        const check = await geminiClient.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Evaluate if this contributor's AI evaluation rationale is coherent and relevant (reply with an integer 70-100 only): "${String(responsePayload.rationale).slice(0, 400)}"`,
        });
        const parsed = Number((check.text || '').replace(/\D/g, '').slice(0, 3));
        if (parsed >= 70 && parsed <= 100) qualityScore = parsed;
      } catch {
        // Keep baseline verified quality score if Gemini latency occurs
      }
    }

    const split = calculate8020Allocation(task.grossRewardCents);
    const transactionRef = `CAL-${task.id}-${user.id}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const [submission] = await db
      .insert(taskSubmissions)
      .values({
        taskId: task.id,
        userUid: user.uid,
        department: task.department,
        responsePayload,
        voiceConsentAccepted: Boolean(voiceConsentAccepted),
        qualityScore,
        status: 'approved',
        grossCents: split.grossCents,
        userCents: split.userCents,
        paybillCents: split.paybillCents,
        transactionRef,
      })
      .returning();

    await db
      .update(marketplaceTasks)
      .set({ completedSlots: sql`${marketplaceTasks.completedSlots} + 1` })
      .where(eq(marketplaceTasks.id, task.id));

    // Record immutable 80/20 allocation
    const allocationResult = await recordRewardAllocation({
      userUid: user.uid,
      submissionId: submission.id,
      sourceType: 'task_reward',
      grossCents: task.grossRewardCents,
      reference: transactionRef,
      taskTitle: task.title,
    });

    // Log recommender completion feedback
    await db.insert(recommendationFeedback).values({
      userUid: user.uid,
      taskId: task.id,
      action: 'completed',
      reason: `Earned KSh ${(split.userCents / 100).toFixed(2)}`,
    });

    // Evaluate and unlock gamification badges
    const newlyAwardedBadges = await evaluateAndAwardBadges(user.uid, {
      department: task.department,
    });

    res.status(201).json({
      submission,
      allocation: allocationResult.ledger,
      split,
      newlyAwardedBadges,
    });
  } catch (error) {
    console.error('Task submission error:', error);
    res.status(500).json({ error: 'Failed to process task submission.' });
  }
});

// ---------------------------------------------------------------------------
// M-PESA WALLET, ALLOCATION LEDGER & WITHDRAWALS
// ---------------------------------------------------------------------------
app.get('/api/wallet', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await ensureSeeded();
    const uid = req.dbUser!.uid;
    const [ledgerRows, withdrawalRows, minWithdrawCents, feeCents, dailyLimitCents] =
      await Promise.all([
        db
          .select()
          .from(allocationLedger)
          .where(eq(allocationLedger.userUid, uid))
          .orderBy(desc(allocationLedger.createdAt))
          .limit(50),
        db
          .select()
          .from(withdrawals)
          .where(eq(withdrawals.userUid, uid))
          .orderBy(desc(withdrawals.createdAt))
          .limit(30),
        getSettingNumber('min_withdrawal_cents', 10000),
        getSettingNumber('withdrawal_fee_cents', 0),
        getSettingNumber('daily_withdrawal_limit_cents', 15000000),
      ]);

    res.json({
      user: req.dbUser!,
      ledger: ledgerRows,
      withdrawals: withdrawalRows,
      config: {
        minWithdrawalCents: minWithdrawCents,
        withdrawalFeeCents: feeCents,
        dailyLimitCents,
        paybillNumber: DESIGNATED_PAYBILL,
        paybillAccount: DESIGNATED_ACCOUNT,
      },
      daraja: getDarajaStatusMetadata(),
    });
  } catch (error) {
    console.error('Wallet fetch error:', error);
    res.status(500).json({ error: 'Unable to load wallet records.' });
  }
});

app.get('/api/wallet/statement.csv', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.dbUser!.uid;
    const rows = await db
      .select()
      .from(allocationLedger)
      .where(eq(allocationLedger.userUid, uid))
      .orderBy(desc(allocationLedger.createdAt));

    const header =
      'Reference,Date,Source,Gross_KES,User_80Pct_KES,Paybill_20Pct_KES,Paybill,Account,Settlement_Status\n';
    const lines = rows.map(
      (r) =>
        `${r.reference},${new Date(r.createdAt).toISOString()},${r.sourceType},${(r.grossCents / 100).toFixed(2)},${(r.userCents / 100).toFixed(2)},${(r.paybillCents / 100).toFixed(2)},${r.paybillNumber},${r.paybillAccount},${r.settlementStatus}`
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="callidus-80-20-statement.csv"');
    res.send(header + lines.join('\n'));
  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({ error: 'Failed to export statement.' });
  }
});

app.post('/api/withdrawals', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.dbUser!;
    const { amountKsh, mpesaPhone } = req.body || {};
    const parsedKsh = Number(amountKsh);
    if (!Number.isFinite(parsedKsh) || parsedKsh <= 0) {
      return res.status(400).json({ error: 'Enter a valid withdrawal amount in KES.' });
    }
    const amountCents = Math.round(parsedKsh * 100);
    const normalizedPhone = normalizeKenyanPhone(String(mpesaPhone || user.mpesaNumber || ''));
    if (!normalizedPhone) {
      return res.status(400).json({
        error: 'Provide a valid Kenyan M-PESA phone number (e.g. 0712345678 or 254712345678).',
      });
    }

    const [minWithdrawCents, feeCents, dailyLimitCents] = await Promise.all([
      getSettingNumber('min_withdrawal_cents', 10000),
      getSettingNumber('withdrawal_fee_cents', 0),
      getSettingNumber('daily_withdrawal_limit_cents', 15000000),
    ]);

    if (amountCents < minWithdrawCents) {
      return res.status(400).json({
        error: `Minimum withdrawal is KSh ${(minWithdrawCents / 100).toFixed(2)}.`,
      });
    }
    if (amountCents > dailyLimitCents) {
      return res.status(400).json({
        error: `Amount exceeds daily limit of KSh ${(dailyLimitCents / 100).toLocaleString()}.`,
      });
    }
    if (amountCents > user.availableBalanceCents) {
      return res.status(400).json({ error: 'Insufficient available balance.' });
    }

    const netDisbursementCents = Math.max(0, amountCents - feeCents);
    const darajaConfigured = isDarajaLiveConfigured();
    const initialStatus = darajaConfigured ? 'sandbox_queued' : 'pending_daraja_b2c';
    const reference = `WDR-${user.id}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const withdrawal = await db.transaction(async (tx) => {
      const updatedUser = await tx
        .update(users)
        .set({
          availableBalanceCents: sql`${users.availableBalanceCents} - ${amountCents}`,
          pendingBalanceCents: sql`${users.pendingBalanceCents} + ${amountCents}`,
          mpesaNumber: normalizedPhone,
          updatedAt: new Date(),
        })
        .where(and(eq(users.uid, user.uid), sql`${users.availableBalanceCents} >= ${amountCents}`))
        .returning();

      if (updatedUser.length === 0) {
        throw new Error('INSUFFICIENT_BALANCE');
      }

      const [created] = await tx
        .insert(withdrawals)
        .values({
          reference,
          userUid: user.uid,
          mpesaPhone: normalizedPhone,
          amountCents,
          feeCents,
          netDisbursementCents,
          status: initialStatus,
          darajaOriginatorId: darajaConfigured
            ? `DARAJA-B2C-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
            : null,
        })
        .returning();

      await tx.insert(notifications).values({
        userUid: user.uid,
        category: 'withdrawal',
        title: `Withdrawal Queued: KSh ${(netDisbursementCents / 100).toFixed(2)}`,
        message: `M-PESA B2C payout to ${normalizedPhone} (Ref: ${reference}) is in ${initialStatus} state awaiting Safaricom Daraja confirmation.`,
      });

      await tx.insert(auditLogs).values({
        actorUid: user.uid,
        actorEmail: user.email,
        action: 'withdrawal_requested',
        targetType: 'withdrawals',
        targetId: String(created.id),
        details: { reference, amountCents, netDisbursementCents, mpesaPhone: normalizedPhone, status: initialStatus },
      });

      return created;
    });

    res.status(201).json({
      withdrawal,
      darajaNote: darajaConfigured
        ? 'Submitted to Safaricom Daraja sandbox queue.'
        : 'Recorded in pending_daraja_b2c queue because live Safaricom Daraja B2C credentials are not yet configured.',
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'INSUFFICIENT_BALANCE') {
      return res.status(400).json({ error: 'Insufficient available balance.' });
    }
    console.error('Withdrawal error:', error);
    res.status(500).json({ error: 'Failed to queue withdrawal.' });
  }
});

// Safaricom Daraja B2C / Settlement Callback Webhook
app.post('/api/mpesa/callback', async (req: Request, res: Response) => {
  try {
    const { reference, resultCode } = req.body || {};
    if (!reference) {
      return res.status(400).json({ error: 'Missing reference' });
    }
    const success = Number(resultCode) === 0;
    const [updated] = await db
      .update(withdrawals)
      .set({
        status: success ? 'paid' : 'failed',
        updatedAt: new Date(),
      })
      .where(eq(withdrawals.reference, String(reference)))
      .returning();

    if (updated) {
      if (success) {
        await db
          .update(users)
          .set({
            pendingBalanceCents: sql`GREATEST(0, ${users.pendingBalanceCents} - ${updated.amountCents})`,
            withdrawnCents: sql`${users.withdrawnCents} + ${updated.amountCents}`,
          })
          .where(eq(users.uid, updated.userUid));
      } else {
        await db
          .update(users)
          .set({
            pendingBalanceCents: sql`GREATEST(0, ${users.pendingBalanceCents} - ${updated.amountCents})`,
            availableBalanceCents: sql`${users.availableBalanceCents} + ${updated.amountCents}`,
          })
          .where(eq(users.uid, updated.userUid));
      }
    }
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('Daraja callback error:', error);
    res.status(500).json({ error: 'Callback processing failed' });
  }
});

// ---------------------------------------------------------------------------
// ADVERTISER PORTAL & AI CLIENT PORTAL
// ---------------------------------------------------------------------------
app.get('/api/advertiser/campaigns', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(advertiserCampaigns)
      .where(eq(advertiserCampaigns.ownerUid, req.dbUser!.uid))
      .orderBy(desc(advertiserCampaigns.createdAt));
    res.json({ campaigns: rows });
  } catch (error) {
    console.error('Advertiser fetch error:', error);
    res.status(500).json({ error: 'Failed to load advertiser campaigns.' });
  }
});

app.post('/api/advertiser/campaigns', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const {
      companyName,
      campaignTitle,
      adFormat,
      targetAudience,
      mediaUrl,
      budgetKsh,
      rewardPerViewKsh,
    } = req.body || {};

    if (!companyName || !campaignTitle || !adFormat || !targetAudience) {
      return res.status(400).json({ error: 'Company, campaign title, format, and audience are required.' });
    }
    const budgetCents = Math.round(Number(budgetKsh) * 100);
    const rewardPerViewCents = Math.round(Number(rewardPerViewKsh) * 100);
    if (!Number.isFinite(budgetCents) || budgetCents < 100000 || !Number.isFinite(rewardPerViewCents) || rewardPerViewCents < 1000) {
      return res.status(400).json({
        error: 'Minimum campaign budget is KSh 1,000 and minimum gross reward per verified view is KSh 10.',
      });
    }

    const [created] = await db
      .insert(advertiserCampaigns)
      .values({
        ownerUid: req.dbUser!.uid,
        companyName: String(companyName).trim().slice(0, 120),
        campaignTitle: String(campaignTitle).trim().slice(0, 160),
        adFormat: String(adFormat).slice(0, 40),
        targetAudience: String(targetAudience).trim().slice(0, 200),
        mediaUrl: mediaUrl ? String(mediaUrl).trim().slice(0, 400) : null,
        budgetCents,
        rewardPerViewCents,
        status: 'pending_approval',
      })
      .returning();

    await db.insert(auditLogs).values({
      actorUid: req.dbUser!.uid,
      actorEmail: req.dbUser!.email,
      action: 'advertiser_campaign_created',
      targetType: 'advertiser_campaigns',
      targetId: String(created.id),
      details: { campaignTitle: created.campaignTitle, budgetCents },
    });

    res.status(201).json({ campaign: created });
  } catch (error) {
    console.error('Create campaign error:', error);
    res.status(500).json({ error: 'Failed to create campaign.' });
  }
});

app.get('/api/ai-client/projects', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(aiClientProjects)
      .where(eq(aiClientProjects.ownerUid, req.dbUser!.uid))
      .orderBy(desc(aiClientProjects.createdAt));
    res.json({ projects: rows });
  } catch (error) {
    console.error('AI client fetch error:', error);
    res.status(500).json({ error: 'Failed to load AI training projects.' });
  }
});

app.post('/api/ai-client/projects', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const {
      organizationName,
      projectName,
      taskCategory,
      targetLanguage,
      difficulty,
      instructions,
      datasetLicense,
      budgetKsh,
      rewardPerItemKsh,
      totalItems,
    } = req.body || {};

    if (!organizationName || !projectName || !taskCategory || !instructions) {
      return res.status(400).json({ error: 'Organization, project name, category, and instructions are required.' });
    }
    const budgetCents = Math.round(Number(budgetKsh) * 100);
    const rewardPerItemCents = Math.round(Number(rewardPerItemKsh) * 100);
    const items = Math.max(10, Math.round(Number(totalItems || 100)));

    if (!Number.isFinite(budgetCents) || budgetCents < 100000 || !Number.isFinite(rewardPerItemCents) || rewardPerItemCents < 1000) {
      return res.status(400).json({
        error: 'Minimum project budget is KSh 1,000 and minimum gross reward per item is KSh 10.',
      });
    }

    const [created] = await db
      .insert(aiClientProjects)
      .values({
        ownerUid: req.dbUser!.uid,
        organizationName: String(organizationName).trim().slice(0, 140),
        projectName: String(projectName).trim().slice(0, 160),
        taskCategory: String(taskCategory).slice(0, 60),
        targetLanguage: String(targetLanguage || 'Kiswahili').slice(0, 40),
        difficulty: String(difficulty || 'Standard').slice(0, 30),
        instructions: String(instructions).trim().slice(0, 1200),
        datasetLicense: String(datasetLicense || 'Commercial Research License').slice(0, 120),
        budgetCents,
        rewardPerItemCents,
        totalItems: items,
        status: 'pending_moderation',
      })
      .returning();

    await db.insert(auditLogs).values({
      actorUid: req.dbUser!.uid,
      actorEmail: req.dbUser!.email,
      action: 'ai_project_created',
      targetType: 'ai_client_projects',
      targetId: String(created.id),
      details: { projectName: created.projectName, targetLanguage: created.targetLanguage, budgetCents },
    });

    res.status(201).json({ project: created });
  } catch (error) {
    console.error('Create AI project error:', error);
    res.status(500).json({ error: 'Failed to create AI training project.' });
  }
});

// ---------------------------------------------------------------------------
// ADMINISTRATOR COMMAND CENTER (RBAC PROTECTED)
// ---------------------------------------------------------------------------
const ADMIN_STAFF_ROLES = ['admin', 'finance_officer', 'moderator', 'support_agent'];

app.get(
  '/api/admin/overview',
  requireAuth,
  requireRoles(ADMIN_STAFF_ROLES),
  async (_req: AuthRequest, res: Response) => {
    try {
      await ensureSeeded();
      const [
        allUsers,
        allLedger,
        allWithdrawals,
        allCampaigns,
        allProjects,
        allTasks,
        recentAuditLogs,
        inquiries,
        settingsRows,
      ] = await Promise.all([
        db.select().from(users).orderBy(desc(users.createdAt)).limit(100),
        db.select().from(allocationLedger).orderBy(desc(allocationLedger.createdAt)).limit(100),
        db.select().from(withdrawals).orderBy(desc(withdrawals.createdAt)).limit(100),
        db.select().from(advertiserCampaigns).orderBy(desc(advertiserCampaigns.createdAt)).limit(50),
        db.select().from(aiClientProjects).orderBy(desc(aiClientProjects.createdAt)).limit(50),
        db.select().from(marketplaceTasks).orderBy(desc(marketplaceTasks.createdAt)).limit(50),
        db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(60),
        db.select().from(contactInquiries).orderBy(desc(contactInquiries.createdAt)).limit(40),
        db.select().from(platformSettings),
      ]);

      const totalGrossCents = allLedger.reduce((s, r) => s + r.grossCents, 0);
      const totalUser80Cents = allLedger.reduce((s, r) => s + r.userCents, 0);
      const totalPaybill20Cents = allLedger.reduce((s, r) => s + r.paybillCents, 0);
      const totalAdRevenueCents = allCampaigns.reduce((s, c) => s + c.budgetCents, 0);
      const totalClientRevenueCents = allProjects.reduce((s, p) => s + p.budgetCents, 0);

      res.json({
        kpis: {
          registeredUsers: allUsers.length,
          activeUsers: allUsers.filter((u) => u.accountStatus === 'active').length,
          completedTasks: allUsers.reduce((s, u) => s + u.tasksCompletedCount, 0),
          totalGrossCents,
          totalUser80Cents,
          totalPaybill20Cents,
          totalAdRevenueCents,
          totalClientRevenueCents,
          pendingWithdrawalsCount: allWithdrawals.filter((w) => w.status !== 'paid' && w.status !== 'failed').length,
          pendingAllocationsCount: allLedger.filter((l) => l.settlementStatus !== 'settled').length,
        },
        users: allUsers,
        ledger: allLedger,
        withdrawals: allWithdrawals,
        campaigns: allCampaigns,
        projects: allProjects,
        tasks: allTasks,
        auditLogs: recentAuditLogs,
        inquiries,
        settings: Object.fromEntries(settingsRows.map((s) => [s.key, s.value])),
      });
    } catch (error) {
      console.error('Admin overview error:', error);
      res.status(500).json({ error: 'Unable to load administrator command center.' });
    }
  }
);

app.post(
  '/api/admin/tasks',
  requireAuth,
  requireRoles(['admin', 'moderator']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { department, taskType, title, description, instructions, language, difficulty, estimatedMinutes, grossRewardKsh } = req.body || {};
      if (!department || !title || !description || !instructions) {
        return res.status(400).json({ error: 'Missing required task fields.' });
      }
      const grossRewardCents = Math.round(Number(grossRewardKsh) * 100);
      if (!Number.isFinite(grossRewardCents) || grossRewardCents < 500) {
        return res.status(400).json({ error: 'Minimum gross task reward is KSh 5.00.' });
      }
      const slug = `adm-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
      const [created] = await db
        .insert(marketplaceTasks)
        .values({
          slug,
          department: String(department),
          taskType: String(taskType || 'custom_task'),
          title: String(title).trim(),
          description: String(description).trim(),
          instructions: String(instructions).trim(),
          language: String(language || 'English'),
          difficulty: String(difficulty || 'Standard'),
          estimatedMinutes: Number(estimatedMinutes || 3),
          grossRewardCents,
          status: 'active',
          createdByUid: req.dbUser!.uid,
          payload: { customPrompt: instructions },
        })
        .returning();

      await db.insert(auditLogs).values({
        actorUid: req.dbUser!.uid,
        actorEmail: req.dbUser!.email,
        action: 'admin_task_created',
        targetType: 'marketplace_tasks',
        targetId: String(created.id),
        details: { title: created.title, grossRewardCents },
      });

      res.status(201).json({ task: created });
    } catch (error) {
      console.error('Admin create task error:', error);
      res.status(500).json({ error: 'Failed to create task.' });
    }
  }
);

app.patch(
  '/api/admin/users/:uid',
  requireAuth,
  requireRoles(['admin', 'support_agent']),
  async (req: AuthRequest, res: Response) => {
    try {
      const targetUid = req.params.uid;
      const { role, accountStatus, kycStatus } = req.body || {};
      const updates: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
      if (role && req.dbUser!.role === 'admin') updates.role = String(role);
      if (accountStatus) updates.accountStatus = String(accountStatus);
      if (kycStatus) updates.kycStatus = String(kycStatus);

      const [updated] = await db
        .update(users)
        .set(updates)
        .where(eq(users.uid, targetUid))
        .returning();

      if (!updated) return res.status(404).json({ error: 'User not found.' });

      await db.insert(auditLogs).values({
        actorUid: req.dbUser!.uid,
        actorEmail: req.dbUser!.email,
        action: 'admin_user_updated',
        targetType: 'users',
        targetId: targetUid,
        details: { role, accountStatus, kycStatus },
      });

      res.json({ user: updated });
    } catch (error) {
      console.error('Admin user update error:', error);
      res.status(500).json({ error: 'Failed to update user.' });
    }
  }
);

app.post(
  '/api/admin/campaigns/:id/approve',
  requireAuth,
  requireRoles(['admin', 'moderator']),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      const [campaign] = await db
        .update(advertiserCampaigns)
        .set({ status: 'active' })
        .where(eq(advertiserCampaigns.id, id))
        .returning();
      if (!campaign) return res.status(404).json({ error: 'Campaign not found.' });

      // Publish approved campaign into Rewarded Advertising department
      await db.insert(marketplaceTasks).values({
        slug: `camp-${campaign.id}-${Date.now()}`,
        department: 'rewarded_ads',
        taskType: `${campaign.adFormat}_ad`,
        title: campaign.campaignTitle,
        description: `Sponsored brand campaign by ${campaign.companyName} for ${campaign.targetAudience}.`,
        instructions: 'Review the sponsored brand brief and submit your verification response.',
        language: 'English',
        difficulty: 'Starter',
        estimatedMinutes: 2,
        grossRewardCents: campaign.rewardPerViewCents,
        organizationName: campaign.companyName,
        totalSlots: Math.max(10, Math.floor(campaign.budgetCents / campaign.rewardPerViewCents)),
        payload: {
          adFormat: campaign.adFormat,
          brandHighlight: campaign.targetAudience,
          verificationQuestion: `Confirm you reviewed the ${campaign.companyName} campaign brief.`,
          options: [`Verified: ${campaign.campaignTitle}`, 'Skip'],
          correctOption: `Verified: ${campaign.campaignTitle}`,
        },
      });

      await db.insert(auditLogs).values({
        actorUid: req.dbUser!.uid,
        actorEmail: req.dbUser!.email,
        action: 'campaign_approved',
        targetType: 'advertiser_campaigns',
        targetId: String(campaign.id),
      });

      res.json({ campaign });
    } catch (error) {
      console.error('Approve campaign error:', error);
      res.status(500).json({ error: 'Failed to approve campaign.' });
    }
  }
);

app.post(
  '/api/admin/projects/:id/approve',
  requireAuth,
  requireRoles(['admin', 'moderator']),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      const [project] = await db
        .update(aiClientProjects)
        .set({ status: 'active' })
        .where(eq(aiClientProjects.id, id))
        .returning();
      if (!project) return res.status(404).json({ error: 'Project not found.' });

      const deptMap: Record<string, string> = {
        image_annotation: 'ai_training',
        text_classification: 'ai_training',
        voice_dataset: 'voice_intelligence',
        llm_evaluation: 'ai_evaluation',
      };

      await db.insert(marketplaceTasks).values({
        slug: `proj-${project.id}-${Date.now()}`,
        department: deptMap[project.taskCategory] || 'ai_training',
        taskType: project.taskCategory,
        title: project.projectName,
        description: `${project.organizationName} dataset project (${project.datasetLicense}).`,
        instructions: project.instructions,
        language: project.targetLanguage,
        difficulty: project.difficulty,
        estimatedMinutes: 4,
        grossRewardCents: project.rewardPerItemCents,
        organizationName: project.organizationName,
        totalSlots: project.totalItems,
        payload: { customPrompt: project.instructions },
      });

      await db.insert(auditLogs).values({
        actorUid: req.dbUser!.uid,
        actorEmail: req.dbUser!.email,
        action: 'ai_project_approved',
        targetType: 'ai_client_projects',
        targetId: String(project.id),
      });

      res.json({ project });
    } catch (error) {
      console.error('Approve project error:', error);
      res.status(500).json({ error: 'Failed to approve AI project.' });
    }
  }
);

app.patch(
  '/api/admin/withdrawals/:id',
  requireAuth,
  requireRoles(['admin', 'finance_officer']),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      const { status } = req.body || {};
      if (!['pending_daraja_b2c', 'sandbox_queued', 'paid', 'failed'].includes(status)) {
        return res.status(400).json({ error: 'Invalid withdrawal status.' });
      }
      const [updated] = await db
        .update(withdrawals)
        .set({
          status,
          adminReviewedBy: req.dbUser!.email,
          updatedAt: new Date(),
        })
        .where(eq(withdrawals.id, id))
        .returning();

      if (!updated) return res.status(404).json({ error: 'Withdrawal not found.' });

      await db.insert(auditLogs).values({
        actorUid: req.dbUser!.uid,
        actorEmail: req.dbUser!.email,
        action: 'withdrawal_status_updated',
        targetType: 'withdrawals',
        targetId: String(id),
        details: { status, reference: updated.reference },
      });

      res.json({ withdrawal: updated });
    } catch (error) {
      console.error('Admin withdrawal update error:', error);
      res.status(500).json({ error: 'Failed to update withdrawal.' });
    }
  }
);

app.patch(
  '/api/admin/ledger/:id/reconcile',
  requireAuth,
  requireRoles(['admin', 'finance_officer']),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      const { settlementStatus } = req.body || {};
      if (!['pending_daraja_settlement', 'sandbox_queued', 'settled', 'failed'].includes(settlementStatus)) {
        return res.status(400).json({ error: 'Invalid settlement status.' });
      }
      const [updated] = await db
        .update(allocationLedger)
        .set({
          settlementStatus,
          reconciledAt: settlementStatus === 'settled' ? new Date() : null,
        })
        .where(eq(allocationLedger.id, id))
        .returning();

      if (!updated) return res.status(404).json({ error: 'Ledger record not found.' });

      await db.insert(auditLogs).values({
        actorUid: req.dbUser!.uid,
        actorEmail: req.dbUser!.email,
        action: 'ledger_reconciled',
        targetType: 'allocation_ledger',
        targetId: String(id),
        details: { settlementStatus, reference: updated.reference },
      });

      res.json({ ledger: updated });
    } catch (error) {
      console.error('Reconcile ledger error:', error);
      res.status(500).json({ error: 'Failed to reconcile ledger record.' });
    }
  }
);

app.patch(
  '/api/admin/settings',
  requireAuth,
  requireRoles(['admin', 'finance_officer']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { minWithdrawalKsh, withdrawalFeeKsh, dailyWithdrawalLimitKsh } = req.body || {};
      const pairs: Array<[string, string]> = [];
      if (minWithdrawalKsh !== undefined) {
        pairs.push(['min_withdrawal_cents', String(Math.round(Number(minWithdrawalKsh) * 100))]);
      }
      if (withdrawalFeeKsh !== undefined) {
        pairs.push(['withdrawal_fee_cents', String(Math.round(Number(withdrawalFeeKsh) * 100))]);
      }
      if (dailyWithdrawalLimitKsh !== undefined) {
        pairs.push(['daily_withdrawal_limit_cents', String(Math.round(Number(dailyWithdrawalLimitKsh) * 100))]);
      }

      for (const [key, value] of pairs) {
        await db
          .insert(platformSettings)
          .values({ key, value })
          .onConflictDoUpdate({
            target: platformSettings.key,
            set: { value, updatedAt: new Date() },
          });
      }

      await db.insert(auditLogs).values({
        actorUid: req.dbUser!.uid,
        actorEmail: req.dbUser!.email,
        action: 'platform_settings_updated',
        targetType: 'platform_settings',
        details: Object.fromEntries(pairs),
      });

      res.json({ ok: true });
    } catch (error) {
      console.error('Settings update error:', error);
      res.status(500).json({ error: 'Failed to update financial settings.' });
    }
  }
);

// ---------------------------------------------------------------------------
// VITE DEV MIDDLEWARE / STATIC PRODUCTION SERVING
// ---------------------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });
    // Intercept /@vite/client so Vite 8 never attempts a browser WebSocket connection
    // when HMR is disabled behind the Cloud Run proxy, while keeping CSS injection & hot stubs intact.
    app.get('/@vite/client', (_req: Request, res: Response) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.send(`
const sheetsMap = new Map();
const linkSheetsMap = new Map();
if (typeof document !== 'undefined') {
  document.querySelectorAll('style[data-vite-dev-id]').forEach((el) => {
    sheetsMap.set(el.getAttribute('data-vite-dev-id'), el);
  });
  document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]').forEach((el) => {
    linkSheetsMap.set(el.getAttribute('data-vite-dev-id'), el);
  });
}
export function updateStyle(id, content) {
  if (typeof document === 'undefined' || linkSheetsMap.has(id)) return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
}
export function removeStyle(id) {
  if (typeof document === 'undefined') return;
  if (linkSheetsMap.has(id)) {
    document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id="' + CSS.escape(id) + '"]').forEach((el) => el.remove());
    linkSheetsMap.delete(id);
  }
  const style = sheetsMap.get(id);
  if (style) {
    style.remove();
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  const noop = () => {};
  return {
    data: {},
    accept: noop,
    acceptExports: noop,
    dispose: noop,
    prune: noop,
    decline: noop,
    invalidate: noop,
    on: noop,
    off: noop,
    send: noop,
  };
}
export function injectQuery(url, queryToInject) {
  if (!url || (url[0] !== '.' && url[0] !== '/')) return url;
  const pathname = url.replace(/[?#].*$/, '');
  const { search, hash } = new URL(url, 'http://vite.dev');
  return pathname + '?' + queryToInject + (search ? '&' + search.slice(1) : '') + (hash || '');
}
export class ErrorOverlay {}
`);
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CALLIDUS EARN AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
