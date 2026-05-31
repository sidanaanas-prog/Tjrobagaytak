import { BadgeCheck, ShieldCheck } from "lucide-react";

interface VerifiedBadgeProps {
  className?: string;
  size?: "xs" | "sm" | "md";
  role?: string;
}

const sizes = {
  xs: "w-4 h-4",
  sm: "w-5 h-5",
  md: "w-6 h-6",
};

export function VerifiedBadge({ className = "", size = "sm", role }: VerifiedBadgeProps) {
  const isAdmin = role === "admin";

  if (isAdmin) {
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 animate-pulse ${className}`}
        style={{
          filter:
            "drop-shadow(0 0 4px #c084fc) drop-shadow(0 0 8px #a855f7) drop-shadow(0 0 16px #7c3aed)",
        }}
        aria-label="دعم"
      >
        <ShieldCheck className={`${sizes[size]} fill-purple-400 text-white`} />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${className}`}
      style={{
        filter:
          "drop-shadow(0 0 4px #60a5fa) drop-shadow(0 0 8px #3b82f6) drop-shadow(0 0 14px #1d4ed8)",
      }}
      aria-label="موثق"
    >
      <BadgeCheck className={`${sizes[size]} fill-blue-400 text-white`} />
    </span>
  );
}
