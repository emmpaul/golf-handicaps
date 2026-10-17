import { resetDatabase } from "../src/db/reset";
import { dbFile } from "./db-file";

resetDatabase(dbFile);
console.info(`Base locale recréée : ${dbFile}`);
