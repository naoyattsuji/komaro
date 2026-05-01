import { cn } from "@/lib/utils";

interface BadgeProps {
  variant?: "active" | "expired" | "deleted" | "gray";
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "gray", children, className }: BadgeProps) {
  const variants = {
    active: "bg-gray-100 text-gray-600 border border-gray-200",
    expired: "bg-gray-100 text-gray-500 border border-gray-200",
    deleted: "bg-gray-100 text-gray-500 border border-gray-200",
    gray: "bg-gray-100 text-gray-600 border border-gray-200",
  };

  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", variants[variant], className)}>
      {children}
    </span>
  );
}
