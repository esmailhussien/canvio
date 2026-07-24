import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { WorldPage } from './pages/WorldPage';
import { HomePage } from './pages/HomePage';
import { SupportPage } from './pages/SupportPage';
import { HowItWorksPage } from './pages/HowItWorksPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/w/:worldId" element={<WorldPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
      </Routes>
    </BrowserRouter>
  );
}
