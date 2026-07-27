// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { useHistory } from './useHistory';
import type { Layer } from '../types/layer';

// A minimal fake WebGL context — only implements what useHistory actually calls.
// readPixels just fills the buffer with a counter value so we can distinguish
// "snapshot taken at different times" in assertions.
function createFakeGL() {
  let callCount = 0
  return {
    canvas: { width: 2, height: 2 },
    bindFramebuffer: () => {},
    readPixels: (
      _x: number, _y: number, _w: number, _h: number,
      _format: number, _type: number, outBuffer: Uint8Array
    ) => {
      callCount++
      outBuffer.fill(callCount) // distinct content per call
    },
    bindTexture: () => {},
    texSubImage2D: () => {},
    RGBA: 6408,
    UNSIGNED_BYTE: 5121,
    FRAMEBUFFER: 36160,
  } as unknown as WebGL2RenderingContext
}

function makeFakeLayer(id: string): Layer {
  return {
    id, name: id, visible: true, opacity: 1, blendMode: 'normal',
    texture: {} as WebGLTexture,
    framebuffer: {} as WebGLFramebuffer,
  }
}

describe('useHistory', () => {
  it('canUndo is false with only a baseline snapshot', () => {
    const { result } = renderHook(() => useHistory())
    const gl = createFakeGL()
    const layers = [makeFakeLayer('layer1')]

    act(() => {
      result.current.pushSnapshot(gl, layers)
    })

    expect(result.current.canUndo()).toBe(false)
  });

  // covers a previous bug, where phantom snapshots were saved after a certain sequence of undo/redo
  it('does not accumulate phantom entries across undo/redo cycles', () => {
    const { result } = renderHook(() => useHistory())
    const gl = createFakeGL()
    const layers = [makeFakeLayer('layer1')]

    // Simulate: baseline, then three "strokes" (each pushes a snapshot)
    act(() => { result.current.pushSnapshot(gl, layers) }) // baseline
    act(() => { result.current.pushSnapshot(gl, layers) }) // stroke 1
    act(() => { result.current.pushSnapshot(gl, layers) }) // stroke 2
    act(() => { result.current.pushSnapshot(gl, layers) }) // stroke 3

    // Undo twice
    act(() => { result.current.undo(gl, layers) })
    act(() => { result.current.undo(gl, layers) })

    // Redo twice — this is exactly where the old buggy implementation
    // introduced phantom duplicate entries by re-capturing instead of moving
    act(() => { result.current.redo(gl, layers) })
    act(() => { result.current.redo(gl, layers) })

    // At this point we should be back at "stroke 3" with no phantom entries.
    // Undoing three times should land exactly back at baseline — no more,
    // no less. If phantom entries exist, canUndo() would still report true
    // after too many or too few undos.
    act(() => { result.current.undo(gl, layers) }) // back to stroke 2
    act(() => { result.current.undo(gl, layers) }) // back to stroke 1
    act(() => { result.current.undo(gl, layers) }) // back to baseline

    expect(result.current.canUndo()).toBe(false)
  });
})