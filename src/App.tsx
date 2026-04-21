import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import CompanyProfile from "./pages/CompanyProfile";
import NewProposal from "./pages/NewProposal";
import GuestNewProposal from "./pages/GuestNewProposal";
import GuestProposalPreview from "./pages/GuestProposalPreview";
import ProposalPreview from "./pages/ProposalPreview";
import ProposalDetail from "./pages/ProposalDetail";
import ProposalSign from "./pages/ProposalSign";
import Clients from "./pages/Clients";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminProposals from "./pages/admin/AdminProposals";
import AdminRevenue from "./pages/admin/AdminRevenue";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminReferrals from "./pages/admin/AdminReferrals";
import AdminSeeder from "./pages/admin/AdminSeeder";
import AdminAmbassadors from "./pages/admin/AdminAmbassadors";
import AmbassadorDashboard from "./pages/AmbassadorDashboard";
import ReferAndEarn from "./pages/ReferAndEarn";
import Tutorial from "./pages/Tutorial";
import ReviewsPage from "./pages/ReviewsPage";
import Earnings from "./pages/Earnings";
import PaymentComplete from "./pages/PaymentComplete";
import NotFound from "./pages/NotFound";
import HelpChatWidget from "./components/HelpChatWidget";
import { usePageTracking } from "./hooks/usePageTracking";
import { useErrorTracking } from "./hooks/useErrorTracking";

const queryClient = new QueryClient();

function AppTracking() {
  usePageTracking();
  useErrorTracking();
  return null;
}

function HelpChatWidgetWrapper() {
  const location = useLocation();
  if (location.pathname.includes('/sign') || location.pathname.startsWith('/guest')) return null;
  return <HelpChatWidget />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/guest/new-proposal" element={<GuestNewProposal />} />
            <Route path="/guest/preview" element={<GuestProposalPreview />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/company-profile" element={<CompanyProfile />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/proposals/new" element={<NewProposal />} />
            <Route path="/proposals/:id/preview" element={<ProposalPreview />} />
            <Route path="/proposals/:id" element={<ProposalDetail />} />
            <Route path="/proposals/:id/sign" element={<ProposalSign />} />
            <Route path="/admin" element={<AdminOverview />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/proposals" element={<AdminProposals />} />
            <Route path="/admin/revenue" element={<AdminRevenue />} />
            <Route path="/admin/analytics" element={<AdminAnalytics />} />
            <Route path="/admin/referrals" element={<AdminReferrals />} />
            <Route path="/admin/ambassadors" element={<AdminAmbassadors />} />
            <Route path="/admin/seed" element={<AdminSeeder />} />
            <Route path="/ambassador" element={<AmbassadorDashboard />} />
            <Route path="/referrals" element={<ReferAndEarn />} />
            <Route path="/earnings" element={<Earnings />} />
            <Route path="/payment-complete" element={<PaymentComplete />} />
            <Route path="/tutorial" element={<Tutorial />} />
            <Route path="/reviews" element={<ReviewsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <HelpChatWidgetWrapper />
          <AppTracking />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
