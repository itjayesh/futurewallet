import type { ReactNode } from "react";
import { formatRupees, toBlocks } from "@/lib/client/aiText";

/** **bold** becomes real bold, and any leftover marker (a reply still streaming in) is dropped. Never uses innerHTML. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={i} className="font-bold text-on-surface">
        {formatRupees(part.slice(2, -2))}
      </strong>
    ) : (
      <span key={i}>{formatRupees(part).replace(/\*\*/g, "")}</span>
    ),
  );
}

/** Renders AI text as headings, short paragraphs and lists, with tidy rupee amounts. */
export default function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = toBlocks(text);
  return (
    <div className={className ?? "space-y-2.5"}>
      {blocks.map((b, i) => {
        if (b.type === "h") {
          return (
            <p key={i} className="font-headline text-base font-extrabold">
              {inline(b.text)}
            </p>
          );
        }
        if (b.type === "p") return <p key={i}>{inline(b.text)}</p>;
        const List = b.type === "ol" ? "ol" : "ul";
        return (
          <List key={i} className={b.type === "ol" ? "list-decimal space-y-1 pl-5" : "list-disc space-y-1 pl-5"}>
            {b.items.map((item, j) => (
              <li key={j}>{inline(item)}</li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
