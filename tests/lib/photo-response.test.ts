import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { photoResponse } from "@/lib/photo-response";

let dataDir: string;

beforeAll(() => {
  // getEnv() lit process.env au premier appel : le DATA_DIR jetable doit être en place avant.
  dataDir = mkdtempSync(join(tmpdir(), "golf-photo-"));
  mkdirSync(join(dataDir, "uploads"));
  writeFileSync(join(dataDir, "uploads", "carte.webp"), Buffer.from("RIFF....WEBP"));
  writeFileSync(join(dataDir, "uploads", "carte.jpg"), Buffer.from([0xff, 0xd8, 0xff]));
  writeFileSync(join(dataDir, "uploads", "carte.jpeg"), Buffer.from([0xff, 0xd8, 0xff]));
  vi.stubEnv("APP_PASSCODE", "birdie");
  vi.stubEnv("SESSION_SECRET", "0123456789abcdef0123456789abcdef");
  vi.stubEnv("DATA_DIR", dataDir);
});

afterAll(() => {
  vi.unstubAllEnvs();
  rmSync(dataDir, { recursive: true, force: true });
});

describe("photoResponse", () => {
  it.each([
    ["uploads/carte.webp", "image/webp"],
    ["uploads/carte.jpg", "image/jpeg"],
    ["uploads/carte.jpeg", "image/jpeg"],
  ])("sert %s avec le type %s", async (photoPath, contentType) => {
    const response = await photoResponse(photoPath);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(contentType);
  });

  it("renvoie les octets du fichier stocké", async () => {
    const response = await photoResponse("uploads/carte.webp");

    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("RIFF....WEBP");
  });
});
