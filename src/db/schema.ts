import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  fullName: text('full_name'),
  phone: text('phone'),
  mpesaNumber: text('mpesa_number'),
  phoneVerified: boolean('phone_verified').notNull().default(false),
  emailVerified: boolean('email_verified').notNull().default(false),
  kycStatus: text('kyc_status').notNull().default('unverified'),
  role: text('role').notNull().default('contributor'),
  accountStatus: text('account_status').notNull().default('active'),
  accepted8020Terms: boolean('accepted_8020_terms').notNull().default(false),
  accepted8020At: timestamp('accepted_8020_at'),
  acceptedDataPrivacy: boolean('accepted_data_privacy').notNull().default(false),
  preferredLanguages: jsonb('preferred_languages')
    .$type<string[]>()
    .notNull()
    .default(['English', 'Kiswahili']),
  preferredDepartments: jsonb('preferred_departments')
    .$type<string[]>()
    .notNull()
    .default(['ai_training', 'voice_intelligence']),
  referralCode: text('referral_code').unique(),
  referredByUid: text('referred_by_uid'),
  referralCount: integer('referral_count').notNull().default(0),
  tasksCompletedCount: integer('tasks_completed_count').notNull().default(0),
  qualityScorePct: integer('quality_score_pct').notNull().default(100),
  grossEarnedCents: integer('gross_earned_cents').notNull().default(0),
  userNetEarnedCents: integer('user_net_earned_cents').notNull().default(0),
  paybillAllocatedCents: integer('paybill_allocated_cents').notNull().default(0),
  availableBalanceCents: integer('available_balance_cents').notNull().default(0),
  pendingBalanceCents: integer('pending_balance_cents').notNull().default(0),
  withdrawnCents: integer('withdrawn_cents').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const marketplaceTasks = pgTable('marketplace_tasks', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  department: text('department').notNull(),
  taskType: text('task_type').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  instructions: text('instructions').notNull(),
  language: text('language').notNull().default('English'),
  difficulty: text('difficulty').notNull().default('Standard'),
  estimatedMinutes: integer('estimated_minutes').notNull().default(3),
  grossRewardCents: integer('gross_reward_cents').notNull(),
  eligibilityRequirement: text('eligibility_requirement')
    .notNull()
    .default('Verified email & accepted 80/20 allocation terms'),
  status: text('status').notNull().default('active'),
  totalSlots: integer('total_slots').notNull().default(500),
  completedSlots: integer('completed_slots').notNull().default(0),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  createdByUid: text('created_by_uid'),
  organizationName: text('organization_name').notNull().default('Callidus AI Lab'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const taskSubmissions = pgTable('task_submissions', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id')
    .references(() => marketplaceTasks.id)
    .notNull(),
  userUid: text('user_uid').notNull(),
  department: text('department').notNull(),
  responsePayload: jsonb('response_payload').$type<Record<string, unknown>>().notNull(),
  voiceConsentAccepted: boolean('voice_consent_accepted').notNull().default(false),
  qualityScore: integer('quality_score').notNull().default(95),
  status: text('status').notNull().default('approved'),
  grossCents: integer('gross_cents').notNull(),
  userCents: integer('user_cents').notNull(),
  paybillCents: integer('paybill_cents').notNull(),
  transactionRef: text('transaction_ref').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const allocationLedger = pgTable('allocation_ledger', {
  id: serial('id').primaryKey(),
  reference: text('reference').notNull().unique(),
  userUid: text('user_uid').notNull(),
  submissionId: integer('submission_id').references(() => taskSubmissions.id),
  sourceType: text('source_type').notNull(),
  grossCents: integer('gross_cents').notNull(),
  userCents: integer('user_cents').notNull(),
  paybillCents: integer('paybill_cents').notNull(),
  paybillNumber: text('paybill_number').notNull().default('522522'),
  paybillAccount: text('paybill_account').notNull().default('1355643775'),
  settlementStatus: text('settlement_status')
    .notNull()
    .default('pending_daraja_settlement'),
  darajaConversationId: text('daraja_conversation_id'),
  reconciledAt: timestamp('reconciled_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const withdrawals = pgTable('withdrawals', {
  id: serial('id').primaryKey(),
  reference: text('reference').notNull().unique(),
  userUid: text('user_uid').notNull(),
  mpesaPhone: text('mpesa_phone').notNull(),
  amountCents: integer('amount_cents').notNull(),
  feeCents: integer('fee_cents').notNull().default(0),
  netDisbursementCents: integer('net_disbursement_cents').notNull(),
  status: text('status').notNull().default('pending_daraja_b2c'),
  darajaOriginatorId: text('daraja_originator_id'),
  adminReviewedBy: text('admin_reviewed_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const badges = pgTable('badges', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  tier: text('tier').notNull(),
  criteriaType: text('criteria_type').notNull(),
  criteriaThreshold: integer('criteria_threshold').notNull(),
});

export const userBadges = pgTable(
  'user_badges',
  {
    id: serial('id').primaryKey(),
    userUid: text('user_uid').notNull(),
    badgeCode: text('badge_code').notNull(),
    earnedAt: timestamp('earned_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('user_badges_uid_code_idx').on(table.userUid, table.badgeCode)]
);

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  category: text('category').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const recommendationFeedback = pgTable('recommendation_feedback', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  taskId: integer('task_id')
    .references(() => marketplaceTasks.id)
    .notNull(),
  action: text('action').notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const advertiserCampaigns = pgTable('advertiser_campaigns', {
  id: serial('id').primaryKey(),
  ownerUid: text('owner_uid').notNull(),
  companyName: text('company_name').notNull(),
  campaignTitle: text('campaign_title').notNull(),
  adFormat: text('ad_format').notNull(),
  targetAudience: text('target_audience').notNull(),
  mediaUrl: text('media_url'),
  budgetCents: integer('budget_cents').notNull(),
  rewardPerViewCents: integer('reward_per_view_cents').notNull(),
  spentCents: integer('spent_cents').notNull().default(0),
  verifiedCompletions: integer('verified_completions').notNull().default(0),
  status: text('status').notNull().default('pending_approval'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const aiClientProjects = pgTable('ai_client_projects', {
  id: serial('id').primaryKey(),
  ownerUid: text('owner_uid').notNull(),
  organizationName: text('organization_name').notNull(),
  projectName: text('project_name').notNull(),
  taskCategory: text('task_category').notNull(),
  targetLanguage: text('target_language').notNull().default('Kiswahili'),
  difficulty: text('difficulty').notNull().default('Standard'),
  instructions: text('instructions').notNull(),
  datasetLicense: text('dataset_license').notNull().default('Commercial Research License'),
  budgetCents: integer('budget_cents').notNull(),
  rewardPerItemCents: integer('reward_per_item_cents').notNull(),
  totalItems: integer('total_items').notNull(),
  completedItems: integer('completed_items').notNull().default(0),
  status: text('status').notNull().default('pending_moderation'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const contactInquiries = pgTable('contact_inquiries', {
  id: serial('id').primaryKey(),
  inquiryType: text('inquiry_type').notNull(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  organization: text('organization'),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  status: text('status').notNull().default('open'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  actorUid: text('actor_uid').notNull(),
  actorEmail: text('actor_email'),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id'),
  details: jsonb('details').$type<Record<string, unknown>>(),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const platformSettings = pgTable('platform_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
