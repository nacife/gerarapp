-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('learner', 'creator', 'org_admin', 'support', 'admin', 'super_admin');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended', 'pending_deletion');

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('org_admin', 'editor', 'viewer');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('draft', 'published', 'unpublished', 'blocked');

-- CreateEnum
CREATE TYPE "AccessMode" AS ENUM ('public', 'link', 'password', 'invite');

-- CreateEnum
CREATE TYPE "SourceMime" AS ENUM ('pdf', 'epub', 'docx', 'md');

-- CreateEnum
CREATE TYPE "OcrStatus" AS ENUM ('not_needed', 'pending', 'running', 'done', 'failed');

-- CreateEnum
CREATE TYPE "ContentBlockKind" AS ENUM ('concept', 'definition', 'example', 'exercise', 'summary', 'figure', 'table', 'formula');

-- CreateEnum
CREATE TYPE "AppVersionStatus" AS ENUM ('building', 'published', 'rolled_back');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('quiz', 'flashcard_deck', 'cloze', 'dragdrop', 'timeline', 'hotspot', 'scenario', 'audio', 'mindmap');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('easy', 'medium', 'hard');

-- CreateEnum
CREATE TYPE "InteractionOrigin" AS ENUM ('ai_generated', 'ai_edited', 'manual');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('extracted', 'stock', 'ai_generated', 'upload', 'tts', 'podcast');

-- CreateEnum
CREATE TYPE "LearningEventType" AS ENUM ('view', 'answer', 'complete', 'streak', 'battle', 'tutor_question');

-- CreateEnum
CREATE TYPE "PlanKey" AS ENUM ('free', 'pro', 'business');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'canceled');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'open', 'paid', 'void', 'uncollectible');

-- CreateEnum
CREATE TYPE "CreditReason" AS ENUM ('ingest', 'interactions', 'image', 'tts', 'tutor', 'grant', 'purchase', 'adjustment');

-- CreateEnum
CREATE TYPE "ModerationSource" AS ENUM ('classifier', 'report', 'dmca');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('open', 'reviewing', 'resolved', 'takedown');

-- CreateEnum
CREATE TYPE "FlagSubjectType" AS ENUM ('user', 'org', 'plan');

-- CreateEnum
CREATE TYPE "InpiFilingMode" AS ENUM ('self_service', 'assisted');

-- CreateEnum
CREATE TYPE "InpiFilingStatus" AS ENUM ('draft', 'awaiting_poa', 'awaiting_payment', 'in_review', 'filed', 'granted', 'rejected', 'revoked');

-- CreateEnum
CREATE TYPE "InpiFilingEventKind" AS ENUM ('created', 'poa_signed', 'gru_paid', 'filed', 'rpi_dispatch', 'granted', 'note');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "password_hash" TEXT,
    "name" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'pt-BR',
    "role" "Role" NOT NULL DEFAULT 'creator',
    "mfa" JSONB,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "branding" JSONB,
    "sso_config" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "org_role" "OrgRole" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "org_id" UUID,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "custom_domain" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'draft',
    "access_mode" "AccessMode" NOT NULL DEFAULT 'public',
    "access_secret" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_files" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "s3_key" TEXT NOT NULL,
    "mime" "SourceMime" NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "sha256" TEXT NOT NULL,
    "ocr_status" "OcrStatus" NOT NULL DEFAULT 'not_needed',
    "extraction_report" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_maps" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "tree" JSONB NOT NULL,
    "structure_confidence" DOUBLE PRECISION,
    "approved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_blocks" (
    "id" UUID NOT NULL,
    "content_map_id" UUID NOT NULL,
    "parent_id" UUID,
    "position" INTEGER NOT NULL DEFAULT 0,
    "kind" "ContentBlockKind" NOT NULL,
    "content_md" TEXT NOT NULL,
    "source_ref" JSONB,
    "confidence" DOUBLE PRECISION,
    "embedding" vector(1536),

    CONSTRAINT "content_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_versions" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "theme_id" UUID,
    "manifest" JSONB NOT NULL,
    "manifest_s3_key" TEXT,
    "bundle_sha512" TEXT,
    "status" "AppVersionStatus" NOT NULL DEFAULT 'building',
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interactions" (
    "id" UUID NOT NULL,
    "app_version_id" UUID NOT NULL,
    "content_block_id" UUID,
    "type" "InteractionType" NOT NULL,
    "payload" JSONB NOT NULL,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'medium',
    "origin" "InteractionOrigin" NOT NULL DEFAULT 'ai_generated',
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokens" JSONB NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "min_plan_tier" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "palettes" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colors" JSONB NOT NULL,
    "wcag_aa" BOOLEAN NOT NULL DEFAULT true,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "min_plan_tier" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "palettes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "themes" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "palette" JSONB NOT NULL,
    "typography" JSONB NOT NULL,
    "effects" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "themes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "s3_key" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "sha256" TEXT,
    "meta" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learners" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "pinned_version" INTEGER,
    "enrolled_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pinned_version_id" UUID,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_events" (
    "id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "interaction_id" UUID,
    "event" "LearningEventType" NOT NULL,
    "detail" JSONB,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learner_progress" (
    "enrollment_id" UUID NOT NULL,
    "content_block_id" UUID NOT NULL,
    "mastery" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "streak_days" INTEGER NOT NULL DEFAULT 0,
    "next_review_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "learner_progress_pkey" PRIMARY KEY ("enrollment_id","content_block_id")
);

-- CreateTable
CREATE TABLE "learning_dna" (
    "learner_id" UUID NOT NULL,
    "profile" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "learning_dna_pkey" PRIMARY KEY ("learner_id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "verify_code" TEXT NOT NULL,
    "pdf_s3_key" TEXT,
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inpi_certificates" (
    "id" UUID NOT NULL,
    "app_version_id" UUID NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'SHA-512',
    "bundle_hash" TEXT NOT NULL,
    "manifest_canonical_s3_key" TEXT,
    "declaration_pdf_s3_key" TEXT,
    "tsa_token_s3_key" TEXT,
    "requested_by" UUID NOT NULL,
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inpi_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inpi_filings" (
    "id" UUID NOT NULL,
    "inpi_certificate_id" UUID,
    "customer_user_id" UUID NOT NULL,
    "mode" "InpiFilingMode" NOT NULL,
    "status" "InpiFilingStatus" NOT NULL DEFAULT 'draft',
    "holder" JSONB,
    "authors" JSONB,
    "poa_pdf_s3_key" TEXT,
    "gru_number" TEXT,
    "inpi_process_number" TEXT,
    "certificate_s3_key" TEXT,
    "fee_cents_service" INTEGER,
    "fee_cents_gru" INTEGER,
    "assigned_operator" UUID,
    "filed_at" TIMESTAMPTZ(6),
    "granted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inpi_filings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inpi_filing_events" (
    "id" UUID NOT NULL,
    "filing_id" UUID NOT NULL,
    "kind" "InpiFilingEventKind" NOT NULL,
    "detail" JSONB,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inpi_filing_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "key" "PlanKey" NOT NULL,
    "name" TEXT NOT NULL,
    "limits" JSONB NOT NULL,
    "price_cents_month" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "gateway_ref" TEXT,
    "current_period_end" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'open',
    "nfe_key" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_credit_ledger" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" "CreditReason" NOT NULL,
    "ref_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_credit_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "device" JSONB,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "actor_role" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" UUID,
    "before_after" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_cases" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "source" "ModerationSource" NOT NULL,
    "status" "ModerationStatus" NOT NULL DEFAULT 'open',
    "assignee_id" UUID,
    "evidence" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "moderation_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "default_on" BOOLEAN NOT NULL DEFAULT false,
    "rollout_pct" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flag_assignments" (
    "id" UUID NOT NULL,
    "flag_id" UUID NOT NULL,
    "subject_type" "FlagSubjectType" NOT NULL,
    "subject_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "flag_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "memberships_org_id_idx" ON "memberships"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_user_id_org_id_key" ON "memberships"("user_id", "org_id");

-- CreateIndex
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "projects_custom_domain_key" ON "projects"("custom_domain");

-- CreateIndex
CREATE INDEX "projects_owner_user_id_idx" ON "projects"("owner_user_id");

-- CreateIndex
CREATE INDEX "projects_org_id_idx" ON "projects"("org_id");

-- CreateIndex
CREATE INDEX "source_files_project_id_idx" ON "source_files"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_maps_project_id_revision_key" ON "content_maps"("project_id", "revision");

-- CreateIndex
CREATE INDEX "content_blocks_content_map_id_idx" ON "content_blocks"("content_map_id");

-- CreateIndex
CREATE INDEX "content_blocks_parent_id_idx" ON "content_blocks"("parent_id");

-- CreateIndex
CREATE INDEX "app_versions_theme_id_idx" ON "app_versions"("theme_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_versions_project_id_version_number_key" ON "app_versions"("project_id", "version_number");

-- CreateIndex
CREATE INDEX "interactions_app_version_id_idx" ON "interactions"("app_version_id");

-- CreateIndex
CREATE INDEX "interactions_content_block_id_idx" ON "interactions"("content_block_id");

-- CreateIndex
CREATE UNIQUE INDEX "templates_key_key" ON "templates"("key");

-- CreateIndex
CREATE UNIQUE INDEX "palettes_key_key" ON "palettes"("key");

-- CreateIndex
CREATE INDEX "themes_project_id_idx" ON "themes"("project_id");

-- CreateIndex
CREATE INDEX "themes_template_id_idx" ON "themes"("template_id");

-- CreateIndex
CREATE INDEX "media_assets_project_id_idx" ON "media_assets"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "learners_email_key" ON "learners"("email");

-- CreateIndex
CREATE INDEX "enrollments_project_id_idx" ON "enrollments"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_learner_id_project_id_key" ON "enrollments"("learner_id", "project_id");

-- CreateIndex
CREATE INDEX "learning_events_enrollment_id_occurred_at_idx" ON "learning_events"("enrollment_id", "occurred_at");

-- CreateIndex
CREATE INDEX "learning_events_interaction_id_idx" ON "learning_events"("interaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_enrollment_id_key" ON "certificates"("enrollment_id");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_verify_code_key" ON "certificates"("verify_code");

-- CreateIndex
CREATE UNIQUE INDEX "inpi_certificates_app_version_id_key" ON "inpi_certificates"("app_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "inpi_certificates_bundle_hash_key" ON "inpi_certificates"("bundle_hash");

-- CreateIndex
CREATE UNIQUE INDEX "inpi_filings_inpi_certificate_id_key" ON "inpi_filings"("inpi_certificate_id");

-- CreateIndex
CREATE INDEX "inpi_filings_customer_user_id_idx" ON "inpi_filings"("customer_user_id");

-- CreateIndex
CREATE INDEX "inpi_filings_status_idx" ON "inpi_filings"("status");

-- CreateIndex
CREATE INDEX "inpi_filing_events_filing_id_idx" ON "inpi_filing_events"("filing_id");

-- CreateIndex
CREATE UNIQUE INDEX "plans_key_key" ON "plans"("key");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "invoices_subscription_id_idx" ON "invoices"("subscription_id");

-- CreateIndex
CREATE INDEX "ai_credit_ledger_user_id_created_at_idx" ON "ai_credit_ledger"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_target_type_target_id_idx" ON "audit_logs"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "moderation_cases_project_id_idx" ON "moderation_cases"("project_id");

-- CreateIndex
CREATE INDEX "moderation_cases_status_idx" ON "moderation_cases"("status");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

-- CreateIndex
CREATE UNIQUE INDEX "flag_assignments_flag_id_subject_type_subject_id_key" ON "flag_assignments"("flag_id", "subject_type", "subject_id");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_files" ADD CONSTRAINT "source_files_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_maps" ADD CONSTRAINT "content_maps_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_blocks" ADD CONSTRAINT "content_blocks_content_map_id_fkey" FOREIGN KEY ("content_map_id") REFERENCES "content_maps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_blocks" ADD CONSTRAINT "content_blocks_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "content_blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_versions" ADD CONSTRAINT "app_versions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_versions" ADD CONSTRAINT "app_versions_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "themes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_app_version_id_fkey" FOREIGN KEY ("app_version_id") REFERENCES "app_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_content_block_id_fkey" FOREIGN KEY ("content_block_id") REFERENCES "content_blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "themes" ADD CONSTRAINT "themes_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "themes" ADD CONSTRAINT "themes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "learners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_pinned_version_id_fkey" FOREIGN KEY ("pinned_version_id") REFERENCES "app_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_events" ADD CONSTRAINT "learning_events_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_events" ADD CONSTRAINT "learning_events_interaction_id_fkey" FOREIGN KEY ("interaction_id") REFERENCES "interactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_progress" ADD CONSTRAINT "learner_progress_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_dna" ADD CONSTRAINT "learning_dna_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "learners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inpi_certificates" ADD CONSTRAINT "inpi_certificates_app_version_id_fkey" FOREIGN KEY ("app_version_id") REFERENCES "app_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inpi_certificates" ADD CONSTRAINT "inpi_certificates_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inpi_filings" ADD CONSTRAINT "inpi_filings_inpi_certificate_id_fkey" FOREIGN KEY ("inpi_certificate_id") REFERENCES "inpi_certificates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inpi_filings" ADD CONSTRAINT "inpi_filings_customer_user_id_fkey" FOREIGN KEY ("customer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inpi_filings" ADD CONSTRAINT "inpi_filings_assigned_operator_fkey" FOREIGN KEY ("assigned_operator") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inpi_filing_events" ADD CONSTRAINT "inpi_filing_events_filing_id_fkey" FOREIGN KEY ("filing_id") REFERENCES "inpi_filings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_credit_ledger" ADD CONSTRAINT "ai_credit_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flag_assignments" ADD CONSTRAINT "flag_assignments_flag_id_fkey" FOREIGN KEY ("flag_id") REFERENCES "feature_flags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

