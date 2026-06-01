import type { ReactNode } from "react";

interface MarketEntryBulletListProps {
  /** Section title rendered in the h4 header. */
  title: string;
  /** Accent icon node (e.g. a Lucide icon already styled with its color). */
  icon: ReactNode;
  /** Presentation style for the item list. */
  variant: "bullets" | "cards";
  /** List items. Empty/missing renders only the header (matches the live block). */
  items?: string[];
  /** Bullet accent classes (bullets variant), e.g. "text-orange-500 mt-1". */
  accentClassName?: string;
  /** Wrapper classes around the cards grid/stack (cards variant). */
  cardsContainerClassName?: string;
  /** Per-card classes (cards variant), e.g. "bg-red-50 p-3 rounded-lg border border-red-200". */
  cardClassName?: string;
  /** Inner text classes for each card (cards variant). */
  cardTextClassName?: string;
}

/**
 * Display-only titled section for the Market Entry view: an icon/accent header
 * over a list of string items. The four Market Entry display lists
 * (Entry Barriers, Competitive Differentiation, Strategic Recommendations,
 * Risk Assessment) share an identical header and differ only in their item
 * presentation — a bulleted `<ul>` or a stack/grid of colored cards — captured
 * here by the `variant` prop. Markup is preserved verbatim from the inlined
 * blocks; empty `items` render only the header (no placeholder), exactly as the
 * original `.map` over an empty array did.
 */
export default function MarketEntryBulletList({
  title,
  icon,
  variant,
  items = [],
  accentClassName,
  cardsContainerClassName,
  cardClassName,
  cardTextClassName,
}: MarketEntryBulletListProps) {
  return (
    <div className="space-y-4">
      <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
        {icon}
        {title}
      </h4>
      {variant === "bullets" ? (
        <ul className="space-y-2">
          {items.map((item: string, index: number) => (
            <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
              <span className={accentClassName}>•</span>
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <div className={cardsContainerClassName}>
          {items.map((item: string, index: number) => (
            <div key={index} className={cardClassName}>
              <div className={cardTextClassName}>{item}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
