-- CreateTable
CREATE TABLE "app_screens" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "layout" JSONB NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_screens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "app_screens_project_id_idx" ON "app_screens"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_screens_project_id_slug_key" ON "app_screens"("project_id", "slug");

-- AddForeignKey
ALTER TABLE "app_screens" ADD CONSTRAINT "app_screens_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
