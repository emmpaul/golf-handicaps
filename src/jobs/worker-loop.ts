export type WorkerLoopOptions = {
  /** Exécute au plus un job ; renvoie `false` quand la file est vide. */
  runOnce: () => Promise<boolean>;
  intervalMs: number;
  onError: (error: unknown) => void;
};

/**
 * Boucle du worker : enchaîne les jobs tant qu'il y en a, sinon attend `intervalMs`.
 * `stop()` laisse finir le job en cours, puis la boucle s'arrête.
 */
export function startWorkerLoop(options: WorkerLoopOptions): { stop(): Promise<void> } {
  let running = true;
  let wake: (() => void) | undefined;
  const pause = () =>
    new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, options.intervalMs);
      wake = () => {
        clearTimeout(timer);
        resolve();
      };
    });

  const done = (async () => {
    while (running) {
      let worked = false;
      try {
        worked = await options.runOnce();
      } catch (error) {
        options.onError(error);
      }
      if (running && !worked) await pause();
    }
  })();

  return {
    stop() {
      running = false;
      wake?.();
      return done;
    },
  };
}
