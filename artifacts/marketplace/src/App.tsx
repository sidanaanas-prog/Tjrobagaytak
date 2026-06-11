import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth, handle401 } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RideAlertProvider } from "@/components/RideAlertProvider";

import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import ProductsPage from "@/pages/products";
import ProductDetailPage from "@/pages/product-detail";
import SellerStorePage from "@/pages/seller-store";
import SellPage from "@/pages/sell";
import EditProductPage from "@/pages/edit-product";
import DashboardPage from "@/pages/dashboard";
import ChatPage from "@/pages/chat";
import ProfilePage from "@/pages/profile";
import FollowingPage from "@/pages/following";
import AddStoryPage from "@/pages/add-story";
import PrivacyPolicyPage from "@/pages/privacy-policy";
import SupportPage from "@/pages/support";
import SellersPage from "@/pages/sellers";
import WishlistPage from "@/pages/wishlist";
import RidesPage from "@/pages/rides";
import RoleSelectPage from "@/pages/role-select";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      gcTime: 5 * 60_000,
      retry: (failureCount, error: any) => {
        if (error?.status === 401) { handle401(); return false; }
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

// Auth Guard wrapper
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Redirect to="/login" />;
  }
  
  return <>{children}</>;
}

// Guest Guard wrapper (redirects to home if already logged in)
function RequireGuest({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;
  }
  
  if (user) {
    return <Redirect to="/" />;
  }
  
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      
      <Route path="/login">
        <RequireGuest><LoginPage /></RequireGuest>
      </Route>
      <Route path="/register">
        <RequireGuest><RegisterPage /></RequireGuest>
      </Route>
      
      <Route path="/products" component={ProductsPage} />
      <Route path="/sellers" component={SellersPage} />
      <Route path="/products/:id" component={ProductDetailPage} />
      <Route path="/seller/:id" component={SellerStorePage} />
      
      <Route path="/sell">
        <RequireAuth><SellPage /></RequireAuth>
      </Route>
      <Route path="/edit-product/:id">
        <RequireAuth><EditProductPage /></RequireAuth>
      </Route>
      <Route path="/dashboard">
        <RequireAuth><DashboardPage /></RequireAuth>
      </Route>
      <Route path="/my-listings">
        <RequireAuth><DashboardPage /></RequireAuth>
      </Route>
      <Route path="/orders">
        <RequireAuth><DashboardPage /></RequireAuth>
      </Route>

      <Route path="/chat">
        <RequireAuth><ChatPage /></RequireAuth>
      </Route>
      <Route path="/chat/:id">
        <RequireAuth><ChatPage /></RequireAuth>
      </Route>

      <Route path="/profile">
        <RequireAuth><ProfilePage /></RequireAuth>
      </Route>
      <Route path="/following">
        <RequireAuth><FollowingPage /></RequireAuth>
      </Route>
      <Route path="/wishlist">
        <RequireAuth><WishlistPage /></RequireAuth>
      </Route>

      <Route path="/privacy-policy" component={PrivacyPolicyPage} />
      <Route path="/support" component={() => <RequireAuth><SupportPage /></RequireAuth>} />
      <Route path="/add-story">
        <RequireAuth><AddStoryPage /></RequireAuth>
      </Route>
      <Route path="/rides" component={RidesPage} />
      <Route path="/role-select">
        <RequireAuth><RoleSelectPage /></RequireAuth>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <RideAlertProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </RideAlertProvider>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
