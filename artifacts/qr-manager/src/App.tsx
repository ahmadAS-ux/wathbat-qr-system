import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/hooks/use-language";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/layout/Header";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

import Home from "@/pages/Home";
import Admin from "@/pages/Admin";
import AdminHistory from "@/pages/AdminHistory";
import AdminRequests from "@/pages/AdminRequests";
import AdminUsers from "@/pages/AdminUsers";
import AdminDropdowns from "@/pages/AdminDropdowns";
import Login from "@/pages/Login";
import Scan from "@/pages/Scan";
import NotFound from "@/pages/not-found";
import ErpLeads from "@/pages/erp/Leads";
import ErpLeadDetail from "@/pages/erp/LeadDetail";
import ErpProjects from "@/pages/erp/Projects";
import ErpProjectDetail from "@/pages/erp/ProjectDetail";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function ProtectedRoute({ component: Component, adminOnly = false }: { component: React.ComponentType; adminOnly?: boolean }) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) navigate('/login');
  }, [isLoading, user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#1B2A4A]" />
      </div>
    );
  }
  if (!user) return null;
  if (adminOnly && user.role !== 'Admin') {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Access denied — Admin only
      </div>
    );
  }
  return <Component />;
}

function AppRoutes() {
  const [location] = useLocation();
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const isScanPage = location === '/scan';
  const isLoginPage = location === '/login';
  const isAdminPage = location.startsWith('/admin') || location.startsWith('/erp');

  // Redirect already-logged-in users away from /login
  useEffect(() => {
    if (!isLoading && user && isLoginPage) navigate('/');
  }, [isLoading, user, isLoginPage]);

  const P = (C: React.ComponentType, adminOnly = false) => () => <ProtectedRoute component={C} adminOnly={adminOnly} />;

  return (
    <div className="flex flex-col min-h-screen relative">
      {!isScanPage && !isLoginPage && !isAdminPage && <Header />}
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/scan" component={Scan} />
        <Route path="/" component={P(Home)} />
        <Route path="/admin" component={P(Admin)} />
        <Route path="/admin/history" component={P(AdminHistory)} />
        <Route path="/admin/requests" component={P(AdminRequests)} />
        <Route path="/admin/users" component={P(AdminUsers, true)} />
        <Route path="/admin/dropdowns" component={P(AdminDropdowns, true)} />
        <Route path="/erp/leads" component={P(ErpLeads)} />
        <Route path="/erp/leads/:id" component={P(ErpLeadDetail)} />
        <Route path="/erp/projects" component={P(ErpProjects)} />
        <Route path="/erp/projects/:id" component={P(ErpProjectDetail)} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AppRoutes />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
