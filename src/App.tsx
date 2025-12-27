import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import Auth from "./pages/Auth";
import ChangePassword from "./pages/ChangePassword";
import Dashboard from "./pages/Dashboard";
import Items from "./pages/Items";
import ItemDetails from "./pages/ItemDetails";
import NewItem from "./pages/NewItem";
import Recipients from "./pages/Recipients";
import Categories from "./pages/Categories";
import ReminderRules from "./pages/ReminderRules";
import Settings from "./pages/Settings";
import Integration from "./pages/Integration";
import Integrations from "./pages/Integrations";
import Security from "./pages/Security";
import TeamManagement from "./pages/TeamManagement";
import AIAdvisor from "./pages/AIAdvisor";
import ComplianceReports from "./pages/ComplianceReports";
import Departments from "./pages/Departments";
import UserProfile from "./pages/UserProfile";
import Delegations from "./pages/Delegations";
import KPITemplates from "./pages/KPITemplates";
import Evaluations from "./pages/Evaluations";
import UserImport from "./pages/UserImport";
import EvaluationReview from "./pages/EvaluationReview";
import MyResults from "./pages/MyResults";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/change-password" element={<ChangePassword />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="items" element={<Items />} />
        <Route path="items/new" element={<NewItem />} />
        <Route path="items/:id" element={<ItemDetails />} />
        <Route path="recipients" element={<Recipients />} />
        <Route path="categories" element={<Categories />} />
        <Route path="reminder-rules" element={<ReminderRules />} />
        <Route path="settings" element={<Settings />} />
        <Route path="security" element={<Security />} />
        <Route path="team-management" element={<TeamManagement />} />
        <Route path="team" element={<Navigate to="/team-management" replace />} />
        <Route path="integrations" element={<Integrations />} />
        <Route path="integration" element={<Integration />} />
        <Route path="ai-advisor" element={<AIAdvisor />} />
        <Route path="compliance-reports" element={<ComplianceReports />} />
        <Route path="departments" element={<Departments />} />
        <Route path="profile" element={<UserProfile />} />
        <Route path="delegations" element={<Delegations />} />
        <Route path="kpi-templates" element={<KPITemplates />} />
        <Route path="evaluations" element={<Evaluations />} />
        <Route path="evaluation-review" element={<EvaluationReview />} />
        <Route path="my-results" element={<MyResults />} />
        <Route path="user-import" element={<UserImport />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AppRoutes />
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
