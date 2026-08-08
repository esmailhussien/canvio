import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { WorldPage } from './pages/WorldPage';
import { HomePage } from './pages/HomePage';
import { SupportPage } from './pages/SupportPage';
import { HowItWorksPage } from './pages/HowItWorksPage';
import { UpdatesPage } from './pages/UpdatesPage';
import { Seo } from './components/Seo/Seo';

export function App() {
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
