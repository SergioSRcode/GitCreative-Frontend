import vertSrc from '../shaders/composite.vert?raw';
import fragSrc from '../shaders/composite.frag?raw';
import blitFragSrc from '../shaders/blit.frag?raw';
import clipMaskFragSrc from '../shaders/clipMask.frag?raw';
import restoreOutsideMaskFragSrc from '../shaders/restoreOutsideMask.frag?raw';
import selectionOutlineFragSrc from '../shaders/selectionOutline.frag?raw';
import blitShiftedVertSrc from '../shaders/blitShifted.vert?raw';
import blitShiftedFragSrc from '../shaders/blitShifted.frag?raw';
import type { Layer } from '../types/layer';

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type)!;

  gl.shaderSource(shader, src);
  gl.compileShader(shader);

  if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`Shader compile error: ${gl.getShaderInfoLog(shader)}`);
  }

  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertSource: string,
  fragSource: string
): WebGLProgram {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSource);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSource);
  const program = gl.createProgram()!;

  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program link error: ${gl.getProgramInfoLog(program)}`);
  }

  return program;
}

const BLEND_MODE_INT: Record<string, number> = {
  normal: 0,
  multiply: 1,
  overlay: 2,
};

export class Compositor {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private quadBuffer: WebGLBuffer;
  private texCoordBuffer: WebGLBuffer;
  private positionLoc: number;
  private texCoordLoc: number;
  private layerLoc: WebGLUniformLocation;
  private backdropLoc: WebGLUniformLocation;
  private opacityLoc: WebGLUniformLocation;
  private blendModeLoc: WebGLUniformLocation;
  private backdropTexture: WebGLTexture;
  private backdropFramebuffer: WebGLFramebuffer;
  private blitProgram: WebGLProgram;
  private blitTextureLoc: WebGLUniformLocation;
  private blitOpacityLoc: WebGLUniformLocation;

  private clipProgram: WebGLProgram;
  private clipTargetLoc: WebGLUniformLocation;
  private clipMaskLoc: WebGLUniformLocation;

  private restoreProgram: WebGLProgram;
  private restoreOriginalLoc: WebGLUniformLocation;
  private restoreCurrentLoc: WebGLUniformLocation;
  private restoreMaskLoc: WebGLUniformLocation;

  private outlineProgram: WebGLProgram;
  private outlineMaskLoc: WebGLUniformLocation;
  private outlineTexelSizeLoc: WebGLUniformLocation;
  // private outlineTimeLoc: WebGLUniformLocation;

  private blitShiftedProgram: WebGLProgram;
  private blitShiftedPositionLoc: number;
  private blitShiftedTexCoordLoc: number;
  private blitShiftedOffsetLoc: WebGLUniformLocation;
  private blitShiftedTextureLoc: WebGLUniformLocation;
  private blitShiftedOpacityLoc: WebGLUniformLocation;

  private outlineOffsetLoc: WebGLUniformLocation;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.program = createProgram(gl, vertSrc, fragSrc);

    // full-screen quad in clip space - covers (-1, -1) to (1, 1)
    // two triangles make a rectangle
    const quadVerts = new Float32Array([
      -1, -1,   1, -1,   -1, 1,
      -1, 1,    1, -1,    1, 1,
    ]);

    this.quadBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);

    // Matching UV coordinates — no flip needed since our layer textures
    // already use the same top-left origin as our stroke rendering
    const texCoords = new Float32Array([
      0, 0,   1, 0,   0, 1,
      0, 1,   1, 0,   1, 1,
    ]);

    this.texCoordBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

    this.positionLoc = gl.getAttribLocation(this.program, 'a_position');
    this.texCoordLoc = gl.getAttribLocation(this.program, 'a_texCoord');
    this.layerLoc = gl.getUniformLocation(this.program, 'u_layer')!;
    this.backdropLoc = gl.getUniformLocation(this.program, 'u_backdrop')!;
    this.opacityLoc = gl.getUniformLocation(this.program, 'u_opacity')!;
    this.blendModeLoc = gl.getUniformLocation(this.program, 'u_blendMode')!;

    this.backdropTexture = gl.createTexture()!;
    this.backdropFramebuffer = gl.createFramebuffer()!;
    this.initBackdrop(gl.canvas.width, gl.canvas.height);

    // Second, simpler program specifically for blitDirect
    this.blitProgram     = createProgram(gl, vertSrc, blitFragSrc); // reuses the same vertex shader
    this.blitTextureLoc  = gl.getUniformLocation(this.blitProgram, 'u_texture')!;
    this.blitOpacityLoc  = gl.getUniformLocation(this.blitProgram, 'u_opacity')!;

    this.clipProgram    = createProgram(gl, vertSrc, clipMaskFragSrc);
    this.clipTargetLoc  = gl.getUniformLocation(this.clipProgram, 'u_target')!;
    this.clipMaskLoc    = gl.getUniformLocation(this.clipProgram, 'u_mask')!;

    this.restoreProgram      = createProgram(gl, vertSrc, restoreOutsideMaskFragSrc);
    this.restoreOriginalLoc  = gl.getUniformLocation(this.restoreProgram, 'u_original')!;
    this.restoreCurrentLoc   = gl.getUniformLocation(this.restoreProgram, 'u_current')!;
    this.restoreMaskLoc      = gl.getUniformLocation(this.restoreProgram, 'u_mask')!;

    this.outlineProgram        = createProgram(gl, vertSrc, selectionOutlineFragSrc);
    this.outlineMaskLoc        = gl.getUniformLocation(this.outlineProgram, 'u_mask')!;
    this.outlineTexelSizeLoc   = gl.getUniformLocation(this.outlineProgram, 'u_texelSize')!;
    // this.outlineTimeLoc        = gl.getUniformLocation(this.outlineProgram, 'u_time')!;

    this.blitShiftedProgram      = createProgram(gl, blitShiftedVertSrc, blitShiftedFragSrc);
    this.blitShiftedPositionLoc  = gl.getAttribLocation(this.blitShiftedProgram, 'a_position');
    this.blitShiftedTexCoordLoc  = gl.getAttribLocation(this.blitShiftedProgram, 'a_texCoord');
    this.blitShiftedOffsetLoc    = gl.getUniformLocation(this.blitShiftedProgram, 'u_offsetClip')!;
    this.blitShiftedTextureLoc   = gl.getUniformLocation(this.blitShiftedProgram, 'u_texture')!;
    this.blitShiftedOpacityLoc   = gl.getUniformLocation(this.blitShiftedProgram, 'u_opacity')!;

    this.outlineOffsetLoc = gl.getUniformLocation(this.outlineProgram, 'u_offsetUV')!;
  }

  private initBackdrop(width: number, height: number) {
    const { gl } = this;

    gl.bindTexture(gl.TEXTURE_2D, this.backdropTexture);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, null
    );

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.backdropFramebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D, this.backdropTexture, 0
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // copies current scrren pixels into the backdrop texture 
  // => with that, the shader can read what has already been composited underneath this layer
  private captureBackdrop(width: number, height: number) {
    const { gl } = this;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, this.backdropTexture);
    gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, width, height, 0);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  blitDirect(
    texture: WebGLTexture,
    opacity: number,
    targetFramebuffer: WebGLFramebuffer | null,
    width: number,
    height: number
  ) {
    const { gl } = this

    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFramebuffer)
    gl.viewport(0, 0, width, height)
    gl.enable(gl.BLEND)
    gl.blendEquation(gl.FUNC_ADD)
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

    gl.useProgram(this.blitProgram)  // new dedicated program, not this.program

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer)
    gl.enableVertexAttribArray(this.positionLoc)
    gl.vertexAttribPointer(this.positionLoc, 2, gl.FLOAT, false, 0, 0)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer)
    gl.enableVertexAttribArray(this.texCoordLoc)
    gl.vertexAttribPointer(this.texCoordLoc, 2, gl.FLOAT, false, 0, 0)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.uniform1i(this.blitTextureLoc, 0)

    gl.uniform1f(this.blitOpacityLoc, opacity)

    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }

  // Draws a single layer's texture onto whatever framebuffer is currently bound
  drawLayer(
    layer: Layer, 
    width: number, 
    height: number, 
    targetFramebuffer: WebGLFramebuffer | null = null  // defaults to screen
  ) {
    const { gl } = this;
    this.captureBackdrop(width, height);

    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFramebuffer);
    gl.viewport(0, 0, width, height);
    gl.useProgram(this.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(this.positionLoc);
    gl.vertexAttribPointer(this.positionLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(this.texCoordLoc);
    gl.vertexAttribPointer(this.texCoordLoc, 2, gl.FLOAT, false, 0, 0);

    // Slot 0 => layer's own painted texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, layer.texture);
    gl.uniform1i(this.layerLoc, 0);

    // Slot 1 => captured backdrop (everything composited underneath this layer)
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.backdropTexture);
    gl.uniform1i(this.backdropLoc, 1);

    gl.uniform1f(this.opacityLoc, layer.opacity);
    gl.uniform1i(this.blendModeLoc, BLEND_MODE_INT[layer.blendMode] ?? 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // Merges `sourceTexture` onto whatever is bound to `targetFramebuffer`,
  // using `targetTexture`'s own current content as the backdrop — NOT the
  // screen. This is distinct from drawLayer(), which always captures the
  // screen as backdrop for normal on-screen layer compositing.
  mergeInto(
    sourceLayer: Layer,
    targetLayer: Layer,
    width: number,
    height: number
  ) {
    const { gl } = this;
    // Snapshot target's CURRENT content into a temporary texture first,
    // since we can't safely read from and write to the same texture at once
    const tempPixels = new Uint8Array(width * height * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, targetLayer.framebuffer);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, tempPixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Pre-composite the target's pixels over a white background before using
    // them as the Multiply backdrop — otherwise transparent (0,0,0,0) regions
    // force the multiply result to black, since raw RGB=0 multiplies to 0
    // regardless of alpha, but "transparent" should behave like "white/no effect"
    for (let i = 0; i < tempPixels.length; i += 4) {
      const a = tempPixels[i + 3] / 255;

      tempPixels[i]     = Math.round(tempPixels[i]     * a + 255 * (1 - a));
      tempPixels[i + 1] = Math.round(tempPixels[i + 1] * a + 255 * (1 - a));
      tempPixels[i + 2] = Math.round(tempPixels[i + 2] * a + 255 * (1 - a));
      tempPixels[i + 3] = 255;  // now fully opaque white-backed representation
    }

    const tempTexture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tempTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, tempPixels);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Now safely draw: source (slot 0) blended against the temp snapshot (slot 1),
    // writing into the real target framebuffer — no read/write collision
    gl.bindFramebuffer(gl.FRAMEBUFFER, targetLayer.framebuffer);
    gl.viewport(0, 0, width, height);
    gl.useProgram(this.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(this.positionLoc);
    gl.vertexAttribPointer(this.positionLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(this.texCoordLoc);
    gl.vertexAttribPointer(this.texCoordLoc, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sourceLayer.texture);
    gl.uniform1i(this.layerLoc, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, tempTexture);
    gl.uniform1i(this.backdropLoc, 1);

    gl.uniform1f(this.opacityLoc, sourceLayer.opacity);
    gl.uniform1i(this.blendModeLoc, BLEND_MODE_INT[sourceLayer.blendMode] ?? 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.deleteTexture(tempTexture);  // clean up — this was only ever needed for this one operation
  }

  // Clips targetTexture's alpha by maskTexture's alpha, writing the result
  // into targetFramebuffer — used right before a finished stroke commits,
  // so drawing outside the active selection has no visible effect
  clipByMask(
    targetTexture: WebGLTexture,
    targetFramebuffer: WebGLFramebuffer,
    maskTexture: WebGLTexture,
    width: number,
    height: number
  ) {
    const { gl } = this;

    // Snapshot target first (can't read/write same texture in one pass)
    const tempPixels = new Uint8Array(width * height * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFramebuffer);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, tempPixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const tempTexture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tempTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, tempPixels);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFramebuffer);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.BLEND);  // straight overwrite — this IS the new content, not blended
    gl.useProgram(this.clipProgram);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(this.positionLoc);
    gl.vertexAttribPointer(this.positionLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(this.texCoordLoc);
    gl.vertexAttribPointer(this.texCoordLoc, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tempTexture);
    gl.uniform1i(this.clipTargetLoc, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, maskTexture);
    gl.uniform1i(this.clipMaskLoc, 1);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.deleteTexture(tempTexture);
    gl.enable(gl.BLEND);  // restore default state for whatever draws next
  }

  // Restores `originalTexture`'s pixels into `targetFramebuffer` wherever
  // `maskTexture`'s alpha is 0 — used to "undo" an eraser's effect outside
  // the active selection, since the eraser writes directly to the layer
  // with no separate in-progress buffer to clip before committing
  restoreOutsideMask(
    targetFramebuffer: WebGLFramebuffer,
    originalTexture: WebGLTexture,
    maskTexture: WebGLTexture,
    width: number,
    height: number
  ) {
    const { gl } = this;

    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFramebuffer);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.BLEND);
    gl.useProgram(this.restoreProgram);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(this.positionLoc);
    gl.vertexAttribPointer(this.positionLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(this.texCoordLoc);
    gl.vertexAttribPointer(this.texCoordLoc, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, originalTexture);
    gl.uniform1i(this.restoreOriginalLoc, 0);

    gl.activeTexture(gl.TEXTURE1);
    // The CURRENT (post-erase) content is already in targetFramebuffer's
    // texture — we read it via a snapshot first, same temp-texture pattern
    // as mergeInto and clipByMask, to avoid a read/write collision
    const currentPixels = new Uint8Array(width * height * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFramebuffer);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, currentPixels);

    const currentTexture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, currentTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, currentPixels);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, currentTexture);
    gl.uniform1i(this.restoreCurrentLoc, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, maskTexture);
    gl.uniform1i(this.restoreMaskLoc, 2);

    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFramebuffer);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.deleteTexture(currentTexture);
    gl.enable(gl.BLEND);
  }

  drawSelectionOutline(
    maskTexture: WebGLTexture,
    width: number,
    height: number,
    offsetX: number = 0,
    offsetY: number = 0
  ) {
    const { gl } = this;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);  // draws onto the screen, on top of everything else
    gl.viewport(0, 0, width, height);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.outlineProgram);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(this.positionLoc);
    gl.vertexAttribPointer(this.positionLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(this.texCoordLoc);
    gl.vertexAttribPointer(this.texCoordLoc, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, maskTexture);
    gl.uniform1i(this.outlineMaskLoc, 0);

    gl.uniform2f(this.outlineTexelSizeLoc, 1.0 / width, 1.0 / height);
    gl.uniform2f(this.outlineOffsetLoc, offsetX / width, -offsetY / height);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // Draws sourceTexture onto targetFramebuffer (or the screen, if null),
  // shifted by (offsetX, offsetY) pixels. Used both for previewing lifted
  // selection content mid-drag (target = null, screen) and for permanently
  // stamping it into a layer at drop time (target = the layer's framebuffer).
  blitDirectShifted(
    sourceTexture: WebGLTexture,
    opacity: number,
    targetFramebuffer: WebGLFramebuffer | null,
    offsetX: number,
    offsetY: number,
    width: number,
    height: number
  ) {
    const { gl } = this;

    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFramebuffer);
    gl.viewport(0, 0, width, height);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.blitShiftedProgram);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(this.blitShiftedPositionLoc);
    gl.vertexAttribPointer(this.blitShiftedPositionLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(this.blitShiftedTexCoordLoc);
    gl.vertexAttribPointer(this.blitShiftedTexCoordLoc, 2, gl.FLOAT, false, 0, 0);

    // Convert pixel offset to clip-space units (-1..1 range spans the full canvas)
    const offsetClipX = (offsetX / width) * 2;
    const offsetClipY = -(offsetY / height) * 2;  // flip Y — clip space Y grows upward, pixels grow downward
    gl.uniform2f(this.blitShiftedOffsetLoc, offsetClipX, offsetClipY);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
    gl.uniform1i(this.blitShiftedTextureLoc, 0);
    gl.uniform1f(this.blitShiftedOpacityLoc, opacity);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // Permanently shifts maskTexture's own stored content by (offsetX, offsetY) —
  // used once, at drop time, so future clipping/outline drawing reflects the
  // selection's new position without needing an offset passed in anymore
  shiftMaskInPlace(
    maskTexture: WebGLTexture,
    maskFramebuffer: WebGLFramebuffer,
    offsetX: number,
    offsetY: number,
    width: number,
    height: number
  ) {
    const { gl } = this;

    // Snapshot current mask content first — can't read/write the same texture at once
    const tempPixels = new Uint8Array(width * height * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, maskFramebuffer);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, tempPixels);

    const tempTexture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tempTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, tempPixels);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Clear the real mask, then blit the snapshot back in at the new offset
    gl.bindFramebuffer(gl.FRAMEBUFFER, maskFramebuffer);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.viewport(0, 0, width, height);

    this.blitDirectShifted(tempTexture, 1.0, maskFramebuffer, offsetX, offsetY, width, height);

    gl.deleteTexture(tempTexture);
  }

  // Same as blitDirectShifted, but overwrites instead of blending — used
  // specifically when dropping lifted selection content back into a layer,
  // where the destination should already be empty (from the lift-time hole)
  // and blending would cause partial-alpha edge pixels to compound over
  // repeated drags.
  blitDirectShiftedOverwrite(
    sourceTexture: WebGLTexture,
    targetFramebuffer: WebGLFramebuffer,
    offsetX: number,
    offsetY: number,
    width: number,
    height: number
  ) {
    const { gl } = this

    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFramebuffer)
    gl.viewport(0, 0, width, height)
    gl.disable(gl.BLEND)
    gl.useProgram(this.blitShiftedProgram)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer)
    gl.enableVertexAttribArray(this.blitShiftedPositionLoc)
    gl.vertexAttribPointer(this.blitShiftedPositionLoc, 2, gl.FLOAT, false, 0, 0)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer)
    gl.enableVertexAttribArray(this.blitShiftedTexCoordLoc)
    gl.vertexAttribPointer(this.blitShiftedTexCoordLoc, 2, gl.FLOAT, false, 0, 0)

    const offsetClipX = (offsetX / width) * 2
    const offsetClipY = -(offsetY / height) * 2
    gl.uniform2f(this.blitShiftedOffsetLoc, offsetClipX, offsetClipY)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, sourceTexture)
    gl.uniform1i(this.blitShiftedTextureLoc, 0)
    gl.uniform1f(this.blitShiftedOpacityLoc, 1.0)

    gl.drawArrays(gl.TRIANGLES, 0, 6)

    gl.enable(gl.BLEND)  // restore default for subsequent draws
  }
}


