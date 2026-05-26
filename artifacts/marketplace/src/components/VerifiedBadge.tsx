import { BadgeCheck } from "lucide-react";

interface VerifiedBadgeProps {
  className?: string;
  size?: "xs" | "sm" | "md";
}

const sizes = {
  xs: "w-3 h-3",
  sm: "w-4 h-4",
  md: "w-5 h-5",
};

export function VerifiedBadge({ className = "", size = "sm" }: VerifiedBadgeProps) {
  return (
    <BadgeCheck
      className={`inline-block shrink-0 fill-blue-500 text-white ${sizes[size]} ${className}`}
      aria-label="موثق"
    />
  );
}
