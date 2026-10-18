import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { eq, like, not } from "drizzle-orm";
import type { Db } from "@/db/client";
import { imports, rounds } from "@/db/schema";
import { toStoredWebp } from "./imports";

/** Chemins distincts des photos d'import et de round qui ne sont pas encore en WebP. */
function pathsToConvert(db: Db): string[] {
  const importPaths = db
    .selectDistinct({ photoPath: imports.photoPath })
    .from(imports)
    .where(not(like(imports.photoPath, "%.webp")))
    .all();
  const roundPaths = db
    .selectDistinct({ photoPath: rounds.photoPath })
    .from(rounds)
    .where(not(like(rounds.photoPath, "%.webp")))
    .all();
  const paths = [...importPaths, ...roundPaths].map((row) => row.photoPath);
  return [...new Set(paths.filter((path): path is string => path !== null))];
}

/** Même uuid, extension `.webp` : `uploads/<uuid>.jpg` → `uploads/<uuid>.webp`. */
const webpPath = (photoPath: string) => photoPath.replace(/(\.[^./]*)?$/, ".webp");

/**
 * Convertit en WebP les photos stockées avant le passage au WebP (design, décision 4). Pour
 * chacune : écrit `<même uuid>.webp`, fait pointer imports et rounds vers lui dans une
 * transaction, puis supprime l'ancien fichier après le commit. Un fichier absent ou illisible
 * reste en place avec sa ligne et figure dans `failed`. Sans effet une fois tout converti.
 */
export async function convertStoredPhotos(
  db: Db,
  dataDir: string,
): Promise<{ converted: number; failed: string[] }> {
  let converted = 0;
  const failed: string[] = [];
  for (const oldPath of pathsToConvert(db)) {
    const newPath = webpPath(oldPath);
    const newFile = join(dataDir, newPath);
    try {
      const webp = await toStoredWebp(await readFile(join(dataDir, oldPath)));
      await writeFile(newFile, webp);
      db.transaction((tx) => {
        tx.update(imports).set({ photoPath: newPath }).where(eq(imports.photoPath, oldPath)).run();
        tx.update(rounds).set({ photoPath: newPath }).where(eq(rounds.photoPath, oldPath)).run();
      });
    } catch (error) {
      console.warn(`[photos] Conversion WebP impossible pour ${oldPath} :`, error);
      await rm(newFile, { force: true });
      failed.push(oldPath);
      continue;
    }
    await rm(join(dataDir, oldPath), { force: true });
    converted++;
  }
  return { converted, failed };
}
