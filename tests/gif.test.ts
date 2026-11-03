import { describe, expect, it } from 'vitest';
import { encodeGif, gifFrameTimes, gifSize, GIF_FPS, GIF_MAX_FRAMES } from '../src/react/gif';

// A clip as a GIF (Habitect report 92e96c31). The drawing needs a real video: see the browser
// check in the PR; what can be worked out without one is checked here.

describe('a GIF of a clip', () => {
  it('takes GIF_FPS frames a second of a short clip', () => {
    const { times, delay } = gifFrameTimes(2);
    expect(times).toHaveLength(2 * GIF_FPS);
    expect(times[1]).toBeCloseTo(1 / GIF_FPS);
    expect(delay).toBe(1000 / GIF_FPS);
  });

  it('keeps a long clip’s length and loses frames', () => {
    const { times, delay } = gifFrameTimes(120);
    expect(times).toHaveLength(GIF_MAX_FRAMES);
    expect(times.at(-1)).toBeLessThan(120);
    expect(delay * times.length).toBe(120_000);
  });

  it('has a frame even for the shortest clip', () => {
    expect(gifFrameTimes(0.01).times).toEqual([0]);
  });

  it('shrinks to the width asked and never grows', () => {
    expect(gifSize({ width: 1280, height: 720 }, 640)).toEqual({ width: 640, height: 360 });
    expect(gifSize({ width: 300, height: 150 }, 640)).toEqual({ width: 300, height: 150 });
  });

  it('writes a GIF that loops, with every frame in it', async () => {
    async function* frames() {
      for (const value of [0, 255]) yield new Uint8ClampedArray(4 * 4).fill(value);
    }
    const gif = await encodeGif(frames(), 2, 2, 100);
    expect(gif.type).toBe('image/gif');
    const bytes = new Uint8Array(await gif.arrayBuffer());
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text.startsWith('GIF89a')).toBe(true);
    expect(text).toContain('NETSCAPE2.0');
    // One graphic control block before each frame.
    expect(text.split('\x21\xf9\x04').length - 1).toBe(2);
  });
});
