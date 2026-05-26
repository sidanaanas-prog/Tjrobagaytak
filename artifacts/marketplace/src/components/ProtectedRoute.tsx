import { type ReactNode } from "react";
import { Link } from "wouter";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  // This will be used in App.tsx to wrap routes that require auth
  // The actual check will happen there or in the component itself
  return <>{children}</>;
}
