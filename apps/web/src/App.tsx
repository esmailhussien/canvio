import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Routes, Route, useLocation, useParams } from 'react-router-dom';
import { Seo } from './components/Seo/Seo';
import { useCanvasStore } from './store/canvasStore';

const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const WorldPage = lazy(() => import('./pages/WorldPage').then((m) => ({ default: m.WorldPage })));
const SupportPage = lazy(() => import('./pages/SupportPage').then((m) => ({ default: m.SupportPage })));
const HowItWorksPage = lazy(() => import('./pages/HowItWorksPage').then((m) => ({ default: m.HowItWorksPage })));
const UpdatesPage = lazy(() => import('./pages/UpdatesPage').then((m) => ({ default: m.UpdatesPage })));

function PageLoadingFallback() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg-canvas, #0a0a0f)',
        color: 'var(--text-secondary, #94a3b8)',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '14px',
        letterSpacing: '0.02em',
      }}
      role="status"
      aria-label="Loading page..."
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            border: '2px solid rgba(99, 102, 241, 0.2)',
            borderTopColor: '#6366f1',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <span>Loading Canvio...</span>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function LegacyWorldRedirect() {
  const { worldId = '' } = useParams();
  const location = useLocation();
  const looksLikeBoardId = /^[A-Za-z0-9_-]{6,64}$/.test(worldId);
  const suffix = `${location.search}${location.hash}`;

  return <Navigate to={looksLikeBoardId ? `/w/${encodeURIComponent(worldId)}${suffix}` : '/'} replace />;
}

export function App() {
  const themePreference = useCanvasStore((state) => state.themePreference);
  const syncSystemTheme = useCanvasStore((state) => state.syncSystemTheme);

  useEffect(() => {
    if (themePreference !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const handleChange = () => syncSystemTheme();
    handleChange();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleChange);
      return () => media.removeEventListener('change', handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, [syncSystemTheme, themePreference]);

  return (
    <BrowserRouter>
      <Seo />
      <Suspense fallback={<PageLoadingFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/w/:worldId" element={<WorldPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/updates" element={<UpdatesPage />} />
          <Route path="/updates/:slug" element={<UpdatesPage />} />
          <Route path="/:worldId" element={<LegacyWorldRedirect />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
