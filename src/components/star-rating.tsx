import { Star } from "lucide-react";

export function StarRating({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (rating: number) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={
            value !== null && n <= value
              ? "text-gold"
              : "text-muted-foreground hover:text-gold/60"
          }
        >
          <Star className="h-4 w-4" fill={value !== null && n <= value ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );
}
