import { GoogleGenAI } from "@google/genai";

const ALLOWED_MODELS = new Set([
  "gemini-3-flash-preview",
  "gemini-3.1-pro-preview",
]);

const MIME_TYPE_REGEX = /^(audio|video)\/[a-zA-Z0-9.+-]+$/;

export class GeminiRequestError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = "GeminiRequestError";
    this.statusCode = statusCode;
  }
}

let cachedClient: GoogleGenAI | null = null;
let cachedApiKey: string | undefined;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new GeminiRequestError(
      "Gemini API key is not configured on the server. Please check Settings > Secrets.",
      500
    );
  }

  if (!cachedClient || cachedApiKey !== apiKey) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
    cachedApiKey = apiKey;
  }

  return cachedClient;
}

export interface TranscribeAudioParams {
  base64Data: unknown;
  mimeType?: unknown;
  modelName?: unknown;
  duration?: unknown;
}

function isTransientError(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  if (status === 429 || status === 503 || status === 504) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /UNAVAILABLE|DEADLINE_EXCEEDED|temporarily unavailable|ECONNRESET|ETIMEDOUT/i.test(
    message
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function transcribeAudioToKhmerSrt(
  params: TranscribeAudioParams
): Promise<string> {
  const { base64Data, mimeType: rawMimeType, modelName: rawModel, duration: rawDuration } = params;

  if (typeof base64Data !== "string" || base64Data.trim().length === 0) {
    throw new GeminiRequestError("Missing or invalid audio data.", 400);
  }

  const resolvedModel =
    typeof rawModel === "string" && rawModel.trim().length > 0
      ? rawModel.trim()
      : "gemini-3-flash-preview";

  if (!ALLOWED_MODELS.has(resolvedModel)) {
    throw new GeminiRequestError(`Unsupported model: ${resolvedModel}`, 400);
  }

  const resolvedMimeType =
    typeof rawMimeType === "string" && rawMimeType.trim().length > 0
      ? rawMimeType.trim()
      : "audio/mpeg";

  if (!MIME_TYPE_REGEX.test(resolvedMimeType)) {
    throw new GeminiRequestError("Unsupported media MIME type.", 400);
  }

  let resolvedDuration: number | undefined;
  if (rawDuration !== undefined && rawDuration !== null) {
    if (
      typeof rawDuration !== "number" ||
      !Number.isFinite(rawDuration) ||
      rawDuration < 0
    ) {
      throw new GeminiRequestError("Invalid audio duration.", 400);
    }
    resolvedDuration = rawDuration;
  }

  const durationText =
    resolvedDuration && resolvedDuration > 0
      ? `The total duration of this audio is approximately ${Math.floor(resolvedDuration / 60)} minutes and ${Math.floor(resolvedDuration % 60)} seconds (${resolvedDuration.toFixed(2)} seconds).`
      : "";

  const ai = getGeminiClient();

  const requestParams = {
    model: resolvedModel,
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: resolvedMimeType,
            },
          },
          {
            text: `You are a professional subtitle editor specializing in cinema-grade SRT generation.
Your task is to transcribe, translate, and time-sync the provided audio file into Khmer subtitles.

${durationText}

OUTPUT FORMAT: Standard SRT file ONLY. (Index, Timestamp --> Timestamp, Text)

CRITICAL INSTRUCTIONS:

1. NANO-PRECISION TIMING & SYNCHRONIZATION:
- DO NOT use fixed intervals or arbitrary splitting.
- ALIGN based on actual speech waveform analysis at a WORD-LEVEL granularity.
- DETECT precise speech start and speech end moments with sub-second accuracy (target error < 100ms).
- **TIMESTAMP FORMAT**: Use STRICT Standard SRT format: 'HH:MM:SS,mmm' (e.g., 00:00:05,230). 
- **CRITICAL: NO SCALING ERRORS**: DO NOT convert seconds into minutes. 10 seconds is 00:00:10,000, NOT 00:10:00,000. 
- **UNIT CALIBRATION**: Ensure 1 second in the transcript corresponds to exactly 1 second in the playback.
- **ABSOLUTE TIME**: Timestamps represent the absolute elapsed time from the very beginning of the audio (00:00:00,000).
- SILENCE DETECTION: Use natural pauses and sentence breaks to split segments.
- **PHRASE-LEVEL SYNC**: Ensure a new subtitle appears exactly at the onset of the first word and disappears immediately after the last word of the phrase.
- **GAP PREVENTION**: If speech is continuous or pauses are short, DO NOT leave gaps between subtitles.
- BUFFER ADJUSTMENT: 
  * Set Start Time slightly earlier (approx. -0.1s before speech starts).
  * Set End Time slightly later (approx. +0.1s after speech ends).
- No overlapping subtitles unless multiple speakers are talking simultaneously.

2. SPEECH SEGMENTATION & READABILITY:
- Group text by phrase meaning and semantic flow, not fixed seconds.
- Each subtitle block must represent a complete idea or phrase.
- MAXIMUM 1-2 lines per block.
- AVOID cutting sentences in unnatural positions.
- Ensure reading flow matches the emotional pacing of the speech.

3. KHMER TRANSLATION & LINGUISTIC QUALITY:
- Translate into natural, fluent, and conversational Khmer suitable for drama or movie content.
- **KHMER SEGMENTATION**: Since Khmer doesn't use spaces between words, ensure that subtitle lines are broken at natural phrasal boundaries.
- AVOID literal word-by-word translation. 
- Use context-aware Khmer that sounds like real people talking.
- Preserve the tone, emotion, and intensity of the original speech.

              4. ACCURACY & CONTENT COMPLETENESS (EXTREME ZERO-LOSS POLICY):
              - **VERBATIM TRANSCRIPTION**: You MUST transcribe EVERY SINGLE word, sound, and syllable spoken. Do not summarize, do not clean up "ums" or "ahs", and do not omit anything.
              - **FAST SPEECH HANDLING**: Even if the speaker is talking very rapidly or mumbling, you MUST use deep analysis to extract the literal words. 
              - **NOISE HANDLING**: Listen through background music, wind, or low-quality recording artifacts. Focus intensely on human vocal frequencies. If speech is audible at all, it MUST be extracted word-for-word.
              - **ACCURACY**: Every spoken sentence in the audio, regardless of speed or volume, MUST be accurately translated into natural, high-fidelity Khmer.
              - **CRITICAL AUDIO COVERAGE**: You MUST process the audio from 00:00:00,000 until the absolute last millisecond.
              - **NO GAPS IN COVERAGE**: Analyze the audio stream continuously. If the user complains about missing content, it is because you stopped listening. STAY ENGAGED with the audio until the very end.
              - **CONTENT INTEGRITY**: Do not remove words or change the meaning. The final Khmer output must be a 100% faithful representation of the original audio's contents for TTS reuse.

5. FINAL OUTPUT RULES:
- Output ONLY the raw SRT text.
- Do not include any other text, warnings, or explanations.`,
          },
        ],
      },
    ],
    config: {
      temperature: 0.0,
      maxOutputTokens: 8192,
    },
  };

  let response;
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      response = await ai.models.generateContent(requestParams);
      break;
    } catch (error) {
      if (attempt < maxAttempts && isTransientError(error)) {
        await delay(attempt * 1000);
        continue;
      }
      throw error;
    }
  }

  let srtContent = response?.text;
  if (!srtContent) {
    throw new GeminiRequestError("No subtitle content generated", 502);
  }

  srtContent = srtContent.trim();

  // Basic validation to check for common hallucination errors
  if (resolvedDuration && resolvedDuration > 0) {
    const timestampRegex = /(\d{2}):(\d{2}):(\d{2}),(\d{3})/g;
    const timestamps = srtContent.match(timestampRegex);

    if (timestamps && timestamps.length > 0) {
      const lastTimestamp = timestamps[timestamps.length - 1];
      const parts = lastTimestamp.split(":");
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const s_ms = parts[2].split(",");
      const s = parseInt(s_ms[0], 10);
      const ms = parseInt(s_ms[1], 10);
      const srtDuration = h * 3600 + m * 60 + s + ms / 1000;

      // If generated SRT is way longer than audio duration (e.g. 5s audio becomes 5m srt)
      // We detect the "seconds-to-minutes" shift.
      if (srtDuration > resolvedDuration * 10 && h === 0 && m > 0 && s === 0) {
        console.warn(
          "Detected possible scaling error (seconds -> minutes). Attempting to auto-fix timestamps..."
        );

        srtContent = srtContent.replace(timestampRegex, (match) => {
          const [hh, mm, ss_ms] = match.split(":");
          const [ss, mmm] = ss_ms.split(",");

          // If HH:MM:SS,mmm was generated as 00:05:00,000 for 5 seconds
          // We shift mm into ss
          const hours = parseInt(hh, 10);
          const minutes = parseInt(mm, 10);
          const seconds = parseInt(ss, 10);

          if (hours === 0 && minutes > 0 && seconds === 0) {
            const newSeconds = minutes.toString().padStart(2, "0");
            return `00:00:${newSeconds},${mmm}`;
          }
          return match;
        });
      } else if (srtDuration > resolvedDuration * 1.5) {
        console.warn(
          `Suspicious SRT duration detected: ${srtDuration}s for ${resolvedDuration}s audio.`
        );
      }
    }
  }

  return srtContent;
}
