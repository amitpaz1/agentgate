CREATE INDEX "idx_api_keys_hash" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "idx_requests_status" ON "approval_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_requests_action" ON "approval_requests" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_requests_created_at" ON "approval_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_request_id" ON "audit_logs" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "idx_tokens_request_id" ON "decision_tokens" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "idx_deliveries_webhook_id" ON "webhook_deliveries" USING btree ("webhook_id");--> statement-breakpoint
CREATE INDEX "idx_deliveries_status" ON "webhook_deliveries" USING btree ("status");