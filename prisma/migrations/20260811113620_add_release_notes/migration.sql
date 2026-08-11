-- CreateTable
CREATE TABLE "release_notes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "release_notes_version_key" ON "release_notes"("version");
