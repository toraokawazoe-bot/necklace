import { Star } from "@/components/star";

const ITEMS = [
  "ひとつずつ手編み",
  "740NLL",
  "ネックレス ¥2,500（税込）",
  "ブレスレット ¥1,700（税込）",
  "全国一律送料 ¥150",
];

export function Marquee() {
  const lap = (
    <div className="flex shrink-0 items-center gap-12 px-6 text-xs uppercase tracking-[0.4em]">
      {ITEMS.map((it, i) => (
        <span key={i} className="flex items-center gap-12">
          <span className="whitespace-nowrap">{it}</span>
          <Star className="h-3 w-3 text-accent-red" />
        </span>
      ))}
    </div>
  );

  return (
    <div className="overflow-hidden border-y border-foreground/10 bg-foreground py-3 text-background">
      <div className="flex w-max animate-marquee">
        {lap}
        {lap}
      </div>
    </div>
  );
}
