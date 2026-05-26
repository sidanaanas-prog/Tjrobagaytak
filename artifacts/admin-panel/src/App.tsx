import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Products from "@/pages/products";
import Users from "@/pages/users";
import Categories from "@/pages/categories";
import Activity from "@/pages/activity";
import Support from "@/pages/support";
import SellerOrders from "@/pages/seller-orders";
import Banners from "@/pages/banners";
import Broadcast from "@/pages/broadcast";
import Reports from "@/pages/reports";
import DeliveryRequests from "@/pages/delivery-requests";
import FlashSales from "@/pages/flash-sales";
import { AdminAuthProvider } from "@/hooks/use-admin-auth";
import { Layout } from "@/components/layout";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/products" component={() => <ProtectedRoute component={Products} />} />
      <Route path="/users" component={() => <ProtectedRoute component={Users} />} />
      <Route path="/categories" component={() => <ProtectedRoute component={Categories} />} />
      <Route path="/activity" component={() => <ProtectedRoute component={Activity} />} />
      <Route path="/support" component={() => <ProtectedRoute component={Support} />} />
      <Route path="/seller-orders" component={() => <ProtectedRoute component={SellerOrders} />} />
      <Route path="/banners" component={() => <ProtectedRoute component={Banners} />} />
      <Route path="/broadcast" component={() => <ProtectedRoute component={Broadcast} />} />
      <Route path="/reports" component={() => <ProtectedRoute component={Reports} />} />
      <Route path="/delivery-requests" component={() => <ProtectedRoute component={DeliveryRequests} />} />
      <Route path="/flash-sales" component={() => <ProtectedRoute component={FlashSales} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AdminAuthProvider>
            <Router />
          </AdminAuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
