-- CreateTable: users
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- RedefineTables: fiscal_years (add userId, change unique constraint)
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_fiscal_years" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL DEFAULT 1,
    "year" INTEGER NOT NULL,
    "grantedDays" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "fiscal_years_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_fiscal_years" ("id", "userId", "year", "grantedDays", "createdAt", "updatedAt")
    SELECT "id", 1, "year", "grantedDays", "createdAt", "updatedAt" FROM "fiscal_years";

DROP TABLE "fiscal_years";
ALTER TABLE "new_fiscal_years" RENAME TO "fiscal_years";

CREATE UNIQUE INDEX "fiscal_years_userId_year_key" ON "fiscal_years"("userId", "year");

-- RedefineTables: leave_records (add userId)
CREATE TABLE "new_leave_records" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL DEFAULT 1,
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
    CONSTRAINT "leave_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "leave_records_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "fiscal_years" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_leave_records" ("id", "userId", "fiscalYearId", "date", "type", "hours", "startTime", "endTime", "consumedDays", "note", "notifiedDaybefore", "notifiedDayof", "createdAt", "updatedAt")
    SELECT "id", 1, "fiscalYearId", "date", "type", "hours", "startTime", "endTime", "consumedDays", "note", "notifiedDaybefore", "notifiedDayof", "createdAt", "updatedAt" FROM "leave_records";

DROP TABLE "leave_records";
ALTER TABLE "new_leave_records" RENAME TO "leave_records";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
