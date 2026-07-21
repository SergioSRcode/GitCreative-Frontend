import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listProjects, createProject, deleteProject, type Project } from "../api/projects";

export function Gallery() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

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
      // default canvas size - can be resized later
      const { projectId, branchId } = await createProject(newName.trim(), 1920, 1080);
      navigate(`/projects/${projectId}/branches/${branchId}`);
    } catch (err) {
      console.error('Failed to create project: ', err);
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
          marginBottom: 24, display: 'flex', gap: 10,
          alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          maxWidth: 480,
        }}>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Project name..."
            aria-label="New project name"
            onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
            autoFocus
            style={{
              flex: 1, border: '1px solid #ddd', borderRadius: 6,
              padding: '7px 10px', fontSize: 13, outline: 'none',
            }}
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            style={{
              padding: '7px 16px', borderRadius: 6,
              border: 'none',
              background: newName.trim() && !creating ? '#222' : '#ccc',
              color: 'white',
              cursor: newName.trim() && !creating ? 'pointer' : 'default',
              fontSize: 13, fontWeight: 600, flexShrink: 0,
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
              }}>
                🎨
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{project.name}</span>
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