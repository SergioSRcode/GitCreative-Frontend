import vertSrc from '../shaders/composite.vert?raw';
import fragSrc from '../shaders/composite.frag?raw';
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

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
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

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.program = createProgram(gl);

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
  }

  // Draws a single layer's texture onto whatever framebuffer is currently bound
  drawLayer(layer: Layer, width: number, height: number) {
    const { gl } = this;
    this.captureBackdrop(width, height);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
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
    gl.uniform1i(this.backdropLoc, 0);

    gl.uniform1f(this.opacityLoc, layer.opacity);
    gl.uniform1i(this.blendModeLoc, BLEND_MODE_INT[layer.blendMode] ?? 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}


