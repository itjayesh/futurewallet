"use client";

export type CardData = {
  name: string;
  title: string;
  tagline: string;
  stats: { label: string; value: string }[];
  plan: string[];
};

const W = 1080;
const H = 1350;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** Draws the shareable "money personality" card and returns it as a PNG blob. Uses the app's fonts and Pop colours. */
export async function renderShareCard(data: CardData): Promise<Blob> {
  const root = getComputedStyle(document.documentElement);
  const head = root.getPropertyValue("--font-bricolage").trim() || "system-ui";
  const body = root.getPropertyValue("--font-dm-sans").trim() || "system-ui";
  await Promise.allSettled([document.fonts.load(`800 96px ${head}`), document.fonts.load(`500 32px ${body}`)]);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext("2d")!;
  const INK = "#15130f";

  c.fillStyle = "#f7f3ea";
  c.fillRect(0, 0, W, H);

  // Card with a hard offset shadow.
  const x = 70, y = 70, w = W - 140, h = H - 140;
  c.fillStyle = INK;
  c.fillRect(x + 14, y + 14, w, h);
  c.fillStyle = "#ffffff";
  c.fillRect(x, y, w, h);
  c.lineWidth = 6;
  c.strokeStyle = INK;
  c.strokeRect(x, y, w, h);

  // Lime sticker.
  c.save();
  c.translate(x + 60, y + 90);
  c.rotate((-2 * Math.PI) / 180);
  c.fillStyle = "#c8f03c";
  c.fillRect(0, -34, 520, 60);
  c.lineWidth = 4;
  c.strokeRect(0, -34, 520, 60);
  c.fillStyle = INK;
  c.font = `800 28px ${head}`;
  c.textBaseline = "middle";
  c.fillText("MY MONEY PERSONALITY", 24, -4);
  c.restore();

  // Title on a pink bar.
  c.font = `800 118px ${head}`;
  c.textBaseline = "alphabetic";
  const titleLines = wrap(c, data.title, w - 120);
  let ty = y + 290;
  for (const line of titleLines) {
    const tw = c.measureText(line).width;
    c.fillStyle = "#ff3d8b";
    c.fillRect(x + 50, ty - 96, tw + 24, 120);
    c.lineWidth = 5;
    c.strokeStyle = INK;
    c.strokeRect(x + 50, ty - 96, tw + 24, 120);
    c.fillStyle = "#ffffff";
    c.fillText(line, x + 62, ty);
    ty += 140;
  }

  c.fillStyle = INK;
  c.font = `500 40px ${body}`;
  for (const line of wrap(c, data.tagline, w - 120)) {
    c.fillText(line, x + 60, ty + 20);
    ty += 54;
  }

  // Stats.
  ty += 50;
  c.lineWidth = 3;
  c.strokeStyle = "rgba(21,19,15,0.2)";
  for (const s of data.stats) {
    c.beginPath();
    c.moveTo(x + 60, ty - 36);
    c.lineTo(x + w - 60, ty - 36);
    c.stroke();
    c.fillStyle = "#6b665a";
    c.font = `500 28px ${body}`;
    c.fillText(s.label, x + 60, ty);
    c.fillStyle = INK;
    c.font = `800 34px ${head}`;
    c.textAlign = "right";
    c.fillText(s.value, x + w - 60, ty);
    c.textAlign = "left";
    ty += 70;
  }

  // Plan.
  ty += 20;
  c.fillStyle = INK;
  c.font = `800 34px ${head}`;
  c.fillText("Your plan", x + 60, ty);
  ty += 20;
  c.font = `500 30px ${body}`;
  data.plan.forEach((step, i) => {
    for (const [j, line] of wrap(c, step, w - 190).entries()) {
      if (j === 0) {
        c.fillStyle = "#c8f03c";
        c.beginPath();
        c.arc(x + 82, ty + 42, 20, 0, Math.PI * 2);
        c.fill();
        c.lineWidth = 3;
        c.strokeStyle = INK;
        c.stroke();
        c.fillStyle = INK;
        c.font = `800 24px ${head}`;
        c.textAlign = "center";
        c.fillText(String(i + 1), x + 82, ty + 51);
        c.textAlign = "left";
        c.font = `500 30px ${body}`;
      }
      c.fillText(line, x + 125, ty + 50);
      ty += 42;
    }
    ty += 16;
  });

  c.fillStyle = "#6b665a";
  c.font = `500 24px ${body}`;
  c.fillText(`${data.name ? data.name + " · " : ""}FutureWallet · General guidance, not regulated financial advice.`, x + 60, y + h - 40);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not create the image."))), "image/png"));
}

/** The "Wrapped" summary as a shareable image (1080x1350). Uses the same Pop look as the personality card. */
export async function renderWrappedCard(w: {
  name: string;
  monthName: string;
  total: number;
  txCount: number;
  topMerchant: { merchant: string; amount: number } | null;
  busiestDay: { name: string } | null;
  lateNight: { sharePct: number } | null;
  noSpend: { days: number };
  personality: { title: string; tagline: string };
}): Promise<Blob> {
  const root = getComputedStyle(document.documentElement);
  const head = root.getPropertyValue("--font-bricolage").trim() || "system-ui";
  const body = root.getPropertyValue("--font-dm-sans").trim() || "system-ui";
  await Promise.allSettled([document.fonts.load(`800 96px ${head}`), document.fonts.load(`500 32px ${body}`)]);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext("2d")!;
  const INK = "#15130f";
  const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

  c.fillStyle = "#c8f03c";
  c.fillRect(0, 0, W, H);
  const x = 70, y = 70, cw = W - 140, ch = H - 140;
  c.fillStyle = INK;
  c.fillRect(x + 14, y + 14, cw, ch);
  c.fillStyle = "#f7f3ea";
  c.fillRect(x, y, cw, ch);
  c.lineWidth = 6;
  c.strokeStyle = INK;
  c.strokeRect(x, y, cw, ch);

  c.fillStyle = INK;
  c.font = `800 30px ${head}`;
  c.fillText("FUTUREWALLET WRAPPED", x + 60, y + 90);

  c.font = `800 104px ${head}`;
  const title = `${w.name ? w.name + "'s " : "My "}${w.monthName}`;
  for (const [i, line] of wrap(c, title, cw - 120).entries()) c.fillText(line, x + 60, y + 210 + i * 116);

  c.fillStyle = "#ff3d8b";
  c.fillRect(x + 60, y + 330, 300, 14);

  const rows: [string, string][] = [
    ["Spent", `${inr(w.total)} · ${w.txCount} transactions`],
    ["Top merchant", w.topMerchant ? `${w.topMerchant.merchant} ${inr(w.topMerchant.amount)}` : "None yet"],
    ["Busiest day", w.busiestDay?.name ?? "None yet"],
    ["After 11 pm", w.lateNight ? `${w.lateNight.sharePct}% of fun spending` : "Barely any"],
    ["No-spend days", String(w.noSpend.days)],
  ];
  let ty = y + 440;
  c.lineWidth = 3;
  c.strokeStyle = "rgba(21,19,15,0.2)";
  for (const [label, value] of rows) {
    c.beginPath();
    c.moveTo(x + 60, ty - 44);
    c.lineTo(x + cw - 60, ty - 44);
    c.stroke();
    c.fillStyle = "#6b665a";
    c.font = `500 30px ${body}`;
    c.fillText(label, x + 60, ty);
    c.fillStyle = INK;
    c.font = `800 36px ${head}`;
    c.textAlign = "right";
    c.fillText(value, x + cw - 60, ty);
    c.textAlign = "left";
    ty += 84;
  }

  // Personality on a pink bar.
  ty += 30;
  c.fillStyle = INK;
  c.font = `500 30px ${body}`;
  c.fillText("Which makes me a", x + 60, ty);
  c.font = `800 92px ${head}`;
  const tw = c.measureText(w.personality.title).width;
  c.fillStyle = "#ff3d8b";
  c.fillRect(x + 50, ty + 20, Math.min(tw + 30, cw - 100), 110);
  c.lineWidth = 5;
  c.strokeStyle = INK;
  c.strokeRect(x + 50, ty + 20, Math.min(tw + 30, cw - 100), 110);
  c.fillStyle = "#ffffff";
  c.fillText(w.personality.title, x + 66, ty + 108);

  c.fillStyle = "#6b665a";
  c.font = `500 24px ${body}`;
  c.fillText("FutureWallet · General guidance, not regulated financial advice.", x + 60, y + ch - 40);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not create the image."))), "image/png"));
}
