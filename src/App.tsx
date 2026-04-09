import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Index from "./pages/Index";
import AICoach from "./pages/AICoach";
import Shop from "./pages/Shop";
import Appointments from "./pages/Appointments";
import ProfileData from "./pages/ProfileData";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  return (
    <DashboardLayout>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/coach" element={<AICoach />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/appointments" element={<Appointments />} />
        <Route path="/profile-data" element={<ProfileData />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </DashboardLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
