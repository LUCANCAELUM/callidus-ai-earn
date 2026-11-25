import { GoogleGenAI, Type } from '@google/genai';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  marketplaceTasks,
  recommendationFeedback,
  taskSubmissions,
  users,
} from '../db/schema.ts';

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

export interface RecommendedTaskResult {
  task: typeof marketplaceTasks.$inferSelect;
  matchScore: number;
  reason: string;
  aiPowered: boolean;
}

export async function getAdaptiveTaskRecommendations(
  userUid: string
): Promise<RecommendedTaskResult[]> {
  try {
    const [userRows, activeTasks, submissions, feedbackRows] = await Promise.all([
      db.select().from(users).where(eq(users.uid, userUid)).limit(1),
      db
        .select()
        .from(marketplaceTasks)
        .where(eq(marketplaceTasks.status, 'active'))
        .orderBy(desc(marketplaceTasks.grossRewardCents)),
      db
        .select()
        .from(taskSubmissions)
        .where(eq(taskSubmissions.userUid, userUid))
        .orderBy(desc(taskSubmissions.createdAt))
        .limit(40),
      db
        .select()
        .from(recommendationFeedback)
        .where(eq(recommendationFeedback.userUid, userUid))
        .orderBy(desc(recommendationFeedback.createdAt))
        .limit(50),
    ]);

    const user = userRows[0];
    const completedTaskIds = new Set(submissions.map((s) => s.taskId));
    const dismissedTaskIds = new Set(
      feedbackRows
        .filter((f) => f.action === 'dismissed' || f.action === 'thumbs_down')
        .map((f) => f.taskId)
    );
    const boostedTaskIds = new Set(
      feedbackRows
        .filter((f) => f.action === 'thumbs_up' || f.action === 'clicked')
        .map((f) => f.taskId)
    );

    const deptCounts: Record<string, number> = {};
    for (const s of submissions) {
      deptCounts[s.department] = (deptCounts[s.department] || 0) + 1;
    }

    const prefLangs = new Set(user?.preferredLanguages || ['English', 'Kiswahili']);
    const prefDepts = new Set(
      user?.preferredDepartments || ['ai_training', 'voice_intelligence']
    );

    const candidateTasks = activeTasks.filter((t) => !dismissedTaskIds.has(t.id));

    // Deterministic behavioral baseline scoring (fast & reliable)
    const baselineScored = candidateTasks.map((task) => {
      let score = 60;
      if (prefLangs.has(task.language)) score += 14;
      if (prefDepts.has(task.department)) score += 12;
      if ((deptCounts[task.department] || 0) > 0) score += 8;
      if (boostedTaskIds.has(task.id)) score += 10;
      if (!completedTaskIds.has(task.id)) score += 6;
      const ratePerMin = task.grossRewardCents / Math.max(1, task.estimatedMinutes);
      score += Math.min(10, Math.round(ratePerMin / 500));
      score = Math.min(99, Math.max(40, score));

      const reasons: string[] = [];
      if (prefLangs.has(task.language)) reasons.push(`matches ${task.language} fluency`);
      if (prefDepts.has(task.department)) reasons.push(`aligned with preferred track`);
      if (boostedTaskIds.has(task.id)) reasons.push(`boosted by your feedback`);
      if (reasons.length === 0) {
        reasons.push(
          `high yield KSh ${((task.grossRewardCents * 0.8) / 100).toFixed(0)} net per ${task.estimatedMinutes} min`
        );
      }

      return {
        task,
        matchScore: score,
        reason: `Recommended because it ${reasons.join(' and ')}.`,
        aiPowered: false,
      };
    });

    baselineScored.sort((a, b) => b.matchScore - a.matchScore);
    const topCandidates = baselineScored.slice(0, 6);

    // Enrich top candidates using Gemini 4 Hydrogen when GEMINI_API_KEY is available
    if (ai && topCandidates.length > 0 && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
      try {
        const profileContext = {
          preferredLanguages: Array.from(prefLangs),
          preferredDepartments: Array.from(prefDepts),
          completedCount: user?.tasksCompletedCount || 0,
          qualityScorePct: user?.qualityScorePct || 100,
          departmentHistory: deptCounts,
          feedbackSignals: feedbackRows.slice(0, 12).map((f) => ({
            taskId: f.taskId,
            action: f.action,
          })),
        };

        const taskSummaries = topCandidates.map((c) => ({
          id: c.task.id,
          title: c.task.title,
          department: c.task.department,
          language: c.task.language,
          difficulty: c.task.difficulty,
          netKsh: Math.round((c.task.grossRewardCents * 0.8) / 100),
          estimatedMinutes: c.task.estimatedMinutes,
        }));

        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Rank and personalize these earning tasks for a Kenyan Callidus Earn AI contributor based on their performance and feedback history. Return concise, concrete 1-sentence explanations.\nUser profile: ${JSON.stringify(profileContext)}\nTasks: ${JSON.stringify(taskSummaries)}`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  taskId: { type: Type.INTEGER },
                  matchScore: { type: Type.INTEGER },
                  reason: { type: Type.STRING },
                },
              },
            },
          },
        });

        const parsed = JSON.parse((response.text ?? '[]').trim()) as Array<{
          taskId: number;
          matchScore: number;
          reason: string;
        }>;
        const aiMap = new Map(parsed.map((p) => [p.taskId, p]));

        const enriched = topCandidates.map((item) => {
          const aiRec = aiMap.get(item.task.id);
          if (!aiRec) return item;
          return {
            task: item.task,
            matchScore: Math.min(99, Math.max(50, aiRec.matchScore || item.matchScore)),
            reason: aiRec.reason || item.reason,
            aiPowered: true,
          };
        });
        enriched.sort((a, b) => b.matchScore - a.matchScore);
        return enriched.slice(0, 4);
      } catch (geminiError) {
        console.warn('Gemini recommender fallback to behavioral scoring:', geminiError);
      }
    }

    return topCandidates.slice(0, 4);
  } catch (error) {
    console.error('Recommender error:', error);
    throw new Error('Failed to generate task recommendations.', { cause: error });
  }
}
