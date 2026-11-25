import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { badges, notifications, userBadges, users } from '../db/schema.ts';

export const DEFAULT_BADGES = [
  {
    code: 'first_task',
    name: 'First Intelligence Signal',
    description: 'Completed your first verified earning task on Callidus Earn AI.',
    tier: 'Bronze',
    criteriaType: 'tasks_completed',
    criteriaThreshold: 1,
  },
  {
    code: 'tasks_10',
    name: 'Precision Contributor',
    description: 'Completed 10 approved AI training or evaluation tasks.',
    tier: 'Silver',
    criteriaType: 'tasks_completed',
    criteriaThreshold: 10,
  },
  {
    code: 'tasks_100',
    name: 'First 100 Tasks Completed',
    description: 'Reached the centurion milestone of 100 verified marketplace tasks.',
    tier: 'Gold',
    criteriaType: 'tasks_completed',
    criteriaThreshold: 100,
  },
  {
    code: 'top_earner_week',
    name: 'Top Earner of the Week',
    description: 'Earned KSh 500+ in verified 80% net contributor rewards.',
    tier: 'Platinum',
    criteriaType: 'net_earnings_cents',
    criteriaThreshold: 50000,
  },
  {
    code: 'referral_master',
    name: 'Referral Master',
    description: 'Invited 3 or more active contributors to the Callidus network.',
    tier: 'Gold',
    criteriaType: 'referrals',
    criteriaThreshold: 3,
  },
  {
    code: 'voice_pioneer',
    name: 'African Voice Pioneer',
    description: 'Contributed verified East African speech & language intelligence.',
    tier: 'Silver',
    criteriaType: 'voice_task',
    criteriaThreshold: 1,
  },
  {
    code: 'quality_ace',
    name: '98% Quality Verifier',
    description: 'Maintained at least 95% quality accuracy across submissions.',
    tier: 'Gold',
    criteriaType: 'quality_score',
    criteriaThreshold: 95,
  },
];

export async function ensureBadgesSeeded() {
  for (const b of DEFAULT_BADGES) {
    await db
      .insert(badges)
      .values(b)
      .onConflictDoNothing({ target: badges.code });
  }
}

export async function evaluateAndAwardBadges(
  userUid: string,
  context?: { department?: string }
) {
  try {
    await ensureBadgesSeeded();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.uid, userUid))
      .limit(1);
    if (!user) return [];

    const existingRows = await db
      .select()
      .from(userBadges)
      .where(eq(userBadges.userUid, userUid));
    const ownedCodes = new Set(existingRows.map((r) => r.badgeCode));

    const eligibleCodes: string[] = [];

    if (user.tasksCompletedCount >= 1) eligibleCodes.push('first_task');
    if (user.tasksCompletedCount >= 10) eligibleCodes.push('tasks_10');
    if (user.tasksCompletedCount >= 100) eligibleCodes.push('tasks_100');
    if (user.userNetEarnedCents >= 50000) eligibleCodes.push('top_earner_week');
    if (user.referralCount >= 3) eligibleCodes.push('referral_master');
    if (context?.department === 'voice_intelligence') eligibleCodes.push('voice_pioneer');
    if (user.tasksCompletedCount >= 1 && user.qualityScorePct >= 95) {
      eligibleCodes.push('quality_ace');
    }

    const newlyEarnedCodes = eligibleCodes.filter((code) => !ownedCodes.has(code));
    if (newlyEarnedCodes.length === 0) return [];

    const badgeDefinitions = await db
      .select()
      .from(badges)
      .where(inArray(badges.code, newlyEarnedCodes));

    const awarded = [];
    for (const def of badgeDefinitions) {
      const inserted = await db
        .insert(userBadges)
        .values({
          userUid,
          badgeCode: def.code,
        })
        .onConflictDoNothing()
        .returning();

      if (inserted.length > 0) {
        awarded.push(def);
        await db.insert(notifications).values({
          userUid,
          category: 'badge_unlocked',
          title: `Badge Unlocked: ${def.name}`,
          message: `You earned the ${def.tier} badge "${def.name}" — ${def.description}`,
        });
      }
    }

    return awarded;
  } catch (error) {
    console.error('Badge evaluation error:', error);
    return [];
  }
}

export async function getUserBadgesWithCatalog(userUid: string) {
  await ensureBadgesSeeded();
  const [allBadges, earned] = await Promise.all([
    db.select().from(badges),
    db.select().from(userBadges).where(eq(userBadges.userUid, userUid)),
  ]);
  const earnedMap = new Map(earned.map((e) => [e.badgeCode, e.earnedAt]));
  return allBadges.map((b) => ({
    ...b,
    earned: earnedMap.has(b.code),
    earnedAt: earnedMap.get(b.code) || null,
  }));
}

export async function markNotificationRead(userUid: string, notificationId: number) {
  return await db
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userUid, userUid)
      )
    )
    .returning();
}
