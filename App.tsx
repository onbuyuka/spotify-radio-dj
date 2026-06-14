import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SpotifyProvider } from './components/SpotifyStore';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { PlayPage } from './pages/PlayPage';
import { SettingsPage } from './pages/SettingsPage';

const App: React.FC = () => (
  <SpotifyProvider>
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/play" element={<PlayPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  </SpotifyProvider>
);

export default App;
