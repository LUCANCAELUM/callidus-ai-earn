import React, { useRef, useState } from 'react';
import { CheckCircle2, Mic, Square, X } from 'lucide-react';
import { DEPARTMENT_LABELS, formatKes } from '../lib/format.ts';

export interface MarketplaceTaskItem {
  id: number;
  slug: string;
  department: string;
  taskType: string;
  title: string;
  description: string;
  instructions: string;
  language: string;
  difficulty: string;
  estimatedMinutes: number;
  grossRewardCents: number;
  eligibilityRequirement: string;
  organizationName: string;
  payload: Record<string, unknown>;
  splitPreview: { grossCents: number; userCents: number; paybillCents: number };
  userCompleted?: boolean;
}

interface TaskWorkbenchProps {
  task: MarketplaceTaskItem;
  accepted8020Terms: boolean;
  onAccept8020Terms: () => Promise<void>;
  onClose: () => void;
  onSubmit: (
    taskId: number,
    payload: Record<string, unknown>,
    voiceConsentAccepted: boolean
  ) => Promise<void>;
}

const VOICE_LANGUAGES = [
  'English',
  'Kiswahili',
  'Sheng',
  'Dholuo',
  'Kikuyu',
  'Kalenjin',
  'Luhya',
  'Somali',
  'Maasai',
];

export const TaskWorkbench: React.FC<TaskWorkbenchProps> = ({
  task,
  accepted8020Terms,
  onAccept8020Terms,
  onClose,
  onSubmit,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rewarded ad state
  const [selectedOption, setSelectedOption] = useState('');

  // Bounding box / AI Training state
  const [boxCoords, setBoxCoords] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null
  );
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const imgContainerRef = useRef<HTMLDivElement | null>(null);
  const [selectedClass, setSelectedClass] = useState('');
  const [sentimentChoice, setSentimentChoice] = useState('');
  const [mpesaReversalNeeded, setMpesaReversalNeeded] = useState('yes');

  // Voice intelligence state
  const [voiceLanguage, setVoiceLanguage] = useState(task.language || 'Kiswahili');
  const [voiceConsent, setVoiceConsent] = useState(false);
  const [transcriptionText, setTranscriptionText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);

  // AI evaluation state
  const [preferredModel, setPreferredModel] = useState<'A' | 'B'>('A');
  const [hallucinationFound, setHallucinationFound] = useState('yes');
  const [accuracyRating, setAccuracyRating] = useState(5);
  const [rationale, setRationale] = useState('');

  // Market research survey state
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, string>>({});

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      setError('Microphone permission unavailable in this browser; enter your phonetic transcription below to submit.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleBoxPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = imgContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    setDragStart({ x, y });
    setBoxCoords({ x, y, w: 0, h: 0 });
  };

  const handleBoxPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart || !imgContainerRef.current) return;
    const rect = imgContainerRef.current.getBoundingClientRect();
    const curX = Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
    const curY = Math.max(0, Math.min(100, Math.round(((e.clientY - rect.top) / rect.height) * 100)));
    setBoxCoords({
      x: Math.min(dragStart.x, curX),
      y: Math.min(dragStart.y, curY),
      w: Math.abs(curX - dragStart.x),
      h: Math.abs(curY - dragStart.y),
    });
  };

  const handleBoxPointerUp = () => {
    setDragStart(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!accepted8020Terms) {
      setError('Accept the 80/20 Earnings Allocation Agreement first.');
      return;
    }

    let responsePayload: Record<string, unknown> = {};
    if (task.department === 'rewarded_ads') {
      if (!selectedOption) {
        setError('Select the verification option to confirm campaign completion.');
        return;
      }
      responsePayload = { selectedOption, watchedConfirmed: true };
    } else if (task.department === 'ai_training') {
      if (task.taskType === 'bounding_box') {
        if (!boxCoords || boxCoords.w < 4 || !selectedClass) {
          setError('Draw a bounding box on the image and choose an object category.');
          return;
        }
        responsePayload = { boundingBoxPct: boxCoords, objectClass: selectedClass };
      } else {
        if (!sentimentChoice) {
          setError('Select the sentiment classification.');
          return;
        }
        responsePayload = { sentimentChoice, mpesaReversalNeeded };
      }
    } else if (task.department === 'voice_intelligence') {
      if (!voiceConsent) {
        setError('Explicit consent for voice recording, storage, and licensing is required.');
        return;
      }
      if (!audioUrl && transcriptionText.trim().length < 8) {
        setError('Record audio using the microphone or provide a complete transcription check.');
        return;
      }
      responsePayload = {
        voiceLanguage,
        recordedSeconds: recordingSeconds,
        hasAudioSample: Boolean(audioUrl),
        transcriptionText: transcriptionText.trim(),
      };
    } else if (task.department === 'ai_evaluation') {
      if (rationale.trim().length < 10) {
        setError('Provide a short factual rationale (at least 10 characters).');
        return;
      }
      responsePayload = {
        preferredModel,
        hallucinationFound,
        accuracyRating,
        rationale: rationale.trim(),
      };
    } else if (task.department === 'market_research') {
      const questions = (task.payload.questions as Array<{ id: string }>) || [];
      if (questions.some((q) => !surveyAnswers[q.id])) {
        setError('Answer all survey questions before submitting.');
        return;
      }
      responsePayload = { surveyAnswers };
    } else {
      responsePayload = { notes: rationale || 'Completed' };
    }

    setSubmitting(true);
    try {
      await onSubmit(task.id, responsePayload, voiceConsent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const dialectSamples = (task.payload.dialectSamples as Record<string, string>) || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/15 bg-[#0B1118] p-6 text-slate-100 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="text-xs text-emerald-400">
              {DEPARTMENT_LABELS[task.department] || task.department} · {task.organizationName}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">{task.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Reward & 80/20 Breakdown */}
        <div className="mt-4 grid grid-cols-3 gap-3 rounded-xl border border-white/10 bg-[#05070A] p-4 text-xs">
          <div>
            <span className="text-slate-400">Gross Reward</span>
            <p className="mt-1 font-mono text-sm font-semibold text-white tabular-nums">
              {formatKes(task.grossRewardCents)}
            </p>
          </div>
          <div>
            <span className="text-slate-400">Your 80% Share</span>
            <p className="mt-1 font-mono text-sm font-semibold text-emerald-400 tabular-nums">
              {formatKes(task.splitPreview.userCents)}
            </p>
          </div>
          <div>
            <span className="text-slate-400">20% Paybill 522522</span>
            <p className="mt-1 font-mono text-sm font-semibold text-cyan-400 tabular-nums">
              {formatKes(task.splitPreview.paybillCents)}
            </p>
          </div>
        </div>

        <div className="mt-4 text-sm text-slate-300">
          <p className="font-medium text-white">Task Instructions</p>
          <p className="mt-1 leading-relaxed">{task.instructions}</p>
        </div>

        {!accepted8020Terms && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
            <span>
              Accept the 80/20 Earnings Allocation Agreement (80% User / 20% Paybill 522522 Acc
              1355643775) to earn rewards.
            </span>
            <button
              type="button"
              onClick={onAccept8020Terms}
              className="rounded-lg bg-amber-400 px-3 py-1.5 font-semibold text-slate-950 hover:bg-amber-300"
            >
              Accept 80/20 Terms
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* DEPARTMENT A: REWARDED ADS */}
          {task.department === 'rewarded_ads' && (
            <div className="space-y-4 rounded-xl border border-white/10 bg-[#05070A] p-5">
              <p className="text-xs font-medium text-cyan-400">Sponsored Campaign Brief</p>
              <p className="text-sm text-slate-200">{String(task.payload.brandHighlight || '')}</p>
              <div>
                <p className="text-xs font-medium text-white">
                  {String(task.payload.verificationQuestion || 'Confirm campaign details')}
                </p>
                <div className="mt-2.5 space-y-2">
                  {((task.payload.options as string[]) || []).map((opt) => (
                    <label
                      key={opt}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-[#0B1118] px-3.5 py-2.5 text-sm hover:border-emerald-500/40"
                    >
                      <input
                        type="radio"
                        name="adOption"
                        checked={selectedOption === opt}
                        onChange={() => setSelectedOption(opt)}
                        className="accent-emerald-500"
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* DEPARTMENT B: AI TRAINING */}
          {task.department === 'ai_training' && task.taskType === 'bounding_box' && (
            <div className="space-y-4">
              <div
                ref={imgContainerRef}
                onPointerDown={handleBoxPointerDown}
                onPointerMove={handleBoxPointerMove}
                onPointerUp={handleBoxPointerUp}
                className="relative cursor-crosshair select-none overflow-hidden rounded-xl border border-white/15 bg-black"
              >
                <img
                  src={String(task.payload.imageUrl || '/src/assets/images/dept_ai_vision_1795098094620.jpg')}
                  alt="Computer vision bounding box target"
                  draggable={false}
                  referrerPolicy="no-referrer"
                  className="h-64 w-full object-cover"
                />
                {boxCoords && boxCoords.w > 0 && (
                  <div
                    style={{
                      left: `${boxCoords.x}%`,
                      top: `${boxCoords.y}%`,
                      width: `${boxCoords.w}%`,
                      height: `${boxCoords.h}%`,
                    }}
                    className="pointer-events-none absolute border-2 border-emerald-400 bg-emerald-400/15"
                  />
                )}
              </div>
              <p className="font-mono text-xs text-slate-400">
                {boxCoords
                  ? `Box Coordinates: x=${boxCoords.x}% y=${boxCoords.y}% w=${boxCoords.w}% h=${boxCoords.h}%`
                  : 'Click and drag across the image above to draw a bounding box.'}
              </p>
              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Primary Object Category
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {((task.payload.targetClasses as string[]) || []).map((cls) => (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => setSelectedClass(cls)}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                        selectedClass === cls
                          ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                          : 'border-white/10 bg-[#05070A] text-slate-300'
                      }`}
                    >
                      {cls}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {task.department === 'ai_training' && task.taskType !== 'bounding_box' && (
            <div className="space-y-4 rounded-xl border border-white/10 bg-[#05070A] p-5">
              <p className="text-xs text-slate-400">Sample Text</p>
              <p className="rounded-lg border border-white/10 bg-[#0B1118] p-3.5 text-sm italic text-slate-200">
                {String(task.payload.sampleText || task.instructions)}
              </p>
              <div className="space-y-2">
                {((task.payload.sentiments as string[]) || ['Accurate / Positive', 'Needs Review', 'Negative']).map((s) => (
                  <label
                    key={s}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-[#0B1118] px-3.5 py-2.5 text-sm"
                  >
                    <input
                      type="radio"
                      name="sentiment"
                      checked={sentimentChoice === s}
                      onChange={() => setSentimentChoice(s)}
                      className="accent-emerald-500"
                    />
                    <span>{s}</span>
                  </label>
                ))}
              </div>
              <label className="block text-xs text-slate-300">
                Escalation Flag
                <select
                  value={mpesaReversalNeeded}
                  onChange={(e) => setMpesaReversalNeeded(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#0B1118] px-3 py-2 text-sm text-white"
                >
                  <option value="yes">Requires M-PESA / Delivery Escalation</option>
                  <option value="no">Standard Inquiry</option>
                </select>
              </label>
            </div>
          )}

          {/* DEPARTMENT C: AFRICAN VOICE INTELLIGENCE */}
          {task.department === 'voice_intelligence' && (
            <div className="space-y-4 rounded-xl border border-white/10 bg-[#05070A] p-5">
              <div>
                <label className="block text-xs font-medium text-slate-300">Select Language</label>
                <select
                  value={voiceLanguage}
                  onChange={(e) => setVoiceLanguage(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#0B1118] px-3 py-2 text-sm text-white"
                >
                  {VOICE_LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-lg border border-white/10 bg-[#0B1118] p-4">
                <p className="text-xs text-cyan-400">Prompt Script ({voiceLanguage})</p>
                <p className="mt-1.5 text-sm font-medium text-white">
                  {dialectSamples[voiceLanguage] || String(task.payload.promptScript || '')}
                </p>
                {Boolean(task.payload.englishGloss) && (
                  <p className="mt-1 text-xs text-slate-400">
                    Gloss: {String(task.payload.englishGloss)}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                  >
                    <Mic className="h-4 w-4" />
                    Record Voice Sample
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-400"
                  >
                    <Square className="h-3.5 w-3.5" />
                    Stop Recording ({recordingSeconds}s)
                  </button>
                )}
                {audioUrl && <audio controls src={audioUrl} className="h-8 max-w-full" />}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Phonetic Transcription Verification
                </label>
                <textarea
                  rows={2}
                  value={transcriptionText}
                  onChange={(e) => setTranscriptionText(e.target.value)}
                  placeholder="Type the spoken phrase in your selected language..."
                  className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#0B1118] px-3 py-2 text-sm text-white"
                />
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3.5 text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={voiceConsent}
                  onChange={(e) => setVoiceConsent(e.target.checked)}
                  className="mt-0.5 accent-emerald-500"
                />
                <span>
                  I grant explicit consent for Callidus Earn AI to record, store, verify, and
                  license this voice contribution for AI speech research in compliance with the
                  Kenya Data Protection Act.
                </span>
              </label>
            </div>
          )}

          {/* DEPARTMENT D: AI EVALUATION */}
          {task.department === 'ai_evaluation' && (
            <div className="space-y-4 rounded-xl border border-white/10 bg-[#05070A] p-5">
              <div>
                <p className="text-xs text-slate-400">Evaluation Prompt</p>
                <p className="mt-1 text-sm font-medium text-white">
                  {String(task.payload.userPrompt || task.instructions)}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPreferredModel('A')}
                  className={`rounded-xl border p-4 text-left text-xs leading-relaxed ${
                    preferredModel === 'A'
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-white/10 bg-[#0B1118]'
                  }`}
                >
                  <span className="font-semibold text-emerald-400">Model Response A</span>
                  <p className="mt-2 text-slate-200">{String(task.payload.responseA || '')}</p>
                </button>
                <button
                  type="button"
                  onClick={() => setPreferredModel('B')}
                  className={`rounded-xl border p-4 text-left text-xs leading-relaxed ${
                    preferredModel === 'B'
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-white/10 bg-[#0B1118]'
                  }`}
                >
                  <span className="font-semibold text-cyan-400">Model Response B</span>
                  <p className="mt-2 text-slate-200">{String(task.payload.responseB || '')}</p>
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs text-slate-300">
                  Hallucination Detected?
                  <select
                    value={hallucinationFound}
                    onChange={(e) => setHallucinationFound(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#0B1118] px-3 py-2 text-sm text-white"
                  >
                    <option value="yes">Yes — Fabricated claim identified</option>
                    <option value="no">No — Both outputs factually grounded</option>
                  </select>
                </label>
                <label className="block text-xs text-slate-300">
                  Preferred Model Factual Score (1–5)
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={accuracyRating}
                    onChange={(e) => setAccuracyRating(Number(e.target.value))}
                    className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#0B1118] px-3 py-2 text-sm text-white"
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs text-slate-300">
                  Evaluation Rationale (verified server-side)
                </label>
                <textarea
                  rows={3}
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  placeholder="Explain why the selected model is more accurate or identify the hallucinated claim..."
                  className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#0B1118] px-3 py-2 text-sm text-white"
                />
              </div>
            </div>
          )}

          {/* DEPARTMENT E: MARKET RESEARCH */}
          {task.department === 'market_research' && (
            <div className="space-y-4 rounded-xl border border-white/10 bg-[#05070A] p-5">
              {((task.payload.questions as Array<{ id: string; prompt: string; options: string[] }>) || []).map((q, idx) => (
                <div key={q.id} className="space-y-2">
                  <p className="text-xs font-medium text-white">
                    {idx + 1}. {q.prompt}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {q.options.map((opt) => (
                      <label
                        key={opt}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-white/10 bg-[#0B1118] px-3 py-2 text-xs"
                      >
                        <input
                          type="radio"
                          name={q.id}
                          checked={surveyAnswers[q.id] === opt}
                          onChange={() =>
                            setSurveyAnswers((prev) => ({ ...prev, [q.id]: opt }))
                          }
                          className="accent-emerald-500"
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-300">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/15 px-4 py-2 text-xs font-medium text-slate-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {submitting ? 'Verifying & Allocating...' : 'Submit for 80/20 Allocation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
