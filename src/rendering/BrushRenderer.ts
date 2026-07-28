import type { Stroke } from "../types/stroke";
import type { Brush } from "../types/brush";
import { buildDabVertices } from "./dab";
import dabVertSrc from '../shaders/dab.vert?raw';
import inkFragSrc from '../shaders/ink.frag?raw';
import pencilFragSrc from '../shaders/pencil.frag?raw';
import eraserFragSrc from '../shaders/eraser.frag?raw';
import airbrushFragSrc from '../shaders/airbrush.frag?raw';
import { pressureToRadiusScale } from "../utils/stroke";

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
  hardLoc?: WebGLUniformLocation  // for eraser only
};

interface AirbrushProgramSet extends ProgramSet {
  hardnessLoc: WebGLUniformLocation;
}

export class BrushRenderer {
  private gl: WebGL2RenderingContext;
  private buffer: WebGLBuffer;
  private programs: {
    ink: ProgramSet,
    pencil: ProgramSet,
    eraser: ProgramSet,
    airbrush: AirbrushProgramSet,
  };

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.buffer = gl.createBuffer()!;

    this.programs = {
      ink:    this.buildProgramSet(inkFragSrc),
      pencil: this.buildProgramSet(pencilFragSrc),
      eraser: this.buildProgramSet(eraserFragSrc, true),
      airbrush: this.buildAirbrushProgramSet(airbrushFragSrc),  // needs hardness uniform
    };
  }

  private buildProgramSet(fragSrc: string, hasHardUniform = false): ProgramSet {
    const gl = this.gl;
    const program = createProgram(gl, dabVertSrc, fragSrc);
    
    const set: ProgramSet = {
      program,
      positionLoc:   gl.getAttribLocation(program, 'a_position'),
      localPosLoc:   gl.getAttribLocation(program, 'a_localPos'),
      resolutionLoc: gl.getUniformLocation(program, 'u_resolution')!,
      // eraser has no u_color uniform — guard for that
      colorLoc:      gl.getUniformLocation(program, 'u_color'),
    };

    if (hasHardUniform) set.hardLoc = gl.getUniformLocation(program, 'u_hard')!;

    return set;
  }

  private buildAirbrushProgramSet(fragSrc: string): AirbrushProgramSet {
    const gl = this.gl
    const program = createProgram(gl, dabVertSrc, fragSrc)
    return {
      program,
      positionLoc:   gl.getAttribLocation(program, 'a_position'),
      localPosLoc:   gl.getAttribLocation(program, 'a_localPos'),
      resolutionLoc: gl.getUniformLocation(program, 'u_resolution')!,
      colorLoc:      gl.getUniformLocation(program, 'u_color'),
      hardnessLoc:   gl.getUniformLocation(program, 'u_hardness')!,
    }
  } 

  render(
    stroke: Stroke, 
    brush: Brush, 
    targetFramebuffer: WebGLFramebuffer | null, 
    width: number, 
    height: number,
    blendMode: 'normal' | 'max' = 'normal',
    hardEraser: boolean = false
  ) {
    const gl = this.gl;
    const set = this.programs[brush.type];

    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFramebuffer);
    gl.viewport(0, 0, width, height);

    if (blendMode === 'max') {
      // Overlapping dabs within a single stroke take the MAX alpha per pixel,
      // rather than stacking additively — this is what prevents a light stroke
      // from self-darkening as it accumulates many overlapping dabs
      gl.blendEquation(gl.MAX);
      gl.blendFunc(gl.ONE, gl.ONE);
    } else if (brush.type === 'eraser') {  // Eraser uses a different blend mode — it subtracts alpha 
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFuncSeparate(gl.ZERO, gl.ONE, gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
    } else {
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }

    gl.useProgram(set.program);
    gl.uniform2f(set.resolutionLoc, width, height);

    if (set.colorLoc) {
      gl.uniform4f(set.colorLoc, ...brush.color, stroke.opacity);
    }
    if (set.hardLoc) {
      gl.uniform1f(set.hardLoc, hardEraser ? 1.0 : 0.0);
    }

    // Build and upload geometry for every dab in this stroke
    const allVerts: number[] = [];

    for (const point of stroke.points) {
      const radiusScale = point.isPen ? pressureToRadiusScale(point.pressure) : 1.0;
      const radius = (brush.size / 2) * radiusScale;

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

  // Deposits one airbrush dab at a single point, with a given tick alpha
  // (the per-tick deposit strength, already computed via asymptotic accumulation)
  renderAirbrushTick(
    point: { x: number; y: number; pressure: number; isPen: boolean },
    hardness: number,
    tickAlpha: number,
    color: [number, number, number],
    size: number,
    targetFramebuffer: WebGLFramebuffer | null,
    width: number,
    height: number
  ) {
    const gl  = this.gl;
    const set = this.programs.airbrush;

    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFramebuffer);
    gl.viewport(0, 0, width, height);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(set.program);
    gl.uniform2f(set.resolutionLoc, width, height);
    gl.uniform4f(set.colorLoc!, color[0], color[1], color[2], tickAlpha);
    gl.uniform1f(set.hardnessLoc, hardness);

    const radiusScale = point.isPen ? pressureToRadiusScale(point.pressure) : 1.0;
    const radius = size / 2 * radiusScale;
    const verts  = buildDabVertices(
      { x: point.x, y: point.y, pressure: point.pressure, timeStamp: 0, isPen: point.isPen },
      radius
    );

    const data = new Float32Array(verts);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);

    const stride = 4 * Float32Array.BYTES_PER_ELEMENT;
    gl.enableVertexAttribArray(set.positionLoc);
    gl.vertexAttribPointer(set.positionLoc, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(set.localPosLoc);
    gl.vertexAttribPointer(set.localPosLoc, 2, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT);

    gl.drawArrays(gl.TRIANGLES, 0, data.length / 4);
  }
}