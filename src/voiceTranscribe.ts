/**
 * Voice transcription via Groq Whisper.
 *
 * Telegram delivers voice messages as `.ogg` Opus blobs. Groq's Whisper API
 * accepts most common audio containers; ogg works out of the box.
 */

import Groq, { toFile } from 'groq-sdk';
import { config } from './config.js';
import { log } from './logger.js';

export interface TranscriptionSuccess {
  ok: true;
  text: string;
}

export interface TranscriptionFailure {
  ok: false;
  reason: 'no_groq' | 'too_long' | 'too_big' | 'empty' | 'error';
  message?: string;
}

export type TranscriptionResult = TranscriptionSuccess | TranscriptionFailure;

let groq: Groq | null = null;
function getGroq(): Groq | null {
  if (!config.hasGroq()) return null;
  if (!groq) groq = new Groq({ apiKey: config.groqApiKey });
  return groq;
}

export interface TranscribeOpts {
  /** Raw audio bytes from Telegram's `getFile` download. */
  audio: Buffer;
  /** Original duration from Telegram in seconds, if known. Enforces a budget. */
  durationSec?: number;
  /** Original mime / extension hint — defaults to `ogg`. */
  filename?: string;
  /** Language hint passed to Whisper for better accuracy (default `ru`). */
  language?: string;
}

export async function transcribeVoice(opts: TranscribeOpts): Promise<TranscriptionResult> {
  const client = getGroq();
  if (!client) {
    return { ok: false, reason: 'no_groq', message: 'GROQ_API_KEY не настроен' };
  }
  if (opts.audio.length === 0) {
    return { ok: false, reason: 'empty' };
  }
  if (opts.audio.length > config.voiceMaxBytes) {
    return { ok: false, reason: 'too_big' };
  }
  if (opts.durationSec != null && opts.durationSec > config.voiceMaxSeconds) {
    return { ok: false, reason: 'too_long' };
  }

  try {
    const filename = opts.filename ?? 'voice.ogg';
    const file = await toFile(opts.audio, filename);
    const res = await client.audio.transcriptions.create({
      file,
      model: config.groqWhisperModel,
      language: opts.language ?? 'ru',
      response_format: 'json',
      // Lower temperature → less hallucination on short voice notes.
      temperature: 0,
    });
    const text = ((res as { text?: string }).text ?? '').trim();
    if (!text) {
      return { ok: false, reason: 'empty' };
    }
    return { ok: true, text };
  } catch (err) {
    log.error('whisper transcription failed', err);
    return { ok: false, reason: 'error', message: 'ошибка распознавания речи' };
  }
}
