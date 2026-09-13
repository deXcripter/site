import { ImageResponse } from "next/og";
import { logoColors, logoDataUri } from "@/lib/logo";
import { site } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${site.name}, software engineer building SEORCE`;

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 96,
          background: "#edece8",
          color: "#161616",
        }}
      >
        <img src={logoDataUri(logoColors.light)} width={96} height={96} alt="" />
        <div style={{ display: "flex", marginTop: 40, fontSize: 92, fontWeight: 600, letterSpacing: "-0.04em" }}>{site.name}</div>
        <div style={{ display: "flex", marginTop: 16, fontSize: 36, color: "#64625e" }}>
          Software engineer building AI search tools
        </div>
      </div>
    ),
    size,
  );
}
