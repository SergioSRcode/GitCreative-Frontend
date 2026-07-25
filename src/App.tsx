import { Routes, Route, Navigate, useParams } from "react-router-dom"
import { Canvas } from "./components/Canvas"
import { Gallery } from './components/Gallery'
import { AuthPage } from './components/AuthPage'

function isAuthenticated(): boolean {
  return !!localStorage.getItem('authToken');
}

// redirects unauthenticated users to /auth
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function CanvasWithKey() {
  const { projectId, branchId } = useParams()
  return <Canvas key={`${projectId}-${branchId}`} />
}

/*
Three routes:

/auth — login and register
/gallery — project list (protected)
/projects/:projectId — the canvas for a specific project (protected)

ProtectedRoute checks for the auth token and redirects to /auth if missing.
*/

export default function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />

      <Route path="/gallery" element={
        <ProtectedRoute>
          <Gallery />
        </ProtectedRoute>
      } />

      <Route path="/projects/:projectId" element={
        <ProtectedRoute>
          <Canvas />
        </ProtectedRoute>
      } />

      <Route path="/projects/:projectId/branches/:branchId" element={
        <ProtectedRoute>
          <CanvasWithKey />
        </ProtectedRoute>
      } />

      {/* Default redirect */}
      <Route path="*" element={
        <Navigate to={isAuthenticated() ? '/gallery' : '/auth'} replace />
      } />
    </Routes>
  );
}
