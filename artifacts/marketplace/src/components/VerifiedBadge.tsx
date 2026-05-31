import { BadgeCheck, ShieldCheck } from "lucide-react";

interface VerifiedBadgeProps {
  className?: string;
  size?: "xs" | "sm" | "md";
  role?: string;
}

const sizes = {
  xs: "w-3 h-3",
  sm: "w-4 h-4",
  md: "w-5 h-5",
};

export function VerifiedBadge({ className = "", size = "sm", role }: VerifiedBadgeProps) {
  const isAdmin = role === "admin";

  if (isAdmin) {
    return (
      <ShieldCheck
        className={`inline-block shrink-0 fill-purple-500 text-white ${sizes[size]} ${className}`}
        aria-label="دعم"
      />
    );
  }

  return (
    <BadgeCheck
      className={`inline-block shrink-0 fill-blue-500 text-white ${sizes[size]} ${className}`}
      aria-label="موثق"
    />
  );
}
