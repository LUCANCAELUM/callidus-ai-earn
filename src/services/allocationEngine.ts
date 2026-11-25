import crypto from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  allocationLedger,
  auditLogs,
  notifications,
  users,
} from '../db/schema.ts';

export const DESIGNATED_PAYBILL = '522522';
export const DESIGNATED_ACCOUNT = '1355643775';

export interface AllocationSplit {
  grossCents: number;
  userCents: number;
  paybillCents: number;
}

/**
 * Deterministic 80/20 integer split using KES cents (100 cents = KSh 1.00).
 * Never double-deducts: calculates once per eligible gross reward and preserves
 * exact conservation (userCents + paybillCents === grossCents).
 */
export function calculate8020Allocation(grossCents: number): AllocationSplit {
  if (!Number.isInteger(grossCents) || grossCents <= 0) {
    throw new Error('Gross reward must be a positive integer in KES cents.');
  }
  const paybillCents = Math.floor((grossCents * 20) / 100);
  const userCents = grossCents - paybillCents;
  return {
    grossCents,
    userCents,
    paybillCents,
  };
}

export function isDarajaLiveConfigured(): boolean {
  return Boolean(
    process.env.MPESA_CONSUMER_KEY &&
      process.env.MPESA_CONSUMER_SECRET &&
      process.env.MPESA_PASSKEY &&
      process.env.MPESA_INITIATOR_NAME &&
      process.env.MPESA_SECURITY_CREDENTIAL
  );
}

export function getDarajaStatusMetadata() {
  const configured = isDarajaLiveConfigured();
  return {
    mode: configured ? (process.env.MPESA_ENV === 'production' ? 'production' : 'sandbox_configured') : 'pending_credentials',
    paybill: DESIGNATED_PAYBILL,
    accountNumber: DESIGNATED_ACCOUNT,
    stkPushNote:
      'Safaricom STK Push is customer-initiated C2B collection; automated 20% treasury settlement to Paybill 522522 Account 1355643775 uses authorized Daraja B2B/settlement workflow or pending reconciliation queue.',
    b2cWithdrawalNote: configured
      ? 'Safaricom Daraja B2C credentials detected.'
      : 'Safaricom Daraja B2C credentials not configured in environment; withdrawals are queued in pending_daraja_b2c state without simulating real transfers.',
  };
}

export async function recordRewardAllocation(params: {
  userUid: string;
  submissionId: number | null;
  sourceType: 'task_reward' | 'referral_bonus';
  grossCents: number;
  reference: string;
  taskTitle: string;
}) {
  const split = calculate8020Allocation(params.grossCents);
  const darajaConfigured = isDarajaLiveConfigured();
  const initialSettlementStatus = darajaConfigured
    ? 'sandbox_queued'
    : 'pending_daraja_settlement';

  try {
    return await db.transaction(async (tx) => {
      // Duplicate protection via unique ledger reference
      const existing = await tx
        .select()
        .from(allocationLedger)
        .where(eq(allocationLedger.reference, params.reference))
        .limit(1);

      if (existing.length > 0) {
        return { split, ledger: existing[0], duplicate: true };
      }

      const [ledger] = await tx
        .insert(allocationLedger)
        .values({
          reference: params.reference,
          userUid: params.userUid,
          submissionId: params.submissionId,
          sourceType: params.sourceType,
          grossCents: split.grossCents,
          userCents: split.userCents,
          paybillCents: split.paybillCents,
          paybillNumber: DESIGNATED_PAYBILL,
          paybillAccount: DESIGNATED_ACCOUNT,
          settlementStatus: initialSettlementStatus,
          darajaConversationId: darajaConfigured
            ? `DARAJA-SBX-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
            : null,
        })
        .returning();

      await tx
        .update(users)
        .set({
          grossEarnedCents: sql`${users.grossEarnedCents} + ${split.grossCents}`,
          userNetEarnedCents: sql`${users.userNetEarnedCents} + ${split.userCents}`,
          paybillAllocatedCents: sql`${users.paybillAllocatedCents} + ${split.paybillCents}`,
          availableBalanceCents: sql`${users.availableBalanceCents} + ${split.userCents}`,
          tasksCompletedCount:
            params.sourceType === 'task_reward'
              ? sql`${users.tasksCompletedCount} + 1`
              : users.tasksCompletedCount,
          updatedAt: new Date(),
        })
        .where(eq(users.uid, params.userUid));

      const ksh = (cents: number) => `KSh ${(cents / 100).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      await tx.insert(notifications).values({
        userUid: params.userUid,
        category: 'reward_allocated',
        title: `Reward Allocated: ${ksh(split.userCents)} (80%)`,
        message: `${params.taskTitle} verified. Gross ${ksh(split.grossCents)} split into ${ksh(split.userCents)} user balance (80%) and ${ksh(split.paybillCents)} queued for Paybill ${DESIGNATED_PAYBILL} Acc ${DESIGNATED_ACCOUNT} (20%). Ref: ${params.reference}`,
      });

      await tx.insert(auditLogs).values({
        actorUid: params.userUid,
        action: 'allocation_recorded',
        targetType: 'allocation_ledger',
        targetId: String(ledger.id),
        details: {
          reference: params.reference,
          grossCents: split.grossCents,
          userCents: split.userCents,
          paybillCents: split.paybillCents,
          paybill: DESIGNATED_PAYBILL,
          account: DESIGNATED_ACCOUNT,
          settlementStatus: initialSettlementStatus,
        },
      });

      return { split, ledger, duplicate: false };
    });
  } catch (error) {
    console.error('Allocation ledger error:', error);
    throw new Error('Failed to record immutable 80/20 financial allocation.', {
      cause: error,
    });
  }
}
