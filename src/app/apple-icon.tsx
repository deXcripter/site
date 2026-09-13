import { ImageResponse } from "next/og";
import { logoColors, logoDataUri } from "@/lib/logo";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a" }}>
        <img src={logoDataUri(logoColors.dark)} width={116} height={116} alt="" />
      </div>
    ),
    size,
  );
}
