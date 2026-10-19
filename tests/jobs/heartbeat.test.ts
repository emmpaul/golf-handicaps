import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HEARTBEAT_FILE, isHeartbeatFresh, writeHeartbeat } from "@/jobs/heartbeat";

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "golf-heartbeat-"));
  file = join(dir, "heartbeat");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("battement du worker", () => {
  it("est frais 299 999 ms après l'écriture", () => {
    writeHeartbeat(file, new Date(1_000_000));
    expect(isHeartbeatFresh(file, new Date(1_000_000 + 299_999), 300_000)).toBe(true);
  });

  it("est périmé 300 000 ms après l'écriture", () => {
    writeHeartbeat(file, new Date(1_000_000));
    expect(isHeartbeatFresh(file, new Date(1_000_000 + 300_000), 300_000)).toBe(false);
  });

  it("n'est pas frais quand le fichier manque", () => {
    expect(isHeartbeatFresh(file, new Date(1_000_000), 300_000)).toBe(false);
  });

  it("n'est pas frais quand le fichier ne contient pas un nombre", () => {
    writeFileSync(file, "abc");
    expect(isHeartbeatFresh(file, new Date(1_000_000), 300_000)).toBe(false);
  });

  it("vit dans le dossier temporaire du conteneur, pas dans /data", () => {
    expect(HEARTBEAT_FILE).toBe(join(tmpdir(), "golf-worker-heartbeat"));
  });
});
