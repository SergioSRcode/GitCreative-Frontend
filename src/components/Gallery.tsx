import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  listProjects, createProject, deleteProject, 
  type Project 
} from "../api/projects";
import { deserialiseDocumentCompressed } from "../utils/document";
import { renameProject } from "../api/projects";
import { fetchProjectThumbnail } from "../utils/thumbnail";
import { CANVAS_SIZE_PRESETS, resolveScreenSize } from '../types/canvasSize';

export function Gallery() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map());
  const [selectedPreset, setSelectedPreset] = useState(0); // index into CANVAS_SIZE_PRESETS
  const [customWidth,  setCustomWidth]  = useState(1920);
  const [customHeight, setCustomHeight] = useState(1080);
  const [useCustomSize, setUseCustomSize] = useState(false);

  async function loadProjects() {
    setLoading(true);

    try {
      const { projects: list } = await listProjects();
      setProjects(list);
    } catch (err) {
      console.error('Failed to load projects: ', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProjects();
  }, []);  

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);

    try {
      let width: number;
      let height: number;

      if (useCustomSize) {
        width  = Math.max(1, customWidth);
        height = Math.max(1, customHeight);
      } else {
        const preset = CANVAS_SIZE_PRESETS[selectedPreset];

        if (preset.width === 0 && preset.height === 0) {
          const screen = resolveScreenSize();
          width  = screen.width;
          height = screen.height;
        } else {
          width  = preset.width;
          height = preset.height;
        }
      }

      const { projectId, branchId } = await createProject(newName.trim(), width, height);
      navigate(`/projects/${projectId}/branches/${branchId}`);
    } catch (err) {
      console.error('Failed to create project:', err);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(projectId: string, e: React.MouseEvent) {
    e.stopPropagation();  // prevents opening a project when clicking delete

    if (deleting === projectId) {
      // second click => confirmed
      try {
        await deleteProject(projectId);
        setProjects(prev => prev.filter(p => p.id !== projectId));
      } catch (err) {
        console.error('Failed to delete project: ', err);
      } finally {
        setDeleting(null);
      }
    } else {
      // first click => makes delete button active
      setDeleting(projectId);
      // auto-reset after 3 secs
      setTimeout(() => setDeleting(null), 3000);
    }
  }

  function handleLogout() {
    localStorage.removeItem('authToken');
    navigate('/auth');
  }

  async function handleImport(file: File) {
    try {
      const buffer = await file.arrayBuffer();
      const doc = await deserialiseDocumentCompressed(buffer);

      // creates a brand new project from the imported file's metadata
      const { projectId, branchId } = await createProject(
        doc.metadata.name || 'Imported Project',
        doc.metadata.width,
        doc.metadata.height
      );

      // Re-serialises the imported data as the initial commit for the new project
      // Storing it temporarily so Canvas can pick it up on mount
      sessionStorage.setItem('pendingImport', JSON.stringify({
        metadataJson: JSON.stringify(doc.metadata)
      }));

      // stores raw layer pixels separately as they cannot go in sessionStorage as JSON
      // IndexedDB-free approach: passes via navigation state instead
      navigate(`/projects/${projectId}/branches/${branchId}`, {
        state: { importedDoc: doc }
      });
    } catch (err) {
      console.error('Import failed: ', err);
      alert('File could not be imported - it may not be a valid .gitcreative file');
    }
  }

  function startRenaming(project: Project, e: React.MouseEvent) {
    e.stopPropagation();  // avoids triggering the card's "open project" click

    setRenamingId(project.id);
    setRenameValue(project.name);
  }

  async function commitRename(projectId: string) {
    const trimmed = renameValue.trim();
    setRenamingId(null);

    if (!trimmed) return;  // ignores empty renames, revert silently

    try {
      await renameProject(projectId, trimmed);

      setProjects(prev => prev.map(p =>
        p.id === projectId ? { ...p, name: trimmed } : p
      ));

    } catch (err) {
      console.error('Rename failed:', err);
    }
  }

  useEffect(() => {
    let cancelled = false

    async function loadThumbnails() {
      for (const project of projects) {
        if (thumbnails.has(project.id)) continue
        const branchId = project.last_active_branch_id ?? project.main_branch_id

        try {
          const url = await fetchProjectThumbnail(project.id, branchId)
          if (!cancelled) {
            setThumbnails(prev => new Map(prev).set(project.id, url))
          }
        } catch {
          // Leave unset — card falls back to the emoji placeholder
        }
      }
    }

    if (projects.length > 0) loadThumbnails()
    return () => { cancelled = true }
  }, [projects]);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f5f3',
      padding: 32,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 32,
      }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
          🎨 GitCreative
        </h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => setShowNew(s => !s)}
            style={{
              padding: '8px 16px', borderRadius: 8,
              border: 'none', background: '#222', color: 'white',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}
          >+ New Project</button>
          <label style={{
            padding: '8px 16px', borderRadius: 8,
            border: '1px solid #ddd', background: 'white',
            cursor: 'pointer', fontSize: 13,
          }}>
            ⬆ Import Project
            <input
              type="file"
              accept=".gitcreative"
              style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) handleImport(file)
                e.target.value = ''
              }}
            />
          </label>
          <button
            onClick={handleLogout}
            style={{
              padding: '8px 16px', borderRadius: 8,
              border: '1px solid #ddd', background: 'white',
              cursor: 'pointer', fontSize: 13,
            }}
          >Log out</button>
        </div>
      </div>

      {/* New project form */}
      {showNew && (
        <div style={{
          background: 'white', borderRadius: 10, padding: 16,
          marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)', maxWidth: 420,
        }}>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Project name..."
            aria-label="New project name"
            autoFocus
            style={{
              border: '1px solid #ddd', borderRadius: 6,
              padding: '7px 10px', fontSize: 13, outline: 'none',
            }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#888' }}>Canvas size</span>
            <select
              value={useCustomSize ? 'custom' : selectedPreset}
              onChange={e => {
                if (e.target.value === 'custom') {
                  setUseCustomSize(true)
                } else {
                  setUseCustomSize(false)
                  setSelectedPreset(Number(e.target.value))
                }
              }}
              style={{ fontSize: 13, border: '1px solid #ddd', borderRadius: 6, padding: '6px 8px' }}
            >
              {CANVAS_SIZE_PRESETS.map((preset, i) => (
                <option key={preset.name} value={i}>{preset.name}</option>
              ))}
              <option value="custom">Custom size...</option>
            </select>
          </div>

          {useCustomSize && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="number" min={1}
                value={customWidth}
                onChange={e => setCustomWidth(parseInt(e.target.value) || 1)}
                aria-label="Custom width"
                style={{ flex: 1, border: '1px solid #ddd', borderRadius: 6, padding: '6px 8px', fontSize: 13 }}
              />
              <span style={{ color: '#888', fontSize: 13 }}>×</span>
              <input
                type="number" min={1}
                value={customHeight}
                onChange={e => setCustomHeight(parseInt(e.target.value) || 1)}
                aria-label="Custom height"
                style={{ flex: 1, border: '1px solid #ddd', borderRadius: 6, padding: '6px 8px', fontSize: 13 }}
              />
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            style={{
              padding: '7px 16px', borderRadius: 6, border: 'none',
              background: newName.trim() && !creating ? '#222' : '#ccc',
              color: 'white', cursor: newName.trim() && !creating ? 'pointer' : 'default',
              fontSize: 13, fontWeight: 600,
            }}
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
      )}

      {/* Project grid */}
      {loading ? (
        <div style={{ color: '#888', fontSize: 14 }}>Loading projects...</div>
      ) : projects.length === 0 ? (
        <div style={{
          textAlign: 'center', color: '#aaa',
          fontSize: 15, marginTop: 80,
        }}>
          No projects yet — create your first one above
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 16,
        }}>
          {projects.map(project => (
            <div
              key={project.id}
              onClick={() => {
                const branchId = project.last_active_branch_id ?? project.main_branch_id;
                navigate(`/projects/${project.id}/branches/${branchId}`)
              }}
              style={{
                background: 'white', borderRadius: 10, padding: 16,
                cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                border: '1px solid #eee',
                display: 'flex', flexDirection: 'column', gap: 8,
                transition: 'box-shadow 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)')}
            >
              {/* Thumbnail placeholder — M9 will add real thumbnails */}
              <div style={{
                width: '100%', aspectRatio: '16/9',
                background: '#f5f5f3', borderRadius: 6,
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 28,
                overflow: 'hidden',
              }}>
                {thumbnails.has(project.id) ? (
                  <img
                    src={thumbnails.get(project.id)}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  '🎨'
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {renamingId === project.id ? (
                    <input
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onClick={e => e.stopPropagation()}
                      onBlur={() => commitRename(project.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitRename(project.id)
                        if (e.key === 'Escape') setRenamingId(null)
                      }}
                      autoFocus
                      onFocus={e => e.target.select()}
                      style={{
                        fontSize: 14, fontWeight: 600, border: '1px solid #ddd',
                        borderRadius: 4, padding: '2px 4px', width: '100%',
                        outline: 'none',
                      }}
                    />
                  ) : (
                    <span
                      onClick={e => startRenaming(project, e)}
                      title="Click to rename"
                      style={{ fontSize: 14, fontWeight: 600, cursor: 'text' }}
                    >
                      {project.name}
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: '#aaa' }}>
                    {new Date(project.updated_at).toLocaleDateString()}
                  </span>
                  <span style={{ fontSize: 11, color: '#bbb' }}>
                    {project.width} × {project.height}
                  </span>
                </div>

                <button
                  onClick={e => handleDelete(project.id, e)}
                  title={deleting === project.id ? 'Click again to confirm' : 'Delete project'}
                  style={{
                    border: '1px solid',
                    borderColor: deleting === project.id ? '#d33' : '#eee',
                    background: deleting === project.id ? '#fdeaea' : 'white',
                    color: deleting === project.id ? '#d33' : '#bbb',
                    borderRadius: 4, padding: '2px 6px',
                    fontSize: 11, cursor: 'pointer',
                    fontWeight: deleting === project.id ? 600 : 400,
                    flexShrink: 0,
                  }}
                >
                  {deleting === project.id ? 'Confirm?' : '✕'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}