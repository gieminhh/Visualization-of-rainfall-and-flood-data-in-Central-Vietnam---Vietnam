import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import MainLayout from './components/layout/MainLayout';
import OverviewPage from './pages/OverviewPage';
import AnalysisPage from './pages/AnalysisPage';
import AILabPage from './pages/AILabPage';
import DataQualityPage from './pages/DataQualityPage';
import NotebookPage from './pages/NotebookPage';

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="analysis" element={<AnalysisPage />} />
            <Route path="ai-lab" element={<AILabPage />} />
            <Route path="data-quality" element={<DataQualityPage />} />
            <Route path="notebook" element={<NotebookPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
