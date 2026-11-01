import { describe, expect, it } from "vitest";
import { photoExtension, sniffImageType } from "@/lib/grievances/photo";

const bytes = (...b: number[]) => new Uint8Array(b);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

describe("complaint photo check", () => {
  it("recognises JPEG, PNG and WebP by their bytes", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0))).toBe("image/jpeg");
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("image/png");
    expect(sniffImageType(bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")))).toBe("image/webp");
  });

  it("rejects anything else, whatever the file is called", () => {
    expect(sniffImageType(bytes(...ascii("<svg onload=alert(1)>")))).toBeNull();
    expect(sniffImageType(bytes(...ascii("%PDF-1.7")))).toBeNull();
    expect(sniffImageType(bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WAVE")))).toBeNull();
    expect(sniffImageType(bytes())).toBeNull();
  });

  it("picks the stored file extension", () => {
    expect(photoExtension("image/jpeg")).toBe("jpg");
    expect(photoExtension("image/png")).toBe("png");
  });
});
