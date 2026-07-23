import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { WorldPage } from './pages/WorldPage';
import { HomePage } from './pages/HomePage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/w/:worldId" element={<WorldPage />} />
      </Routes>
    </BrowserRouter>
  );
}
