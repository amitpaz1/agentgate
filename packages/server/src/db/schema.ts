import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// Approval requests table
export const approvalRequests = sqliteTable("approval_requests", {
  id: text("id").primaryKey(),
  action: text("action").notNull(),
  params: text("params"), // JSON stringified
  context: text("context"), // JSON stringified
  status: text("status", {
    enum: ["pending", "approved", "denied", "expired"],
  }).notNull(),
  urgency: text("urgency", {
    enum: ["low", "normal", "high", "critical"],
  }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  decidedAt: integer("decided_at", { mode: "timestamp" }),
  decidedBy: text("decided_by"),
  decisionReason: text("decision_reason"),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
});

// Audit logs table
export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  requestId: text("request_id")
    .notNull()
    .references(() => approvalRequests.id),
  eventType: text("event_type", {
    enum: ["created", "approved", "denied", "expired", "viewed"],
  }).notNull(),
  actor: text("actor").notNull(),
  details: text("details"), // JSON stringified
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// Policies table
export const policies = sqliteTable("policies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  rules: text("rules").notNull(), // JSON stringified
  priority: integer("priority").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// Type exports
export type ApprovalRequest = typeof approvalRequests.$inferSelect;
export type NewApprovalRequest = typeof approvalRequests.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type Policy = typeof policies.$inferSelect;
export type NewPolicy = typeof policies.$inferInsert;
