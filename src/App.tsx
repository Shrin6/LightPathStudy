import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import AlphaKeyActivation from "./pages/AlphaKeyActivation";
import AlphaGuard from "./components/AlphaGuard";
import Study from "./pages/Study";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import FeatureTutor from "./pages/FeatureTutor";
import FeatureQuizzes from "./pages/FeatureQuizzes";
import FeatureFlashcards from "./pages/FeatureFlashcards";
import FeatureMemory from "./pages/FeatureMemory";

const queryClient = new QueryClient();

const App = () => {
  // Initialize theme on app mount
  useEffect(() => {
    const storedTheme = localStorage.getItem('theme') || 'system';
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    
    if (storedTheme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(storedTheme);
    }
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/activate" element={<AlphaKeyActivation />} />
          <Route path="/study" element={<AlphaGuard><Study /></AlphaGuard>} />
          <Route path="/dashboard" element={<AlphaGuard><Dashboard /></AlphaGuard>} />
          <Route path="/settings" element={<AlphaGuard><Settings /></AlphaGuard>} />
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
};

export default App;