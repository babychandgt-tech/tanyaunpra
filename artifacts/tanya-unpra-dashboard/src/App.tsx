import { ComponentType } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { MainLayout } from "@/components/layout/main-layout";

// Pages
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import ChatLogs from "@/pages/chat-logs";
import Intents from "@/pages/intents";
import Jadwal from "@/pages/jadwal";
import Kalender from "@/pages/kalender";
import Pengumuman from "@/pages/pengumuman";
import Mahasiswa from "@/pages/mahasiswa";
import Dosen from "@/pages/dosen";
import Matkul from "@/pages/matkul";
import ApiKeys from "@/pages/api-keys";
import Users from "@/pages/users";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component, allowedRoles }: { component: ComponentType, allowedRoles?: string[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">Loading...</div>;
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Redirect to="/dashboard" />;
  }

  return (
    <MainLayout>
      <Component />
    </MainLayout>
  );
}

function Router() {
  const { user } = useAuth();
  
  return (
    <Switch>
      <Route path="/">
        {user ? <Redirect to="/dashboard" /> : <Redirect to="/login" />}
      </Route>
      <Route path="/login">
        {user ? <Redirect to="/dashboard" /> : <Login />}
      </Route>
      
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/chat-logs" component={() => <ProtectedRoute component={ChatLogs} allowedRoles={["admin"]} />} />
      <Route path="/intents" component={() => <ProtectedRoute component={Intents} allowedRoles={["admin"]} />} />
      <Route path="/jadwal" component={() => <ProtectedRoute component={Jadwal} allowedRoles={["admin", "dosen"]} />} />
      <Route path="/kalender" component={() => <ProtectedRoute component={Kalender} allowedRoles={["admin", "dosen", "mahasiswa"]} />} />
      <Route path="/pengumuman" component={() => <ProtectedRoute component={Pengumuman} allowedRoles={["admin", "dosen"]} />} />
      <Route path="/mahasiswa" component={() => <ProtectedRoute component={Mahasiswa} allowedRoles={["admin", "dosen"]} />} />
      <Route path="/dosen" component={() => <ProtectedRoute component={Dosen} allowedRoles={["admin"]} />} />
      <Route path="/matkul" component={() => <ProtectedRoute component={Matkul} allowedRoles={["admin", "dosen"]} />} />
      <Route path="/settings/api-keys" component={() => <ProtectedRoute component={ApiKeys} allowedRoles={["admin"]} />} />
      <Route path="/users" component={() => <ProtectedRoute component={Users} allowedRoles={["admin"]} />} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
