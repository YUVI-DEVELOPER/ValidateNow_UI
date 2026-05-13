import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Download,
  ExternalLink,
  Eye,
  Filter,
  Gauge,
  History,
  Layers3,
  Loader2,
  PlayCircle,
  RefreshCw,
  Save,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import {
  analyzeAuditReviewJob,
  createAssetAuditReviewSchedule,
  AuditReviewFinding,
  AuditReviewJobCreatePayload,
  AuditReviewJobDetail,
  AuditReviewJobListItem,
  AuditReviewMetadata,
  AuditReviewReportDetail,
  AuditReviewReportListItem,
  AuditReviewScope,
  AuditReviewSchedule,
  AuditReviewScheduleFrequency,
  AuditReviewScheduleRunNowResponse,
  AuditReviewScore,
  AuditTrailRecord,
  createAuditReviewJob,
  downloadAuditReviewReportPdf,
  extractAuditReviewJob,
  generateAuditReviewReport,
  getAssetAuditReviewSchedules,
  getAuditReviewFindings,
  getAuditReviewJob,
  getAuditReviewMetadata,
  getAuditReviewRecords,
  getAuditReviewReport,
  getAuditReviewScores,
  listAssetAuditReviewReports,
  listAuditReviewJobs,
  runAuditReviewScheduleNow,
  updateAuditReviewSchedule,
} from "../../services/audit-review.service";
import { AssetRecord, getAssets } from "../../services/asset.service";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardBody } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import { cn } from "../components/ui/utils";
import {
  formatAuditReviewDate,
  formatAuditReviewDateTime,
  formatAuditReviewLabel,
  formatAuditReviewNumber,
  formatAuditReviewPeriod,
  getAuditReviewReportStatusBadgeClass,
} from "../components/assets/auditReviewUi.shared";
import {
  formatAuditReviewRating,
  getAuditReviewRatingBadgeClass,
} from "../components/assets/AuditReviewScoreCard";

const FULL_GXP_TYPES = [
  "login_audit_trail",
  "document_audit_trail",
  "object_audit_trail",
  "system_audit_trail",
  "domain_audit_trail",
] as const;

const FALLBACK_METADATA: AuditReviewMetadata = {
  supported_audit_trail_types: [
    { code: "login_audit_trail", label: "Login Audit Trail" },
    { code: "document_audit_trail", label: "Document Audit Trail" },
    { code: "object_audit_trail", label: "Object Audit Trail" },
    { code: "system_audit_trail", label: "System Audit Trail" },
    { code: "domain_audit_trail", label: "Domain Audit Trail" },
  ],
  review_scopes: [
    { code: "LOGIN_ONLY", label: "Login Only", score_label: "Login Audit Trail Score", audit_trail_types: ["login_audit_trail"] },
    { code: "DOCUMENT_ONLY", label: "Document Only", score_label: "Document Audit Trail Score", audit_trail_types: ["document_audit_trail"] },
    { code: "OBJECT_ONLY", label: "Object Only", score_label: "Object Audit Trail Score", audit_trail_types: ["object_audit_trail"] },
    { code: "SYSTEM_ONLY", label: "System Only", score_label: "System Audit Trail Score", audit_trail_types: ["system_audit_trail"] },
    { code: "DOMAIN_ONLY", label: "Domain Only", score_label: "Domain Audit Trail Score", audit_trail_types: ["domain_audit_trail"] },
    { code: "FULL_GXP", label: "Full GxP", score_label: "Full GxP Audit Trail Score", audit_trail_types: [...FULL_GXP_TYPES] },
    { code: "CUSTOM", label: "Custom", score_label: "Custom Audit Trail Review Score", audit_trail_types: [] },
  ],
  full_gxp_audit_trail_types: [...FULL_GXP_TYPES],
  checkpoint_metadata: [],
  checkpoint_applicability_matrix: {},
  parameter_card_metadata: [],
};

const SCOPE_EXPLANATIONS: Record<string, string> = {
  LOGIN_ONLY: "checks login/access activity such as successful logins, failed logins, user identity, source IP, and off-hours access.",
  DOCUMENT_ONLY: "checks document lifecycle activity such as creation, updates, deletion, downloads/exports, approvals, and off-hours activity.",
  OBJECT_ONLY: "checks Veeva object record activity such as record creation, field updates, status changes, ownership changes, and deletion events.",
  SYSTEM_ONLY: "checks system configuration activity such as lifecycle, workflow, field, object, integration, and system setting changes.",
  DOMAIN_ONLY: "checks domain/security activity such as users, roles, groups, permissions, and security policy changes.",
  FULL_GXP: "checks login, document, object, system, and domain audit trails for complete GxP coverage.",
  CUSTOM: "checks only the selected audit trail types.",
};

const SOFTWARE_TERMS = [
  "software",
  "it system",
  "application",
  "validated computerized system",
  "validated computerised system",
  "validated system",
  "veeva",
  "vault",
  "lims",
  "qms",
  "dms",
  "mes",
  "ctms",
  "rim",
  "promomats",
  "qualitydocs",
  "trackwise",
  "labware",
  "empower",
  "pas-x",
  "pas x",
];

const SOFTWARE_ASSET_FIELDS = [
  "asset_class",
  "asset_category",
  "asset_sub_category",
  "asset_type",
  "asset_name",
  "tags",
  "description",
  "asset_description",
  "short_description",
] as const;

const SOFTWARE_CLASSIFICATION_FIELDS = [
  "asset_class",
  "asset_category",
  "asset_sub_category",
  "asset_type",
  "asset_nature",
  "tags",
] as const;

const EXPLICIT_SOFTWARE_CLASSIFICATION_TERMS = [
  "software",
  "it system",
  "application",
  "validated computerized system",
  "validated computerised system",
  "computerized system",
  "computerised system",
  "information system",
];

const SOFTWARE_PRODUCT_TERMS = [
  "veeva",
  "vault",
  "qualitydocs",
  "quality docs",
  "promomats",
  "promo mats",
  "lims",
  "qms",
  "dms",
  "mes",
  "ctms",
  "rim",
  "trackwise",
  "labware",
  "empower",
  "pas-x",
  "pas x",
];

const PHYSICAL_ASSET_TERMS = [
  "reactor",
  "sterilizer",
  "steriliser",
  "homogenizer",
  "homogeniser",
  "pump",
  "balance",
  "equipment",
  "process equipment",
  "router",
];

const SOURCE_SYSTEM_FIELDS = [
  "source_system",
  "source_system_name",
  "source_system_display",
  "system_source",
  "system_name",
  "veeva_instance_name",
] as const;

const INACTIVE_TERMS = ["inactive", "retired", "obsolete", "decommissioned", "disposed", "scrapped"];
const SCHEDULE_FREQUENCIES: AuditReviewScheduleFrequency[] = ["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY"];
const TECHNICAL_ACTION_LABELS: Record<string, string> = {
  GetDocumentVersion: "Document Version Retrieved",
  getdocumentversion: "Document Version Retrieved",
};

type TopTab = "new-review" | "history" | "schedule";
type ResultTab = "summary" | "findings" | "evidence";
type PipelineStepKey =
  | "asset"
  | "created"
  | "extracted"
  | "analyzed"
  | "drafted";
type PipelineStepStatus = "pending" | "active" | "done" | "warning" | "failed";

interface ReviewRuntime {
  job: AuditReviewJobDetail;
  report: AuditReviewReportDetail | null;
  findings: AuditReviewFinding[];
  scores: AuditReviewScore[];
  records: AuditTrailRecord[];
  reviewScope: AuditReviewScope;
  selectedAuditTrailTypes: string[];
}

interface RunFormState {
  reviewStart: string;
  reviewEnd: string;
  reviewScope: AuditReviewScope;
  selectedAuditTrailTypes: string[];
  veevaInstanceName: string;
  veevaAppName: string;
}

interface ScheduleFormState {
  enabled: boolean;
  frequency: AuditReviewScheduleFrequency;
  reviewWindowDays: string;
  nextRun: string;
  timezone: string;
  businessStartHour: string;
  businessEndHour: string;
  reviewScope: AuditReviewScope;
  selectedAuditTrailTypes: string[];
  veevaInstanceName: string;
  veevaAppName: string;
  vaultDns: string;
  actor: string;
}

interface PipelineStep {
  key: PipelineStepKey;
  label: string;
  status: PipelineStepStatus;
  message?: string;
}

interface FindingGroup {
  key: string;
  name: string;
  count: number;
  highestSeverity: string;
  recommendedAction: string;
  findings: AuditReviewFinding[];
}

const toDatetimeLocalValue = (date: Date): string => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
};

const defaultReviewWindow = (): Pick<RunFormState, "reviewStart" | "reviewEnd"> => {
  const end = new Date();
  end.setDate(end.getDate() - 1);
  end.setHours(23, 59, 0, 0);
  const start = new Date(end.getFullYear(), end.getMonth(), 1, 0, 0, 0, 0);
  return { reviewStart: toDatetimeLocalValue(start), reviewEnd: toDatetimeLocalValue(end) };
};

const buildDefaultRunForm = (): RunFormState => ({
  ...defaultReviewWindow(),
  reviewScope: "LOGIN_ONLY",
  selectedAuditTrailTypes: ["login_audit_trail"],
  veevaInstanceName: "Veeva Quality Vault",
  veevaAppName: "QualityDocs",
});

const initialPipeline = (): PipelineStep[] => [
  { key: "asset", label: "Validate asset", status: "pending" },
  { key: "created", label: "Create review job", status: "pending" },
  { key: "extracted", label: "Extract records", status: "pending" },
  { key: "analyzed", label: "Analyse records", status: "pending" },
  { key: "drafted", label: "Generate draft report", status: "pending" },
];

const updateStep = (
  steps: PipelineStep[],
  key: PipelineStepKey,
  status: PipelineStepStatus,
  message?: string,
): PipelineStep[] => steps.map((step) => (step.key === key ? { ...step, status, message } : step));

const pipelineStepLabels: Record<PipelineStepKey, Partial<Record<PipelineStepStatus, string>>> = {
  asset: {
    pending: "Validate asset",
    active: "Validating asset",
    done: "Asset validated",
    failed: "Asset validation failed",
  },
  created: {
    pending: "Create review job",
    active: "Creating review job",
    done: "Review job created",
    failed: "Review job creation failed",
  },
  extracted: {
    pending: "Extract records",
    active: "Extracting records",
    done: "Records extracted",
    warning: "Records partially extracted",
    failed: "Record extraction failed",
  },
  analyzed: {
    pending: "Analyse records",
    active: "Analysing records",
    done: "Records analysed",
    failed: "Analysis failed",
  },
  drafted: {
    pending: "Generate draft report",
    active: "Generating draft report",
    done: "Draft report generated",
    failed: "Draft report generation failed",
  },
};

const pipelineStepLabel = (step: PipelineStep): string =>
  pipelineStepLabels[step.key]?.[step.status] || step.label;

const apiErrorMessage = (error: unknown): string => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string; detail?: string } } }).response;
    return response?.data?.message || response?.data?.detail || "Audit review request failed.";
  }
  return error instanceof Error ? error.message : "Audit review request failed.";
};

const assetField = (asset: AssetRecord, field: string): unknown =>
  (asset as Record<string, unknown>)[field];

const textValue = (value: unknown): string | null => {
  if (Array.isArray(value)) {
    const items = value.map(textValue).filter((item): item is string => Boolean(item));
    return items.length > 0 ? items.join(" ") : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
};

const normalizedText = (...values: unknown[]): string =>
  values
    .map(textValue)
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase()
    .replace(/[_/\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const hasTerm = (text: string, term: string): boolean => {
  if (!text || !term) return false;
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(term.toLowerCase())}([^a-z0-9]|$)`).test(text);
};

const hasAnyTerm = (text: string, terms: string[]): boolean => terms.some((term) => hasTerm(text, term));

const isActiveAsset = (asset: AssetRecord): boolean => {
  const status = normalizedText(asset.asset_status, assetField(asset, "status"), assetField(asset, "lifecycle_state"));
  return !INACTIVE_TERMS.some((term) => status.includes(term));
};

const isValidatedSoftwareAsset = (asset: AssetRecord): boolean => {
  if (!isActiveAsset(asset)) return false;

  const classification = normalizedText(...SOFTWARE_CLASSIFICATION_FIELDS.map((field) => assetField(asset, field)));
  const allSignals = normalizedText(
    ...SOFTWARE_ASSET_FIELDS.map((field) => assetField(asset, field)),
    ...SOURCE_SYSTEM_FIELDS.map((field) => assetField(asset, field)),
  );
  const hasExplicitSoftwareSignal =
    hasAnyTerm(classification, EXPLICIT_SOFTWARE_CLASSIFICATION_TERMS) ||
    hasAnyTerm(allSignals, EXPLICIT_SOFTWARE_CLASSIFICATION_TERMS) ||
    hasAnyTerm(allSignals, SOFTWARE_PRODUCT_TERMS);
  const hasSoftwareSignal = hasAnyTerm(allSignals, SOFTWARE_TERMS) || hasAnyTerm(allSignals, SOFTWARE_PRODUCT_TERMS);
  const hasPhysicalSignal = hasAnyTerm(allSignals, PHYSICAL_ASSET_TERMS);

  if (!hasSoftwareSignal) return false;
  if (hasPhysicalSignal && !hasExplicitSoftwareSignal) return false;
  return true;
};

const assetNameLabel = (asset: AssetRecord | null): string =>
  textValue(asset?.asset_name) || textValue(asset?.asset_id) || textValue(asset?.asset_code) || "Untitled asset";

const assetIdLabel = (asset: AssetRecord | null): string =>
  textValue(asset?.asset_id) || textValue(asset?.asset_code) || textValue(asset?.asset_uuid) || "No asset ID";

const assetSelectionId = (asset: AssetRecord): string =>
  textValue(asset.asset_uuid) || textValue(assetField(asset, "uuid")) || textValue(asset.asset_id) || "";

const assetSourceSystemLabel = (asset: AssetRecord): string | null =>
  SOURCE_SYSTEM_FIELDS.map((field) => textValue(assetField(asset, field))).find(Boolean) ?? null;

const assetStatusLabel = (asset: AssetRecord): string | null => {
  const status = textValue(asset.asset_status) || textValue(assetField(asset, "status")) || textValue(assetField(asset, "lifecycle_state"));
  return status ? formatAuditReviewLabel(status) : null;
};

const uniqueTextParts = (...parts: Array<string | null | undefined>): string[] => {
  const seen = new Set<string>();
  return parts.reduce<string[]>((items, part) => {
    const value = part?.trim();
    if (!value) return items;
    const key = value.toLowerCase();
    if (seen.has(key)) return items;
    seen.add(key);
    items.push(value);
    return items;
  }, []);
};

const assetPrimaryLabel = (asset: AssetRecord): string => `${assetNameLabel(asset)} — ${assetIdLabel(asset)}`;

const assetSecondaryLabel = (asset: AssetRecord): string => {
  const parts = uniqueTextParts(
    textValue(asset.org_node_name),
    assetStatusLabel(asset),
    textValue(asset.criticality_class) || textValue(asset.asset_criticality),
    assetSourceSystemLabel(asset),
  );
  return parts.join(" · ");
};

const assetSearchLabel = (asset: AssetRecord): string =>
  normalizedText(
    assetPrimaryLabel(asset),
    assetSecondaryLabel(asset),
    asset.asset_class,
    asset.asset_category,
    asset.asset_sub_category,
    asset.asset_type,
    asset.tags,
    asset.asset_description,
    asset.short_description,
  );

const sameStringSet = (left: string[], right: string[]): boolean => {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((item) => rightSet.has(item));
};

const toUtcIso = (value: string): string => new Date(value).toISOString();

const selectedTypesForScope = (
  metadata: AuditReviewMetadata,
  scope: AuditReviewScope,
  customTypes: string[],
): string[] => {
  if (scope === "CUSTOM") return customTypes;
  const scopeMetadata = metadata.review_scopes.find((item) => item.code === scope);
  return scopeMetadata?.audit_trail_types?.length ? scopeMetadata.audit_trail_types : ["login_audit_trail"];
};

const defaultScheduleNextRun = (): string => {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(2, 0, 0, 0);
  return toDatetimeLocalValue(next);
};

const toDatetimeLocalInput = (value?: string | null): string => {
  if (!value) return defaultScheduleNextRun();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? defaultScheduleNextRun() : toDatetimeLocalValue(parsed);
};

const buildDefaultScheduleForm = (
  schedule?: AuditReviewSchedule | null,
  actor?: string | null,
  asset?: AssetRecord | null,
): ScheduleFormState => {
  const selectedAuditTrailTypes = schedule?.selected_audit_trail_types?.length
    ? schedule.selected_audit_trail_types
    : [schedule?.audit_trail_type ?? "login_audit_trail"];
  const sourceSystem = asset ? assetSourceSystemLabel(asset) : null;
  const vaultDns = asset ? textValue(assetField(asset, "vault_dns")) : null;
  return {
    enabled: schedule?.enabled ?? true,
    frequency: schedule?.frequency ?? "MONTHLY",
    reviewWindowDays: schedule?.review_window_days ? String(schedule.review_window_days) : "30",
    nextRun: toDatetimeLocalInput(schedule?.next_run_dt),
    timezone: schedule?.timezone ?? "Asia/Kolkata",
    businessStartHour: String(schedule?.business_start_hour ?? 9),
    businessEndHour: String(schedule?.business_end_hour ?? 18),
    reviewScope: schedule?.review_scope ?? "LOGIN_ONLY",
    selectedAuditTrailTypes,
    veevaInstanceName: schedule?.veeva_instance_name ?? sourceSystem ?? "Veeva Quality Vault",
    veevaAppName: schedule?.veeva_app_name ?? "QualityDocs",
    vaultDns: schedule?.vault_dns ?? vaultDns ?? "",
    actor: schedule?.modified_by ?? schedule?.created_by ?? (actor?.trim() || asset?.asset_owner || ""),
  };
};

const scoreLabelForSelection = (scope?: string | null, selectedTypes: string[] = []): string => {
  const allFullTypes = FULL_GXP_TYPES.every((type) => selectedTypes.includes(type)) && selectedTypes.length === FULL_GXP_TYPES.length;
  if (allFullTypes) return "Full GxP Audit Trail Score";
  if (selectedTypes.length === 1) {
    if (selectedTypes[0] === "login_audit_trail") return "Login Audit Trail Score";
    if (selectedTypes[0] === "document_audit_trail") return "Document Audit Trail Score";
    if (selectedTypes[0] === "object_audit_trail") return "Object Audit Trail Score";
    if (selectedTypes[0] === "system_audit_trail") return "System Audit Trail Score";
    if (selectedTypes[0] === "domain_audit_trail") return "Domain Audit Trail Score";
  }
  if (scope === "LOGIN_ONLY") return "Login Audit Trail Score";
  if (scope === "DOCUMENT_ONLY") return "Document Audit Trail Score";
  if (scope === "OBJECT_ONLY") return "Object Audit Trail Score";
  if (scope === "SYSTEM_ONLY") return "System Audit Trail Score";
  if (scope === "DOMAIN_ONLY") return "Domain Audit Trail Score";
  return "Custom Audit Trail Review Score";
};

const statusLabel = (value?: string | null): string => {
  if (!value) return "-";
  if (value === "DRAFT") return "Draft Generated";
  if (value === "UNDER_REVIEW") return "Under Review";
  return formatAuditReviewLabel(value);
};

const getScheduleRunBadgeClass = (status?: string | null): string => {
  if (status === "COMPLETED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "STARTED") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "FAILED") return "border-red-200 bg-red-50 text-red-700";
  if (status === "SKIPPED") return "border-slate-200 bg-slate-50 text-slate-600";
  return "border-slate-200 bg-white text-slate-700";
};

const displayValue = (value?: string | number | null): string => {
  if (value === undefined || value === null || String(value).trim() === "" || String(value).trim() === "-") {
    return "Not returned by source";
  }
  return String(value);
};

const knownAction = (value?: string | null): value is string => {
  if (!value) return false;
  const normalized = value.trim().toUpperCase();
  return normalized !== "" && normalized !== "UNKNOWN" && normalized !== "N/A" && normalized !== "NA" && normalized !== "-";
};

const actionDisplay = (record: AuditTrailRecord): { label: string; raw?: string | null } => {
  const raw = record.raw_action;
  const first = [
    record.display_action,
    record.action_type,
    record.detected_action_category,
    raw,
  ].find(knownAction);
  const friendly = first && (TECHNICAL_ACTION_LABELS[first] || TECHNICAL_ACTION_LABELS[first.toLowerCase()]);
  return {
    label: friendly || first || "UNKNOWN",
    raw: raw && raw !== friendly && raw !== first ? raw : raw,
  };
};

const severityWeight = (severity?: string | null): number => {
  if (severity === "HIGH" || severity === "CRITICAL") return 3;
  if (severity === "MEDIUM") return 2;
  if (severity === "LOW") return 1;
  return 0;
};

const groupForFinding = (finding: AuditReviewFinding): { name: string; action: string } => {
  const text = normalizedText(
    finding.check_code,
    finding.check_name,
    finding.finding_type,
    finding.finding_title,
    finding.finding_summary,
    finding.description,
  );
  if (text.includes("export") || text.includes("download")) {
    return { name: "Data Export / Download", action: "Confirm export/download business justification and reviewer approval." };
  }
  if (text.includes("old") || text.includes("new") || text.includes("missing value")) {
    return { name: "Missing Old/New Values", action: "Review source configuration and verify the change can be reconstructed." };
  }
  if (text.includes("delete") || text.includes("deletion")) {
    return { name: "Delete Action", action: "Confirm deletion authorization and retention impact." };
  }
  if (text.includes("off") || text.includes("after hour") || text.includes("business hour")) {
    return { name: "Off-hours Activity", action: "Validate user activity timing against approved operational need." };
  }
  if (text.includes("addition") || text.includes("record add") || text.includes("create")) {
    return { name: "Record Addition Gap", action: "Confirm record creation has expected approval or traceability." };
  }
  if (text.includes("user") || text.includes("identity")) {
    return { name: "Missing User Identity", action: "Verify identity mapping and remediate missing user attribution." };
  }
  if (text.includes("permission") || text.includes("role") || text.includes("security")) {
    return { name: "Permission Changes", action: "Review privilege change authorization and segregation of duties." };
  }
  if (text.includes("config") || text.includes("workflow") || text.includes("field") || text.includes("system")) {
    return { name: "Configuration Changes", action: "Confirm configuration changes are linked to approved change control." };
  }
  return { name: "Other Audit Trail Findings", action: "Review evidence and assign corrective action if required." };
};

const groupFindings = (findings: AuditReviewFinding[]): FindingGroup[] => {
  const groups = new Map<string, FindingGroup>();
  findings.forEach((finding) => {
    const group = groupForFinding(finding);
    const key = group.name;
    const current = groups.get(key);
    if (!current) {
      groups.set(key, {
        key,
        name: group.name,
        count: 1,
        highestSeverity: finding.severity || "-",
        recommendedAction: group.action,
        findings: [finding],
      });
      return;
    }
    current.count += 1;
    current.findings.push(finding);
    if (severityWeight(finding.severity) > severityWeight(current.highestSeverity)) {
      current.highestSeverity = finding.severity || "-";
    }
  });
  return Array.from(groups.values()).sort((left, right) => severityWeight(right.highestSeverity) - severityWeight(left.highestSeverity));
};

const checklistFriendlyStatus = (status?: string | null): string => {
  if (status === "ACTIVE") return "Checked";
  if (status === "PARTIAL") return "Checked with limitations";
  if (status === "NOT_APPLICABLE") return "Not applicable for this audit type";
  if (status === "NO_DATA") return "No records available";
  if (status === "PASS") return "Passed";
  if (status === "FAIL") return "Finding found";
  return formatAuditReviewLabel(status || "-");
};

const checklistRows = (job: AuditReviewJobDetail | null, scores: AuditReviewScore[]) => {
  const summaryRows = job?.checklist_applicability?.filter((item) => item && typeof item === "object") ?? [];
  if (summaryRows.length > 0) return summaryRows as Array<Record<string, unknown>>;
  return scores
    .filter((score) => score.score_scope === "CHECKPOINT")
    .map((score) => ({
      check_code: score.check_code,
      check_name: score.check_name,
      applicability: score.applicability ?? score.score_status,
      evaluated_record_count: score.evaluated_record_count,
      finding_count: score.finding_count,
    }));
};

const checklistSummary = (job: AuditReviewJobDetail | null, scores: AuditReviewScore[]) => {
  const rows = checklistRows(job, scores);
  return rows.reduce(
    (acc, row) => {
      const status = String(row.applicability ?? row.check_status ?? row.score_status ?? "").toUpperCase();
      if (status === "PASS" || status === "ACTIVE") acc.passed += 1;
      else if (status === "FAIL") acc.withFindings += 1;
      else if (status === "NOT_APPLICABLE") acc.notApplicable += 1;
      else if (status === "NO_DATA") acc.noData += 1;
      else if (status === "PARTIAL") acc.partial += 1;
      return acc;
    },
    { passed: 0, withFindings: 0, notApplicable: 0, noData: 0, partial: 0 },
  );
};

const fieldFromRecord = (record: AuditTrailRecord, field: keyof AuditTrailRecord): string =>
  displayValue(record[field] as string | number | null | undefined);

function SectionTitle({ icon, title, description, action }: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {icon ? <div className="mt-0.5 text-slate-500">{icon}</div> : null}
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function AssetSelector({
  assets,
  selectedAssetId,
  onSelect,
  loading,
  error,
  disabled,
  showAllActive,
  activeAssetCount,
  onShowAllActive,
  onShowValidatedOnly,
  onGoToAssetMaster,
}: {
  assets: AssetRecord[];
  selectedAssetId: string | null;
  onSelect: (assetId: string) => void;
  loading?: boolean;
  error?: string | null;
  disabled?: boolean;
  showAllActive?: boolean;
  activeAssetCount?: number;
  onShowAllActive?: () => void;
  onShowValidatedOnly?: () => void;
  onGoToAssetMaster?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedAsset = assets.find((asset) => assetSelectionId(asset) === selectedAssetId) ?? null;
  const hasAssets = assets.length > 0;
  const selectorDisabled = Boolean(disabled || loading || error || !hasAssets);
  const statusText = loading
    ? "Loading validated software/system assets..."
    : error
      ? "Unable to load validated software/system assets."
      : selectedAsset
        ? assetPrimaryLabel(selectedAsset)
        : "Search or select a validated software/system asset...";

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <label className="block text-sm font-medium text-slate-700">Select Validated Software Asset</label>
        <span className="text-xs font-medium text-slate-500">
          {loading ? "Loading" : showAllActive ? `${assets.length} active assets` : `${assets.length} validated software/system assets`}
        </span>
      </div>

      <Popover open={open && !selectorDisabled} onOpenChange={(nextOpen) => setOpen(selectorDisabled ? false : nextOpen)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            disabled={selectorDisabled}
            className={cn(
              "flex min-h-11 w-full items-center justify-between gap-3 rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm shadow-sm transition-colors",
              "focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25",
              selectorDisabled ? "cursor-not-allowed opacity-70" : "hover:border-slate-400",
            )}
          >
            <span className={cn("min-w-0 flex-1 truncate", selectedAsset ? "font-medium text-slate-950" : "text-slate-500")}>
              {statusText}
            </span>
            {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" /> : <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter>
            <CommandInput placeholder="Search or select a validated software/system asset..." />
            <CommandList className="max-h-80">
              <CommandEmpty>No matching assets found.</CommandEmpty>
              <CommandGroup>
                {assets.map((asset) => {
                  const optionId = assetSelectionId(asset);
                  const secondary = assetSecondaryLabel(asset);
                  const selected = optionId === selectedAssetId;
                  return (
                    <CommandItem
                      key={optionId || `${assetIdLabel(asset)}-${assetNameLabel(asset)}`}
                      value={`${assetSearchLabel(asset)} ${optionId}`}
                      disabled={!optionId}
                      onSelect={() => {
                        if (!optionId) return;
                        onSelect(optionId);
                        setOpen(false);
                      }}
                      className="items-start gap-3 px-3 py-2"
                    >
                      <Check className={cn("mt-0.5 h-4 w-4 shrink-0", selected ? "opacity-100" : "opacity-0")} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-950">{assetPrimaryLabel(asset)}</div>
                        {secondary ? <div className="mt-0.5 truncate text-xs text-slate-500">{secondary}</div> : null}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {loading ? (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
          Loading validated software/system assets...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
          Unable to load validated software/system assets.
        </div>
      ) : !hasAssets ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-900">
            {showAllActive ? "No active assets found." : "No validated software/system assets found."}
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={onGoToAssetMaster}>
              <ExternalLink className="h-4 w-4" />
              Go to Asset Master
            </Button>
            {!showAllActive && (activeAssetCount ?? 0) > 0 ? (
              <Button type="button" variant="secondary" onClick={onShowAllActive}>
                Show all active assets for troubleshooting
              </Button>
            ) : null}
          </div>
        </div>
      ) : showAllActive ? (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
          <span>Troubleshooting view: showing all active assets. The validated software filter is relaxed.</span>
          <Button type="button" size="sm" variant="outline" onClick={onShowValidatedOnly}>
            Show validated software assets only
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function AssetContextCard({
  asset,
  jobs,
  schedules,
  action,
  collapsed = false,
  onCollapsedChange,
}: {
  asset: AssetRecord;
  jobs: AuditReviewJobListItem[];
  schedules: AuditReviewSchedule[];
  action?: React.ReactNode;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}) {
  const latestJob = jobs[0];
  const nextRun = schedules.find((schedule) => schedule.enabled)?.next_run_dt;
  const tags = Array.isArray(asset.tags)
    ? asset.tags.map(textValue).filter((tag): tag is string => Boolean(tag))
    : [];
  const items = [
    ["Asset name", assetNameLabel(asset)],
    ["Asset ID", assetIdLabel(asset)],
    ["Current status", assetStatusLabel(asset)],
    ["Current/validated version", textValue(asset.asset_version)],
    ["Organization/business unit", textValue(asset.org_node_name)],
    ["Owner / QA owner / IT owner", textValue(asset.asset_owner)],
    ["Criticality", textValue(asset.criticality_class) || textValue(asset.asset_criticality)],
    ["GxP impact", tags.find((tag) => tag.toLowerCase().includes("gxp")) || null],
    ["Part 11 applicability", tags.find((tag) => tag.toLowerCase().includes("part 11")) || null],
    ["Veeva instance/app/source", assetSourceSystemLabel(asset) || (latestJob?.audit_trail_type ? "Veeva audit trail" : null)],
    ["Last review", latestJob?.created_dt ? formatAuditReviewDate(latestJob.created_dt) : null],
    ["Next review due", nextRun ? formatAuditReviewDate(nextRun) : null],
  ];

  return (
    <Card className="rounded-lg border-slate-200 bg-white shadow-sm" padding="none">
      <SectionTitle
        icon={<ShieldCheck className="h-5 w-5" />}
        title="Asset Compliance Context"
        description="Current asset context used to frame this manual periodic audit trail review."
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {action}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onCollapsedChange?.(!collapsed)}
              aria-expanded={!collapsed}
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", collapsed ? "" : "rotate-180")} />
              {collapsed ? "Show Context" : "Hide Context"}
            </Button>
          </div>
        }
      />
      {!collapsed ? (
        <CardBody className="grid grid-cols-1 gap-3 py-5 sm:grid-cols-2 xl:grid-cols-3">
          {items.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
              <div className="mt-1 text-sm font-medium text-slate-900">{value || "-"}</div>
            </div>
          ))}
        </CardBody>
      ) : null}
    </Card>
  );
}

function RunReviewActionButton({
  disabled,
  running,
  onClick,
}: {
  disabled: boolean;
  running: boolean;
  onClick: () => void;
}) {
  const disabledReason = disabled && !running ? "Select a validated software asset first." : null;
  const button = (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabledReason ?? undefined}
    >
      {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
      Run Audit Trail Review
    </Button>
  );

  if (!disabledReason) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{button}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{disabledReason}</TooltipContent>
    </Tooltip>
  );
}

function ReviewHistoryTable({
  jobs,
  reports,
  selectedJobId,
  onView,
  onDownload,
}: {
  jobs: AuditReviewJobListItem[];
  reports: AuditReviewReportListItem[];
  selectedJobId?: string | null;
  onView: (jobId: string) => void;
  onDownload?: (reportId: string) => void;
}) {
  const reportByJob = useMemo(() => {
    const map = new Map<string, AuditReviewReportListItem>();
    reports.forEach((report) => {
      if (!map.has(report.job_id)) map.set(report.job_id, report);
    });
    return map;
  }, [reports]);

  return (
    <Card className="rounded-lg border-slate-200 bg-white shadow-sm" padding="none">
      <SectionTitle
        icon={<History className="h-5 w-5" />}
        title="Previous Audit Reviews"
        description="Historical reviews stay read-only and separate from a new manual run."
      />
      <div className="overflow-x-auto">
        <Table className="min-w-[1100px]">
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Date</TableHead>
              <TableHead>Review period</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Audit trail types</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Report status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-slate-500">
                  No previous audit trail reviews found for this asset.
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => {
                const report = reportByJob.get(job.job_id);
                return (
                  <TableRow key={job.job_id} className={selectedJobId === job.job_id ? "bg-blue-50/50" : undefined}>
                    <TableCell>{formatAuditReviewDate(job.created_dt)}</TableCell>
                    <TableCell>{formatAuditReviewPeriod(job.review_start_dt, job.review_end_dt)}</TableCell>
                    <TableCell>{formatAuditReviewLabel(job.review_scope)}</TableCell>
                    <TableCell className="max-w-72 whitespace-normal">
                      {(job.selected_audit_trail_types?.length ? job.selected_audit_trail_types : [job.audit_trail_type])
                        .map(formatAuditReviewLabel)
                        .join(", ")}
                    </TableCell>
                    <TableCell>{report?.overall_score ?? ("overall_score" in job ? (job as AuditReviewJobDetail).overall_score ?? "-" : "-")}</TableCell>
                    <TableCell>
                      {report?.rating || ("rating" in job && (job as AuditReviewJobDetail).rating) ? (
                        <Badge variant="outline" className={getAuditReviewRatingBadgeClass(report?.rating || (job as AuditReviewJobDetail).rating)}>
                          {formatAuditReviewRating(report?.rating || (job as AuditReviewJobDetail).rating)}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getAuditReviewReportStatusBadgeClass(report?.status)}>
                        {statusLabel(report?.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => onView(job.job_id)}>
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                        {report && onDownload ? (
                          <Button type="button" size="sm" variant="outline" onClick={() => onDownload(report.report_id)}>
                            <Download className="h-4 w-4" />
                            Download
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function PipelineTimeline({ steps, visible }: { steps: PipelineStep[]; visible: boolean }) {
  if (!visible) return null;
  return (
    <Card className="rounded-lg border-slate-200 bg-white shadow-sm" padding="none">
      <SectionTitle icon={<RefreshCw className="h-5 w-5" />} title="Live Progress" description="One-click pipeline status for this review run." />
      <CardBody className="grid grid-cols-1 gap-3 py-5 lg:grid-cols-5">
        {steps.map((step) => {
          const color =
            step.status === "done"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : step.status === "active"
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : step.status === "warning"
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : step.status === "failed"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-slate-200 bg-slate-50 text-slate-500";
          return (
            <div key={step.key} className={`rounded-lg border px-3 py-3 ${color}`}>
              <div className="flex items-center gap-2 text-sm font-semibold">
                {step.status === "active" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {pipelineStepLabel(step)}
              </div>
              {step.message ? <p className="mt-1 text-xs leading-5">{step.message}</p> : null}
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

function RunReviewDialog({
  open,
  asset,
  metadata,
  jobs,
  creating,
  onClose,
  onRun,
  onViewExisting,
}: {
  open: boolean;
  asset: AssetRecord | null;
  metadata: AuditReviewMetadata;
  jobs: AuditReviewJobListItem[];
  creating: boolean;
  onClose: () => void;
  onRun: (payload: AuditReviewJobCreatePayload, form: RunFormState) => Promise<void>;
  onViewExisting: (jobId: string) => void;
}) {
  const [form, setForm] = useState<RunFormState>(buildDefaultRunForm);
  const [duplicate, setDuplicate] = useState<AuditReviewJobListItem | null>(null);

  useEffect(() => {
    if (open) {
      setForm(buildDefaultRunForm());
      setDuplicate(null);
    }
  }, [open]);

  const effectiveTypes = selectedTypesForScope(metadata, form.reviewScope, form.selectedAuditTrailTypes);
  const selectedScope = metadata.review_scopes.find((scope) => scope.code === form.reviewScope);
  const canRun = Boolean(asset && form.reviewStart && form.reviewEnd && effectiveTypes.length > 0 && !creating);

  const updateScope = (scope: AuditReviewScope) => {
    const types = selectedTypesForScope(metadata, scope, form.selectedAuditTrailTypes);
    setForm((previous) => ({
      ...previous,
      reviewScope: scope,
      selectedAuditTrailTypes: scope === "CUSTOM" ? previous.selectedAuditTrailTypes : types,
    }));
    setDuplicate(null);
  };

  const toggleCustomType = (type: string, checked: boolean) => {
    setForm((previous) => ({
      ...previous,
      selectedAuditTrailTypes: checked
        ? Array.from(new Set([...previous.selectedAuditTrailTypes, type]))
        : previous.selectedAuditTrailTypes.filter((item) => item !== type),
    }));
    setDuplicate(null);
  };

  const findDuplicate = (): AuditReviewJobListItem | null => {
    const startIso = toUtcIso(form.reviewStart);
    const endIso = toUtcIso(form.reviewEnd);
    return jobs.find((job) => {
      const jobTypes = job.selected_audit_trail_types?.length ? job.selected_audit_trail_types : [job.audit_trail_type];
      return (
        new Date(job.review_start_dt).toISOString() === startIso &&
        new Date(job.review_end_dt).toISOString() === endIso &&
        job.review_scope === form.reviewScope &&
        sameStringSet(jobTypes, effectiveTypes)
      );
    }) ?? null;
  };

  const submit = async (force = false) => {
    if (!asset || !canRun) return;
    const existing = findDuplicate();
    if (existing && !force) {
      setDuplicate(existing);
      return;
    }
    setDuplicate(null);
    await onRun(
      {
        review_start_dt: toUtcIso(form.reviewStart),
        review_end_dt: toUtcIso(form.reviewEnd),
        audit_trail_type: effectiveTypes[0],
        review_scope: form.reviewScope,
        selected_audit_trail_types: effectiveTypes,
        veeva_instance_name: form.veevaInstanceName.trim() || null,
        veeva_app_name: form.veevaAppName.trim() || null,
        requested_by: asset.asset_owner || "QA reviewer",
      },
      { ...form, selectedAuditTrailTypes: effectiveTypes },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen && !creating ? onClose() : undefined)}>
      <DialogContent className="max-h-[92vh] w-[min(980px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-hidden p-0 sm:max-w-[calc(100vw-2rem)] lg:max-w-5xl">
        <DialogHeader className="border-b border-slate-200 bg-slate-50 px-6 py-5 text-left">
          <DialogTitle className="text-lg font-semibold text-slate-950">Run Audit Trail Review</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-slate-600">
            Review scope controls the audit trail types unless Custom is selected.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[calc(92vh-9rem)] space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-[1.4fr_1fr_1fr]">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Asset</div>
              <div className="mt-1 break-words text-sm font-semibold text-slate-900">{asset?.asset_name || "-"}</div>
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Asset ID</div>
              <div className="mt-1 break-words text-sm font-semibold text-slate-900">{asset?.asset_id || "-"}</div>
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Owner</div>
              <div className="mt-1 break-words text-sm font-semibold text-slate-900">{asset?.asset_owner || "-"}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Review start"
              type="datetime-local"
              value={form.reviewStart}
              onChange={(event) => {
                setForm((previous) => ({ ...previous, reviewStart: event.target.value }));
                setDuplicate(null);
              }}
              disabled={creating}
              className="h-10"
            />
            <Input
              label="Review end"
              type="datetime-local"
              value={form.reviewEnd}
              onChange={(event) => {
                setForm((previous) => ({ ...previous, reviewEnd: event.target.value }));
                setDuplicate(null);
              }}
              disabled={creating}
              className="h-10"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="min-w-0">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Review scope</label>
              <Select value={form.reviewScope} onValueChange={(value) => updateScope(value as AuditReviewScope)} disabled={creating}>
                <SelectTrigger className="h-10 min-w-0 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {metadata.review_scopes.map((scope) => (
                    <SelectItem key={scope.code} value={scope.code}>{scope.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              label="Veeva instance name"
              value={form.veevaInstanceName}
              onChange={(event) => setForm((previous) => ({ ...previous, veevaInstanceName: event.target.value }))}
              disabled={creating}
              className="h-10"
            />
            <Input
              label="Veeva app name"
              value={form.veevaAppName}
              onChange={(event) => setForm((previous) => ({ ...previous, veevaAppName: event.target.value }))}
              disabled={creating}
              className="h-10"
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Selected audit trail types</div>
            <p className="mt-1 text-sm text-slate-500">
              {SCOPE_EXPLANATIONS[form.reviewScope] || selectedScope?.label || "Selected scope applies to the chosen audit trail types."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {effectiveTypes.map((type) => (
                <Badge key={type} variant="outline" className="border-slate-200 bg-white text-slate-700">
                  {metadata.supported_audit_trail_types.find((item) => item.code === type)?.label || formatAuditReviewLabel(type)}
                </Badge>
              ))}
            </div>
            {form.reviewScope === "CUSTOM" ? (
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {metadata.supported_audit_trail_types.map((type) => (
                  <label key={type.code} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                    <Checkbox
                      checked={form.selectedAuditTrailTypes.includes(type.code)}
                      onCheckedChange={(checked) => toggleCustomType(type.code, checked === true)}
                      disabled={creating}
                    />
                    {type.label}
                  </label>
                ))}
              </div>
            ) : null}
            {effectiveTypes.length === 0 ? <p className="mt-2 text-sm text-red-600">Select at least one audit trail type.</p> : null}
          </div>

          {duplicate ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-5 w-5" />
                <div>
                  <div className="font-semibold">A review already exists for this period. View existing review or run again?</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => onViewExisting(duplicate.job_id)} disabled={creating}>
                      View Existing
                    </Button>
                    <Button type="button" onClick={() => void submit(true)} disabled={creating}>
                      Run Again
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <DialogFooter className="border-t border-slate-200 bg-slate-50 px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={creating}>Cancel</Button>
          <Button type="button" onClick={() => void submit(false)} disabled={!canRun}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            Run Review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResultSummaryHeader({ runtime }: { runtime: ReviewRuntime }) {
  const scoreLabel = scoreLabelForSelection(runtime.reviewScope, runtime.selectedAuditTrailTypes);

  return (
    <SectionTitle
      icon={<ClipboardCheck className="h-5 w-5" />}
      title="Current Review Result"
      description={SCOPE_EXPLANATIONS[runtime.reviewScope] || "Review completed for selected audit trail types."}
      action={
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-700">
            <Gauge className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{scoreLabel}</div>
            <div className="mt-1 flex items-end">
              <div className="text-3xl font-semibold leading-none text-slate-950">{runtime.job.overall_score ?? "-"}</div>
            </div>
          </div>
        </div>
      }
    />
  );
}

function ResultSummary({
  runtime,
}: {
  runtime: ReviewRuntime;
}) {
  return (
    <Card className="rounded-lg border-slate-200 bg-white shadow-sm" padding="none">
      <ResultSummaryHeader runtime={runtime} />
    </Card>
  );
}

function CurrentResultSummaryTab({ runtime }: { runtime: ReviewRuntime }) {
  const reportStatus = runtime.report?.status || runtime.job.latest_report_status;
  const items = [
    ["Review period", formatAuditReviewPeriod(runtime.job.review_start_dt, runtime.job.review_end_dt)],
    ["Scope", formatAuditReviewLabel(runtime.reviewScope)],
    ["Audit trails", runtime.selectedAuditTrailTypes.map(formatAuditReviewLabel).join(", ")],
    ["Records analyzed", formatAuditReviewNumber(runtime.job.record_count)],
    ["Findings", formatAuditReviewNumber(runtime.job.finding_count)],
    ["Report status", statusLabel(reportStatus)],
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{value || "-"}</div>
          </div>
        ))}
      </div>
      <TechnicalChecklistSummary runtime={runtime} />
    </div>
  );
}

function FindingsWorkspace({ findings }: { findings: AuditReviewFinding[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [auditType, setAuditType] = useState("ALL");
  const [checkCode, setCheckCode] = useState("ALL");
  const [severity, setSeverity] = useState("ALL");
  const groups = useMemo(() => groupFindings(findings), [findings]);
  const auditTypes = useMemo(() => Array.from(new Set(findings.map((finding) => finding.audit_trail_type).filter(Boolean))) as string[], [findings]);
  const checkCodes = useMemo(() => Array.from(new Set(findings.map((finding) => finding.check_code).filter(Boolean))), [findings]);
  const severities = useMemo(() => Array.from(new Set(findings.map((finding) => finding.severity).filter(Boolean))) as string[], [findings]);
  const filtered = findings.filter((finding) => {
    if (auditType !== "ALL" && finding.audit_trail_type !== auditType) return false;
    if (checkCode !== "ALL" && finding.check_code !== checkCode) return false;
    if (severity !== "ALL" && finding.severity !== severity) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <Card className="rounded-lg border-slate-200 bg-white shadow-sm" padding="none">
        <SectionTitle title="Grouped Findings Summary" description="Grouped first so QA can see what needs action before scanning technical rows." />
        <CardBody className="space-y-3 py-5">
          {groups.length === 0 ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
              No grouped findings to action.
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.key} className="rounded-lg border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === group.key ? null : group.key)}
                  className="flex w-full flex-col gap-3 px-4 py-3 text-left sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{group.name}</div>
                    <div className="mt-1 text-sm text-slate-500">{group.recommendedAction}</div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">{group.count} findings</Badge>
                    <Badge variant="outline" className={getAuditReviewRatingBadgeClass(group.highestSeverity)}>
                      Highest: {formatAuditReviewLabel(group.highestSeverity)}
                    </Badge>
                  </div>
                </button>
                {expanded === group.key ? (
                  <div className="border-t border-slate-200 px-4 py-3">
                    <div className="space-y-2">
                      {group.findings.map((finding) => (
                        <div key={finding.finding_id} className="rounded-md bg-slate-50 p-3 text-sm">
                          <div className="font-medium text-slate-900">{finding.finding_title || finding.title || finding.check_name}</div>
                          <div className="mt-1 text-slate-600">{finding.finding_summary || finding.description || "No summary returned."}</div>
                          <pre className="mt-2 max-h-40 overflow-auto rounded bg-white p-2 text-xs text-slate-500">
                            {JSON.stringify(finding.evidence_json || {}, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <Card className="rounded-lg border-slate-200 bg-white shadow-sm" padding="none">
        <SectionTitle icon={<Filter className="h-5 w-5" />} title="Detailed Findings" description="Technical finding rows remain available with filters." />
        <CardBody className="space-y-4 py-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Select value={auditType} onValueChange={setAuditType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All audit trail types</SelectItem>
                {auditTypes.map((type) => <SelectItem key={type} value={type}>{formatAuditReviewLabel(type)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={checkCode} onValueChange={setCheckCode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All checks</SelectItem>
                {checkCodes.map((code) => <SelectItem key={code} value={code}>{code}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All severities</SelectItem>
                {severities.map((item) => <SelectItem key={item} value={item}>{formatAuditReviewLabel(item)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Table className="min-w-[1320px]">
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="w-48 px-3">Audit Trail Type</TableHead>
                  <TableHead className="w-56 px-3">Check Code</TableHead>
                  <TableHead className="w-28 px-3">Severity</TableHead>
                  <TableHead className="min-w-[44rem] px-3">Finding</TableHead>
                  <TableHead className="w-24 px-3">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center text-slate-500">No findings match the selected filters.</TableCell></TableRow>
                ) : (
                  filtered.map((finding) => (
                    <TableRow key={finding.finding_id}>
                      <TableCell className="px-3">{formatAuditReviewLabel(finding.audit_trail_type)}</TableCell>
                      <TableCell className="px-3"><span className="font-mono text-xs text-slate-600">{finding.check_code}</span></TableCell>
                      <TableCell className="px-3">{formatAuditReviewLabel(finding.severity)}</TableCell>
                      <TableCell className="min-w-[44rem] whitespace-normal px-3">
                        <div className="font-medium text-slate-900">{finding.finding_title || finding.title || finding.check_name}</div>
                        <div className="mt-1 text-sm text-slate-500">{finding.finding_summary || finding.description}</div>
                      </TableCell>
                      <TableCell className="px-3">{formatAuditReviewLabel(finding.status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function EvidenceRecordsTable({ runtime }: { runtime: ReviewRuntime }) {
  const [activeType, setActiveType] = useState("ALL");
  const selectedTypes = runtime.selectedAuditTrailTypes;
  const records = activeType === "ALL" ? runtime.records : runtime.records.filter((record) => record.audit_trail_type === activeType);
  const documentMode = activeType === "document_audit_trail" || (activeType === "ALL" && records[0]?.audit_trail_type === "document_audit_trail");

  return (
    <Card className="rounded-lg border-slate-200 bg-white shadow-sm" padding="none">
      <SectionTitle
        icon={<Layers3 className="h-5 w-5" />}
        title="Evidence Records"
        description="Normalized source records are available after the result and findings summary."
        action={
          <Select value={activeType} onValueChange={setActiveType}>
            <SelectTrigger className="w-56 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All audit trail types</SelectItem>
              {selectedTypes.map((type) => <SelectItem key={type} value={type}>{formatAuditReviewLabel(type)}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />
      <Table className="min-w-[1500px]" containerClassName="rounded-b-lg border-t border-slate-200">
        <TableHeader>
          <TableRow className="bg-slate-50">
            {documentMode ? (
              <>
                <TableHead className="min-w-44 px-3">Time</TableHead>
                <TableHead className="min-w-64 px-3">User</TableHead>
                <TableHead className="min-w-44 px-3">Detected Action</TableHead>
                <TableHead className="min-w-64 px-3">Document/Object</TableHead>
                <TableHead className="min-w-64 px-3">Field Changed</TableHead>
                <TableHead className="min-w-72 px-3">Old Value</TableHead>
                <TableHead className="min-w-72 px-3">New Value</TableHead>
                <TableHead className="min-w-56 px-3">Source Record</TableHead>
              </>
            ) : (
              <>
                <TableHead className="min-w-44 px-3">Time</TableHead>
                <TableHead className="min-w-64 px-3">User</TableHead>
                <TableHead className="min-w-40 px-3">Audit Trail</TableHead>
                <TableHead className="min-w-44 px-3">Detected Action</TableHead>
                <TableHead className="min-w-64 px-3">Object</TableHead>
                <TableHead className="min-w-64 px-3">Field</TableHead>
                <TableHead className="min-w-72 px-3">Old Value</TableHead>
                <TableHead className="min-w-72 px-3">New Value</TableHead>
              </>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="py-8 text-center text-slate-500">No evidence records returned for this selection.</TableCell>
            </TableRow>
          ) : (
            records.slice(0, 200).map((record) => {
              const action = actionDisplay(record);
              const actionSecondary = action.raw && action.raw !== action.label ? action.raw : record.raw_action;
              return (
                <TableRow key={record.record_id}>
                  <TableCell className="px-3">{formatAuditReviewDateTime(record.event_timestamp)}</TableCell>
                  <TableCell className="px-3">{displayValue(record.user_name || record.user_id)}</TableCell>
                  {!documentMode ? <TableCell className="px-3">{formatAuditReviewLabel(record.audit_trail_type)}</TableCell> : null}
                  <TableCell className="px-3">
                    <div className="font-medium text-slate-900">{action.label}</div>
                    {actionSecondary ? <div className="mt-1 text-xs text-slate-400">{actionSecondary}</div> : null}
                  </TableCell>
                  <TableCell className="px-3">{displayValue(record.object_name || record.object_type || record.object_id)}</TableCell>
                  <TableCell className="px-3">{fieldFromRecord(record, "field_name")}</TableCell>
                  <TableCell className="px-3">{fieldFromRecord(record, "old_value")}</TableCell>
                  <TableCell className="px-3">{fieldFromRecord(record, "new_value")}</TableCell>
                  {documentMode ? <TableCell className="px-3">{displayValue(record.source_record_key)}</TableCell> : null}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

function TechnicalChecklistSummary({ runtime }: { runtime: ReviewRuntime }) {
  const [expanded, setExpanded] = useState(false);
  const rows = checklistRows(runtime.job, runtime.scores);
  const summary = checklistSummary(runtime.job, runtime.scores);
  const cards = [
    ["Passed", summary.passed],
    ["With findings", summary.withFindings],
    ["Not applicable", summary.notApplicable],
    ["No data", summary.noData],
    ["Partial", summary.partial],
  ];

  return (
    <section className="space-y-4 border-t border-slate-200 pt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 text-slate-500">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-950">Technical Checklist</h3>
            <p className="mt-1 text-sm leading-5 text-slate-500">
              Checklist status is included in the result summary for reviewers who need it.
            </p>
          </div>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Hide Details" : "Show Details"}
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
          </div>
        ))}
      </div>
      {expanded ? (
        <Table className="min-w-[920px]" containerClassName="rounded-lg border border-slate-200">
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Checkpoint</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Evaluated</TableHead>
              <TableHead>Findings</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="py-8 text-center text-slate-500">Checklist details are available after analysis.</TableCell></TableRow>
            ) : (
              rows.map((row) => {
                const status = String(row.applicability ?? row.check_status ?? row.score_status ?? "-");
                return (
                  <TableRow key={String(row.check_code)}>
                    <TableCell className="whitespace-normal">
                      <div className="font-medium text-slate-900">{String(row.check_name ?? row.check_code ?? "-")}</div>
                      <div className="mt-1 font-mono text-xs text-slate-400">{String(row.check_code ?? "-")}</div>
                    </TableCell>
                    <TableCell>{checklistFriendlyStatus(status)}</TableCell>
                    <TableCell>{formatAuditReviewNumber(Number(row.evaluated_record_count ?? 0))}</TableCell>
                    <TableCell>{formatAuditReviewNumber(Number(row.finding_count ?? 0))}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      ) : null}
    </section>
  );
}

function ReadOnlyReviewDialog({
  runtime,
  open,
  onClose,
}: {
  runtime: ReviewRuntime | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!runtime) return null;
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="max-h-[92vh] w-[min(1280px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-hidden p-0 sm:max-w-[calc(100vw-2rem)] xl:max-w-7xl">
        <DialogHeader className="border-b border-slate-200 bg-slate-50 px-6 py-5 text-left">
          <DialogTitle>Read-only Audit Review Detail</DialogTitle>
          <DialogDescription>
            Historical review from {formatAuditReviewPeriod(runtime.job.review_start_dt, runtime.job.review_end_dt)}.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[calc(92vh-8rem)] space-y-4 overflow-y-auto px-6 py-5">
          <ResultSummary runtime={runtime} />
          <FindingsWorkspace findings={runtime.findings} />
          <EvidenceRecordsTable runtime={runtime} />
        </div>
        <DialogFooter className="border-t border-slate-200 bg-slate-50 px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleSetupPanel({
  asset,
  schedule,
  form,
  metadata,
  saving,
  running,
  lastResult,
  onChange,
  onSave,
  onRunNow,
  onDisable,
}: {
  asset: AssetRecord;
  schedule: AuditReviewSchedule | null;
  form: ScheduleFormState;
  metadata: AuditReviewMetadata;
  saving: boolean;
  running: boolean;
  lastResult: AuditReviewScheduleRunNowResponse | null;
  onChange: (field: keyof ScheduleFormState, value: string | boolean | string[]) => void;
  onSave: () => void;
  onRunNow: () => void;
  onDisable: () => void;
}) {
  const actionDisabled = saving || running;
  const effectiveTypes = selectedTypesForScope(metadata, form.reviewScope, form.selectedAuditTrailTypes);
  const customMissing = form.reviewScope === "CUSTOM" && effectiveTypes.length === 0;
  const latestRun = lastResult?.run ?? null;
  const statusEnabled = schedule?.enabled ?? form.enabled;
  const statusText = !schedule
    ? "No schedule configured for this asset"
    : statusEnabled
      ? "Schedule enabled for this asset"
      : "Schedule disabled for this asset";

  const updateScope = (scope: AuditReviewScope) => {
    onChange("reviewScope", scope);
    if (scope !== "CUSTOM") {
      onChange("selectedAuditTrailTypes", selectedTypesForScope(metadata, scope, form.selectedAuditTrailTypes));
    }
  };

  const toggleType = (type: string, checked: boolean) => {
    const next = checked
      ? Array.from(new Set([...form.selectedAuditTrailTypes, type]))
      : form.selectedAuditTrailTypes.filter((item) => item !== type);
    onChange("selectedAuditTrailTypes", next);
  };

  return (
    <div className="space-y-5">
      <Card className="rounded-lg border-slate-200 bg-white shadow-sm" padding="none">
        <SectionTitle
          icon={<CalendarClock className="h-5 w-5" />}
          title="Current Schedule Status"
          description="Recurring review status stays separate from the manual New Review result."
        />
        <CardBody className="grid grid-cols-1 gap-3 py-5 md:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 md:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={statusEnabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}>
                {statusEnabled ? "Enabled" : "Disabled"}
              </Badge>
              {latestRun ? (
                <Badge variant="outline" className={getScheduleRunBadgeClass(latestRun.status)}>
                  Last run {formatAuditReviewLabel(latestRun.status)}
                </Badge>
              ) : null}
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-900">{statusText}</div>
            <div className="mt-1 text-xs text-slate-500">{assetNameLabel(asset)} · {assetIdLabel(asset)}</div>
            {latestRun?.error_message ? <div className="mt-2 text-xs text-red-700">{latestRun.error_message}</div> : null}
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Next run</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{formatAuditReviewDateTime(schedule?.next_run_dt)}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Last run</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{formatAuditReviewDateTime(schedule?.last_run_dt)}</div>
          </div>
        </CardBody>
      </Card>

      <Card className="rounded-lg border-slate-200 bg-white shadow-sm" padding="none">
        <SectionTitle
          icon={<RefreshCw className="h-5 w-5" />}
          title="Schedule Configuration"
          description={schedule ? "Edit the saved recurring periodic review settings." : "No schedule configured for this asset. Create a schedule from the form below."}
        />
        <CardBody className="space-y-5 py-5">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <div>
              <div className="text-sm font-medium text-slate-900">Enabled</div>
              <div className="text-xs text-slate-500">{form.enabled ? "Automatic due runs active" : "Automatic due runs paused"}</div>
            </div>
            <Switch checked={form.enabled} disabled={actionDisabled} onCheckedChange={(checked) => onChange("enabled", checked)} />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Frequency</label>
              <Select value={form.frequency} disabled={actionDisabled} onValueChange={(value) => onChange("frequency", value as AuditReviewScheduleFrequency)}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCHEDULE_FREQUENCIES.map((frequency) => (
                    <SelectItem key={frequency} value={frequency}>{formatAuditReviewLabel(frequency)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input label="Review window days" type="number" min={1} max={366} value={form.reviewWindowDays} onChange={(event) => onChange("reviewWindowDays", event.target.value)} disabled={actionDisabled} />
            <Input label="Next run date/time" type="datetime-local" value={form.nextRun} onChange={(event) => onChange("nextRun", event.target.value)} disabled={actionDisabled} />
            <Input label="Timezone" value={form.timezone} onChange={(event) => onChange("timezone", event.target.value)} disabled={actionDisabled} />
            <Input label="Business start hour" type="number" min={0} max={23} value={form.businessStartHour} onChange={(event) => onChange("businessStartHour", event.target.value)} disabled={actionDisabled} />
            <Input label="Business end hour" type="number" min={1} max={24} value={form.businessEndHour} onChange={(event) => onChange("businessEndHour", event.target.value)} disabled={actionDisabled} />
            <Input label="Updated by" value={form.actor} onChange={(event) => onChange("actor", event.target.value)} disabled={actionDisabled} wrapperClassName="md:col-span-2" />
          </div>
        </CardBody>
      </Card>

      <Card className="rounded-lg border-slate-200 bg-white shadow-sm" padding="none">
        <SectionTitle
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Veeva Configuration"
          description="Review scope drives the audit trail types except when Custom is selected."
        />
        <CardBody className="space-y-5 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Review scope</label>
              <Select value={form.reviewScope} disabled={actionDisabled} onValueChange={(value) => updateScope(value as AuditReviewScope)}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {metadata.review_scopes.map((scope) => (
                    <SelectItem key={scope.code} value={scope.code}>{scope.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input label="Vault DNS / source" value={form.vaultDns} onChange={(event) => onChange("vaultDns", event.target.value)} disabled={actionDisabled} />
            <Input label="Veeva instance" value={form.veevaInstanceName} onChange={(event) => onChange("veevaInstanceName", event.target.value)} disabled={actionDisabled} />
            <Input label="Veeva app" value={form.veevaAppName} onChange={(event) => onChange("veevaAppName", event.target.value)} disabled={actionDisabled} />
          </div>

          <div>
            <div className="mb-2 text-sm font-medium text-slate-700">Selected audit trail types</div>
            {form.reviewScope === "CUSTOM" ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {metadata.supported_audit_trail_types.map((type) => (
                  <label key={type.code} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                    <Checkbox checked={form.selectedAuditTrailTypes.includes(type.code)} disabled={actionDisabled} onCheckedChange={(checked) => toggleType(type.code, checked === true)} />
                    {type.label}
                  </label>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {effectiveTypes.map((type) => (
                  <Badge key={type} variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                    {metadata.supported_audit_trail_types.find((item) => item.code === type)?.label || formatAuditReviewLabel(type)}
                  </Badge>
                ))}
              </div>
            )}
            {customMissing ? <div className="mt-2 text-sm text-red-600">Select at least one audit trail type before saving or running.</div> : null}
          </div>

          <div className="flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onDisable} disabled={!schedule || actionDisabled || !statusEnabled}>
              Disable Schedule
            </Button>
            <Button type="button" variant="outline" onClick={onRunNow} disabled={actionDisabled || customMissing}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
              Run Now
            </Button>
            <Button type="button" onClick={onSave} disabled={actionDisabled || customMissing}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Schedule
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

interface PeriodicReviewPageProps {
  onNavigate?: (page: "asset" | "asset-dashboard") => void;
}

export function PeriodicReviewPage({ onNavigate }: PeriodicReviewPageProps = {}) {
  const [activeTab, setActiveTab] = useState<TopTab>("new-review");
  const [resultTab, setResultTab] = useState<ResultTab>("summary");
  const [allAssets, setAllAssets] = useState<AssetRecord[]>([]);
  const [showAllActiveAssets, setShowAllActiveAssets] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<AuditReviewMetadata>(FALLBACK_METADATA);
  const [jobs, setJobs] = useState<AuditReviewJobListItem[]>([]);
  const [reports, setReports] = useState<AuditReviewReportListItem[]>([]);
  const [schedules, setSchedules] = useState<AuditReviewSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [assetLoadError, setAssetLoadError] = useState<string | null>(null);
  const [assetLoading, setAssetLoading] = useState(false);
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [pipeline, setPipeline] = useState<PipelineStep[]>(initialPipeline);
  const [runtime, setRuntime] = useState<ReviewRuntime | null>(null);
  const [historyRuntime, setHistoryRuntime] = useState<ReviewRuntime | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [assetContextCollapsed, setAssetContextCollapsed] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>(() => buildDefaultScheduleForm());
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [runningSchedule, setRunningSchedule] = useState(false);
  const [lastScheduleResult, setLastScheduleResult] = useState<AuditReviewScheduleRunNowResponse | null>(null);
  const assetContextRequestRef = useRef(0);

  const validatedSoftwareAssets = useMemo(() => allAssets.filter(isValidatedSoftwareAsset), [allAssets]);
  const activeAssets = useMemo(() => allAssets.filter(isActiveAsset), [allAssets]);
  const selectableAssets = showAllActiveAssets ? activeAssets : validatedSoftwareAssets;
  const currentSchedule = schedules[0] ?? null;
  const assetSelectorBusy = running || savingSchedule || runningSchedule;

  const selectedAsset = useMemo(
    () => allAssets.find((asset) => assetSelectionId(asset) === selectedAssetId) ?? null,
    [allAssets, selectedAssetId],
  );

  const resetAssetScopedState = useCallback(() => {
    assetContextRequestRef.current += 1;
    setJobs([]);
    setReports([]);
    setSchedules([]);
    setAssetLoading(false);
    setRuntime(null);
    setHistoryRuntime(null);
    setHistoryOpen(false);
    setAssetContextCollapsed(false);
    setRunDialogOpen(false);
    setScheduleForm(buildDefaultScheduleForm());
    setSavingSchedule(false);
    setRunningSchedule(false);
    setLastScheduleResult(null);
    setResultTab("summary");
    setPipeline(initialPipeline());
  }, []);

  const loadAssetContext = useCallback(async (assetId: string) => {
    const requestId = assetContextRequestRef.current + 1;
    assetContextRequestRef.current = requestId;
    setAssetLoading(true);
    try {
      const [jobList, reportList, scheduleList] = await Promise.all([
        listAuditReviewJobs(assetId),
        listAssetAuditReviewReports(assetId),
        getAssetAuditReviewSchedules(assetId),
      ]);
      if (assetContextRequestRef.current !== requestId) return;
      setJobs(jobList);
      setReports(reportList);
      setSchedules(scheduleList);
    } catch (error) {
      if (assetContextRequestRef.current !== requestId) return;
      toast.error(apiErrorMessage(error));
      setJobs([]);
      setReports([]);
      setSchedules([]);
    } finally {
      if (assetContextRequestRef.current === requestId) setAssetLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      getAssets(),
      getAuditReviewMetadata().catch(() => FALLBACK_METADATA),
    ])
      .then(([assetList, nextMetadata]) => {
        if (cancelled) return;
        setAllAssets(Array.isArray(assetList) ? assetList : []);
        setAssetLoadError(null);
        setMetadata(nextMetadata);
      })
      .catch((error) => {
        if (cancelled) return;
        setAllAssets([]);
        setAssetLoadError("Unable to load validated software assets.");
        toast.error(apiErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedAssetId) {
      setAssetLoading(false);
      return;
    }
    void loadAssetContext(selectedAssetId);
  }, [loadAssetContext, selectedAssetId]);

  useEffect(() => {
    setScheduleForm(buildDefaultScheduleForm(currentSchedule, selectedAsset?.asset_owner, selectedAsset));
    setLastScheduleResult(null);
  }, [currentSchedule?.schedule_id, selectedAsset, selectedAssetId]);

  const handleAssetSelect = useCallback((assetId: string) => {
    if (assetId === selectedAssetId) return;
    resetAssetScopedState();
    setSelectedAssetId(assetId || null);
  }, [resetAssetScopedState, selectedAssetId]);

  const handleShowAllActiveAssets = useCallback(() => {
    setShowAllActiveAssets(true);
  }, []);

  const handleShowValidatedOnly = useCallback(() => {
    setShowAllActiveAssets(false);
    if (selectedAsset && !isValidatedSoftwareAsset(selectedAsset)) {
      resetAssetScopedState();
      setSelectedAssetId(null);
    }
  }, [resetAssetScopedState, selectedAsset]);

  const handleGoToAssetMaster = useCallback(() => {
    if (onNavigate) {
      onNavigate("asset");
      return;
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem("app_current_page", "asset");
      window.location.reload();
    }
  }, [onNavigate]);

  const updateScheduleForm = useCallback((field: keyof ScheduleFormState, value: string | boolean | string[]) => {
    setScheduleForm((previous) => ({ ...previous, [field]: value }));
    setLastScheduleResult(null);
  }, []);

  const buildSchedulePayload = (mode: "create" | "update") => {
    const reviewWindowDays = Number(scheduleForm.reviewWindowDays);
    const businessStartHour = Number(scheduleForm.businessStartHour);
    const businessEndHour = Number(scheduleForm.businessEndHour);
    const nextRunDate = new Date(scheduleForm.nextRun);
    const selectedAuditTrailTypes = selectedTypesForScope(metadata, scheduleForm.reviewScope, scheduleForm.selectedAuditTrailTypes);

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
    if (!scheduleForm.nextRun || Number.isNaN(nextRunDate.getTime())) {
      throw new Error("Next run date/time is required.");
    }
    if (!scheduleForm.timezone.trim()) {
      throw new Error("Timezone is required.");
    }
    if (selectedAuditTrailTypes.length === 0) {
      throw new Error("Select at least one audit trail type.");
    }

    return {
      enabled: scheduleForm.enabled,
      audit_trail_type: selectedAuditTrailTypes[0],
      review_scope: scheduleForm.reviewScope,
      selected_audit_trail_types: selectedAuditTrailTypes,
      veeva_instance_name: scheduleForm.veevaInstanceName.trim() || null,
      veeva_app_name: scheduleForm.veevaAppName.trim() || null,
      vault_dns: scheduleForm.vaultDns.trim() || null,
      frequency: scheduleForm.frequency,
      review_window_days: reviewWindowDays,
      next_run_dt: nextRunDate.toISOString(),
      timezone: scheduleForm.timezone.trim(),
      business_start_hour: businessStartHour,
      business_end_hour: businessEndHour,
      ...(mode === "create"
        ? { created_by: scheduleForm.actor.trim() || selectedAsset?.asset_owner || null }
        : { modified_by: scheduleForm.actor.trim() || selectedAsset?.asset_owner || null }),
    };
  };

  const persistSchedule = async (showSuccessToast: boolean): Promise<AuditReviewSchedule> => {
    if (!selectedAssetId) throw new Error("Select an asset before saving a schedule.");

    const saved = currentSchedule
      ? await updateAuditReviewSchedule(currentSchedule.schedule_id, buildSchedulePayload("update"))
      : await createAssetAuditReviewSchedule(selectedAssetId, buildSchedulePayload("create"));

    setSchedules((previous) => [saved, ...previous.filter((item) => item.schedule_id !== saved.schedule_id)]);
    setScheduleForm(buildDefaultScheduleForm(saved, selectedAsset?.asset_owner, selectedAsset));
    setLastScheduleResult(null);
    if (showSuccessToast) toast.success("Periodic review schedule saved");
    return saved;
  };

  const handleSaveSchedule = async () => {
    setSavingSchedule(true);
    try {
      await persistSchedule(true);
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleDisableSchedule = async () => {
    if (!currentSchedule) return;
    setSavingSchedule(true);
    try {
      const updated = await updateAuditReviewSchedule(currentSchedule.schedule_id, {
        enabled: false,
        modified_by: scheduleForm.actor.trim() || selectedAsset?.asset_owner || null,
      });
      setSchedules((previous) => [updated, ...previous.filter((item) => item.schedule_id !== updated.schedule_id)]);
      setScheduleForm(buildDefaultScheduleForm(updated, selectedAsset?.asset_owner, selectedAsset));
      setLastScheduleResult(null);
      toast.success("Periodic review schedule disabled");
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleRunScheduleNow = async () => {
    if (!selectedAssetId) return;
    setRunningSchedule(true);
    try {
      const savedSchedule = await persistSchedule(false);
      const result = await runAuditReviewScheduleNow(savedSchedule.schedule_id);
      setLastScheduleResult(result);
      setSchedules((previous) => [result.schedule, ...previous.filter((item) => item.schedule_id !== result.schedule.schedule_id)]);
      setScheduleForm(buildDefaultScheduleForm(result.schedule, selectedAsset?.asset_owner, selectedAsset));
      if (result.run.status === "COMPLETED") {
        toast.success("Scheduled audit review completed");
      } else if (result.run.status === "FAILED") {
        toast.error(result.run.error_message || "Scheduled audit review failed");
      } else {
        toast.info(result.run.message || "Scheduled audit review run started");
      }
      await loadAssetContext(selectedAssetId);
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setRunningSchedule(false);
    }
  };

  const refreshRuntime = async (jobId: string, scope?: AuditReviewScope, selectedTypes?: string[]): Promise<ReviewRuntime> => {
    const detail = await getAuditReviewJob(jobId);
    const [findings, scores, records, reportList] = await Promise.all([
      getAuditReviewFindings(jobId),
      getAuditReviewScores(jobId),
      getAuditReviewRecords(jobId, false),
      listAssetAuditReviewReports(detail.asset_id),
    ]);
    const reportId = detail.latest_report_id || reportList.find((item) => item.job_id === jobId)?.report_id || null;
    const report = reportId ? await getAuditReviewReport(reportId) : null;
    return {
      job: detail,
      report,
      findings,
      scores,
      records,
      reviewScope: scope || detail.review_scope || "LOGIN_ONLY",
      selectedAuditTrailTypes: selectedTypes?.length
        ? selectedTypes
        : detail.selected_audit_trail_types?.length
          ? detail.selected_audit_trail_types
          : [detail.audit_trail_type],
    };
  };

  const handleRunReview = async (payload: AuditReviewJobCreatePayload, form: RunFormState) => {
    if (!selectedAssetId) return;
    setRunning(true);
    setRunDialogOpen(false);
    setResultTab("summary");
    setRuntime(null);
    setPipeline(updateStep(initialPipeline(), "asset", "done"));
    let createdJobId: string | null = null;

    try {
      setPipeline((steps) => updateStep(steps, "created", "active"));
      const created = await createAuditReviewJob(selectedAssetId, payload);
      createdJobId = created.job_id;
      setPipeline((steps) => updateStep(steps, "created", "done"));

      setPipeline((steps) => updateStep(steps, "extracted", "active"));
      const extraction = await extractAuditReviewJob(created.job_id);
      if (extraction.status === "FAILED") {
        setPipeline((steps) => updateStep(steps, "extracted", "failed", "FAILED: all selected audit trail types failed extraction."));
        throw new Error("All selected audit trail types failed extraction.");
      }
      setPipeline((steps) =>
        updateStep(
          steps,
          "extracted",
          extraction.status === "PARTIAL_EXTRACTION" ? "warning" : "done",
          extraction.status === "PARTIAL_EXTRACTION" ? "PARTIAL_EXTRACTION: available audit types will continue." : undefined,
        ),
      );

      setPipeline((steps) => updateStep(steps, "analyzed", "active"));
      await analyzeAuditReviewJob(created.job_id, {
        business_timezone: "Asia/Kolkata",
        business_start_hour: 9,
        business_end_hour: 18,
      });
      setPipeline((steps) => updateStep(steps, "analyzed", "done"));

      setPipeline((steps) => updateStep(steps, "drafted", "active"));
      await generateAuditReviewReport(created.job_id);
      setPipeline((steps) => updateStep(steps, "drafted", "done"));

      const nextRuntime = await refreshRuntime(created.job_id, form.reviewScope, form.selectedAuditTrailTypes);
      setRuntime(nextRuntime);
      setAssetContextCollapsed(true);
      await loadAssetContext(selectedAssetId);
      toast.success("Draft audit review report generated");
    } catch (error) {
      setPipeline((steps) => {
        const active = steps.find((step) => step.status === "active");
        return active ? updateStep(steps, active.key, "failed", apiErrorMessage(error)) : steps;
      });
      if (createdJobId) {
        const failedRuntime = await refreshRuntime(createdJobId, form.reviewScope, form.selectedAuditTrailTypes).catch(() => null);
        if (failedRuntime) setRuntime(failedRuntime);
      }
      toast.error(apiErrorMessage(error));
    } finally {
      setRunning(false);
    }
  };

  const handleViewHistory = async (jobId: string) => {
    try {
      const detail = await refreshRuntime(jobId);
      setHistoryRuntime(detail);
      setHistoryOpen(true);
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  };

  const handleDownloadPdf = async (reportId?: string | null) => {
    const targetReportId = reportId || runtime?.report?.report_id;
    if (!targetReportId) return;
    try {
      const download = await downloadAuditReviewReportPdf(targetReportId);
      const url = URL.createObjectURL(download.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = download.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  };

  return (
    <div className="min-h-full bg-slate-50">
      <section className="border-b border-slate-200 bg-white px-4 py-5 shadow-sm lg:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Periodic Review</h1>
          </div>
        </div>
        <div className="mt-5">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TopTab)}>
            <TabsList className="rounded-lg bg-slate-100 p-1">
              <TabsTrigger value="new-review" className="rounded-md px-4">New Review</TabsTrigger>
              <TabsTrigger value="history" className="rounded-md px-4">Review History</TabsTrigger>
              <TabsTrigger value="schedule" className="rounded-md px-4">Schedule</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </section>

      <main className="space-y-5 px-4 py-5 lg:px-6">
        {activeTab === "new-review" ? (
          <div className="space-y-5">
            <Card className="rounded-lg border-slate-200 bg-white p-5 shadow-sm">
              <AssetSelector
                assets={selectableAssets}
                selectedAssetId={selectedAssetId}
                onSelect={handleAssetSelect}
                loading={loading}
                error={assetLoadError}
                disabled={assetSelectorBusy}
                showAllActive={showAllActiveAssets}
                activeAssetCount={activeAssets.length}
                onShowAllActive={handleShowAllActiveAssets}
                onShowValidatedOnly={handleShowValidatedOnly}
                onGoToAssetMaster={handleGoToAssetMaster}
              />
            </Card>

            {!selectedAsset ? (
              null
            ) : (
              <>
                {assetLoading ? (
                  <Card className="rounded-lg border-slate-200 bg-white p-5 text-sm text-slate-500">Loading asset compliance context...</Card>
                ) : null}
                <AssetContextCard
                  asset={selectedAsset}
                  jobs={jobs}
                  schedules={schedules}
                  collapsed={assetContextCollapsed}
                  onCollapsedChange={setAssetContextCollapsed}
                  action={(
                    <RunReviewActionButton
                      disabled={!selectedAsset || assetSelectorBusy}
                      running={running}
                      onClick={() => setRunDialogOpen(true)}
                    />
                  )}
                />
                <PipelineTimeline steps={pipeline} visible={running} />

                {runtime ? (
                  <Card className="rounded-lg border-slate-200 bg-white shadow-sm" padding="none">
                    <ResultSummaryHeader runtime={runtime} />
                    <Tabs value={resultTab} onValueChange={(value) => setResultTab(value as ResultTab)} className="gap-0">
                      <div className="border-b border-slate-200 px-3 py-3">
                        <TabsList className="rounded-lg bg-slate-100 p-1">
                          <TabsTrigger value="summary">Result Summary</TabsTrigger>
                          <TabsTrigger value="findings">Findings</TabsTrigger>
                          <TabsTrigger value="evidence">Evidence Records</TabsTrigger>
                        </TabsList>
                      </div>
                      <TabsContent value="summary" className="m-0 px-3 py-4">
                        <CurrentResultSummaryTab runtime={runtime} />
                      </TabsContent>
                      <TabsContent value="findings" className="m-0 px-3 py-4">
                        <FindingsWorkspace findings={runtime.findings} />
                      </TabsContent>
                      <TabsContent value="evidence" className="m-0 px-3 py-4">
                        <EvidenceRecordsTable runtime={runtime} />
                      </TabsContent>
                    </Tabs>
                  </Card>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {activeTab === "history" ? (
          <div className="space-y-5">
            <Card className="rounded-lg border-slate-200 bg-white p-5 shadow-sm">
              <AssetSelector
                assets={selectableAssets}
                selectedAssetId={selectedAssetId}
                onSelect={handleAssetSelect}
                loading={loading}
                error={assetLoadError}
                disabled={assetSelectorBusy}
                showAllActive={showAllActiveAssets}
                activeAssetCount={activeAssets.length}
                onShowAllActive={handleShowAllActiveAssets}
                onShowValidatedOnly={handleShowValidatedOnly}
                onGoToAssetMaster={handleGoToAssetMaster}
              />
            </Card>
            {selectedAsset ? (
              <ReviewHistoryTable jobs={jobs} reports={reports} onView={handleViewHistory} onDownload={(reportId) => void handleDownloadPdf(reportId)} />
            ) : (
              !loading && !assetLoadError && selectableAssets.length > 0 ? (
                <Card className="rounded-lg border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                  Select an asset to view old reviews.
                </Card>
              ) : null
            )}
          </div>
        ) : null}

        {activeTab === "schedule" ? (
          <div className="space-y-5">
            <Card className="rounded-lg border-slate-200 bg-white p-5 shadow-sm">
              <AssetSelector
                assets={selectableAssets}
                selectedAssetId={selectedAssetId}
                onSelect={handleAssetSelect}
                loading={loading}
                error={assetLoadError}
                disabled={assetSelectorBusy}
                showAllActive={showAllActiveAssets}
                activeAssetCount={activeAssets.length}
                onShowAllActive={handleShowAllActiveAssets}
                onShowValidatedOnly={handleShowValidatedOnly}
                onGoToAssetMaster={handleGoToAssetMaster}
              />
            </Card>
            {!selectedAsset ? (
              <Card className="rounded-lg border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                Select an asset to view or configure its periodic review schedule.
              </Card>
            ) : (
              <ScheduleSetupPanel
                asset={selectedAsset}
                schedule={currentSchedule}
                form={scheduleForm}
                metadata={metadata}
                saving={savingSchedule}
                running={runningSchedule}
                lastResult={lastScheduleResult}
                onChange={updateScheduleForm}
                onSave={() => void handleSaveSchedule()}
                onRunNow={() => void handleRunScheduleNow()}
                onDisable={() => void handleDisableSchedule()}
              />
            )}
          </div>
        ) : null}
      </main>

      <RunReviewDialog
        open={runDialogOpen}
        asset={selectedAsset}
        metadata={metadata}
        jobs={jobs}
        creating={running}
        onClose={() => setRunDialogOpen(false)}
        onRun={handleRunReview}
        onViewExisting={(jobId) => {
          setRunDialogOpen(false);
          void handleViewHistory(jobId);
        }}
      />

      <ReadOnlyReviewDialog runtime={historyRuntime} open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}
