import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import AlphaKey from "./pages/AlphaKey";
import Study from "./pages/Study";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import FeatureTutor from "./pages/FeatureTutor";
import FeatureQuizzes from "./pages/FeatureQuizzes";
import FeatureFlashcards from "./pages/FeatureFlashcards";
import FeatureMemory from "./pages/FeatureMemory";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/alpha-key" element={<AlphaKey />} />
          <Route path="/study" element={<Study />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/features/tutor" element={<FeatureTutor />} />
          <Route path="/features/quizzes" element={<FeatureQuizzes />} />
          <Route path="/features/flashcards" element={<FeatureFlashcards />} />
          <Route path="/features/memory" element={<FeatureMemory />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
