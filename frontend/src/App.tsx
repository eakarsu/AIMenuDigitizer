import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MenuDetail from './pages/MenuDetail';
import AllergensPage from './pages/AllergensPage';
import CaloriesPage from './pages/CaloriesPage';
import TranslationsPage from './pages/TranslationsPage';
import AIAnalysisPage from './pages/AIAnalysisPage';
import PriceOptimizerPage from './pages/PriceOptimizerPage';
import DishRecommenderPage from './pages/DishRecommenderPage';
import NutritionHealthcarePage from './pages/NutritionHealthcarePage';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import ProfileSettings from './pages/ProfileSettings';
import PublicMenuPage from './pages/PublicMenuPage';
import MenuEngineerScorePage from './pages/MenuEngineerScorePage';
import DietaryFilterPage from './pages/DietaryFilterPage';
import SeasonalRotationPage from './pages/SeasonalRotationPage';
import LocationsPage from './pages/LocationsPage';
import StaffPage from './pages/StaffPage';
import IngredientCostsPage from './pages/IngredientCostsPage';
import IntegrationsPage from './pages/IntegrationsPage';
import AICostAnalysisPage from './pages/AICostAnalysisPage';
// @ts-ignore — JS module
import CustomViewsPage from './pages/CustomViewsPage';
import Layout from './components/Layout';
import ToastContainer from './components/ToastContainer';
import ErrorBoundary from './components/ErrorBoundary';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <ToastContainer />
          <ErrorBoundary>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/verify-email/:token" element={<VerifyEmail />} />
              {/* Public QR menu page — no authentication required */}
              <Route path="/menu/:id/view" element={<PublicMenuPage />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="menu/:id" element={<MenuDetail />} />
                <Route path="allergens" element={<AllergensPage />} />
                <Route path="calories" element={<CaloriesPage />} />
                <Route path="translations" element={<TranslationsPage />} />
                <Route path="ai-analysis" element={<AIAnalysisPage />} />
                <Route path="price-optimizer" element={<PriceOptimizerPage />} />
                <Route path="dish-recommender" element={<DishRecommenderPage />} />
                <Route path="nutrition-healthcare" element={<NutritionHealthcarePage />} />
                <Route path="settings" element={<ProfileSettings />} />
                <Route path="menu-engineer" element={<MenuEngineerScorePage />} />
                <Route path="dietary-filters" element={<DietaryFilterPage />} />
                <Route path="seasonal-rotation" element={<SeasonalRotationPage />} />
                <Route path="locations" element={<LocationsPage />} />
                <Route path="staff" element={<StaffPage />} />
                <Route path="ingredient-costs" element={<IngredientCostsPage />} />
                <Route path="integrations" element={<IntegrationsPage />} />
                <Route path="ai-cost-analysis" element={<AICostAnalysisPage />} />
                <Route path="custom-views" element={<CustomViewsPage />} />
              </Route>
            </Routes>
          </ErrorBoundary>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
