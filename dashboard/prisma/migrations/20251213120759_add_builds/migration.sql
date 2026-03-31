-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "active_build_id" TEXT;

-- CreateTable
CREATE TABLE "builds" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "script" TEXT NOT NULL,
    "script_view" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "generated_files" JSONB,
    "ast" JSONB,
    "dependencies" JSONB,
    "detected_packages" JSONB,
    "detected_env_vars" JSONB,
    "ai_usage" JSONB,
    "ai_generated_ranges" JSONB,
    "summary" JSONB,
    "syntax_errors" JSONB,
    "stats" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "builds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "builds_project_id_created_at_idx" ON "builds"("project_id", "created_at");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_active_build_id_fkey" FOREIGN KEY ("active_build_id") REFERENCES "builds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "builds" ADD CONSTRAINT "builds_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
