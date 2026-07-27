import { useEffect, useRef, useState } from 'react';
import type { StrokePoint, Stroke } from '../types/stroke';
import type { Brush, Tool } from '../types/brush';
import type { HSVColor, RGBColor } from '../types/color';
import { hsvToRgb, rgbToHsv, rgbToHex } from '../utils/color';
import { resample, smooth } from '../utils/stroke';
import { BrushRenderer } from '../rendering/BrushRenderer';
import { Compositor } from '../rendering/Compositor';
import { sampleColorFromLayer } from '../utils/eyedropper';
import { exportCanvas, flipVertically } from '../utils/export';
import type { ExportFormat } from '../utils/export';
import { useLayers } from '../hooks/useLayers';
import { useHistory } from '../hooks/useHistory';
import { ColorPicker } from './ColorPicker';
import { RecentColors } from './RecentColors';
// import { LayerPanel } from './LayerPanel';
import { VerticalBar } from './VerticalBar';
import { BrushPreview } from './BrushPreview';
import { floodFill } from '../utils/fill';
import type { AirbrushVariant } from '../types/brush';
import { AIRBRUSH_VARIANTS } from '../types/brush';
import { serialiseDocument, //deserialiseDocument, 
  serialiseDocumentCompressed, deserialiseDocumentCompressed,
  type DeserialisedDocument
} from '../utils/document';
import { createCommit, listCommits, listBranchCommits, fetchSnapshot,
  listBranches, createBranch, deleteBranch, 
  quickSave, fetchCurrentState,
  type CommitSummary, type Branch, 
} from '../api/projects';
// import { CommitPanel } from './CommitPanel';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
// import { apiClient } from '../api/client';
import { RightPanel } from './RightPanel';
import { updateLastBranch } from '../api/projects';


const MAX_RECENT = 10;

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const rendererRef = useRef<BrushRenderer | null>(null);
  const compositorRef = useRef<Compositor | null>(null);
  const isDrawing = useRef(false);
  const currentPoints = useRef<StrokePoint[]>([]);
  const initializedRef = useRef(false);
  // const lastPointerPos = useRef<{ x: number; y: number; pressure: number } | null>(null);
  const airbrushTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const airbrushPathPoints = useRef<{ x: number; y: number; pressure: number }[]>([]);
  const thumbnailCache = useRef<Map<string, string>>(new Map());
  const previewingRef = useRef(false);

  const { projectId: urlProjectId, branchId: urlBranchId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [hsvColor, setHsvColor] = useState<HSVColor>({ h: 0, s: 1, v: 0 });
  const [recentColors, setRecentColors] = useState<RGBColor[]>([]);
  const [eyedropper, setEyedropper] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [brushSize, setBrushSize] = useState(12);
  const [sizeBarActive, setSizeBarActive] = useState(false);
  const [canvasPixelSize, setCanvasPixelSize] = useState({ width: 0, height: 0 });
  const [tool, setTool] = useState<Tool>('ink');
  const [fillTolerance, setFillTolerance] = useState(32);  // range is 0-255
  const [brushOpacity, setBrushOpacity] = useState(1.0);
  const [airbrushVariant, setAirbrushVariant] = useState<AirbrushVariant>('medium');
  const [projectName, setProjectName] = useState('Untitled');
  // const [projectId,     setProjectId]     = useState<string>(urlProjectId ?? '');
  const [branchId, setBranchId] = useState<string | null>(null);
  const [headCommitId, setHeadCommitId] = useState<string | null>(null);
  // const [commits, setCommits] = useState<CommitSummary[]>([]);
  const [branchCommits, setBranchCommits] = useState<CommitSummary[]>([])  // commits tab
  const [allCommits,    setAllCommits]    = useState<CommitSummary[]>([])   // tree tab
  const [commitMessage, setCommitMessage] = useState('');
  const [committing, setCommitting] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [isDetached, setIsDetached] = useState(false);
  const [viewingCommitId, setViewingCommitId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const projectId = urlProjectId ?? '';
  const dpr = window.devicePixelRatio || 1;
  const physicalBrushSize = brushSize * dpr;
  const {
    layersRef, layersDisplay, activeLayer, activeLayerId, setActiveLayerId,
    init, addLayer, deleteLayer, moveLayer,
    setVisibility, setOpacity, setBlendMode, renameLayer, 
    clearLayer, loadLayers,
  } = useLayers();

  const { pushSnapshot, undo, redo, canUndo, canRedo } = useHistory();

  const rgb: RGBColor = hsvToRgb(hsvColor);
  const brush: Brush | null = tool === 'fill' 
    ? null
    : {
      type:    tool,
      size:    physicalBrushSize,
      opacity: brushOpacity,
      color:   [rgb.r, rgb.g, rgb.b],
    };

  const HARDNESS_BY_VARIANT: Record<AirbrushVariant, number> = {
    soft:   0.0,
    medium: 0.5,
    hard:   1.0,
  };

  async function loadProject(pid: string, targetBranchId?: string) {
    try {
      // gets the main branch and its head commit
      const { branches: loadedBranches } = await listBranches(pid);
      setBranches(loadedBranches);

      const targetBranch = targetBranchId
        ? loadedBranches.find(b => b.id === targetBranchId) ?? loadedBranches[0]
        : loadedBranches[0];

      if (!targetBranch) return;

      setActiveBranchId(targetBranch.id);
      setBranchId(targetBranch.id);

      await refreshCommits(pid, targetBranch.id);  // loads commit history

      // try current state (quick-save or HEAD commit) via unified enpoint
      try {
        const buffer = await fetchCurrentState(pid, targetBranch.id);
        const doc = await deserialiseDocumentCompressed(buffer);
        const gl = glRef.current!;
        const canvas = canvasRef.current!;

        canvas.width = doc.metadata.width;
        canvas.height = doc.metadata.height;
        gl.viewport(0, 0, doc.metadata.width, doc.metadata.height);
        setCanvasPixelSize({ width: doc.metadata.width, height: doc.metadata.height });

        loadLayers(gl, doc.metadata, doc.layerPixels);
        setProjectName(doc.metadata.name);

        if (targetBranch.head_commit_id) {
        // restore latest commit
          setHeadCommitId(targetBranch.head_commit_id);
          setViewingCommitId(targetBranch.head_commit_id);
        }

        compositeToScreen();
        pushSnapshot(gl, layersRef.current);
      } catch {
        // No snapshot exists yet — brand new branch, keep the blank canvas from init()
      }
      // if no commits exist yet => start with blank canvas
    } catch (err) {
      console.error('Failed to load project: ', err);
    }
  }

  function airbrushTick() {
    console.log('brush.size', brush!.size, 'dpr', window.devicePixelRatio, 'physical', physicalBrushSize);
    const gl = glRef.current;
    if (!gl || !activeLayer || !brush) return;

    const points = airbrushPathPoints.current;
    if (points.length === 0) return;

    const tickAlpha = brushOpacity * 0.15;

    // converts accumulated path points to StrokePoints so resample() can use them
    const strokePoints = points.map(p => ({
      x: p.x, y: p.y,
      pressure: p.pressure,
      timeStamp: 0,
    }));

    // resamples at a spacing relative to brush size
    // smaller than other brushes bc. airbrush dabs are soft-edged and need more overlap
    const spacing = Math.max(brush.size * 0.08, 1);
    const densePath = strokePoints.length > 1
      ? resample(strokePoints, spacing)
      : strokePoints;  // single point (holding still) => no resampling
      
    for (const point of densePath) {
      rendererRef.current!.renderAirbrushTick(
        point,
        HARDNESS_BY_VARIANT[airbrushVariant],
        tickAlpha,
        brush.color,
        brush.size,
        activeLayer.framebuffer,
        gl.canvas.width, gl.canvas.height
      );
    }

    // keeps only the most recent point = still position
    airbrushPathPoints.current = [points[points.length - 1]];
    compositeToScreen();
  }

  function resizeCanvas(canvas: HTMLCanvasElement) {
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = Math.round(canvas.clientWidth * dpr);
    const displayHeight = Math.round(canvas.clientHeight * dpr);

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      setCanvasPixelSize({ width: displayWidth, height: displayHeight });
    }
  }

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>): StrokePoint {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    return {
      x:         (e.clientX - rect.left) * dpr,
      y:         (e.clientY - rect.top)  * dpr,
      pressure:  e.pressure > 0 ? e.pressure : 0.5,
      timeStamp: e.timeStamp,
    };
  }

  function compositeToScreen() {
    const gl = glRef.current!;
    const canvas = canvasRef.current!;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.BLEND);

    for (const layer of layersRef.current) {
      if (!layer.visible) continue;
      compositorRef.current!.drawLayer(layer, canvas.width, canvas.height);
    }

    // re-enables blending for any subsequent draw calls
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(
      gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,       gl.ONE_MINUS_SRC_ALPHA
    );
  }

  function renderCurrentStrokeToLayer() {
    const gl = glRef.current;
    if (!gl || !activeLayer || !brush) return;
    if (currentPoints.current.length < 2) return;

    const spacing   = Math.max(brush.size * 0.15, 1);
    const resampled = resample(currentPoints.current, spacing);
    const smoothed  = smooth(resampled, 1);
    const avgPressure = smoothed.reduce((sum, p) => sum + p.pressure, 0) / smoothed.length;

    const stroke: Stroke = {
      id: 'current',
      points: smoothed,
      color: brush.color,
      size: brush.size,
      opacity: brush.opacity * avgPressure,
    };

    rendererRef.current!.render(
      stroke, brush,
      activeLayer.framebuffer,
      gl.canvas.width, gl.canvas.height
    );

    compositeToScreen();
  }

  function pushRecentColor(color: RGBColor) {
    const hex = rgbToHex(color);

    setRecentColors(prev => {
      const filtered = prev.filter(c => rgbToHex(c) !== hex);
      return [color, ...filtered].slice(0, MAX_RECENT);
    });
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    // Blocks drawing in detached HEAD (view only) state
    if (isDetached) return;

    if (eyedropper) {
      const gl     = glRef.current!;
      const canvas = canvasRef.current!;
      const point  = getPoint(e);
      const sampled = sampleColorFromLayer(
        gl, layersRef.current[0], point.x, point.y, canvas.height
      );

      setHsvColor(rgbToHsv(sampled));
      setEyedropper(false);

      return;
    }

    if (tool === 'fill') {
      handleFill(e);
      return;
    }

    canvasRef.current!.setPointerCapture(e.pointerId);
    isDrawing.current = true;

    if (tool === 'airbrush') {
      const point = getPoint(e);
      airbrushPathPoints.current = [{ x: point.x, y: point.y, pressure: point.pressure }];
      pushRecentColor(rgb);

      airbrushTick();
      airbrushTimer.current = setInterval(airbrushTick, 40);  // around 25 ticks/sec
      return;
    }

    currentPoints.current = [getPoint(e)];
    pushRecentColor(rgb);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing.current) return;

    if (tool === 'airbrush') {
      const point = getPoint(e);
      airbrushPathPoints.current.push({ x: point.x, y: point.y, pressure: point.pressure });
      return;  // interval timer handles actual rendering, not pointer move
    }

    currentPoints.current.push(getPoint(e));
    renderCurrentStrokeToLayer();
    currentPoints.current = currentPoints.current.slice(-1);
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    if (tool === 'airbrush') {
      if (airbrushTimer.current) {
        clearInterval(airbrushTimer.current);
        airbrushTimer.current = null;
      }

      airbrushPathPoints.current = [];

      const gl = glRef.current!;
      pushSnapshot(gl, layersRef.current);
      return;
    }

    currentPoints.current.push(getPoint(e));
    renderCurrentStrokeToLayer();
    currentPoints.current = [];

    // takes snapshot after stroke has been committed to layer texture (used for undo/redo)
    const gl = glRef.current!;
    pushSnapshot(gl, layersRef.current);
  }

  async function refreshCommits(pid: string, bid: string) {
    const [{ commits: branch }, { commits: all }] = await Promise.all([
      listBranchCommits(pid, bid),
      listCommits(pid),
    ])
    setBranchCommits(branch);
    setAllCommits(all);
  }

  function handleUndo() {
    const gl = glRef.current!;
    if (undo(gl, layersRef.current)) compositeToScreen();
  }

  function handleRedo() {
    const gl = glRef.current!;
    if (redo(gl, layersRef.current)) compositeToScreen();
  }

  async function handleExport(format: ExportFormat) {
    const gl = glRef.current!;
    const canvas = canvasRef.current!;
    await exportCanvas(gl, layersRef.current, canvas.width, canvas.height, format, 'my-painting');
  }

  function handleFill(e: React.PointerEvent<HTMLCanvasElement>) {
    const gl = glRef.current;
    if (!gl || !activeLayer) return;

    const point  = getPoint(e);
    const canvas = canvasRef.current!;
    const x = Math.floor(point.x);
    const y = Math.floor(canvas.height - point.y); // flip Y — same convention as readPixels/eyedropper

    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return;

    const pixels = new Uint8Array(canvas.width * canvas.height * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, activeLayer.framebuffer);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const fillColor: [number, number, number, number] = [
      Math.round(rgb.r * 255),
      Math.round(rgb.g * 255),
      Math.round(rgb.b * 255),
      255,
    ];

    const didFill = floodFill(
      pixels, canvas.width, canvas.height,
      x, y, fillColor, fillTolerance
    );

    if (!didFill) return;

    gl.bindTexture(gl.TEXTURE_2D, activeLayer.texture);
    gl.texSubImage2D(
      gl.TEXTURE_2D, 0, 0, 0,
      canvas.width, canvas.height,
      gl.RGBA, gl.UNSIGNED_BYTE,
      pixels
    );
    gl.bindTexture(gl.TEXTURE_2D, null);

    compositeToScreen();
    pushSnapshot(gl, layersRef.current);
  }

  function handleClearLayer(id: string) {
    const gl = glRef.current;
    if (!gl) return;

    clearLayer(id);
    compositeToScreen();
    pushSnapshot(gl, layersRef.current);
  }

  function handleProjectExport() {
    const gl = glRef.current!;
    const blob = serialiseDocument(
      { name: projectName, activeLayerId },
      layersRef.current,
      gl
    );

    // triggers download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName}.gitcreative`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCommit() {
    if (!projectId || !branchId || !commitMessage.trim()) return;
    if (isDetached) return;  // safety guard - UI prevents this already
    setCommitting(true);

    try {
      const gl = glRef.current!;

      // serialises current canvas state as a .gitcreative blob
      const blob = await serialiseDocumentCompressed(
        { name: projectName, activeLayerId },
        layersRef.current,
        gl
      );

      const { commitId } = await createCommit(
        projectId,
        branchId, 
        headCommitId,  // parent is current HEAD - null for first commit
        commitMessage.trim(),
        blob
      );

      // updates HEAD
      setHeadCommitId(commitId);
      setViewingCommitId(commitId);
      setCommitMessage('');

      // refreshes branches and commit list
      await refreshCommits(projectId, branchId);
      const { branches: updatedBranches } = await listBranches(projectId);
      // setCommits(updated);
      setBranches(updatedBranches);
    } catch (err) {
      console.error('Commit failed: ', err);
    } finally {
      setCommitting(false);
    }
  }

  async function handleRestoreCommit(commit: CommitSummary) {
    if (!projectId || !activeBranchId) return;

    try {
      // If restoring to the branch's actual HEAD, prefer the quick-saved state
      // (if any) over the commit's own frozen snapshot — otherwise any unsaved
      // quick-save progress since the last commit would be silently lost
      const isHeadCommit = commit.id === headCommitId;
      const buffer = isHeadCommit
        ? await fetchCurrentState(projectId, activeBranchId)
        : await fetchSnapshot(projectId, commit.id);
      const doc = await deserialiseDocumentCompressed(buffer);
      const gl = glRef.current!;
      const canvas = canvasRef.current!;

      canvas.width = doc.metadata.width;
      canvas.height = doc.metadata.height;
      gl.viewport(0, 0, doc.metadata.width, doc.metadata.height);
      setCanvasPixelSize({ width: doc.metadata.width, height: doc.metadata.height });

      loadLayers(gl, doc.metadata, doc.layerPixels);
      setProjectName(doc.metadata.name);

      // enters detached HEAD  - viewing a past state (not on top of a branch)
      setViewingCommitId(commit.id);

      // if curr commit is NOT the branch's tip = true, else false
      setIsDetached(!isHeadCommit);

      compositeToScreen();
      pushSnapshot(gl, layersRef.current);
    } catch (err) {
      console.error('Restore failed: ', err);
    }
  }

  async function handleCheckout(branch: Branch) {
    if (!projectId || !branch.head_commit_id) return;

    try {
      const buffer = await fetchCurrentState(projectId, branch.id);
      const doc = await deserialiseDocumentCompressed(buffer);
      const gl = glRef.current!;
      const canvas = canvasRef.current!;

      canvas.width = doc.metadata.width;
      canvas.height = doc.metadata.height;
      gl.viewport(0, 0, doc.metadata.width, doc.metadata.height);
      setCanvasPixelSize({ width: doc.metadata.width, height: doc.metadata.height });

      loadLayers(gl, doc.metadata, doc.layerPixels);
      setProjectName(doc.metadata.name);

      // exits detached HEAD - now on a real branch
      setActiveBranchId(branch.id);
      setBranchId(branch.id);
      setHeadCommitId(branch.head_commit_id);
      setViewingCommitId(branch.head_commit_id);
      setIsDetached(false);

      // refreshes commits for curr branch
      await refreshCommits(projectId, branch.id);
      const { branches: updatedBranches } = await listBranches(projectId);
      setBranches(updatedBranches);

      await updateLastBranch(projectId, branch.id);

      navigate(`/projects/${projectId}/branches/${branch.id}`);
      compositeToScreen();
      pushSnapshot(gl, layersRef.current);
    } catch (err) {
      console.error('Checkout failed: ', err);
    }
  }

  async function handleCreateBranchFromCommit(commit: CommitSummary) {
    if (!projectId) return;

    const name = prompt('Name this Timeline:');
    if (!name?.trim()) return;

    try {
      const { branchId: newBranchId } = await createBranch(
        projectId, name.trim(), commit.id
      );

      const newBranch: Branch = {
        id: newBranchId,
        name: name.trim(),
        head_commit_id: commit.id,
      };

      setBranches(prev => [...prev, newBranch]);

      // auto checkouts the new branch
      setActiveBranchId(newBranchId);
      setBranchId(newBranchId);
      setHeadCommitId(commit.id);
      // setViewingCommitId(commit.id);
      setIsDetached(false);

      await refreshCommits(projectId, newBranchId);
      // refreshes commit list
      // const { commits: updated } = await listCommits(projectId);
      // setCommits(updated);

      navigate(`/projects/${projectId}/branches/${newBranchId}`);
      await updateLastBranch(projectId, newBranchId);
    } catch (err) {
      console.error('Create branch failed: ', err);
    }
  }

  async function handleDeleteBranch(branch: Branch) {
    if (!projectId) return;

    try {
      await deleteBranch(projectId, branch.id);
      setBranches(prev => prev.filter(b => b.id !== branch.id));
    } catch (err) {
      console.error('Delete branch failed: ', err);
    }
  }

  async function handleQuickSave() {
    console.log('handleQuickSave called', { projectId, activeBranchId, isDetached })
    if (!projectId || !activeBranchId || isDetached) return;
    setSaving(true);

    try {
      const gl = glRef.current!;
      const blob = await serialiseDocumentCompressed(
        { name: projectName, activeLayerId},
        layersRef.current,
        gl  
      );

      await quickSave(projectId, activeBranchId, blob);
      setLastSavedAt(new Date());
    } catch (err) {
      console.error('Quick save failed: ', err);
    } finally {
      setSaving(false);
    }
  }
  const handleQuickSaveRef = useRef(handleQuickSave)
  useEffect(() => {
    handleQuickSaveRef.current = handleQuickSave  // updated every render, always current
  }); 

  async function handleFetchThumbnail(
    commitId: string, 
    size: { w: number; h: number } = { w: 200, h: 150 }
  ): Promise<string> {
    const cacheKey = `${commitId}_${size.w}x${size.h}`;
    if (thumbnailCache.current.has(cacheKey)) {
      return thumbnailCache.current.get(cacheKey)!;
    }

    const buffer = await fetchSnapshot(projectId, commitId);
    const doc = await deserialiseDocumentCompressed(buffer);

    // renders a quicke composite to an offscreen canvas for the thumbnail
    const offscreen = document.createElement('canvas');
    offscreen.width = size.w;
    offscreen.height = size.h;
    const ctx = offscreen.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size.w, size.h);

    // draws the top layers pixels scaled down
    if (doc.metadata.layers.length > 0) {
      const topLayerMeta = doc.metadata.layers[doc.metadata.layers.length - 1];
      const pixels = doc.layerPixels.get(topLayerMeta.id);

      if (pixels) {
        const flipped = flipVertically(pixels, doc.metadata.width, doc.metadata.height);

        const layerCanvas = document.createElement('canvas');
        layerCanvas.width = doc.metadata.width;
        layerCanvas.height = doc.metadata.height;

        const layerCtx = layerCanvas.getContext('2d')!;
        const imageData = new ImageData(
          new Uint8ClampedArray(flipped), doc.metadata.width, doc.metadata.height
        );
        layerCtx.putImageData(imageData, 0, 0);
        ctx.drawImage(layerCanvas, 0, 0, size.w, size.h);
      }
    }

    const url = offscreen.toDataURL('image/png');
    thumbnailCache.current.set(commitId, url);

    return url;
  }

  async function handleTimelinePreview(commit: CommitSummary) {
    if (!projectId) return;
    previewingRef.current = true;

    try {
      const buffer = await fetchSnapshot(projectId, commit.id);
      const doc    = await deserialiseDocumentCompressed(buffer);
      const gl     = glRef.current!;
      const canvas = canvasRef.current!;

      // Only resize if dimensions actually differ, to avoid flicker
      if (canvas.width !== doc.metadata.width || canvas.height !== doc.metadata.height) {
        canvas.width  = doc.metadata.width;
        canvas.height = doc.metadata.height;
        gl.viewport(0, 0, doc.metadata.width, doc.metadata.height);
        setCanvasPixelSize({ width: doc.metadata.width, height: doc.metadata.height });
      }

      loadLayers(gl, doc.metadata, doc.layerPixels);
      compositeToScreen();
    } catch (err) {
      console.error('Timeline preview failed:', err);
    }
  }

  // function handleTimelineCommit(commit: CommitSummary) {
  //   // Actually commit to viewing this state — same as clicking "View" in Commits tab
  //   handleRestoreCommit(commit);
  // }

  async function handleTimelinePreviewEnd() {
    // Revert canvas back to whatever is actually being viewed/committed
    if (!projectId || !viewingCommitId || !activeBranchId) return;

    try {
      const isHeadCommit = viewingCommitId === headCommitId;
      const buffer = isHeadCommit
        ? await fetchCurrentState(projectId, activeBranchId)
        : await fetchSnapshot(projectId, viewingCommitId);
      const doc    = await deserialiseDocumentCompressed(buffer)
      const gl     = glRef.current!
      const canvas = canvasRef.current!

      if (canvas.width !== doc.metadata.width || canvas.height !== doc.metadata.height) {
        canvas.width  = doc.metadata.width
        canvas.height = doc.metadata.height
        gl.viewport(0, 0, doc.metadata.width, doc.metadata.height)
        setCanvasPixelSize({ width: doc.metadata.width, height: doc.metadata.height })
      }

      loadLayers(gl, doc.metadata, doc.layerPixels)
      compositeToScreen()
    } catch (err) {
      console.error('Failed to revert preview:', err)
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current!;
    // guards agains React strict mode double-invocation in development
    if (!initializedRef.current) {
      initializedRef.current = true;
    }

    const gl = canvas.getContext('webgl2');
    if (!gl) { console.error('WebGL2 not supported'); return };

    glRef.current = gl;
    rendererRef.current = new BrushRenderer(gl);
    compositorRef.current = new Compositor(gl);

    resizeCanvas(canvas);
    setCanvasPixelSize({ width: canvas.width, height: canvas.height });
    init(gl, canvas.width, canvas.height);
    pushSnapshot(gl, layersRef.current);
    compositeToScreen();

    // Handles an imported .gitcreative file (from Gallery import) if present,
    // otherwise loads the project normally from the URL
    const importedDoc = (location.state as { importedDoc?: DeserialisedDocument })?.importedDoc;
  
    async function applyImportedDoc(doc: DeserialisedDocument) {
      const gl = glRef.current!;
      const canvas = canvasRef.current!;

      canvas.width = doc.metadata.width;
      canvas.height = doc.metadata.height;
      gl.viewport(0, 0, doc.metadata.width, doc.metadata.height);
      setCanvasPixelSize({ width: doc.metadata.width, height: doc.metadata.height });

      loadLayers(gl, doc.metadata, doc.layerPixels);
      setProjectName(doc.metadata.name);
      compositeToScreen();
      pushSnapshot(gl, layersRef.current);

      if (!urlProjectId || !urlBranchId) return;

      const blob = await serialiseDocumentCompressed(
        { name: doc.metadata.name, activeLayerId: doc.metadata.activeLayerId },
        layersRef.current,
        gl
      );

      const { commitId } = await createCommit(
        urlProjectId, urlBranchId, null, 'Imported project', blob
      );

      setHeadCommitId(commitId);
      setViewingCommitId(commitId);
      await refreshCommits(urlProjectId, urlBranchId);
    }

    if (importedDoc) {
      applyImportedDoc(importedDoc);
    } else if (urlProjectId) {
      loadProject(urlProjectId, urlBranchId);
    }

    function handleKeyDown(e: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl && e.key === 's') {
        e.preventDefault();

        handleQuickSaveRef.current();
        return;
      }

      if (cmdOrCtrl && e.key === 'z') {
        e.preventDefault();

        if (e.shiftKey) {
          // cmd+Shift+z => redo
          const gl = glRef.current!;
          if (redo(gl, layersRef.current)) compositeToScreen();
        } else {
          // cmd+z => undo
          const gl = glRef.current!;
          if (undo(gl, layersRef.current)) compositeToScreen();
        }
      }
    }

    function handleResize() {
      resizeCanvas(canvas);
      compositeToScreen();
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
      if (airbrushTimer.current) clearInterval(airbrushTimer.current);
    }
  }, []); 

  // Re-composite whenever layer state changes (visibility, opacity, order, blend mode)
  useEffect(() => {
    if (glRef.current && compositorRef.current) compositeToScreen();
  }, [layersDisplay]);

  const currentHex = rgbToHex(rgb);

  return (
    <>
      {/* Toolbar */}
      <div style={{
        position: 'absolute', top: 10, left: 10, zIndex: 10,
        background: 'white', border: '1px solid #ddd',
        borderRadius: 10, padding: 12,
        display: 'flex', flexDirection: 'column', gap: 10,
        boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
        width: 244,
      }}>
        {/* Back to Gallery button */}
        <button
          onClick={() => navigate('/gallery')}
          style={{
            padding: '4px 0', borderRadius: 6,
            border: '1px solid #ddd', background: 'white',
            cursor: 'pointer', fontSize: 13,
          }}
        >← Gallery</button>
        {/* Project name */}
        <input
          value={projectName}
          onChange={e => setProjectName(e.target.value)}
          aria-label="Project name"
          style={{
            border: 'none', borderBottom: '1px solid #ddd',
            fontSize: 13, fontWeight: 500,
            width: '100%', padding: '2px 0',
            outline: 'none', background: 'transparent',
          }}
        />

        {/* Quick-save button */}
        <button
          onClick={handleQuickSave}
          disabled={saving || isDetached}
          title={isDetached ? 'Cannot save while viewing a past state' : 'Save (Cmd+S)'}
          style={{
            padding: '4px 0', borderRadius: 6,
            border: '1px solid #ddd',
            background: saving ? '#f8f8f8' : 'white',
            cursor: isDetached ? 'default' : 'pointer',
            fontSize: 13, opacity: isDetached ? 0.4 : 1,
          }}
        >
          {saving ? 'Saving...' : '💾 Save'}
          {lastSavedAt && !saving && (
            <span style={{ fontSize: 10, color: '#aaa', marginLeft: 4 }}>
              {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </button>

        {/* Export */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleProjectExport}
            style={{
              flex: 1, padding: '4px 0', borderRadius: 6,
              border: '1px solid #ddd', background: 'white',
              cursor: 'pointer', fontSize: 13,
            }}
          >⬇ Export</button>
        </div>

        {/* Undo / Redo */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleUndo}
            disabled={!canUndo()}
            style={{
              flex: 1, padding: '4px 0', borderRadius: 6,
              border: '1px solid #ddd',
              background: canUndo() ? 'white' : '#f8f8f8',
              color: canUndo() ? '#000' : '#bbb',
              cursor: canUndo() ? 'pointer' : 'default',
              fontSize: 13,
            }}
          >↩ Undo</button>
          <button
            onClick={handleRedo}
            disabled={!canRedo()}
            style={{
              flex: 1, padding: '4px 0', borderRadius: 6,
              border: '1px solid #ddd',
              background: canRedo() ? 'white' : '#f8f8f8',
              color: canRedo() ? '#000' : '#bbb',
              cursor: canRedo() ? 'pointer' : 'default',
              fontSize: 13,
            }}
          >↪ Redo</button>
        </div>

        {/* Tool selector*/}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['pencil', 'ink', 'eraser', 'airbrush', 'fill'] as Tool[]).map(t => (
            <button
              key={t}
              onClick={() => { setTool(t); setEyedropper(false) }}
              style={{
                flex: 1, padding: '4px 0', borderRadius: 6,
                border: '1px solid #ddd',
                background: tool === t && !eyedropper ? '#f0f0f0' : 'white',
                fontWeight: tool === t && !eyedropper ? 600 : 400,
                cursor: 'pointer', fontSize: 12,
              }}
            >{t}</button>
          ))}
        </div>

        {/* Fill tolerance slider — only visible while Fill tool is active */}
        {tool === 'fill' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#888' }}>Fill tolerance</span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                onClick={() => setFillTolerance(t => Math.max(0, t - 1))}
                aria-label="Decrease tolerance by 1"
                style={{
                  width: 18, height: 18, borderRadius: 4,
                  border: '1px solid #ddd', background: 'white',
                  cursor: 'pointer', fontSize: 11, lineHeight: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, padding: 0,
                }}
              >−</button>

              <input
                type="range" min={0} max={255} step={1}
                value={fillTolerance}
                onChange={e => setFillTolerance(parseInt(e.target.value))}
                aria-label="Fill tolerance"
                style={{ flex: 1, minWidth: 0 }}
              />

              <button
                onClick={() => setFillTolerance(t => Math.min(255, t + 1))}
                aria-label="Increase tolerance by 1"
                style={{
                  width: 18, height: 18, borderRadius: 4,
                  border: '1px solid #ddd', background: 'white',
                  cursor: 'pointer', fontSize: 11, lineHeight: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, padding: 0,
                }}
              >+</button>

              <span style={{
                fontSize: 11, color: '#888',
                width: 26, flexShrink: 0,
                textAlign: 'right',
              }}>
                {fillTolerance}
              </span>
            </div>
          </div>
        )}

        {/* Airbrush variant dropdown => shows only when airbrush is active */}
        {tool === 'airbrush' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#888' }}>Airbrush type</span>
            <select
              value={airbrushVariant}
              onChange={e => setAirbrushVariant(e.target.value as AirbrushVariant)}
              title="Airbrush hardness"
              style={{ fontSize: 12, border: '1px solid #ddd', borderRadius: 4, padding: '3px 4px' }}
            >
              {AIRBRUSH_VARIANTS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Color swatch + eyedropper */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div
            onClick={() => setShowPicker(p => !p)}
            title="Pick color"
            style={{
              width: 32, height: 32, borderRadius: 6,
              background: currentHex,
              border: '1px solid rgba(0,0,0,0.15)',
              cursor: 'pointer', flexShrink: 0,
            }}
          />
          <button
            onClick={() => setEyedropper(e => !e)}
            style={{
              padding: '4px 10px', borderRadius: 6,
              border: '1px solid #ddd',
              background: eyedropper ? '#f0f0f0' : 'white',
              cursor: 'pointer', fontSize: 13,
            }}
          >eyedropper</button>
          <span style={{ fontSize: 12, color: '#888', fontFamily: 'monospace' }}>
            {currentHex}
          </span>
        </div>

        {/* Color picker */}
        {showPicker && (
          <>
            <ColorPicker color={hsvColor} onChange={setHsvColor} />
            <RecentColors
              colors={recentColors}
              onSelect={c => setHsvColor(rgbToHsv(c))}
            />
          </>
        )}
        {/* Export */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['png', 'jpeg'] as ExportFormat[]).map(fmt => (
            <button
              key={fmt}
              onClick={() => handleExport(fmt)}
              style={{
                flex: 1, padding: '4px 0', borderRadius: 6,
                border: '1px solid #ddd', background: 'white',
                cursor: 'pointer', fontSize: 13,
              }}
            >export {fmt.toUpperCase()}</button>
          ))}
        </div>
      </div>
      <div style={{
        position: 'absolute',
        left: 12,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}>
        {/* Brush size bar — upper half of the left edge */}
        <VerticalBar
          value={brushSize}
          min={1}
          max={500}
          onChange={setBrushSize}
          onInteracting={setSizeBarActive}
          formatLabel={v => String(v)}
        />

        {/* Brush opacity bar — lower half of the left edge */}
        <VerticalBar
          value={brushOpacity}
          min={0}
          max={1}
          step={0.01}
          onChange={setBrushOpacity}
          formatLabel={v => `${Math.round(v * 100)}%`}
        />
      </div>
      
      {/* Brush size preview — centred on canvas, visible while interacting */}
      <BrushPreview
        size={physicalBrushSize}
        visible={sizeBarActive}
        canvasWidth={canvasPixelSize.width}
        canvasHeight={canvasPixelSize.height}
      />

      {/* Tab panel: Layers, commits, branches */}
      <RightPanel
        // Layer props
        layers={layersDisplay}
        activeLayerId={activeLayerId}
        onSelectLayer={setActiveLayerId}
        onAddLayer={addLayer}
        onDeleteLayer={deleteLayer}
        onMoveUp={id => moveLayer(id, 'up')}
        onMoveDown={id => moveLayer(id, 'down')}
        onVisibility={setVisibility}
        onOpacity={setOpacity}
        onBlendMode={setBlendMode}
        onRename={renameLayer}
        onClear={handleClearLayer}

        // Commit props
        viewingCommitId={viewingCommitId}
        branchCommits={branchCommits}
        allCommits={allCommits}
        headCommitId={headCommitId}
        activeBranchId={activeBranchId}
        commitMessage={commitMessage}
        committing={committing}
        isDetached={isDetached}
        onCommitMessageChange={setCommitMessage}
        onCommit={handleCommit}
        onRestoreCommit={handleRestoreCommit}
        onCreateBranchFromCommit={handleCreateBranchFromCommit}
        onTimelinePreview={handleTimelinePreview}
        onTimelinePreviewEnd={handleTimelinePreviewEnd}
        onFetchThumbnail={handleFetchThumbnail}

        // Branch props
        branches={branches}
        onCheckout={handleCheckout}
        onDeleteBranch={handleDeleteBranch}
      />

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          display: 'block', width: '100vw', height: '100vh',
          touchAction: 'none',
          cursor: eyedropper ? 'crosshair' : tool === 'fill' ? 'cell' : 'default',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      />
    </>
  );
}