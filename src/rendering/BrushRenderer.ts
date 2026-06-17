import type { Stroke } from "../types/stroke";
import type { Brush } from "../types/brush";
import { buildDabVertices } from "./dab";
import dabVertSrc from '../shaders/dab.vert?raw';
import inkFragSrc from '../shaders/ink.frag?raw';
import pencilFragSrc from '../shaders/pencil.frag?raw';
import eraserFragSrc from '../shaders/eraser.frag?raw';

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`Shader compile error: ${gl.getShaderInfoLog(shader)}`);
  }

  return shader;
}

function createProgram(gl: WebGL2RenderingContext, vertSrc: string, fragSrc: string): WebGLProgram {
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

type ProgramSet = {
  program: WebGLProgram,
  positionLoc: number,
  localPosLoc: number,
  resolutionLoc: WebGLUniformLocation,
  colorLoc: WebGLUniformLocation | null,
};

export class BrushRenderer {
  private gl: WebGL2RenderingContext;
  private buffer: WebGLBuffer;
  private programs: Record<'ink' | 'pencil' | 'eraser', ProgramSet>;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.buffer = gl.createBuffer()!;

    this.programs = {
      ink:    this.buildProgramSet(inkFragSrc),
      pencil: this.buildProgramSet(pencilFragSrc),
      eraser: this.buildProgramSet(eraserFragSrc),
    };
  }

  private buildProgramSet(fragSrc: string): ProgramSet {
    const gl = this.gl;
    const program = createProgram(gl, dabVertSrc, fragSrc);
    
    return {
      program,
      positionLoc:   gl.getAttribLocation(program, 'a_position'),
      localPosLoc:   gl.getAttribLocation(program, 'a_localPos'),
      resolutionLoc: gl.getUniformLocation(program, 'u_resolution')!,
      // eraser has no u_color uniform — guard for that
      colorLoc:      gl.getUniformLocation(program, 'u_color'),
    };
  }

  render(stroke: Stroke, brush: Brush, targetFramebuffer: WebGLFramebuffer | null, width: number, height: number) {
    const gl = this.gl;
    const set = this.programs[brush.type];

    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFramebuffer);
    gl.viewport(0, 0, width, height);

    // Eraser uses a different blend mode — it subtracts alpha rather than
    // blending colour on top, effectively punching transparent holes
    if (brush.type === 'eraser') {
      gl.blendFuncSeparate(gl.ZERO, gl.ONE, gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
    } else {
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }

    gl.useProgram(set.program);
    gl.uniform2f(set.resolutionLoc, width, height);

    if (set.colorLoc) {
      gl.uniform4f(set.colorLoc, ...brush.color, brush.opacity);
    }

    // Build and upload geometry for every dab in this stroke
    const allVerts: number[] = [];

    for (const point of stroke.points) {
      const radius = (brush.size * point.pressure) / 2;
      allVerts.push(...buildDabVertices(point, radius));
    }

    if (allVerts.length === 0) return;

    const data = new Float32Array(allVerts);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);

    const stride = 4 * Float32Array.BYTES_PER_ELEMENT; // 4 floats per vertex

    gl.enableVertexAttribArray(set.positionLoc);
    gl.vertexAttribPointer(set.positionLoc, 2, gl.FLOAT, false, stride, 0);

    gl.enableVertexAttribArray(set.localPosLoc);
    gl.vertexAttribPointer(set.localPosLoc, 2, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT);

    gl.drawArrays(gl.TRIANGLES, 0, data.length / 4);
  }
}