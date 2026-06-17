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

export class Compositor {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private quadBuffer: WebGLBuffer;
  private texCoordBuffer: WebGLBuffer;
  private positionLoc: number;
  private texCoordLoc: number;
  private textureLoc: WebGLUniformLocation;
  private opacityLoc: WebGLUniformLocation;

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

    // Matching UV coordinates — Y is flipped because
    // texture row 0 is the TOP of the image but UV (0,0) is conventionally
    // the BOTTOM-left in OpenGL's texture convention
    const texCoords = new Float32Array([
      0, 1,   1, 1,   0, 0,
      0, 0,   1, 1,   1, 0,
    ]);

    this.texCoordBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

    this.positionLoc = gl.getAttribLocation(this.program, 'a_position');
    this.texCoordLoc = gl.getAttribLocation(this.program, 'a_texCoord');
    this.textureLoc = gl.getUniformLocation(this.program, 'u_texture')!;
    this.opacityLoc = gl.getUniformLocation(this.program, 'u_opacity')!;
  }

  // Draws a single layer's texture onto whatever framebuffer is currently bound
  drawLayer(layer: Layer) {
    const { gl } = this;
    gl.useProgram(this.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(this.positionLoc);
    gl.vertexAttribPointer(this.positionLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(this.texCoordLoc);
    gl.vertexAttribPointer(this.texCoordLoc, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, layer.texture);
    gl.uniform1i(this.textureLoc, 0);
    gl.uniform1f(this.opacityLoc, layer.opacity);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}


