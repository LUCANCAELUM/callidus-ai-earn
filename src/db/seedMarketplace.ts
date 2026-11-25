import { count } from 'drizzle-orm';
import { db } from './index.ts';
import { marketplaceTasks, platformSettings } from './schema.ts';
import { ensureBadgesSeeded } from '../services/gamificationEngine.ts';

let seededOnce = false;

export const SEED_TASKS = [
  // Department A: Rewarded Advertising
  {
    slug: 'ad-safaricom-5g-router',
    department: 'rewarded_ads',
    taskType: 'video_ad',
    title: 'Safaricom 5G Home Broadband Launch Brief',
    description: 'Watch the 20-second product showcase and verify key fibre-alternative coverage details for Kenyan households.',
    instructions: 'View the sponsored product brief until completion, then answer the 1-question comprehension check to trigger verified reward allocation.',
    language: 'English',
    difficulty: 'Starter',
    estimatedMinutes: 2,
    grossRewardCents: 4500, // KSh 45.00
    eligibilityRequirement: 'Verified account & 80/20 agreement',
    organizationName: 'Kenya Fibre & Mobility Partners',
    totalSlots: 1200,
    completedSlots: 184,
    payload: {
      adFormat: 'video',
      durationSeconds: 20,
      brandHighlight: 'High-speed wireless broadband across Nairobi, Mombasa, Kisumu, and Nakuru.',
      verificationQuestion: 'Which connectivity tier is featured in this Kenyan household campaign?',
      options: ['5G Home Wireless Broadband', 'Dial-up Landline', 'Satellite Maritime Link'],
      correctOption: '5G Home Wireless Broadband',
    },
  },
  {
    slug: 'ad-kilimani-solar-microgrid',
    department: 'rewarded_ads',
    taskType: 'interactive_ad',
    title: 'SunGrid Kenya Pay-As-You-Go Solar Kit Showcase',
    description: 'Explore interactive solar battery specifications and provide brief consumer purchase-intent feedback.',
    instructions: 'Inspect all product specifications and submit your honest relevance rating.',
    language: 'Kiswahili',
    difficulty: 'Starter',
    estimatedMinutes: 2,
    grossRewardCents: 5000, // KSh 50.00
    eligibilityRequirement: 'Open to all verified Kenyan contributors',
    organizationName: 'SunGrid East Africa',
    totalSlots: 900,
    completedSlots: 92,
    payload: {
      adFormat: 'interactive',
      brandHighlight: 'Clean 300Wh lithium backup power payable daily via M-PESA.',
      verificationQuestion: 'How do households settle daily installments in this campaign?',
      options: ['M-PESA Paybill', 'International Wire Only', 'Paper Cheque'],
      correctOption: 'M-PESA Paybill',
    },
  },
  // Department B: AI Data Training
  {
    slug: 'ai-nairobi-matatu-bbox',
    department: 'ai_training',
    taskType: 'bounding_box',
    title: 'Nairobi Street Traffic & Matatu Object Identification',
    description: 'Draw and verify bounding boxes on East African street scenes to improve local autonomous safety vision models.',
    instructions: 'Inspect the Nairobi intersection image, click and drag to mark a bounding box around the primary vehicle/pedestrian zone, and classify the scene objects.',
    language: 'English',
    difficulty: 'Standard',
    estimatedMinutes: 4,
    grossRewardCents: 12000, // KSh 120.00
    eligibilityRequirement: 'Minimum 90% quality score',
    organizationName: 'Callidus Vision Lab',
    totalSlots: 600,
    completedSlots: 141,
    payload: {
      imageUrl: '/src/assets/images/dept_ai_vision_1795098094620.jpg',
      targetClasses: ['Public Transit Vehicle', 'Pedestrian Crossing', 'Traffic Signal', 'Motorcycle Boda'],
      promptQuestion: 'Identify the dominant hazard or transit object category visible in the annotated scene.',
    },
  },
  {
    slug: 'ai-sheng-commerce-sentiment',
    department: 'ai_training',
    taskType: 'sentiment',
    title: 'Kenyan E-Commerce Sentiment & Intent Classification',
    description: 'Classify real-world Kiswahili and Sheng customer support messages by sentiment and urgency.',
    instructions: 'Read the customer message carefully, select the accurate sentiment polarity, and specify whether M-PESA reversal support is needed.',
    language: 'Sheng',
    difficulty: 'Standard',
    estimatedMinutes: 3,
    grossRewardCents: 8500, // KSh 85.00
    eligibilityRequirement: 'Fluency in Kiswahili / Sheng',
    organizationName: 'Nairobi FinTech NLP',
    totalSlots: 1500,
    completedSlots: 410,
    payload: {
      sampleText: '"Maze parcel yangu ilikuwa ifike jana Westlands lakini bado sijapata SMS ya rider, na pesa ilishakatwa kwa M-PESA."',
      sentiments: ['Urgent Negative (Delivery + Payment)', 'Positive Feedback', 'Neutral Inquiry'],
    },
  },
  // Department C: African Voice Intelligence
  {
    slug: 'voice-kiswahili-sanifu-banking',
    department: 'voice_intelligence',
    taskType: 'voice_recording',
    title: 'Kiswahili Financial Voice Prompt Recording',
    description: 'Record clear natural Kiswahili audio for conversational banking assistants and verify pronunciation clarity.',
    instructions: 'Review the Data Licensing & Voice Consent notice, record the Kiswahili prompt clearly using your microphone (or upload WAV/WebM), and submit your transcription check.',
    language: 'Kiswahili',
    difficulty: 'Standard',
    estimatedMinutes: 4,
    grossRewardCents: 15000, // KSh 150.00
    eligibilityRequirement: 'Explicit voice recording & licensing consent required',
    organizationName: 'African Speech Consortium',
    totalSlots: 800,
    completedSlots: 205,
    payload: {
      promptScript: 'Habari, ningependa kuhakikisha salio langu la akaunti na kutuma shilingi elfu mbili kupitia M-PESA.',
      englishGloss: 'Hello, I would like to check my account balance and send two thousand shillings via M-PESA.',
      supportedLanguages: ['English', 'Kiswahili', 'Sheng', 'Dholuo', 'Kikuyu', 'Kalenjin', 'Luhya', 'Somali', 'Maasai'],
      requiresVoiceConsent: true,
    },
  },
  {
    slug: 'voice-multilingual-east-africa-clip',
    department: 'voice_intelligence',
    taskType: 'voice_recording',
    title: 'Multilingual East African Dialect Phonetics (Dholuo / Kikuyu / Kalenjin / Luhya / Somali / Maasai)',
    description: 'Contribute clean pronunciation samples and phonetic transcriptions for underrepresented African languages.',
    instructions: 'Select your fluent mother tongue from the supported list, accept the explicit voice data consent disclosure, and record or transcribe the greeting & agricultural query.',
    language: 'Dholuo',
    difficulty: 'Specialist',
    estimatedMinutes: 5,
    grossRewardCents: 20000, // KSh 200.00
    eligibilityRequirement: 'Native or fluent speaker + explicit voice licensing consent',
    organizationName: 'Callidus Voice Intelligence Lab',
    totalSlots: 1000,
    completedSlots: 118,
    payload: {
      promptScript: 'Select your language below and speak a 5-second weather & market price update in natural cadence.',
      dialectSamples: {
        Dholuo: 'Oyawore, koth chue maber e gwengwa kawuono.',
        Kikuyu: 'Wimwega, mbura niirauraga wega matuku maya.',
        Kalenjin: 'Chamgei, miten ropta ne kararan eng emetab raini.',
        Luhya: 'Mulembe, ifula yikwa bulayi mumbo.',
        Somali: 'Iska waran, roob wanaagsan ayaa maanta da’aya.',
        Maasai: 'Supa, etaa enchan sidai te nkop ang taata.',
        Sheng: 'Sasa fam, rada ya soko leo iko fiti mbaya.',
        Kiswahili: 'Habari za asubuhi, hali ya hewa leo ni nzuri kwa kilimo.',
        English: 'Good morning, local market demand and rainfall remain steady today.',
      },
      requiresVoiceConsent: true,
    },
  },
  // Department D: AI Evaluation
  {
    slug: 'eval-kenya-tax-rag-comparison',
    department: 'ai_evaluation',
    taskType: 'ai_comparison',
    title: 'AI Response Comparison & Hallucination Audit (Kenyan SME Finance)',
    description: 'Compare two AI-generated answers on Kenyan M-PESA business compliance and identify any factual hallucinations.',
    instructions: 'Read the user prompt and both Model A and Model B responses. Select the more accurate response, rate factual grounding, and flag any fabricated rules.',
    language: 'English',
    difficulty: 'Specialist',
    estimatedMinutes: 5,
    grossRewardCents: 18000, // KSh 180.00
    eligibilityRequirement: 'Verified analytical contributor',
    organizationName: 'Callidus Alignment Research',
    totalSlots: 450,
    completedSlots: 87,
    payload: {
      userPrompt: 'Explain how a Nairobi sole proprietor accepts customer payments via Lipa na M-PESA Paybill versus Till Number.',
      responseA: 'A Lipa na M-PESA Till Number (Buy Goods) lets customers pay directly with no account number prompt, whereas a Paybill requires both a Business Number and an Account Number to reconcile individual invoices or customer IDs.',
      responseB: 'In Kenya, Paybill numbers can only be used by international banks and automatically expire every 30 days unless renewed through county offices.',
    },
  },
  {
    slug: 'eval-kiswahili-translation-quality',
    department: 'ai_evaluation',
    taskType: 'ai_comparison',
    title: 'Educational Kiswahili Translation Accuracy Audit',
    description: 'Evaluate AI-translated secondary school biology explanations for natural Kiswahili grammar and scientific accuracy.',
    instructions: 'Compare the English source against the AI translation and score factual and linguistic accuracy.',
    language: 'Kiswahili',
    difficulty: 'Standard',
    estimatedMinutes: 4,
    grossRewardCents: 11000, // KSh 110.00
    eligibilityRequirement: 'Bilingual English & Kiswahili',
    organizationName: 'East Africa EdTech AI',
    totalSlots: 700,
    completedSlots: 164,
    payload: {
      userPrompt: 'Source: "Photosynthesis converts sunlight energy into chemical glucose inside plant chloroplasts." -> AI Translation: "Usanidinuru hubadilisha nishati ya mwanga wa jua kuwa glukosi ya kikemia ndani ya kloroplasti za mimea."',
      responseA: 'Accurate scientific terminology ("Usanidinuru", "kloroplasti") and natural Kiswahili grammar.',
      responseB: 'Literal machine-translated wording missing botanical terms.',
    },
  },
  // Department E: Market Research
  {
    slug: 'survey-kenya-digital-wallets-2026',
    department: 'market_research',
    taskType: 'survey',
    title: 'East Africa Digital Payments & Micro-Earning Survey',
    description: 'Share consumer insights on mobile money frequency, payout thresholds, and digital task preferences in Kenya.',
    instructions: 'Complete all 3 structured market research questions thoughtfully.',
    language: 'English',
    difficulty: 'Starter',
    estimatedMinutes: 3,
    grossRewardCents: 7500, // KSh 75.00
    eligibilityRequirement: 'Resident in Kenya or East Africa',
    organizationName: 'Nairobi FinTech Insights',
    totalSlots: 2000,
    completedSlots: 530,
    payload: {
      questions: [
        {
          id: 'q1',
          prompt: 'Which mobile settlement channel do you rely on most for online income?',
          options: ['M-PESA Direct', 'M-PESA to Bank', 'Airtel Money', 'Bank EFT'],
        },
        {
          id: 'q2',
          prompt: 'What minimum withdrawal threshold feels fairest for daily micro-task contributors?',
          options: ['KSh 100', 'KSh 250', 'KSh 500', 'KSh 1,000'],
        },
        {
          id: 'q3',
          prompt: 'Which AI contribution area interests you most?',
          options: ['African Voice Recording', 'AI Response Evaluation', 'Image Annotation', 'Rewarded Brand Campaigns'],
        },
      ],
    },
  },
];

export const DEFAULT_SETTINGS = [
  { key: 'min_withdrawal_cents', value: '10000' }, // KSh 100
  { key: 'withdrawal_fee_cents', value: '0' }, // KSh 0 platform fee
  { key: 'daily_withdrawal_limit_cents', value: '15000000' }, // KSh 150,000
  { key: 'daraja_mode', value: 'pending_credentials' },
  { key: 'paybill_number', value: '522522' },
  { key: 'paybill_account', value: '1355643775' },
];

export async function ensureSeeded() {
  if (seededOnce) return;
  try {
    await ensureBadgesSeeded();

    for (const setting of DEFAULT_SETTINGS) {
      await db
        .insert(platformSettings)
        .values(setting)
        .onConflictDoNothing({ target: platformSettings.key });
    }

    const [{ value: taskCount }] = await db
      .select({ value: count() })
      .from(marketplaceTasks);

    if (Number(taskCount) === 0) {
      for (const task of SEED_TASKS) {
        await db
          .insert(marketplaceTasks)
          .values(task)
          .onConflictDoNothing({ target: marketplaceTasks.slug });
      }
    }
    seededOnce = true;
  } catch (error) {
    console.error('Lazy seed error:', error);
  }
}
