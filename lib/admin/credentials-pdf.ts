/**
 * A one-page A4 PDF with a staff member's sign-in details, written by hand (built-in Helvetica
 * and Courier fonts, no library). Runs in the browser: nothing is sent anywhere.
 */
export type Credentials = { username: string; password: string; signInUrl: string; pages: string[]; date: string };

// Built-in PDF fonts only cover basic Latin; anything else becomes "?". Escape PDF string syntax.
const pdfText = (s: string) => s.replace(/[^\x20-\x7e]/g, "?").replace(/[\\()]/g, (c) => `\\${c}`);

export function credentialsPdf(c: Credentials): string {
  const lines: string[] = [];
  const text = (font: string, size: number, x: number, y: number, s: string) =>
    lines.push(`BT /${font} ${size} Tf ${x} ${y} Td (${pdfText(s)}) Tj ET`);

  text("F2", 22, 56, 770, "Arabica admin");
  text("F1", 13, 56, 748, "Staff sign-in details");
  // A framed box with the details.
  lines.push("0.85 g 56 520 483 200 re f 0 g 1 w 56 520 483 200 re S");
  text("F1", 11, 76, 692, "Sign in at");
  text("F2", 13, 76, 674, c.signInUrl);
  text("F1", 11, 76, 640, "Username");
  text("F3", 18, 76, 618, c.username);
  text("F1", 11, 76, 584, "Password");
  text("F3", 18, 76, 562, c.password);
  text("F1", 11, 56, 490, "Pages you can open:");
  text("F1", 11, 56, 472, c.pages.join(", "));
  text("F2", 11, 56, 430, "Keep this private.");
  text("F1", 11, 56, 412, "After signing in, change your password under Settings > My account,");
  text("F1", 11, 56, 396, "then delete or shred this page.");
  text("F1", 9, 56, 60, `Created ${c.date}`);

  const stream = lines.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];

  // Everything is ASCII, so string length = byte offset.
  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((body, i) => {
    const at = pdf.length;
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return at;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return pdf;
}
