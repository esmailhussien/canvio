import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { WorldPage } from './pages/WorldPage';
import { HomePage } from './pages/HomePage';
import { SupportPage } from './pages/SupportPage';
import { HowItWorksPage } from './pages/HowItWorksPage';
import { UpdatesPage } from './pages/UpdatesPage';
import { Seo } from './components/Seo/Seo';
import { useCanvasStore } from './store/canvasStore';

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
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/w/:worldId" element={<WorldPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/updates" element={<UpdatesPage />} />
        <Route path="/updates/:slug" element={<UpdatesPage />} />
      </Routes>
    </BrowserRouter>
  );
}
