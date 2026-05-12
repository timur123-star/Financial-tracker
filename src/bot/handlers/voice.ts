/**
 * Voice / audio message handler.
 *
 * 1. Downloads the .ogg blob via `telegram.getFileLink`.
 * 2. Sends it to Groq Whisper for transcription (Russian by default).
 * 3. Hands the resulting text to the same NLP + persistence pipeline used by
 *    typed messages, so the user sees the exact same reply with undo button.
 */

import type { Telegraf, Context } from 'telegraf';
import { config } from '../../config.js';
import { log } from '../../logger.js';
import { metrics } from '../../metrics.js';
import { transcribeVoice } from '../../voiceTranscribe.js';
import { processFinancialText } from '../services/processInput.js';

interface VoicePayload {
  file_id: string;
  duration?: number;
  file_size?: number;
  mime_type?: string;
}

function extractVoice(ctx: Context): VoicePayload | null {
  const msg = ctx.message;
  if (!msg) return null;
  if ('voice' in msg && msg.voice) {
    return {
      file_id: msg.voice.file_id,
      duration: msg.voice.duration,
      file_size: msg.voice.file_size,
      mime_type: msg.voice.mime_type,
    };
  }
  if ('audio' in msg && msg.audio) {
    return {
      file_id: msg.audio.file_id,
      duration: msg.audio.duration,
      file_size: msg.audio.file_size,
      mime_type: msg.audio.mime_type,
    };
  }
  return null;
}

async function downloadFile(ctx: Context, fileId: string): Promise<Buffer> {
  const link = await ctx.telegram.getFileLink(fileId);
  // Use global fetch (Node 22) — no extra deps.
  const res = await fetch(link.toString());
  if (!res.ok) throw new Error(`telegram file download failed: ${res.status}`);
  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}

export function registerVoice(bot: Telegraf): void {
  const handler = async (ctx: Context): Promise<void> => {
    if (!ctx.from) return;
    const payload = extractVoice(ctx);
    if (!payload) return;

    if (!config.voiceEnabled) {
      await ctx.reply(
        '🎙 Распознавание голоса выключено. Включи через переменную окружения <code>DISABLE_VOICE=false</code> ' +
          'и установи <code>GROQ_API_KEY</code>.',
        { parse_mode: 'HTML' },
      );
      return;
    }

    if (payload.duration && payload.duration > config.voiceMaxSeconds) {
      metrics.voiceTranscriptions.inc({ result: 'too_long' });
      await ctx.reply(
        `🎙 Слишком длинное голосовое (${payload.duration}s). Лимит — ${config.voiceMaxSeconds}s.`,
      );
      return;
    }
    if (payload.file_size && payload.file_size > config.voiceMaxBytes) {
      metrics.voiceTranscriptions.inc({ result: 'too_big' });
      await ctx.reply('🎙 Файл слишком большой.');
      return;
    }

    await ctx.sendChatAction('typing').catch(() => {});

    let audio: Buffer;
    try {
      audio = await downloadFile(ctx, payload.file_id);
    } catch (err) {
      log.error('voice download failed', err);
      metrics.voiceTranscriptions.inc({ result: 'download_failed' });
      await ctx.reply('⚠️ Не получилось скачать голосовое из Telegram.');
      return;
    }

    const transcription = await transcribeVoice({
      audio,
      durationSec: payload.duration,
      filename: payload.mime_type?.includes('mpeg') ? 'voice.mp3' : 'voice.ogg',
      language: 'ru',
    });

    if (!transcription.ok) {
      metrics.voiceTranscriptions.inc({ result: transcription.reason });
      if (transcription.reason === 'no_groq') {
        await ctx.reply(
          '🎙 Распознавание речи требует <code>GROQ_API_KEY</code>. Добавь ключ и попробуй снова.',
          { parse_mode: 'HTML' },
        );
        return;
      }
      if (transcription.reason === 'empty') {
        await ctx.reply('🎙 Не удалось разобрать речь. Попробуй ещё раз громче и чётче.');
        return;
      }
      await ctx.reply('⚠️ Не получилось распознать голосовое. Попробуй ещё раз.');
      return;
    }

    metrics.voiceTranscriptions.inc({ result: 'ok' });

    // Show what we heard so the user can verify, then pipe through the regular
    // NLP → save pipeline. The "source prefix" makes the reply distinguishable
    // from typed messages.
    await ctx.reply(`🎙 <i>«${escapeHtml(transcription.text)}»</i>`, { parse_mode: 'HTML' });

    await processFinancialText(ctx, {
      text: transcription.text,
      sourcePrefix: '🎙',
      smalltalkOnNotFinancial: false,
    });
  };

  bot.on('voice', handler);
  bot.on('audio', handler);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
