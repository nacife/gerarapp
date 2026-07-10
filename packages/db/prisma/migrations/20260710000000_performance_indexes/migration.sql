-- Performance indexes (pós-M10 hardening)
-- learner_progress: SM-2 spaced repetition queries filtram por next_review_at
CREATE INDEX IF NOT EXISTS idx_learner_progress_next_review ON learner_progress(next_review_at);
-- jobs: queue-poller queries filtram por status
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
-- webhook_deliveries: cleanup e listagem por data
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at ON webhook_deliveries(created_at);
-- learning_events: analytics queries por enrollment + data
CREATE INDEX IF NOT EXISTS idx_learning_events_enrollment_occurred ON learning_events(enrollment_id, occurred_at DESC);
-- ai_credit_ledger: relatórios de consumo por reason
CREATE INDEX IF NOT EXISTS idx_ai_credit_ledger_reason ON ai_credit_ledger(reason);
-- sessions: lookup por userId (revogação)
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
