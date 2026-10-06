import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Arabica deli-café";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  const logo = readFileSync(join(process.cwd(), "public/logo.svg"), "utf8").replace(
    'fill="currentColor"',
    'fill="#d6a23e"',
  );
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
        background: "#233d2e",
        color: "#f2f3ec",
        fontSize: 40,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`data:image/svg+xml;base64,${Buffer.from(logo).toString("base64")}`}
        width={440}
        height={295}
        alt=""
      />
      <div style={{ display: "flex" }}>Coffee · Saj · Shisha</div>
    </div>,
    size,
  );
}
