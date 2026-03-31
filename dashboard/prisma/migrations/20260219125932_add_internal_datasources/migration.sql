-- CreateTable
CREATE TABLE "internal_datasources" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_datasources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_tables" (
    "id" TEXT NOT NULL,
    "datasource_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_columns" (
    "id" TEXT NOT NULL,
    "table_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "options" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_rows" (
    "id" TEXT NOT NULL,
    "table_id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "internal_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "internal_datasources_project_id_key" ON "internal_datasources"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "internal_tables_datasource_id_name_key" ON "internal_tables"("datasource_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "internal_columns_table_id_name_key" ON "internal_columns"("table_id", "name");

-- CreateIndex
CREATE INDEX "internal_rows_table_id_idx" ON "internal_rows"("table_id");

-- CreateIndex
CREATE INDEX "internal_rows_table_id_created_at_idx" ON "internal_rows"("table_id", "created_at");

-- AddForeignKey
ALTER TABLE "internal_datasources" ADD CONSTRAINT "internal_datasources_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_tables" ADD CONSTRAINT "internal_tables_datasource_id_fkey" FOREIGN KEY ("datasource_id") REFERENCES "internal_datasources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_columns" ADD CONSTRAINT "internal_columns_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "internal_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_rows" ADD CONSTRAINT "internal_rows_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "internal_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
