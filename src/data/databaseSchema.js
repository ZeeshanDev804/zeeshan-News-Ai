export const DATABASE_TABLES = {
  articles: "articles",
  sources: "sources",
  trends: "trends",
  opportunities: "opportunities",
  tasks: "tasks",
  analytics: "analytics",
  approvals: "approvals",
  auditLogs: "audit_logs"
};

export function getDatabaseTables() {
  return Object.values(DATABASE_TABLES);
}
