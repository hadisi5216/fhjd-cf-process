import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './app/AppLayout';
import { ProtectedRoute } from './app/ProtectedRoute';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { LoginPage } from './pages/login/LoginPage';
import { ProcessesPage } from './pages/processes/ProcessesPage';
import { ProductDetailPage } from './pages/products/ProductDetailPage';
import { ProductsPage } from './pages/products/ProductsPage';
import { ScannersPage } from './pages/scanners/ScannersPage';
import { ScreenPage } from './pages/screen/ScreenPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { WarningsPage } from './pages/warnings/WarningsPage';
import './App.css';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/screen" element={<ScreenPage />} />
      <Route path="/" element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="products/:id" element={<ProductDetailPage />} />
          <Route path="processes" element={<ProcessesPage />} />
          <Route path="scanners" element={<ScannersPage />} />
          <Route path="warnings" element={<WarningsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
