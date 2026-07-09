-- AlterTable
ALTER TABLE "inpi_certificates" ADD COLUMN     "bundle_hash_sha256" TEXT;

-- CreateTable
CREATE TABLE "inpi_certificate_verifications" (
    "id" UUID NOT NULL,
    "certificate_id" UUID NOT NULL,
    "matched" BOOLEAN NOT NULL,
    "recomputed_hash" TEXT NOT NULL,
    "verified_by" UUID,
    "verified_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inpi_certificate_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inpi_certificate_verifications_certificate_id_idx" ON "inpi_certificate_verifications"("certificate_id");

-- AddForeignKey
ALTER TABLE "inpi_certificate_verifications" ADD CONSTRAINT "inpi_certificate_verifications_certificate_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "inpi_certificates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inpi_certificate_verifications" ADD CONSTRAINT "inpi_certificate_verifications_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Append-only: verificação de integridade é histórico auditável, nunca editável (mesmo
-- espírito da ADR-0043 aplicado a esta nova tabela de log).
REVOKE UPDATE, DELETE ON "inpi_certificate_verifications" FROM eduforge_app;

