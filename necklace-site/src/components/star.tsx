import { cn } from "@/lib/utils";

export function Star({
  className,
  twinkle = false,
  filled = true,
}: {
  className?: string;
  twinkle?: boolean;
  filled?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn(
        "inline-block",
        twinkle && "animate-star",
        className,
      )}
      aria-hidden
    >
      <path
        d="M12 2.5 L14.4 9.1 L21.5 9.4 L15.8 13.7 L17.9 20.5 L12 16.5 L6.1 20.5 L8.2 13.7 L2.5 9.4 L9.6 9.1 Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.4}
        strokeLinejoin="round"
      />
    </svg>
  );
}
