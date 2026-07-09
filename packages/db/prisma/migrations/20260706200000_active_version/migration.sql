-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "active_app_version_id" UUID;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_active_app_version_id_fkey" FOREIGN KEY ("active_app_version_id") REFERENCES "app_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

