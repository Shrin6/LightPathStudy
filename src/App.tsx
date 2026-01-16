import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Study from "./pages/Study";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import FeatureTutor from "./pages/FeatureTutor";
import FeatureQuizzes from "./pages/FeatureQuizzes";
import FeatureFlashcards from "./pages/FeatureFlashcards";
import FeatureMemory from "./pages/FeatureMemory";
import CalendarConverter from "./pages/CalendarConverter";
import AdBlockNotice from "./components/AdBlockNotice";

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
      {/* Global ad-block/resource-block detection — shows a one-time-per-session dialog when a resource appears blocked */}
      <AdBlockNotice />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/study" element={<Study />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/features/tutor" element={<FeatureTutor />} />
          <Route path="/features/quizzes" element={<FeatureQuizzes />} />
          <Route path="/features/flashcards" element={<FeatureFlashcards />} />
          <Route path="/features/memory" element={<FeatureMemory />} />
          <Route path="/calendar-converter" element={<CalendarConverter />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;