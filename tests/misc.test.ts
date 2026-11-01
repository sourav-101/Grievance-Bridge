import { describe, expect, it } from "vitest";
import { encodeWav, mixToMono, normalizePeak, resampleLinear } from "@/lib/client/wav";
import { csvCell, toCsv } from "@/lib/admin/csv";
import { allowedTargetStatuses, can, permissionsFor } from "@/lib/auth/rbac";

describe("WAV encoding", () => {
  it("writes a valid 16 kHz mono PCM header", () => {
    const buf = encodeWav(new Float32Array([0, 0.5, -0.5, 1, -1]), 16000);
    const v = new DataView(buf);
    const str = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
    expect(str(0)).toBe("RIFF");
    expect(str(8)).toBe("WAVE");
    expect(v.getUint16(22, true)).toBe(1); // mono
    expect(v.getUint32(24, true)).toBe(16000);
    expect(v.getUint32(40, true)).toBe(10); // 5 samples × 2 bytes
    expect(v.getInt16(44 + 3 * 2, true)).toBe(32767);
    expect(v.getInt16(44 + 4 * 2, true)).toBe(-32768);
  });

  it("resamples 48 kHz → 16 kHz and mixes to mono", () => {
    expect(resampleLinear(new Float32Array(48000), 48000, 16000).length).toBe(16000);
    expect(Array.from(mixToMono([new Float32Array([1, 0]), new Float32Array([0, 1])]))).toEqual([0.5, 0.5]);
  });

  it("boosts quiet audio but not loud audio", () => {
    expect(Math.max(...normalizePeak(new Float32Array([0.2, -0.1])))).toBeCloseTo(0.9, 5);
    const loud = new Float32Array([0.95]);
    expect(normalizePeak(loud)).toBe(loud);
  });
});

describe("CSV export", () => {
  it("quotes and neutralises spreadsheet formulas", () => {
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell(null)).toBe("");
    expect(toCsv(["a", "b"], [[1, "गोविंद"]]).startsWith("﻿a,b\r\n1,गोविंद")).toBe(true);
  });
});

describe("RBAC", () => {
  it("restricts contractors", () => {
    expect(can("contractor", "tickets.view")).toBe(true);
    expect(can("contractor", "tickets.resolve")).toBe(false);
    expect(can("contractor", "tickets.viewIdentity")).toBe(false);
    expect(can("contractor", "reports.export")).toBe(false);
    expect(allowedTargetStatuses("contractor")).toEqual(["In Progress"]);
  });

  it("only the dean manages users", () => {
    expect(can("dean", "users.manage")).toBe(true);
    expect(can("estate_officer", "users.manage")).toBe(false);
    expect(permissionsFor("dean").length).toBeGreaterThan(permissionsFor("estate_officer").length);
    expect(can(null, "tickets.view")).toBe(false);
  });
});
