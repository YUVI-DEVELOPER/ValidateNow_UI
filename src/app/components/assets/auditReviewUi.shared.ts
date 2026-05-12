import {
  AuditReviewJobDetail,
  AuditReviewReportDetail,
  AuditReviewReportStatus,
} from "../../../services/audit-review.service";

export type AuditReviewUiActionKey =
  | "run"
  | "extract"
  | "analyze"
  | "generate-report"
  | "open-report"
  | "open-approval"
  | "download-pdf"
  | "refresh"
  | "none";

export interface AuditReviewUiAction {
  key: AuditReviewUiActionKey;
  label: string;
  description: string;
  disabled?: boolean;
  loading?: boolean;
}

export const formatAuditReviewValue = (value?: string | number | null): string => {
  if (value === undefined || value === null || String(value).trim() === "") return "-";
  return String(value);
};

export const formatAuditReviewNumber = (value?: number | null): string => {
  if (value === undefined || value === null) return "0";
  return value.toLocaleString();
};

export const formatAuditReviewDateTime = (value?: string | null): string => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatAuditReviewDate = (value?: string | null): string => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

export const formatAuditReviewPeriod = (start?: string | null, end?: string | null): string => {
  if (!start && !end) return "-";
  return `${formatAuditReviewDate(start)} - ${formatAuditReviewDate(end)}`;
};

export const formatAuditReviewLabel = (value?: string | null): string => {
  if (!value) return "-";
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => {
      const upper = part.toUpperCase();
      return upper.length <= 4 ? upper : upper.charAt(0) + upper.slice(1).toLowerCase();
    })
    .join(" ");
};

export const shortAuditReviewIdentifier = (value?: string | null): string =>
  value ? `${value.slice(0, 8)}...` : "Not saved";

export const getAuditReviewJobStatusBadgeClass = (status?: string | null): string => {
  if (status === "REPORT_DRAFTED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "ANALYZED" || status === "EXTRACTED") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "EXTRACTING" || status === "ANALYZING" || status === "REPORT_GENERATING") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (status === "FAILED") return "border-red-200 bg-red-50 text-red-700";
  if (status === "CANCELLED") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-slate-200 bg-white text-slate-700";
};

export const getAuditReviewReportStatusBadgeClass = (status?: AuditReviewReportStatus | null): string => {
  if (status === "APPROVED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "UNDER_REVIEW") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "REJECTED") return "border-red-200 bg-red-50 text-red-700";
  if (status === "SUPERSEDED") return "border-slate-200 bg-slate-100 text-slate-600";
  if (status === "DRAFT") return "border-violet-200 bg-violet-50 text-violet-700";
  return "border-slate-200 bg-white text-slate-700";
};

export const getAuditReviewLifecycleStatus = (
  job: AuditReviewJobDetail | null,
  report: AuditReviewReportDetail | null,
): string => {
  if (report?.status === "APPROVED" || report?.status === "UNDER_REVIEW" || report?.status === "REJECTED") {
    return report.status;
  }
  return job?.status || "NO_JOB";
};

export const getAuditReviewLastUpdated = (
  job: AuditReviewJobDetail | null,
  report: AuditReviewReportDetail | null,
): string | null =>
  report?.modified_dt || report?.created_dt || job?.modified_dt || job?.completed_at || job?.created_dt || null;

