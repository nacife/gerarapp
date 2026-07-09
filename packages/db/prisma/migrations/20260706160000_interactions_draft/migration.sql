-- AlterTable
ALTER TABLE "interactions" ADD COLUMN     "project_id" UUID NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL,
ALTER COLUMN "app_version_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "interactions_project_id_idx" ON "interactions"("project_id");

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

