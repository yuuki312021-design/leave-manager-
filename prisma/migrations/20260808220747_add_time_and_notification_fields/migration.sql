-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_leave_records" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fiscalYearId" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "hours" REAL,
    "startTime" TEXT,
    "endTime" TEXT,
    "consumedDays" REAL NOT NULL,
    "note" TEXT,
    "notifiedDaybefore" BOOLEAN NOT NULL DEFAULT false,
    "notifiedDayof" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "leave_records_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "fiscal_years" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_leave_records" ("consumedDays", "createdAt", "date", "fiscalYearId", "hours", "id", "note", "type", "updatedAt") SELECT "consumedDays", "createdAt", "date", "fiscalYearId", "hours", "id", "note", "type", "updatedAt" FROM "leave_records";
DROP TABLE "leave_records";
ALTER TABLE "new_leave_records" RENAME TO "leave_records";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
