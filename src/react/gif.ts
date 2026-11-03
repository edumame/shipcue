'use client';

// A clip as a GIF (Habitect report 92e96c31): it plays by itself wherever a picture shows, with
// no player, at the cost of size. The encoder loads only when a GIF is made.

/** Frames a second in a GIF: enough to follow clicks and scrolling. */
export const GIF_FPS = 10;
/** The most frames in a GIF; a long clip keeps its length and loses frames instead. */
export const GIF_MAX_FRAMES = 200;
/** Widest first, each tried until the GIF fits `maxBytes`. */
export const GIF_WIDTHS = [640, 480, 320];
/** Colours in each frame, GIF's most. */
const GIF_COLOURS = 256;
/** Past this, a video's end was not found: its length is unknown, and no GIF is made. */
const LOAD_WAIT_MS = 10_000;

export interface GifOptions {
  /** The largest GIF wanted; the narrower sizes are tried to fit it. */
  maxBytes: number;
}

/** When to take each frame of a clip `seconds` long, and how long each one shows (ms). */
export function gifFrameTimes(seconds: number, fps = GIF_FPS, maxFrames = GIF_MAX_FRAMES): { times: number[]; delay: number } {
  const count = Math.min(maxFrames, Math.max(1, Math.round(seconds * fps)));
  const step = seconds / count;
  return { times: Array.from({ length: count }, (_, i) => i * step), delay: Math.round(step * 1000) };
}

/** `size` scaled down to at most `maxWidth` wide, with whole sides. */
export function gifSize(size: { width: number; height: number }, maxWidth: number): { width: number; height: number } {
  const scale = Math.min(1, maxWidth / size.width);
  return { width: Math.max(1, Math.round(size.width * scale)), height: Math.max(1, Math.round(size.height * scale)) };
}

/** One GIF, looping forever, from RGBA frames all of `width`×`height`. */
export async function encodeGif(frames: AsyncIterable<Uint8ClampedArray>, width: number, height: number, delay: number): Promise<Blob> {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
  const gif = GIFEncoder();
  for await (const rgba of frames) {
    const palette = quantize(rgba, GIF_COLOURS);
    gif.writeFrame(applyPalette(rgba, palette), width, height, { palette, delay });
  }
  gif.finish();
  return new Blob([new Uint8Array(gif.bytes())], { type: 'image/gif' });
}

function once(video: HTMLVideoElement, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Video did not load')), LOAD_WAIT_MS);
    const done = (act: () => void) => {
      clearTimeout(timer);
      video.removeEventListener(event, ok);
      video.removeEventListener('error', bad);
      act();
    };
    const ok = () => done(resolve);
    const bad = () => done(() => reject(new Error('Video did not load')));
    video.addEventListener(event, ok);
    video.addEventListener('error', bad);
  });
}

const seek = (video: HTMLVideoElement, time: number) => {
  const seeked = once(video, 'seeked');
  video.currentTime = time;
  return seeked;
};

/** A recorded WebM says nothing of its length until the player has been to its end. */
async function clipSeconds(video: HTMLVideoElement): Promise<number> {
  if (!Number.isFinite(video.duration)) await seek(video, Number.MAX_SAFE_INTEGER);
  if (!Number.isFinite(video.duration) || video.duration <= 0) throw new Error('Video has no length');
  return video.duration;
}

async function* drawnFrames(video: HTMLVideoElement, ctx: CanvasRenderingContext2D, times: number[]): AsyncGenerator<Uint8ClampedArray> {
  const { width, height } = ctx.canvas;
  for (const time of times) {
    await seek(video, time);
    ctx.drawImage(video, 0, 0, width, height);
    yield ctx.getImageData(0, 0, width, height).data;
  }
}

/**
 * A video as a looping GIF, in this browser, at the widest of GIF_WIDTHS that fits `maxBytes`.
 * Rejects when even the narrowest does not, or the video cannot be played here.
 */
export async function videoToGif(clip: Blob, { maxBytes }: GifOptions): Promise<Blob> {
  const url = URL.createObjectURL(clip);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  try {
    const loaded = once(video, 'loadeddata');
    video.src = url;
    await loaded;
    const seconds = await clipSeconds(video);
    const { times, delay } = gifFrameTimes(seconds);
    for (const maxWidth of GIF_WIDTHS) {
      const { width, height } = gifSize({ width: video.videoWidth, height: video.videoHeight }, maxWidth);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('No canvas');
      const gif = await encodeGif(drawnFrames(video, ctx, times), width, height, delay);
      if (gif.size <= maxBytes) return gif;
    }
    throw new Error('GIF too large');
  } finally {
    video.removeAttribute('src');
    URL.revokeObjectURL(url);
  }
}
