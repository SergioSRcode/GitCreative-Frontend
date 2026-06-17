import type { Stroke, StrokePoint } from '../types/stroke';
import vertSrc from '../shaders/stroke.vert?raw';
import fragSrc from '../shaders/stroke.frag?raw';

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type)!;

  gl.shaderSource(shader, src);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`Shader compile error: ${gl.getShaderInfoLog(shader)}`)
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
    throw new Error(`Program link error: ${gl.getProgramInfoLog(program)}`)
  }

  return program;
}

// Build quad vertices for a stroke segment
// Each segment between two points becomes a rectangle oriented along the stroke
function buildQuadVertices(points: StrokePoint[], size: number): Float32Array {
  const verts: number[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];

    // Direction vector along the segment
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) continue;

    // Perpendicular vector (normalised) for the rectangle width
    const nx = (-dy / len) * (size * a.pressure) * 0.5;
    const ny = ( dx / len) * (size * a.pressure) * 0.5;

    // Four corners of the quad
    const x0 = a.x - nx,  y0 = a.y - ny;  // a left
    const x1 = a.x + nx,  y1 = a.y + ny;  // a right
    const x2 = b.x - nx,  y2 = b.y - ny;  // b left
    const x3 = b.x + nx,  y3 = b.y + ny;  // b right

    // Two triangles: (a-left, a-right, b-left) and (a-right, b-right, b-left)
    verts.push(
      x0, y0,  x1, y1,  x2, y2,
      x1, y1,  x3, y3,  x2, y2,
    );
  }

  return new Float32Array(verts);
}

export class StrokeRenderer {
  private gl: WebGL2RenderingContext
  private program: WebGLProgram
  private buffer: WebGLBuffer
  private positionLoc: number
  private resolutionLoc: WebGLUniformLocation
  private colorLoc: WebGLUniformLocation

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.program = createProgram(gl);
    this.buffer = gl.createBuffer()!;

    this.positionLoc   = gl.getAttribLocation(this.program,  'a_position');
    this.resolutionLoc = gl.getUniformLocation(this.program, 'u_resolution')!;
    this.colorLoc      = gl.getUniformLocation(this.program, 'u_color')!;
  }

  render(
    stroke: Stroke, 
    targetFramebuffer: WebGLFramebuffer | null, 
    width: number, 
    height: number 
  ) {
    const { gl } = this;
    const verts = buildQuadVertices(stroke.points, stroke.size);
    if (verts.length === 0) return

    // binds the target:
    //    - a framebuffer object => renders into a layer's texture
    //    - null => renders to the visible scrren
    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFramebuffer);
    gl.viewport(0, 0, width, height);

    gl.useProgram(this.program);

    // Uploads vertex data to the GPU
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);

    // Tells WebGL how to read the buffer — 2 floats per vertex, no offset
    gl.enableVertexAttribArray(this.positionLoc);
    gl.vertexAttribPointer(this.positionLoc, 2, gl.FLOAT, false, 0, 0);

    // Pass uniforms
    gl.uniform2f(this.resolutionLoc, width, height);
    gl.uniform4f(this.colorLoc, ...stroke.color, stroke.opacity);

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, verts.length / 2);
  }
}