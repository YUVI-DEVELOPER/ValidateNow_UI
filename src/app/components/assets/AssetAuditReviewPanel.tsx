import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  CalendarClock,
  ClipboardCheck,
  Database,
  Eye,
  FileCheck2,
  FileText,
  Gauge,
  History,
  Loader2,
  PlayCircle,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import {
  analyzeAuditReviewJob,
  approveAuditReviewReport,
  AuditReviewFinding,
  AuditReviewJobCreatePayload,
  AuditReviewJobDetail,
  AuditReviewJobListItem,
  AuditReviewReportDetail,
  AuditReviewReportReviewDecisionPayload,
  AuditReviewReportListItem,
  AuditReviewReportSubmitReviewPayload,
  AuditReviewSchedule,
  AuditReviewScheduleFrequency,
  AuditReviewScheduleRun,
  AuditReviewScheduleRunNowResponse,
  AuditReviewScore,
  AuditTrailRecord,
  createAssetAuditReviewSchedule,
  createAuditReviewJob,
  downloadAuditReviewReportPdf,
  extractAuditReviewJob,
  generateAuditReviewReport,
  getAssetAuditReviewSchedules,
  getAuditReviewFindings,
  getAuditReviewJob,
  getAuditReviewRecords,
  getAuditReviewReport,
  getAuditReviewScheduleRuns,
  getAuditReviewScores,
  listAssetAuditReviewReports,
  listAuditReviewJobs,
  rejectAuditReviewReport,
  runAuditReviewScheduleNow,
  submitAuditReviewReport,
  updateAuditReviewSchedule,
} from "../../../services/audit-review.service";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { Skeleton } from "../ui/skeleton";
import { Switch } from "../ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { AuditReviewFindingsTable } from "./AuditReviewFindingsTable";
import { AuditReviewHeroSummary } from "./AuditReviewHeroSummary";
import { AuditReviewKpiRow } from "./AuditReviewKpiRow";
import { AuditReviewReportView } from "./AuditReviewReportView";
import {
  AuditReviewScoreCard,
  formatAuditReviewRating,
  getAuditReviewRatingBadgeClass,
} from "./AuditReviewScoreCard";
import { AuditReviewRunDialog } from "./AuditReviewRunDialog";
import { AuditReviewTabs, AuditReviewWorkspaceTab } from "./AuditReviewTabs";
import { AuditReviewWorkflowStepper } from "./AuditReviewWorkflowStepper";
import {
  AuditReviewUiAction,
  AuditReviewUiActionKey,
} from "./auditReviewUi.shared";

interface AssetAuditReviewPanelProps {
  enabled: boolean;
  assetId: string | null;
  assetName?: string | null;
  assetCode?: string | null;
  assetOwner?: string | null;
}

type AuditReviewAction = "extract" | "analyze" | "generate-report";
type AuditReviewReportAction = "submit-review" | "approve" | "reject";

interface LoadOptions {
  silent?: boolean;
  jobId?: string | null;
}

interface ScheduleFormState {
  enabled: boolean;
  frequency: AuditReviewScheduleFrequency;
  reviewWindowDays: string;
  nextRun: string;
  timezone: string;
  businessStartHour: string;
  businessEndHour: string;
  auditTrailType: string;
  veevaInstanceName: string;
  veevaAppName: string;
  vaultDns: string;
  actor: string;
}

const IN_PROGRESS_STATUSES = new Set(["EXTRACTING", "ANALYZING", "REPORT_GENERATING"]);
const ANALYSIS_READY_STATUSES = new Set(["ANALYZED", "REPORT_GENERATING", "REPORT_DRAFTED", "FAILED"]);
const RECORD_READY_STATUSES = new Set(["EXTRACTED", "ANALYZING", "ANALYZED", "REPORT_GENERATING", "REPORT_DRAFTED", "FAILED"]);
const SCHEDULE_FREQUENCIES: AuditReviewScheduleFrequency[] = ["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY"];
const DRAWER_DEFAULT_WIDTH = 640;
const DRAWER_MIN_WIDTH = 560;
const DRAWER_MAX_WIDTH = 640;

const formatValue = (value?: string | number | null): string => {
  if (value === undefined || value === null || String(value).trim() === "") return "-";
  return String(value);
};

const formatNumber = (value?: number | null): string => {
  if (value === undefined || value === null) return "0";
  return value.toLocaleString();
};

const formatDateTime = (value?: string | null): string => {
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

const formatDate = (value?: string | null): string => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

const formatPeriod = (start?: string | null, end?: string | null): string => {
  if (!start && !end) return "-";
  return `${formatDate(start)} - ${formatDate(end)}`;
};

const toDatetimeLocalInputValue = (value?: string | Date | null): string => {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
};

const datetimeLocalToIso = (value: string): string | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const formatLabel = (value?: string | null): string => {
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

const getStatusBadgeClass = (status?: string | null): string => {
  if (status === "REPORT_DRAFTED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "ANALYZED" || status === "EXTRACTED") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "EXTRACTING" || status === "ANALYZING" || status === "REPORT_GENERATING") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (status === "FAILED") return "border-red-200 bg-red-50 text-red-700";
  if (status === "CANCELLED") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-slate-200 bg-white text-slate-700";
};

const getScheduleRunBadgeClass = (status?: string | null): string => {
  if (status === "COMPLETED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "STARTED") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "FAILED") return "border-red-200 bg-red-50 text-red-700";
  if (status === "SKIPPED") return "border-slate-200 bg-slate-50 text-slate-600";
  return "border-slate-200 bg-white text-slate-700";
};

const buildDefaultScheduleForm = (schedule?: AuditReviewSchedule | null, actor?: string | null): ScheduleFormState => ({
  enabled: schedule?.enabled ?? true,
  frequency: schedule?.frequency ?? "MONTHLY",
  reviewWindowDays: schedule?.review_window_days ? String(schedule.review_window_days) : "30",
  nextRun: toDatetimeLocalInputValue(schedule?.next_run_dt ?? new Date()),
  timezone: schedule?.timezone ?? "Asia/Kolkata",
  businessStartHour: String(schedule?.business_start_hour ?? 9),
  businessEndHour: String(schedule?.business_end_hour ?? 18),
  auditTrailType: schedule?.audit_trail_type ?? "login_audit_trail",
  veevaInstanceName: schedule?.veeva_instance_name ?? "Veeva Quality Vault",
  veevaAppName: schedule?.veeva_app_name ?? "QualityDocs",
  vaultDns: schedule?.vault_dns ?? "",
  actor: schedule?.created_by ?? actor?.trim() ?? "",
});

const mapAuditReviewError = (error: unknown): string => {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : "Unexpected audit review error occurred.";
  }

  const data = error.response?.data as { message?: string; detail?: unknown } | undefined;
  const detail = typeof data?.detail === "string" ? data.detail : undefined;
  return detail || data?.message || error.message || "Audit review request failed.";
};

const sortJobs = (jobs: AuditReviewJobListItem[]): AuditReviewJobListItem[] =>
  [...jobs].sort((left, right) => Date.parse(right.created_dt || "") - Date.parse(left.created_dt || ""));

const shouldLoadRecords = (job: AuditReviewJobDetail): boolean =>
  job.record_count > 0 || RECORD_READY_STATUSES.has(job.status);

const shouldLoadAnalysis = (job: AuditReviewJobDetail): boolean =>
  job.overall_score !== undefined && job.overall_score !== null || job.finding_count > 0 || ANALYSIS_READY_STATUSES.has(job.status);

const calculateSeverityCounts = (findings: AuditReviewFinding[]) =>
  findings.reduce(
    (counts, finding) => {
      if (finding.severity === "HIGH") counts.high += 1;
      if (finding.severity === "MEDIUM") counts.medium += 1;
      if (finding.severity === "LOW") counts.low += 1;
      return counts;
    },
    { high: 0, medium: 0, low: 0 },
  );

const getLatestUpdatedAt = (job: AuditReviewJobDetail | null, report: AuditReviewReportDetail | null): string | null =>
  report?.modified_dt || report?.created_dt || job?.modified_dt || job?.completed_at || job?.created_dt || null;

const buildPrimaryReviewAction = ({
  job,
  report,
  creatingJob,
  action,
  reportAction,
  pdfDownloading,
  refreshing,
}: {
  job: AuditReviewJobDetail | null;
  report: AuditReviewReportDetail | null;
  creatingJob: boolean;
  action: AuditReviewAction | null;
  reportAction: AuditReviewReportAction | null;
  pdfDownloading: boolean;
  refreshing: boolean;
}): AuditReviewUiAction => {
  if (!job) {
    return {
      key: "run",
      label: "Run Audit Review",
      description: "Start the first review job for this asset.",
      loading: creatingJob,
    };
  }

  if (job.status === "CREATED" || job.status === "FAILED") {
    return {
      key: "extract",
      label: "Extract Records",
      description: job.status === "FAILED"
        ? "The last job failed. Retry record extraction to continue the review."
        : "Job is created. Extract normalized Veeva audit trail records for analysis.",
      loading: action === "extract",
    };
  }

  if (job.status === "EXTRACTING") {
    return {
      key: "refresh",
      label: "Extracting Records",
      description: "Record extraction is in progress. Refresh to check the latest backend state.",
      disabled: refreshing,
      loading: refreshing || action === "extract",
    };
  }

  if (job.status === "EXTRACTED") {
    return {
      key: "analyze",
      label: "Analyze Job",
      description: "Records are extracted. Run analysis to generate findings and scores.",
      loading: action === "analyze",
    };
  }

  if (job.status === "ANALYZING") {
    return {
      key: "refresh",
      label: "Analyzing Job",
      description: "Analysis is in progress. Refresh to check generated findings and scores.",
      disabled: refreshing,
      loading: refreshing || action === "analyze",
    };
  }

  if (job.status === "ANALYZED") {
    return {
      key: "generate-report",
      label: "Generate Draft Report",
      description: "Analysis is complete. Generate the draft audit report.",
      loading: action === "generate-report",
    };
  }

  if (job.status === "REPORT_GENERATING") {
    return {
      key: "refresh",
      label: "Generating Report",
      description: "Draft report generation is in progress. Refresh to check report availability.",
      disabled: refreshing,
      loading: refreshing || action === "generate-report",
    };
  }

  if (job.status === "REPORT_DRAFTED" && report?.status === "DRAFT") {
    return {
      key: "open-approval",
      label: "Submit for QA Review",
      description: "Draft report is ready. Submit it for QA review.",
      loading: reportAction === "submit-review",
    };
  }

  if (report?.status === "UNDER_REVIEW") {
    return {
      key: "open-approval",
      label: "Approve / Reject",
      description: "Report is under QA review. Capture a human approval or rejection decision.",
      loading: Boolean(reportAction),
    };
  }

  if (report?.status === "APPROVED") {
    return {
      key: "download-pdf",
      label: "Download PDF",
      description: "Report is approved. Download the approved PDF or send notifications.",
      loading: pdfDownloading,
    };
  }

  if (report?.status === "REJECTED") {
    return {
      key: "open-approval",
      label: "Review Rejection",
      description: "Report was rejected. Review QA comments and regenerate a corrected report if needed.",
    };
  }

  if (report) {
    return {
      key: "open-report",
      label: "View Draft Report",
      description: "Draft report is available for review.",
    };
  }

  return {
    key: "refresh",
    label: "Refresh Status",
    description: "Refresh to confirm the latest audit review state.",
    loading: refreshing,
  };
};

const buildSecondaryReviewAction = (
  job: AuditReviewJobDetail | null,
  report: AuditReviewReportDetail | null,
  primaryAction: AuditReviewUiAction,
): AuditReviewUiAction | null => {
  if (report && primaryAction.key !== "open-report") {
    return {
      key: "open-report",
      label: report.status === "APPROVED" ? "View Approved Report" : "View Draft Report",
      description: "Open the report workspace.",
    };
  }

  return null;
};

const clampDrawerWidth = (value: number): number => {
  if (typeof window === "undefined") return value;
  const viewportMax = Math.max(DRAWER_MIN_WIDTH, Math.min(DRAWER_MAX_WIDTH, window.innerWidth - 24));
  return Math.min(Math.max(value, DRAWER_MIN_WIDTH), viewportMax);
};

const useResizableDrawer = (defaultWidth = DRAWER_DEFAULT_WIDTH) => {
  const [drawerWidth, setDrawerWidth] = useState(defaultWidth);
  const [resizing, setResizing] = useState(false);

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (event: MouseEvent) => {
      setDrawerWidth(clampDrawerWidth(window.innerWidth - event.clientX));
    };
    const handleMouseUp = () => setResizing(false);
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizing]);

  const resizeBy = (delta: number) => {
    setDrawerWidth((previous) => clampDrawerWidth(previous + delta));
  };

  return {
    drawerWidth,
    resizing,
    resizeBy,
    startResize: (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      setResizing(true);
    },
  };
};

function ResizableDrawerHandle({
  resizing,
  onMouseDown,
  onResizeStep,
}: {
  resizing: boolean;
  onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  onResizeStep: (delta: number) => void;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize drawer"
      tabIndex={0}
      title="Drag to resize"
      className={`absolute inset-y-0 left-0 z-20 hidden w-2 cursor-col-resize focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:block ${
        resizing ? "bg-blue-100/70" : "hover:bg-blue-50"
      }`}
      onMouseDown={onMouseDown}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          onResizeStep(40);
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          onResizeStep(-40);
        }
      }}
    >
      <span className="absolute left-1/2 top-1/2 h-12 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-300" />
    </div>
  );
}

const ActionButton = ({
  children,
  icon,
  enabled,
  disabledReason,
  loading,
  onClick,
  variant = "outline",
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  enabled: boolean;
  disabledReason: string;
  loading?: boolean;
  onClick: () => void;
  variant?: "default" | "outline" | "ghost";
}) => (
  <span className="inline-flex" title={!enabled ? disabledReason : undefined}>
    <Button
      type="button"
      size="sm"
      variant={variant}
      onClick={onClick}
      disabled={!enabled || loading}
      className="min-w-40 justify-center"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </Button>
  </span>
);

function AuditReviewLoadingState() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-36 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}

function AuditReviewEmptyState({ onRun, disabled }: { onRun: () => void; disabled: boolean }) {
  return (
    <section className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 text-blue-700">
        <ShieldCheck className="h-7 w-7" />
      </div>
      <h3 className="mt-5 text-base font-semibold text-slate-950">No audit review has been run for this asset yet.</h3>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500">
        Start a periodic audit review to extract Veeva audit trail records, analyze findings, and generate a draft compliance report.
      </p>
      <div className="mt-6">
        <Button type="button" onClick={onRun} disabled={disabled}>
          <PlayCircle className="h-4 w-4" />
          Run Audit Review
        </Button>
      </div>
    </section>
  );
}

function AuditReviewErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-red-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="text-sm font-semibold">Audit review data could not be loaded</p>
            <p className="mt-1 text-sm leading-6 text-red-700">{message}</p>
          </div>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onRetry} className="border-red-200 bg-white text-red-700 hover:bg-red-100">
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    </div>
  );
}

function AuditReviewHeader({
  job,
  report,
  onRun,
  runningDisabled,
}: {
  job: AuditReviewJobDetail | null;
  report: AuditReviewReportDetail | null;
  onRun: () => void;
  runningDisabled: boolean;
}) {
  const latestUpdatedAt = getLatestUpdatedAt(job, report);
  const reportStatus = report?.status || job?.latest_report_status || "Not generated";

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50/70 px-5 py-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex gap-4">
            <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-white text-blue-700 shadow-sm sm:flex">
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-normal text-slate-950">Audit Trail Reviews</h2>
                <Badge variant="outline" className={getStatusBadgeClass(job?.status)}>
                  {formatLabel(job?.status) || "No Job"}
                </Badge>
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                Periodic compliance review of Veeva audit trail activity for this asset
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Latest Period</p>
                <p className="mt-1 whitespace-nowrap font-semibold text-slate-900">{formatPeriod(job?.review_start_dt, job?.review_end_dt)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Report</p>
                <p className="mt-1 whitespace-nowrap font-semibold text-slate-900">{formatLabel(reportStatus)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Updated</p>
                <p className="mt-1 whitespace-nowrap font-semibold text-slate-900">{formatDateTime(latestUpdatedAt)}</p>
              </div>
            </div>
            <Button type="button" onClick={onRun} disabled={runningDisabled} className="h-10">
              <PlayCircle className="h-4 w-4" />
              Run Audit Review
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function AuditReviewActions({
  job,
  report,
  action,
  refreshing,
  onRun,
  onExtract,
  onAnalyze,
  onGenerateReport,
  onViewReport,
  onRefresh,
}: {
  job: AuditReviewJobDetail | null;
  report: AuditReviewReportDetail | null;
  action: AuditReviewAction | null;
  refreshing: boolean;
  onRun: () => void;
  onExtract: () => void;
  onAnalyze: () => void;
  onGenerateReport: () => void;
  onViewReport: () => void;
  onRefresh: () => void;
}) {
  const status = job?.status;
  const isWorkflowBusy = Boolean(status && IN_PROGRESS_STATUSES.has(status));
  const canExtract = Boolean(job && (status === "CREATED" || status === "FAILED") && !isWorkflowBusy);
  const canAnalyze = Boolean(job && status === "EXTRACTED");
  const canGenerateReport = Boolean(job && status === "ANALYZED");
  const canViewReport = Boolean(job && status === "REPORT_DRAFTED" && report);
  const nextAction =
    !job
      ? "Run the first audit review for this asset."
      : canExtract
        ? "Extract records is the next available step."
        : canAnalyze
          ? "Analyze job is ready."
          : canGenerateReport
            ? "Generate the draft report from analyzed scores."
            : canViewReport
              ? "Draft report is available for review."
              : isWorkflowBusy
                ? "Backend processing is in progress."
                : "Refresh to confirm the latest review state.";

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Primary Actions</h3>
          <p className="mt-1 text-xs text-slate-500">{nextAction}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!job ? (
            <Button type="button" size="sm" onClick={onRun}>
              <PlayCircle className="h-4 w-4" />
              Run Audit Review
            </Button>
          ) : null}
          <ActionButton
            enabled={canExtract}
            disabledReason={isWorkflowBusy ? "The current audit review action is still running." : "Extraction is available for created or failed jobs."}
            loading={action === "extract"}
            onClick={onExtract}
            icon={<Database className="h-4 w-4" />}
            variant={canExtract ? "default" : "outline"}
          >
            Extract Records
          </ActionButton>
          <ActionButton
            enabled={canAnalyze}
            disabledReason="Analysis is available after records have been extracted."
            loading={action === "analyze"}
            onClick={onAnalyze}
            icon={<BarChart3 className="h-4 w-4" />}
            variant={canAnalyze ? "default" : "outline"}
          >
            Analyze Job
          </ActionButton>
          <ActionButton
            enabled={canGenerateReport}
            disabledReason="Draft report generation is available after analysis is completed."
            loading={action === "generate-report"}
            onClick={onGenerateReport}
            icon={<FileText className="h-4 w-4" />}
            variant={canGenerateReport ? "default" : "outline"}
          >
            Generate Draft Report
          </ActionButton>
          <ActionButton
            enabled={canViewReport}
            disabledReason="A drafted report is not available for this job yet."
            onClick={onViewReport}
            icon={<Eye className="h-4 w-4" />}
          >
            View Draft Report
          </ActionButton>
          <Button type="button" size="sm" variant="outline" onClick={onRefresh} disabled={refreshing || Boolean(action)}>
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>
      {job?.error_message ? (
        <div className="mt-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{job.error_message}</span>
        </div>
      ) : null}
    </section>
  );
}

function AuditReviewSchedulePanel({
  schedule,
  form,
  runs,
  loading,
  saving,
  running,
  lastResult,
  onChange,
  onSave,
  onToggle,
  onRunNow,
  onSelectJob,
  onViewReport,
}: {
  schedule: AuditReviewSchedule | null;
  form: ScheduleFormState;
  runs: AuditReviewScheduleRun[];
  loading: boolean;
  saving: boolean;
  running: boolean;
  lastResult: AuditReviewScheduleRunNowResponse | null;
  onChange: (field: keyof ScheduleFormState, value: string | boolean) => void;
  onSave: () => void;
  onToggle: (enabled: boolean) => void;
  onRunNow: () => void;
  onSelectJob: (jobId: string) => void;
  onViewReport: () => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const latestRun = runs[0] ?? lastResult?.run ?? null;
  const resultJobId = lastResult?.job?.job_id || lastResult?.run.job_id || null;
  const resultReportId = lastResult?.report?.report_id || lastResult?.job?.latest_report_id || null;
  const isBusy = saving || running;
  const scheduleStatus = schedule?.enabled ?? form.enabled;

  return (
    <>
      <AuditReviewScheduleSummaryCard
        schedule={schedule}
        form={form}
        latestRun={latestRun}
        loading={loading}
        onOpen={() => setDetailsOpen(true)}
      />

      <AuditReviewScheduleDrawer
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        schedule={schedule}
        form={form}
        runs={runs}
        loading={loading}
        saving={saving}
        running={running}
        latestRun={latestRun}
        resultJobId={resultJobId}
        resultReportId={resultReportId}
        isBusy={isBusy}
        scheduleStatus={scheduleStatus}
        onChange={onChange}
        onSave={onSave}
        onToggle={onToggle}
        onRunNow={onRunNow}
        onSelectJob={onSelectJob}
        onViewReport={onViewReport}
      />
    </>
  );
}

const shortIdentifier = (value?: string | null): string => (value ? `${value.slice(0, 8)}...` : "Not saved");

const formatScheduleRunStatus = (status?: string | null): string => {
  if (!status) return "Never Run";
  if (status === "STARTED") return "Running";
  return formatLabel(status);
};

const ScheduleSummaryTile = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0 border-l border-slate-200 pl-3">
    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 truncate text-sm font-semibold text-slate-900" title={value}>
      {value}
    </p>
  </div>
);

function AuditReviewScheduleSummaryCard({
  schedule,
  form,
  latestRun,
  loading,
  onOpen,
}: {
  schedule: AuditReviewSchedule | null;
  form: ScheduleFormState;
  latestRun: AuditReviewScheduleRun | null;
  loading: boolean;
  onOpen: () => void;
}) {
  const scheduleStatus = schedule?.enabled ?? form.enabled;
  const runStatusLabel = formatScheduleRunStatus(latestRun?.status);
  const summaryFrequency = schedule?.frequency ?? form.frequency;

  return (
    <section
      role="button"
      tabIndex={0}
      aria-label="Manage periodic schedule"
      className="rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-blue-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Periodic Schedule</h3>
              <Badge
                variant="outline"
                className={scheduleStatus ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}
              >
                {scheduleStatus ? "Enabled" : "Disabled"}
              </Badge>
              <Badge variant="outline" className={latestRun ? getScheduleRunBadgeClass(latestRun.status) : "border-slate-200 bg-white text-slate-700"}>
                Last run {runStatusLabel}
              </Badge>
            </div>
            <p className="mt-1 truncate text-xs text-slate-500" title={schedule?.schedule_id || undefined}>
              Schedule ID {shortIdentifier(schedule?.schedule_id)}
            </p>
          </div>
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-3 lg:max-w-2xl">
          <ScheduleSummaryTile label="Frequency" value={formatLabel(summaryFrequency)} />
          <ScheduleSummaryTile label="Next Run" value={formatDateTime(schedule?.next_run_dt)} />
          <ScheduleSummaryTile label="Last Run" value={formatDateTime(schedule?.last_run_dt)} />
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          disabled={loading}
          className="self-start lg:self-center"
        >
          <Settings2 className="h-4 w-4" />
          {schedule ? "Manage Schedule" : "Create Schedule"}
        </Button>
      </div>
    </section>
  );
}

const DrawerSummaryTile = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 truncate text-sm font-semibold text-slate-900" title={value}>
      {value}
    </p>
  </div>
);

const ScheduleDrawerSection = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="space-y-3">
    <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
    {children}
  </section>
);

function AuditReviewScheduleDrawer({
  open,
  onOpenChange,
  schedule,
  form,
  runs,
  loading,
  saving,
  running,
  latestRun,
  resultJobId,
  resultReportId,
  isBusy,
  scheduleStatus,
  onChange,
  onSave,
  onToggle,
  onRunNow,
  onSelectJob,
  onViewReport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: AuditReviewSchedule | null;
  form: ScheduleFormState;
  runs: AuditReviewScheduleRun[];
  loading: boolean;
  saving: boolean;
  running: boolean;
  latestRun: AuditReviewScheduleRun | null;
  resultJobId: string | null;
  resultReportId: string | null;
  isBusy: boolean;
  scheduleStatus: boolean;
  onChange: (field: keyof ScheduleFormState, value: string | boolean) => void;
  onSave: () => void;
  onToggle: (enabled: boolean) => void;
  onRunNow: () => void;
  onSelectJob: (jobId: string) => void;
  onViewReport: () => void;
}) {
  const runStatusLabel = formatScheduleRunStatus(latestRun?.status);
  const actionDisabled = isBusy || loading;
  const { drawerWidth, resizing, resizeBy, startResize } = useResizableDrawer();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-none"
        style={{ width: drawerWidth, maxWidth: "calc(100vw - 24px)" }}
      >
        <ResizableDrawerHandle resizing={resizing} onMouseDown={startResize} onResizeStep={resizeBy} />
        <SheetHeader className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-5 pr-12">
          <div className="flex flex-wrap items-start gap-2">
            <SheetTitle className="text-base text-slate-950">Periodic Schedule</SheetTitle>
            <Badge
              variant="outline"
              className={scheduleStatus ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}
            >
              {scheduleStatus ? "Enabled" : "Disabled"}
            </Badge>
            <Badge variant="outline" className={latestRun ? getScheduleRunBadgeClass(latestRun.status) : "border-slate-200 bg-white text-slate-700"}>
              Last run {runStatusLabel}
            </Badge>
          </div>
          <SheetDescription className="text-sm text-slate-500">
            Manage automatic periodic audit review execution for this asset.
          </SheetDescription>
          <p className="break-all font-mono text-[11px] text-slate-400">
            Schedule ID {schedule?.schedule_id || "Not saved"}
          </p>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto bg-white px-5 py-5">
          <div className="grid grid-cols-2 gap-3">
            <DrawerSummaryTile label="Frequency" value={formatLabel(form.frequency)} />
            <DrawerSummaryTile label="Next Run" value={formatDateTime(schedule?.next_run_dt)} />
            <DrawerSummaryTile label="Last Run" value={formatDateTime(schedule?.last_run_dt)} />
            <DrawerSummaryTile label="Review Window" value={`${form.reviewWindowDays || "-"} days`} />
          </div>

          <ScheduleDrawerSection title="Schedule Configuration">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-slate-800">Enabled</p>
                <p className="text-xs text-slate-500">{form.enabled ? "Automatic due runs active" : "Automatic due runs paused"}</p>
              </div>
              <Switch
                checked={form.enabled}
                disabled={actionDisabled}
                onCheckedChange={(checked) => {
                  onChange("enabled", checked);
                  onToggle(checked);
                }}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Frequency</label>
                <Select
                  value={form.frequency}
                  disabled={actionDisabled}
                  onValueChange={(value) => onChange("frequency", value as AuditReviewScheduleFrequency)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCHEDULE_FREQUENCIES.map((frequency) => (
                      <SelectItem key={frequency} value={frequency}>
                        {formatLabel(frequency)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                label="Review window days"
                type="number"
                min={1}
                max={366}
                value={form.reviewWindowDays}
                onChange={(event) => onChange("reviewWindowDays", event.target.value)}
                disabled={actionDisabled}
              />
              <Input
                label="Next run date"
                type="datetime-local"
                value={form.nextRun}
                onChange={(event) => onChange("nextRun", event.target.value)}
                iconLeft={<CalendarDays className="h-4 w-4" />}
                disabled={actionDisabled}
              />
              <Input
                label="Timezone"
                value={form.timezone}
                onChange={(event) => onChange("timezone", event.target.value)}
                disabled={actionDisabled}
              />
              <Input
                label="Business start"
                type="number"
                min={0}
                max={23}
                value={form.businessStartHour}
                onChange={(event) => onChange("businessStartHour", event.target.value)}
                disabled={actionDisabled}
              />
              <Input
                label="Business end"
                type="number"
                min={1}
                max={24}
                value={form.businessEndHour}
                onChange={(event) => onChange("businessEndHour", event.target.value)}
                disabled={actionDisabled}
              />
              <Input
                label="Updated by"
                value={form.actor}
                onChange={(event) => onChange("actor", event.target.value)}
                disabled={actionDisabled}
                wrapperClassName="sm:col-span-2"
              />
            </div>
          </ScheduleDrawerSection>

          <ScheduleDrawerSection title="Veeva Configuration">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Audit trail type"
                value={form.auditTrailType}
                onChange={(event) => onChange("auditTrailType", event.target.value)}
                disabled={actionDisabled}
              />
              <Input
                label="Vault DNS"
                value={form.vaultDns}
                onChange={(event) => onChange("vaultDns", event.target.value)}
                disabled={actionDisabled}
              />
              <Input
                label="Veeva instance"
                value={form.veevaInstanceName}
                onChange={(event) => onChange("veevaInstanceName", event.target.value)}
                disabled={actionDisabled}
              />
              <Input
                label="Veeva app"
                value={form.veevaAppName}
                onChange={(event) => onChange("veevaAppName", event.target.value)}
                disabled={actionDisabled}
              />
            </div>
          </ScheduleDrawerSection>

          <ScheduleDrawerSection title="Recent Scheduler Runs">
            <div className="rounded-lg border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-900">Run history</span>
                </div>
                <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
                  {runs.length}
                </Badge>
              </div>
              <div className="max-h-72 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-white">
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">Started</TableHead>
                      <TableHead className="font-semibold">Updated</TableHead>
                      <TableHead className="font-semibold">Job</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-slate-500">
                          Loading scheduler runs...
                        </TableCell>
                      </TableRow>
                    ) : runs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-slate-500">
                          No scheduler runs yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      runs.map((run) => (
                        <React.Fragment key={run.run_id}>
                          <TableRow className="hover:bg-slate-50">
                            <TableCell>
                              <Badge variant="outline" className={getScheduleRunBadgeClass(run.status)}>
                                {formatScheduleRunStatus(run.status)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-slate-600" title={run.started_at}>
                              {formatDateTime(run.started_at)}
                            </TableCell>
                            <TableCell className="text-xs text-slate-600" title={run.completed_at || run.started_at}>
                              {formatDateTime(run.completed_at || run.started_at)}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-slate-600">
                              {run.job_id ? (
                                <button
                                  type="button"
                                  className="max-w-24 truncate text-left text-blue-700 hover:underline"
                                  onClick={() => onSelectJob(run.job_id!)}
                                  title={run.job_id}
                                >
                                  {shortIdentifier(run.job_id)}
                                </button>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                          </TableRow>
                          {run.error_message ? (
                            <TableRow className="bg-red-50/70">
                              <TableCell colSpan={4} className="px-3 py-2 text-xs leading-5 text-red-700">
                                {run.error_message}
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </React.Fragment>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </ScheduleDrawerSection>
        </div>

        <SheetFooter className="sticky bottom-0 z-10 border-t border-slate-200 bg-white px-5 py-4">
          <div className="flex flex-wrap justify-end gap-2">
            {scheduleStatus ? (
              <Button type="button" size="sm" variant="outline" onClick={() => onToggle(false)} disabled={!schedule || actionDisabled}>
                Disable Schedule
              </Button>
            ) : null}
            {resultJobId ? (
              <Button type="button" size="sm" variant="outline" onClick={() => onSelectJob(resultJobId)}>
                <Settings2 className="h-4 w-4" />
                Open Job
              </Button>
            ) : null}
            {resultReportId ? (
              <Button type="button" size="sm" variant="outline" onClick={onViewReport}>
                <FileText className="h-4 w-4" />
                View Draft Report
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="outline" onClick={onRunNow} disabled={!schedule || actionDisabled}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
              Run Now
            </Button>
            <Button type="button" size="sm" onClick={onSave} disabled={actionDisabled}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {schedule ? "Save Schedule" : "Create Schedule"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function AuditReviewOverviewCards({
  job,
  report,
  totalFindings,
}: {
  job: AuditReviewJobDetail;
  report: AuditReviewReportDetail | null;
  totalFindings: number;
}) {
  const cards = [
    {
      label: "Review Status",
      value: formatLabel(job.status),
      icon: ClipboardCheck,
      badgeClass: getStatusBadgeClass(job.status),
    },
    {
      label: "Audit Trail Type",
      value: formatLabel(job.audit_trail_type),
      icon: Database,
    },
    {
      label: "Records Reviewed",
      value: formatNumber(job.record_count),
      icon: FileCheck2,
    },
    {
      label: "Total Findings",
      value: formatNumber(totalFindings),
      icon: AlertCircle,
    },
    {
      label: "Rating",
      value: formatAuditReviewRating(job.rating),
      icon: ShieldCheck,
      badgeClass: getAuditReviewRatingBadgeClass(job.rating),
    },
    {
      label: "Report Lifecycle",
      value: formatLabel(report?.status || job.latest_report_status || "Not generated"),
      icon: FileText,
    },
    {
      label: "Review Period",
      value: formatPeriod(job.review_start_dt, job.review_end_dt),
      icon: CalendarDays,
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Audit review overview">
      <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm ring-1 ring-blue-50 xl:row-span-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Compliance Score</p>
            <p className="mt-3 text-4xl font-semibold text-slate-950">{job.overall_score ?? "-"}</p>
            <p className="mt-1 text-sm text-slate-500">Overall audit review score</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700">
            <Gauge className="h-5 w-5" />
          </div>
        </div>
        <Badge variant="outline" className={`mt-5 ${getAuditReviewRatingBadgeClass(job.rating)}`}>
          {formatAuditReviewRating(job.rating)}
        </Badge>
      </div>

      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{card.label}</p>
                {card.badgeClass ? (
                  <Badge variant="outline" className={`mt-2 max-w-full ${card.badgeClass}`}>
                    <span className="truncate">{card.value}</span>
                  </Badge>
                ) : (
                  <p className="mt-2 break-words text-lg font-semibold leading-6 text-slate-950">{card.value}</p>
                )}
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600">
                <Icon className="h-4 w-4" />
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function AuditReviewJobLedger({
  jobs,
  selectedJobId,
  onSelect,
}: {
  jobs: AuditReviewJobListItem[];
  selectedJobId: string | null;
  onSelect: (jobId: string) => void;
}) {
  const [jobsOpen, setJobsOpen] = useState(false);
  if (jobs.length === 0) return null;

  const selectedJob = jobs.find((item) => item.job_id === selectedJobId) ?? jobs[0] ?? null;

  return (
    <>
      <AuditReviewJobsSummaryCard
        jobs={jobs}
        selectedJob={selectedJob}
        onOpen={() => setJobsOpen(true)}
      />
      <AuditReviewJobsDrawer
        open={jobsOpen}
        onOpenChange={setJobsOpen}
        jobs={jobs}
        selectedJob={selectedJob}
        selectedJobId={selectedJobId}
        onSelect={onSelect}
      />
    </>
  );
}

function AuditReviewJobsSummaryCard({
  jobs,
  selectedJob,
  onOpen,
}: {
  jobs: AuditReviewJobListItem[];
  selectedJob: AuditReviewJobListItem | null;
  onOpen: () => void;
}) {
  return (
    <section
      role="button"
      tabIndex={0}
      aria-label="View audit review jobs"
      className="rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-blue-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
            <History className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Review Jobs</h3>
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                {jobs.length} {jobs.length === 1 ? "job" : "jobs"}
              </Badge>
              {selectedJob ? (
                <Badge variant="outline" className={getStatusBadgeClass(selectedJob.status)}>
                  {formatLabel(selectedJob.status)}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 truncate text-xs text-slate-500" title={selectedJob?.job_id || undefined}>
              Selected job {shortIdentifier(selectedJob?.job_id)}
            </p>
          </div>
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-4 lg:max-w-3xl">
          <ScheduleSummaryTile label="Review Period" value={formatPeriod(selectedJob?.review_start_dt, selectedJob?.review_end_dt)} />
          <ScheduleSummaryTile label="Audit Trail" value={formatLabel(selectedJob?.audit_trail_type)} />
          <ScheduleSummaryTile label="Records" value={formatNumber(selectedJob?.record_count)} />
          <ScheduleSummaryTile label="Created" value={formatDateTime(selectedJob?.created_dt)} />
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          className="self-start lg:self-center"
        >
          <Settings2 className="h-4 w-4" />
          View Jobs
        </Button>
      </div>
    </section>
  );
}

function AuditReviewJobsDrawer({
  open,
  onOpenChange,
  jobs,
  selectedJob,
  selectedJobId,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobs: AuditReviewJobListItem[];
  selectedJob: AuditReviewJobListItem | null;
  selectedJobId: string | null;
  onSelect: (jobId: string) => void;
}) {
  const { drawerWidth, resizing, resizeBy, startResize } = useResizableDrawer();

  const openSelectedJob = () => {
    if (!selectedJob) return;
    onSelect(selectedJob.job_id);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-none"
        style={{ width: drawerWidth, maxWidth: "calc(100vw - 24px)" }}
      >
        <ResizableDrawerHandle resizing={resizing} onMouseDown={startResize} onResizeStep={resizeBy} />
        <SheetHeader className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-5 pr-12">
          <div className="flex flex-wrap items-start gap-2">
            <SheetTitle className="text-base text-slate-950">Review Jobs</SheetTitle>
            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
              {jobs.length} {jobs.length === 1 ? "job" : "jobs"}
            </Badge>
            {selectedJob ? (
              <Badge variant="outline" className={getStatusBadgeClass(selectedJob.status)}>
                {formatLabel(selectedJob.status)}
              </Badge>
            ) : null}
          </div>
          <SheetDescription className="text-sm text-slate-500">
            Browse periodic audit review jobs and open the job context for this asset.
          </SheetDescription>
          <p className="break-all font-mono text-[11px] text-slate-400">
            Selected job {selectedJob?.job_id || "None"}
          </p>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto bg-white px-5 py-5">
          <div className="grid grid-cols-2 gap-3">
            <DrawerSummaryTile label="Total Jobs" value={formatNumber(jobs.length)} />
            <DrawerSummaryTile label="Selected Status" value={formatLabel(selectedJob?.status)} />
            <DrawerSummaryTile label="Review Period" value={formatPeriod(selectedJob?.review_start_dt, selectedJob?.review_end_dt)} />
            <DrawerSummaryTile label="Created" value={formatDateTime(selectedJob?.created_dt)} />
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-900">Recent Review Jobs</h4>
              <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
                {jobs.length}
              </Badge>
            </div>
            <div className="rounded-lg border border-slate-200">
              <div className="max-h-[28rem] overflow-y-auto">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">Review Period</TableHead>
                      <TableHead className="font-semibold">Audit Trail</TableHead>
                      <TableHead className="font-semibold">Records</TableHead>
                      <TableHead className="font-semibold">Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((item) => {
                      const selected = item.job_id === selectedJobId;
                      return (
                        <TableRow
                          key={item.job_id}
                          role="button"
                          tabIndex={0}
                          onClick={() => onSelect(item.job_id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onSelect(item.job_id);
                            }
                          }}
                          className={`cursor-pointer hover:bg-slate-50 ${selected ? "bg-blue-50/60" : ""}`}
                        >
                          <TableCell>
                            <Badge variant="outline" className={getStatusBadgeClass(item.status)}>
                              {formatLabel(item.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-700">{formatPeriod(item.review_start_dt, item.review_end_dt)}</TableCell>
                          <TableCell className="text-slate-700">{formatLabel(item.audit_trail_type)}</TableCell>
                          <TableCell className="text-slate-700">{formatNumber(item.record_count)}</TableCell>
                          <TableCell className="text-slate-600" title={item.created_dt}>
                            {formatDateTime(item.created_dt)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </section>
        </div>

        <SheetFooter className="sticky bottom-0 z-10 border-t border-slate-200 bg-white px-5 py-4">
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button type="button" size="sm" onClick={openSelectedJob} disabled={!selectedJob}>
              <Settings2 className="h-4 w-4" />
              Open Selected Job
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function AuditReviewRecordsPreview({ records, job }: { records: AuditTrailRecord[]; job: AuditReviewJobDetail }) {
  const previewRows = records.slice(0, 8);

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Audit trail records preview">
      <div className="flex flex-col gap-1 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Records Preview</h3>
          <p className="mt-1 text-xs text-slate-500">Normalized Veeva audit trail records, limited to a compact preview.</p>
        </div>
        <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
          Showing {previewRows.length} of {formatNumber(job.record_count)}
        </Badge>
      </div>
      <Table className="min-w-[860px]">
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="font-semibold">Event Timestamp</TableHead>
            <TableHead className="font-semibold">User Name</TableHead>
            <TableHead className="font-semibold">User ID</TableHead>
            <TableHead className="font-semibold">Action Type</TableHead>
            <TableHead className="font-semibold">Object Type</TableHead>
            <TableHead className="font-semibold">Object Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {previewRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-slate-500">
                {shouldLoadRecords(job) ? "No normalized record preview was returned." : "Record preview is available after extraction."}
              </TableCell>
            </TableRow>
          ) : (
            previewRows.map((record) => (
              <TableRow key={record.record_id} className="hover:bg-slate-50">
                <TableCell className="text-slate-700" title={record.event_timestamp ?? undefined}>
                  {formatDateTime(record.event_timestamp)}
                </TableCell>
                <TableCell className="text-slate-700">{formatValue(record.user_name)}</TableCell>
                <TableCell className="font-mono text-xs text-slate-600">{formatValue(record.user_id)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                    {formatValue(record.action_type)}
                  </Badge>
                </TableCell>
                <TableCell className="text-slate-700">{formatValue(record.object_type)}</TableCell>
                <TableCell className="whitespace-normal text-slate-700">
                  <div className="max-w-72 break-words">{formatValue(record.object_name)}</div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </section>
  );
}

export function AssetAuditReviewPanel({
  enabled,
  assetId,
  assetName,
  assetCode,
  assetOwner,
}: AssetAuditReviewPanelProps) {
  const [jobs, setJobs] = useState<AuditReviewJobListItem[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const selectedJobIdRef = useRef<string | null>(null);
  const [job, setJob] = useState<AuditReviewJobDetail | null>(null);
  const [findings, setFindings] = useState<AuditReviewFinding[]>([]);
  const [scores, setScores] = useState<AuditReviewScore[]>([]);
  const [records, setRecords] = useState<AuditTrailRecord[]>([]);
  const [reports, setReports] = useState<AuditReviewReportListItem[]>([]);
  const [report, setReport] = useState<AuditReviewReportDetail | null>(null);
  const [schedules, setSchedules] = useState<AuditReviewSchedule[]>([]);
  const [schedule, setSchedule] = useState<AuditReviewSchedule | null>(null);
  const [scheduleRuns, setScheduleRuns] = useState<AuditReviewScheduleRun[]>([]);
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>(() => buildDefaultScheduleForm(null, assetOwner));
  const [lastScheduleResult, setLastScheduleResult] = useState<AuditReviewScheduleRunNowResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [creatingJob, setCreatingJob] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [runningSchedule, setRunningSchedule] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [action, setAction] = useState<AuditReviewAction | null>(null);
  const [reportAction, setReportAction] = useState<AuditReviewReportAction | null>(null);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<AuditReviewWorkspaceTab>("overview");
  const [approvalRequest, setApprovalRequest] = useState<{ action: "submit" | "decision" | null; token: number }>({
    action: null,
    token: 0,
  });

  const setSelectedJob = (jobId: string | null) => {
    selectedJobIdRef.current = jobId;
    setSelectedJobId(jobId);
  };

  const resetPanel = useCallback(() => {
    setJobs([]);
    setSelectedJob(null);
    setJob(null);
    setFindings([]);
    setScores([]);
    setRecords([]);
    setReports([]);
    setReport(null);
    setSchedules([]);
    setSchedule(null);
    setScheduleRuns([]);
    setScheduleForm(buildDefaultScheduleForm(null, assetOwner));
    setLastScheduleResult(null);
    setLoading(false);
    setRefreshing(false);
    setError(null);
    setRunDialogOpen(false);
    setCreatingJob(false);
    setSavingSchedule(false);
    setRunningSchedule(false);
    setPdfDownloading(false);
    setAction(null);
    setReportAction(null);
    setActiveWorkspaceTab("overview");
    setApprovalRequest({ action: null, token: 0 });
  }, [assetOwner]);

  const loadPanel = useCallback(async (options: LoadOptions = {}) => {
    if (!assetId) return;

    if (options.silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [jobListResponse, scheduleList] = await Promise.all([
        listAuditReviewJobs(assetId),
        getAssetAuditReviewSchedules(assetId),
      ]);
      const jobList = sortJobs(jobListResponse);
      setJobs(jobList);
      setSchedules(scheduleList);

      const nextSchedule = scheduleList[0] ?? null;
      setSchedule(nextSchedule);
      setScheduleForm(buildDefaultScheduleForm(nextSchedule, assetOwner));
      setScheduleRuns(nextSchedule ? await getAuditReviewScheduleRuns(nextSchedule.schedule_id) : []);

      const preferredJobId = options.jobId ?? selectedJobIdRef.current;
      const targetJobId = preferredJobId && jobList.some((item) => item.job_id === preferredJobId)
        ? preferredJobId
        : jobList[0]?.job_id ?? null;
      setSelectedJob(targetJobId);

      if (!targetJobId) {
        setJob(null);
        setFindings([]);
        setScores([]);
        setRecords([]);
        setReports([]);
        setReport(null);
        return;
      }

      const detail = await getAuditReviewJob(targetJobId);
      setJob(detail);

      const [nextReports, nextRecords, nextFindings, nextScores] = await Promise.all([
        listAssetAuditReviewReports(assetId),
        shouldLoadRecords(detail) ? getAuditReviewRecords(targetJobId, false) : Promise.resolve([]),
        shouldLoadAnalysis(detail) ? getAuditReviewFindings(targetJobId) : Promise.resolve([]),
        shouldLoadAnalysis(detail) ? getAuditReviewScores(targetJobId) : Promise.resolve([]),
      ]);

      const sortedReports = [...nextReports].sort(
        (left, right) => Date.parse(right.created_dt || "") - Date.parse(left.created_dt || ""),
      );
      setReports(sortedReports);
      setRecords(nextRecords);
      setFindings(nextFindings);
      setScores(nextScores);

      const reportId = detail.latest_report_id || sortedReports.find((item) => item.job_id === targetJobId)?.report_id || null;
      setReport(reportId ? await getAuditReviewReport(reportId) : null);
    } catch (loadError) {
      const message = mapAuditReviewError(loadError);
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [assetId, assetOwner]);

  useEffect(() => {
    if (!enabled || !assetId) {
      resetPanel();
      return;
    }

    void loadPanel();
  }, [assetId, enabled, loadPanel, resetPanel]);

  useEffect(() => {
    if (!enabled || !assetId || !job || !IN_PROGRESS_STATUSES.has(job.status)) return;

    const intervalId = window.setInterval(() => {
      void loadPanel({ silent: true, jobId: selectedJobIdRef.current ?? job.job_id });
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [assetId, enabled, job, loadPanel]);

  const severityCounts = useMemo(() => calculateSeverityCounts(findings), [findings]);
  const totalFindings = job?.finding_count ?? findings.length;
  const primaryAction = useMemo(
    () =>
      buildPrimaryReviewAction({
        job,
        report,
        creatingJob,
        action,
        reportAction,
        pdfDownloading,
        refreshing,
      }),
    [action, creatingJob, job, pdfDownloading, refreshing, report, reportAction],
  );
  const headerPrimaryAction = useMemo<AuditReviewUiAction>(
    () => ({
      key: "run",
      label: "+ New Audit Review",
      description: "Create a new audit review job for this asset.",
      loading: creatingJob,
    }),
    [creatingJob],
  );
  const secondaryAction = useMemo(
    () => buildSecondaryReviewAction(job, report, headerPrimaryAction),
    [headerPrimaryAction, job, report],
  );

  const handleCreateJob = async (payload: AuditReviewJobCreatePayload) => {
    if (!assetId) return;

    setCreatingJob(true);
    try {
      const created = await createAuditReviewJob(assetId, payload);
      toast.success("Audit review job created");
      setRunDialogOpen(false);
      await loadPanel({ silent: true, jobId: created.job_id });
    } catch (createError) {
      toast.error(mapAuditReviewError(createError));
    } finally {
      setCreatingJob(false);
    }
  };

  const handleAction = async (nextAction: AuditReviewAction) => {
    if (!job) return;

    setAction(nextAction);
    try {
      if (nextAction === "extract") {
        await extractAuditReviewJob(job.job_id);
        toast.success("Audit trail records extracted");
      }
      if (nextAction === "analyze") {
        await analyzeAuditReviewJob(job.job_id, {
          business_timezone: "Asia/Kolkata",
          business_start_hour: 9,
          business_end_hour: 18,
        });
        toast.success("Audit review analysis completed");
      }
      if (nextAction === "generate-report") {
        await generateAuditReviewReport(job.job_id);
        toast.success("Draft audit review report generated");
      }
      await loadPanel({ silent: true, jobId: job.job_id });
    } catch (actionError) {
      toast.error(mapAuditReviewError(actionError));
    } finally {
      setAction(null);
    }
  };

  const handleSubmitReportForReview = async (payload: AuditReviewReportSubmitReviewPayload) => {
    if (!report) return;

    setReportAction("submit-review");
    try {
      await submitAuditReviewReport(report.report_id, payload);
      toast.success("Audit review report submitted for QA review");
      await loadPanel({ silent: true, jobId: report.job_id });
    } catch (submitError) {
      toast.error(mapAuditReviewError(submitError));
      throw submitError;
    } finally {
      setReportAction(null);
    }
  };

  const handleApproveReport = async (payload: AuditReviewReportReviewDecisionPayload) => {
    if (!report) return;

    setReportAction("approve");
    try {
      await approveAuditReviewReport(report.report_id, payload);
      toast.success("Audit review report approved");
      await loadPanel({ silent: true, jobId: report.job_id });
    } catch (approveError) {
      toast.error(mapAuditReviewError(approveError));
      throw approveError;
    } finally {
      setReportAction(null);
    }
  };

  const handleRejectReport = async (payload: AuditReviewReportReviewDecisionPayload) => {
    if (!report) return;

    setReportAction("reject");
    try {
      await rejectAuditReviewReport(report.report_id, payload);
      toast.success("Audit review report rejected");
      await loadPanel({ silent: true, jobId: report.job_id });
    } catch (rejectError) {
      toast.error(mapAuditReviewError(rejectError));
      throw rejectError;
    } finally {
      setReportAction(null);
    }
  };

  const handleViewReport = () => {
    setActiveWorkspaceTab("report");
    window.setTimeout(() => {
      document.getElementById("audit-review-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const handleOpenApproval = () => {
    const nextRequest =
      report?.status === "DRAFT"
        ? "submit"
        : report?.status === "UNDER_REVIEW"
          ? "decision"
          : null;
    setActiveWorkspaceTab("approval");
    setApprovalRequest((previous) => ({ action: nextRequest, token: previous.token + 1 }));
    window.setTimeout(() => {
      document.getElementById("audit-review-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const handleSelectJob = (jobId: string) => {
    setSelectedJob(jobId);
    setActiveWorkspaceTab("overview");
    void loadPanel({ jobId });
  };

  const handleOpenReportForJob = (jobId: string) => {
    setSelectedJob(jobId);
    setActiveWorkspaceTab("report");
    void loadPanel({ jobId });
    window.setTimeout(() => {
      document.getElementById("audit-review-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const handleRefresh = () => {
    void loadPanel({ silent: true, jobId: selectedJobIdRef.current });
  };

  const handleDownloadReportPdf = async () => {
    if (!report) return;

    setPdfDownloading(true);
    try {
      const download = await downloadAuditReviewReportPdf(report.report_id);
      const url = URL.createObjectURL(download.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = download.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      toast.error(downloadError instanceof Error ? downloadError.message : "Audit review PDF download failed.");
    } finally {
      setPdfDownloading(false);
    }
  };

  const handleUiAction = (nextAction: AuditReviewUiActionKey) => {
    if (nextAction === "run") {
      setRunDialogOpen(true);
      return;
    }
    if (nextAction === "extract") {
      void handleAction("extract");
      return;
    }
    if (nextAction === "analyze") {
      void handleAction("analyze");
      return;
    }
    if (nextAction === "generate-report") {
      void handleAction("generate-report");
      return;
    }
    if (nextAction === "open-report") {
      handleViewReport();
      return;
    }
    if (nextAction === "open-approval") {
      handleOpenApproval();
      return;
    }
    if (nextAction === "download-pdf") {
      void handleDownloadReportPdf();
      return;
    }
    if (nextAction === "refresh") {
      handleRefresh();
    }
  };

  const updateScheduleForm = (field: keyof ScheduleFormState, value: string | boolean) => {
    setScheduleForm((previous) => ({ ...previous, [field]: value }));
  };

  const buildSchedulePayload = (mode: "create" | "update") => {
    const reviewWindowDays = Number(scheduleForm.reviewWindowDays);
    const businessStartHour = Number(scheduleForm.businessStartHour);
    const businessEndHour = Number(scheduleForm.businessEndHour);
    const nextRunIso = datetimeLocalToIso(scheduleForm.nextRun);

    if (!Number.isInteger(reviewWindowDays) || reviewWindowDays < 1 || reviewWindowDays > 366) {
      throw new Error("Review window days must be between 1 and 366.");
    }
    if (!Number.isInteger(businessStartHour) || businessStartHour < 0 || businessStartHour > 23) {
      throw new Error("Business start hour must be between 0 and 23.");
    }
    if (!Number.isInteger(businessEndHour) || businessEndHour < 1 || businessEndHour > 24) {
      throw new Error("Business end hour must be between 1 and 24.");
    }
    if (businessEndHour <= businessStartHour) {
      throw new Error("Business end hour must be after business start hour.");
    }
    if (!nextRunIso) {
      throw new Error("Next run date is required.");
    }
    if (!scheduleForm.auditTrailType.trim()) {
      throw new Error("Audit trail type is required.");
    }
    if (!scheduleForm.frequency) {
      throw new Error("Frequency is required.");
    }
    if (!scheduleForm.timezone.trim()) {
      throw new Error("Timezone is required.");
    }

    return {
      enabled: scheduleForm.enabled,
      audit_trail_type: scheduleForm.auditTrailType.trim(),
      veeva_instance_name: scheduleForm.veevaInstanceName.trim() || null,
      veeva_app_name: scheduleForm.veevaAppName.trim() || null,
      vault_dns: scheduleForm.vaultDns.trim() || null,
      frequency: scheduleForm.frequency,
      review_window_days: reviewWindowDays,
      next_run_dt: nextRunIso,
      timezone: scheduleForm.timezone.trim(),
      business_start_hour: businessStartHour,
      business_end_hour: businessEndHour,
      ...(mode === "create"
        ? { created_by: scheduleForm.actor.trim() || null }
        : { modified_by: scheduleForm.actor.trim() || null }),
    };
  };

  const handleSaveSchedule = async () => {
    if (!assetId) return;

    setSavingSchedule(true);
    try {
      const payload = buildSchedulePayload(schedule ? "update" : "create");
      const saved = schedule
        ? await updateAuditReviewSchedule(schedule.schedule_id, payload)
        : await createAssetAuditReviewSchedule(assetId, payload);
      setSchedule(saved);
      setScheduleForm(buildDefaultScheduleForm(saved, assetOwner));
      setLastScheduleResult(null);
      toast.success("Audit review schedule saved");
      await loadPanel({ silent: true, jobId: selectedJobIdRef.current });
    } catch (saveError) {
      toast.error(mapAuditReviewError(saveError));
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleToggleSchedule = async (enabledValue: boolean) => {
    if (!schedule) return;

    setSavingSchedule(true);
    try {
      const updated = await updateAuditReviewSchedule(schedule.schedule_id, {
        enabled: enabledValue,
        modified_by: scheduleForm.actor.trim() || null,
      });
      setSchedule(updated);
      setScheduleForm(buildDefaultScheduleForm(updated, assetOwner));
      toast.success(enabledValue ? "Audit review schedule enabled" : "Audit review schedule disabled");
      await loadPanel({ silent: true, jobId: selectedJobIdRef.current });
    } catch (toggleError) {
      toast.error(mapAuditReviewError(toggleError));
      setScheduleForm(buildDefaultScheduleForm(schedule, assetOwner));
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleRunScheduleNow = async () => {
    if (!schedule) return;

    setRunningSchedule(true);
    try {
      const result = await runAuditReviewScheduleNow(schedule.schedule_id);
      setLastScheduleResult(result);
      if (result.run.status === "COMPLETED") {
        toast.success("Scheduled audit review completed");
      } else if (result.run.status === "FAILED") {
        toast.error(result.run.error_message || "Scheduled audit review failed");
      } else {
        toast.info(result.run.message || "Scheduled audit review was skipped");
      }
      await loadPanel({ silent: true, jobId: result.job?.job_id || result.run.job_id || selectedJobIdRef.current });
      if (result.report?.report_id) {
        window.setTimeout(() => handleViewReport(), 150);
      }
    } catch (runError) {
      toast.error(mapAuditReviewError(runError));
    } finally {
      setRunningSchedule(false);
    }
  };

  return (
    <>
      <div className="space-y-5">
        <AuditReviewHeroSummary
          job={job}
          report={report}
          primaryAction={{
            ...headerPrimaryAction,
            disabled:
              headerPrimaryAction.disabled ||
              !assetId ||
              creatingJob ||
              savingSchedule ||
              runningSchedule ||
              Boolean(action) ||
              Boolean(reportAction),
          }}
          secondaryAction={secondaryAction}
          onAction={handleUiAction}
        />

        {loading ? (
          <AuditReviewLoadingState />
        ) : (
          <>
            {error ? <AuditReviewErrorState message={error} onRetry={() => void loadPanel()} /> : null}

            <AuditReviewWorkflowStepper
              job={job}
              report={report}
            />

            <AuditReviewKpiRow
              job={job}
              report={report}
              severityCounts={severityCounts}
              totalFindings={totalFindings}
            />

            <AuditReviewSchedulePanel
              schedule={schedule}
              form={scheduleForm}
              runs={scheduleRuns}
              loading={refreshing && scheduleRuns.length === 0}
              saving={savingSchedule}
              running={runningSchedule}
              lastResult={lastScheduleResult}
              onChange={updateScheduleForm}
              onSave={() => void handleSaveSchedule()}
              onToggle={(enabledValue) => void handleToggleSchedule(enabledValue)}
              onRunNow={() => void handleRunScheduleNow()}
              onSelectJob={handleSelectJob}
              onViewReport={handleViewReport}
            />

            {schedules.length > 1 ? (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 shadow-sm">
                {schedules.length} audit review schedules exist for this asset. The newest matching schedule is shown above.
              </div>
            ) : null}

            {!job && !error ? (
              <AuditReviewEmptyState onRun={() => setRunDialogOpen(true)} disabled={!assetId || creatingJob} />
            ) : null}

            <AuditReviewTabs
              activeTab={activeWorkspaceTab}
              onTabChange={setActiveWorkspaceTab}
              job={job}
              jobs={jobs}
              selectedJobId={selectedJobId}
              report={report}
              reports={reports}
              findings={findings}
              scores={scores}
              scheduleRuns={scheduleRuns}
              severityCounts={severityCounts}
              totalFindings={totalFindings}
              refreshing={refreshing}
              reportAction={reportAction}
              approvalRequest={approvalRequest}
              nextAction={primaryAction}
              defaultActor={assetOwner}
              onAction={handleUiAction}
              onSelectJob={handleSelectJob}
              onOpenReport={handleOpenReportForJob}
              onRefresh={handleRefresh}
              onSubmitReview={handleSubmitReportForReview}
              onApprove={handleApproveReport}
              onReject={handleRejectReport}
            />
          </>
        )}
      </div>

      <AuditReviewRunDialog
        open={runDialogOpen}
        assetName={assetName}
        assetCode={assetCode}
        defaultRequestedBy={assetOwner}
        creating={creatingJob}
        onClose={() => setRunDialogOpen(false)}
        onCreate={handleCreateJob}
      />
    </>
  );
}
