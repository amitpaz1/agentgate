CREATE INDEX `idx_api_keys_hash` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE INDEX `idx_requests_status` ON `approval_requests` (`status`);--> statement-breakpoint
CREATE INDEX `idx_requests_action` ON `approval_requests` (`action`);--> statement-breakpoint
CREATE INDEX `idx_requests_created_at` ON `approval_requests` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_request_id` ON `audit_logs` (`request_id`);--> statement-breakpoint
CREATE INDEX `idx_tokens_request_id` ON `decision_tokens` (`request_id`);--> statement-breakpoint
CREATE INDEX `idx_deliveries_webhook_id` ON `webhook_deliveries` (`webhook_id`);--> statement-breakpoint
CREATE INDEX `idx_deliveries_status` ON `webhook_deliveries` (`status`);