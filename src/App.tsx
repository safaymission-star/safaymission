import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import Dashboard from "./pages/Dashboard";
import ContactForm from "./pages/ContactForm";
import PendingWorks from "./pages/PendingWorks";
import MembershipMembers from "./pages/MembershipMembers";
import CompletedWorks from "./pages/CompletedWorks";
import AddEmployee from "./pages/AddEmployee";
import AllWorkers from "./pages/AllWorkers";
import Attendance from "./pages/Attendance";
import Expense from "./pages/Expense";
import NotFound from "./pages/NotFound";
import FirebaseTest from "./pages/FirebaseTest";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import { useEffect } from "react";
import { clearLocalStorage, needsMigration } from "./lib/localStorage";

const queryClient = new QueryClient();

const App = () => {
  // Clear old localStorage data on first load
  useEffect(() => {
    if (needsMigration()) {
      console.log('🔄 Migrating from localStorage to Firebase...');
      clearLocalStorage();
      console.log('✅ Migration complete! Now using Firebase.');
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public route */}
            <Route path="/login" element={<Login />} />
            
            {/* Protected routes */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <SidebarProvider>
                    <div className="min-h-screen flex w-full">
                      <AppSidebar />
                      <div className="flex-1 flex flex-col">
                        <header className="h-14 border-b bg-card flex items-center px-4">
                          <SidebarTrigger />
                        </header>
                        <main className="flex-1 p-6 overflow-auto">
                          <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/test" element={<FirebaseTest />} />
                            <Route path="/contact-form" element={<ContactForm />} />
                            <Route path="/pending-works" element={<PendingWorks />} />
                            <Route path="/completed-works" element={<CompletedWorks />} />
                            <Route path="/membership-members" element={<MembershipMembers />} />
                            <Route path="/add-employee" element={<AddEmployee />} />
                            <Route path="/all-workers" element={<AllWorkers />} />
                            <Route path="/attendance" element={<Attendance />} />
                            <Route path="/expense" element={<Expense />} />
                            <Route path="*" element={<NotFound />} />
                          </Routes>
                        </main>
                      </div>
                    </div>
                  </SidebarProvider>
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
