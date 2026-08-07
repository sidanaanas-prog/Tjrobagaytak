import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth, handle401 } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RideAlertProvider, unlockAudioContext } from "@/components/RideAlertProvider";

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
import DriverRegisterPage from "@/pages/driver-register";
import SellerVerifyPage from "@/pages/seller-verify";
import PinLockPage from "@/pages/pin-lock";
import PinSetupPage from "@/pages/pin-setup";
import WalletPage from "@/pages/wallet";
import FoodPage from "@/pages/food";
import FoodDetailPage from "@/pages/food-detail";
import FoodOrdersPage from "@/pages/food-orders";
import FoodRegisterPage from "@/pages/food-register";
import FoodDashboardPage from "@/pages/food-dashboard";
import PharmacyPage from "@/pages/pharmacy";
import WholesalePage from "@/pages/wholesale";

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

import { PinLockGuard } from "@/components/PinLockGuard";
import { PinOnlyGuard } from "@/components/PinOnlyGuard";
import { getApiUrl } from "@/lib/api-url";

const BASE = getApiUrl("");

function PharmacyVisibilityGuard({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/api/feature-flags`)
      .then((response) => response.ok ? response.json() : null)
      .then((flags) => {
        if (flags && typeof flags.pharmacyEnabled === "boolean") {
          setEnabled(flags.pharmacyEnabled);
        }
      })
      .catch(() => {});
  }, []);

  return enabled ? <>{children}</> : <Redirect to="/" />;
}

function WholesaleVisibilityGuard({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/api/feature-flags`)
      .then((response) => response.ok ? response.json() : null)
      .then((flags) => {
        if (flags && typeof flags.wholesaleEnabled === "boolean") {
          setEnabled(flags.wholesaleEnabled);
        }
      })
      .catch(() => {});
  }, []);

  return enabled ? <>{children}</> : <Redirect to="/" />;
}

// Auth Guard wrapper
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return <PinLockGuard>{children}</PinLockGuard>;
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
      <Route path="/driver-register">
        <RequireAuth><DriverRegisterPage /></RequireAuth>
      </Route>
      <Route path="/seller-verify">
        <RequireAuth><SellerVerifyPage /></RequireAuth>
      </Route>
      <Route path="/role-select">
        <RequireAuth><RoleSelectPage /></RequireAuth>
      </Route>
      <Route path="/wallet">
        <RequireAuth><WalletPage /></RequireAuth>
      </Route>
      <Route path="/pin-lock" component={PinLockPage} />
      <Route path="/pin-setup" component={PinSetupPage} />
      <Route path="/food" component={FoodPage} />
      <Route path="/food/orders">
        <RequireAuth><FoodOrdersPage /></RequireAuth>
      </Route>
      <Route path="/food/register">
        <RequireAuth><FoodRegisterPage /></RequireAuth>
      </Route>
      <Route path="/food/dashboard">
        <RequireAuth><FoodDashboardPage /></RequireAuth>
      </Route>
      <Route path="/food/:id" component={FoodDetailPage} />
      <Route path="/pharmacy">
        <PharmacyVisibilityGuard><PharmacyPage /></PharmacyVisibilityGuard>
      </Route>
      <Route path="/wholesale">
        <WholesaleVisibilityGuard><WholesalePage /></WholesaleVisibilityGuard>
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
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <RideAlertProvider>
              <Router />
              <Toaster />
            </RideAlertProvider>
          </WouterRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
