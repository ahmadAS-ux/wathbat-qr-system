import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/hooks/use-language";
import { Header } from "@/components/layout/Header";

import Home from "@/pages/Home";
import Admin from "@/pages/Admin";
import AdminHistory from "@/pages/AdminHistory";
import AdminRequests from "@/pages/AdminRequests";
import Scan from "@/pages/Scan";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRoutes() {
  const [location] = useLocation();
  const isScanPage = location === '/scan';

  return (
    <div className="flex flex-col min-h-screen relative">
      {!isScanPage && <Header />}
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/admin" component={Admin} />
        <Route path="/admin/history" component={AdminHistory} />
        <Route path="/admin/requests" component={AdminRequests} />
        <Route path="/scan" component={Scan} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppRoutes />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
