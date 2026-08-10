-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_fiscal_years" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "grantedDays" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "fiscal_years_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_fiscal_years" ("createdAt", "grantedDays", "id", "updatedAt", "userId", "year") SELECT "createdAt", "grantedDays", "id", "updatedAt", "userId", "year" FROM "fiscal_years";
DROP TABLE "fiscal_years";
ALTER TABLE "new_fiscal_years" RENAME TO "fiscal_years";
CREATE UNIQUE INDEX "fiscal_years_userId_year_key" ON "fiscal_years"("userId", "year");
CREATE TABLE "new_leave_records" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
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
INSERT INTO "new_leave_records" ("consumedDays", "createdAt", "date", "endTime", "fiscalYearId", "hours", "id", "note", "notifiedDaybefore", "notifiedDayof", "startTime", "type", "updatedAt", "userId") SELECT "consumedDays", "createdAt", "date", "endTime", "fiscalYearId", "hours", "id", "note", "notifiedDaybefore", "notifiedDayof", "startTime", "type", "updatedAt", "userId" FROM "leave_records";
DROP TABLE "leave_records";
ALTER TABLE "new_leave_records" RENAME TO "leave_records";
CREATE TABLE "new_users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "joined_at" DATETIME,
    "reminderTime" TEXT NOT NULL DEFAULT '09:00',
    "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_users" ("createdAt", "email", "id", "joined_at", "name", "passwordHash") SELECT "createdAt", "email", "id", "joined_at", "name", "passwordHash" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_email_idx" ON "password_reset_tokens"("email");
