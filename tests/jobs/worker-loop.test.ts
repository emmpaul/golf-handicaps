import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startWorkerLoop } from "@/jobs/worker-loop";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const ignoreErrors = (_error: unknown) => undefined;

/** `runOnce` qui renvoie les résultats donnés puis `false` (file vide). */
function scripted(results: boolean[]) {
  const calls = { count: 0 };
  const runOnce = async () => {
    calls.count += 1;
    return results.shift() ?? false;
  };
  return { calls, runOnce };
}

describe("startWorkerLoop", () => {
  it("enchaîne les jobs sans attendre tant que la file n'est pas vide", async () => {
    const { calls, runOnce } = scripted([true, true]);
    const loop = startWorkerLoop({ runOnce, intervalMs: 1000, onError: ignoreErrors });
    await vi.advanceTimersByTimeAsync(0);
    expect(calls.count).toBe(3);
    await loop.stop();
  });

  it("interroge la file toutes les 1000 ms quand elle est vide", async () => {
    const { calls, runOnce } = scripted([]);
    const loop = startWorkerLoop({ runOnce, intervalMs: 1000, onError: ignoreErrors });
    await vi.advanceTimersByTimeAsync(999);
    expect(calls.count).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls.count).toBe(2);
    await loop.stop();
  });

  it("à l'arrêt, attend la fin du job en cours puis ne réserve plus rien", async () => {
    let finish: ((value: boolean) => void) | undefined;
    let calls = 0;
    const runOnce = () => {
      calls += 1;
      return new Promise<boolean>((resolve) => {
        finish = resolve;
      });
    };
    const loop = startWorkerLoop({ runOnce, intervalMs: 1000, onError: ignoreErrors });
    let stopped = false;
    const stopping = loop.stop().then(() => {
      stopped = true;
    });
    await vi.advanceTimersByTimeAsync(5000);
    expect(stopped).toBe(false);
    finish?.(true);
    await stopping;
    await vi.advanceTimersByTimeAsync(5000);
    expect([stopped, calls]).toEqual([true, 1]);
  });

  it("signale une erreur et continue d'interroger la file", async () => {
    const errors: unknown[] = [];
    let calls = 0;
    const runOnce = async () => {
      calls += 1;
      if (calls === 1) throw new Error("base verrouillée");
      return false;
    };
    const loop = startWorkerLoop({ runOnce, intervalMs: 1000, onError: (e) => errors.push(e) });
    await vi.advanceTimersByTimeAsync(1000);
    expect(errors.map((e) => (e as Error).message)).toEqual(["base verrouillée"]);
    expect(calls).toBe(2);
    await loop.stop();
  });
});
