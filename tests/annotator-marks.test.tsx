// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Annotator, type AnnotationMark as Mark } from '../src/react';

// Habitect report d2b77641: a photo annotated once opens again with its marks, to change them.
// The Annotator takes the marks it starts from and hands back the marks it saved, beside the
// flattened PNG, so a host keeps the original picture and the marks apart. One pointer draws
// at a time: a palm or a second finger on an iPad adds nothing while the Pencil draws.

const ctx = new Proxy({ canvas: { width: 0, height: 0 } } as Record<string, unknown>, {
  get: (t, k) => (k in t ? t[k as string] : () => undefined),
  set: (t, k, v) => ((t[k as string] = v), true),
});
class FakeImage {
  onload: (() => void) | null = null;
  width = 200;
  height = 100;
  set src(_v: string) {
    setTimeout(() => this.onload?.(), 0);
  }
}
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx) as never;
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
    cb(new Blob(['png'], { type: 'image/png' }));
  };
});
beforeEach(() => vi.stubGlobal('Image', FakeImage));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const box: Mark = { kind: 'rect', color: '#ef4444', width: 3, rect: { x: 5, y: 5, width: 40, height: 20 } };

async function open(marks?: Mark[]) {
  const onSave = vi.fn<(image: Blob, alt: string, marks: Mark[]) => void>();
  const onCancel = vi.fn();
  render(<Annotator src="blob:photo" maxAlt={200} marks={marks} onSave={onSave} onCancel={onCancel} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add to report' })).toBeEnabled());
  const canvas = screen.getByRole('dialog').querySelector('canvas')!;
  return { onSave, onCancel, canvas };
}
const stroke = (canvas: HTMLCanvasElement, pointerId: number, from: [number, number], to: [number, number]) => {
  fireEvent.pointerDown(canvas, { button: 0, clientX: from[0], clientY: from[1], pointerId });
  fireEvent.pointerMove(canvas, { clientX: to[0], clientY: to[1], pointerId });
  fireEvent.pointerUp(canvas, { clientX: to[0], clientY: to[1], pointerId });
};

describe('the annotator keeps its marks', () => {
  it('starts from saved marks, which undo like its own', async () => {
    const { onSave } = await open([box]);
    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(undo).toBeEnabled();
    await userEvent.click(undo);
    expect(undo).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Redo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add to report' }));
    expect(onSave.mock.calls[0]![2]).toEqual([box]);
  });

  it('hands back the marks it saved, the new one after the old', async () => {
    const { onSave, canvas } = await open([box]);
    await userEvent.click(screen.getByRole('radio', { name: 'Arrow' }));
    stroke(canvas, 1, [10, 10], [60, 40]);
    await userEvent.click(screen.getByRole('button', { name: 'Add to report' }));
    const [image, , marks] = onSave.mock.calls[0]!;
    expect(image.type).toBe('image/png');
    expect(marks.map((m) => m.kind)).toEqual(['rect', 'arrow']);
  });

  it('with none, saves none', async () => {
    const { onSave } = await open();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Add to report' }));
    expect(onSave.mock.calls[0]![2]).toEqual([]);
  });

  it('draws with one pointer at a time: a second finger mid-stroke adds nothing', async () => {
    const { onSave, canvas } = await open();
    await userEvent.click(screen.getByRole('radio', { name: 'Arrow' }));
    fireEvent.pointerDown(canvas, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerDown(canvas, { button: 0, clientX: 150, clientY: 80, pointerId: 2 });
    fireEvent.pointerMove(canvas, { clientX: 190, clientY: 90, pointerId: 2 });
    fireEvent.pointerUp(canvas, { clientX: 190, clientY: 90, pointerId: 2 });
    fireEvent.pointerMove(canvas, { clientX: 60, clientY: 40, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 60, clientY: 40, pointerId: 1 });
    await userEvent.click(screen.getByRole('button', { name: 'Add to report' }));
    const marks = onSave.mock.calls[0]![2];
    expect(marks).toHaveLength(1);
    expect(marks[0]).toMatchObject({ kind: 'arrow', from: { x: 10, y: 10 }, to: { x: 60, y: 40 } });
  });

  it('Cancel saves nothing', async () => {
    const { onSave, onCancel } = await open([box]);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
