import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import AllPage from './pages/AllPage';
import UrlPage from './pages/UrlPage';
import CategoryPage from './pages/CategoryPage';
import FolderNotesPage from './pages/FolderNotesPage';
import FolderUrlsPage from './pages/FolderUrlsPage';
import SettingsPage from './pages/SettingsPage';
import NewNotePage from './pages/NewNotePage';
import SearchPage from './pages/SearchPage';
import MePage from './pages/MePage';
import TrashPage from './pages/TrashPage';
import MessageCenterPage from './pages/MessageCenterPage';
import AccountSecurityPage from './pages/AccountSecurityPage';
import DeviceManagementPage from './pages/DeviceManagementPage';
import HelpFeedbackPage from './pages/HelpFeedbackPage';
import AboutPage from './pages/AboutPage';
import UserAgreementPage from './pages/UserAgreementPage';
import './styles/global.css';
import './styles/colors.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="all" element={<AllPage />} />
          <Route path="url" element={<UrlPage />} />
          <Route path="url/folder/:folderId" element={<FolderUrlsPage />} />
          <Route path="category" element={<CategoryPage />} />
          <Route path="category/:folderId" element={<FolderNotesPage />} />
          <Route path="new-note" element={<NewNotePage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="me" element={<MePage />} />
          <Route path="messages" element={<MessageCenterPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="trash" element={<TrashPage />} />
          <Route path="account-security" element={<AccountSecurityPage />} />
          <Route path="devices" element={<DeviceManagementPage />} />
          <Route path="help-feedback" element={<HelpFeedbackPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="user-agreement" element={<UserAgreementPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;






