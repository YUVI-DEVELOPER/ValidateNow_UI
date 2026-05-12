import React, { useMemo, useState } from "react";
import { CheckCircle2, Download, Eye, FileText, Loader2, RefreshCw, RotateCw, Send, XCircle } from "lucide-react";
import { toast } from "sonner";

import {
  AuditReviewReportDetail,
  AuditReviewReportReviewDecisionPayload,
  AuditReviewReportStatus,
  AuditReviewReportSubmitReviewPayload,
  downloadAuditReviewReportPdf,
} from "../../../services/audit-review.service";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { AuditReviewAiSummaryPanel } from "./AuditReviewAiSummaryPanel";
import { AuditReviewNotificationsPanel } from "./AuditReviewNotificationsPanel";

interface AuditReviewReportViewProps {
  report: AuditReviewReportDetail | null;
  loading?: boolean;
  refreshing?: boolean;
  actionLoading?: "submit-review" | "approve" | "reject" | null;
  onRefresh?: () => void;
  onSubmitReview?: (payload: AuditReviewReportSubmitReviewPayload) => Promise<void>;
  onApprove?: (payload: AuditReviewReportReviewDecisionPayload) => Promise<void>;
  onReject?: (payload: AuditReviewReportReviewDecisionPayload) => Promise<void>;
  defaultNotificationActor?: string | null;
  onNotificationsChanged?: () => void;
  showRelatedPanels?: boolean;
}

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

const getReportStatusBadgeClass = (status?: AuditReviewReportStatus | null): string => {
  if (status === "APPROVED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "UNDER_REVIEW") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "REJECTED") return "border-red-200 bg-red-50 text-red-700";
  if (status === "SUPERSEDED") return "border-slate-200 bg-slate-100 text-slate-600";
  if (status === "DRAFT") return "border-violet-200 bg-violet-50 text-violet-700";
  return "border-slate-200 bg-white text-slate-700";
};

const getSubmissionNotes = (approvalDecision?: Record<string, unknown> | null): string | null => {
  const submission = approvalDecision?.submission;
  if (submission && typeof submission === "object" && !Array.isArray(submission)) {
    const notes = (submission as Record<string, unknown>).submission_notes;
    if (typeof notes === "string" && notes.trim()) return notes;
  }

  const fallback = approvalDecision?.submission_notes;
  return typeof fallback === "string" && fallback.trim() ? fallback : null;
};

const getPdfButtonLabel = (status?: AuditReviewReportStatus | null): string => {
  if (status === "APPROVED") return "Download Approved PDF";
  if (status === "DRAFT") return "Download Draft PDF";
  return "Download PDF";
};

const MarkdownPreview = ({ markdown }: { markdown: string }) => {
  const blocks = useMemo(() => markdown.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean), [markdown]);

  if (blocks.length === 0) {
    return <p className="text-sm text-slate-500">No report content was returned.</p>;
  }

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        if (block.startsWith("# ")) {
          return (
            <h1 key={index} className="text-2xl font-semibold leading-tight text-slate-950">
              {block.replace(/^#\s+/, "")}
            </h1>
          );
        }
        if (block.startsWith("## ")) {
          return (
            <h2 key={index} className="border-b border-slate-200 pb-2 text-lg font-semibold text-slate-900">
              {block.replace(/^##\s+/, "")}
            </h2>
          );
        }
        if (block.startsWith("### ")) {
          return (
            <h3 key={index} className="text-base font-semibold text-slate-900">
              {block.replace(/^###\s+/, "")}
            </h3>
          );
        }
        if (block.split("\n").every((line) => line.trim().startsWith("- "))) {
          return (
            <ul key={index} className="space-y-2 pl-5 text-sm leading-6 text-slate-700">
              {block.split("\n").map((line, itemIndex) => (
                <li key={itemIndex} className="list-disc">
                  {line.replace(/^-\s+/, "")}
                </li>
              ))}
            </ul>
          );
        }
        if (/^\|.+\|$/m.test(block)) {
          return (
            <pre key={index} className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">
              {block}
            </pre>
          );
        }

        return (
          <p key={index} className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {block}
          </p>
        );
      })}
    </div>
  );
};

const MetadataItem = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="min-w-0">
    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 break-words text-sm font-medium text-slate-900">{value && value.trim() ? value : "-"}</p>
  </div>
);

export function AuditReviewReportView({
  report,
  loading = false,
  refreshing = false,
  actionLoading = null,
  onRefresh,
  onSubmitReview,
  onApprove,
  onReject,
  defaultNotificationActor,
  onNotificationsChanged,
  showRelatedPanels = true,
}: AuditReviewReportViewProps) {
  const [fullOpen, setFullOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [submittedBy, setSubmittedBy] = useState("");
  const [submissionNotes, setSubmissionNotes] = useState("Please review the draft audit trail report.");
  const [reviewedBy, setReviewedBy] = useState("");
  const [approveComments, setApproveComments] = useState("");
  const [rejectComments, setRejectComments] = useState("");
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const markdown = report?.report_markdown?.trim() || "";
  const status = report?.status;
  const submissionNotesText = getSubmissionNotes(report?.approval_decision_json);
  const canSubmitReview = Boolean(report && status === "DRAFT" && onSubmitReview);
  const canApproveOrReject = Boolean(report && status === "UNDER_REVIEW");
  const isSubmitBusy = actionLoading === "submit-review";
  const isApproveBusy = actionLoading === "approve";
  const isRejectBusy = actionLoading === "reject";
  const isPdfBusy = pdfDownloading;

  const handleSubmitReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onSubmitReview) return;
    try {
      await onSubmitReview({
        submitted_by: submittedBy.trim(),
        submission_notes: submissionNotes.trim() || null,
      });
      setSubmitOpen(false);
    } catch {
      return;
    }
  };

  const handleApprove = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onApprove) return;
    try {
      await onApprove({
        reviewed_by: reviewedBy.trim(),
        reviewer_comments: approveComments.trim(),
      });
      setApproveOpen(false);
    } catch {
      return;
    }
  };

  const handleReject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onReject) return;
    try {
      await onReject({
        reviewed_by: reviewedBy.trim(),
        reviewer_comments: rejectComments.trim(),
      });
      setRejectOpen(false);
    } catch {
      return;
    }
  };

  const handleDownloadPdf = async () => {
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Audit review PDF download failed.");
    } finally {
      setPdfDownloading(false);
    }
  };

  return (
    <>
      <section id="audit-review-report-section" className="rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Audit review report">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 text-violet-700">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900">Audit Review Report</h3>
                {report ? (
                  <Badge variant="outline" className={getReportStatusBadgeClass(report.status)}>
                    {formatLabel(report.status)}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {report ? `Generated ${formatDateTime(report.created_dt)}` : "Draft report becomes available after report generation."}
              </p>
              {report?.report_id ? (
                <p className="mt-1 max-w-full truncate font-mono text-[11px] text-slate-400" title={report.report_id}>
                  Report ID {report.report_id}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {canSubmitReview ? (
              <Button type="button" size="sm" onClick={() => setSubmitOpen(true)} disabled={loading || Boolean(actionLoading)}>
                {isSubmitBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Submit for QA Review
              </Button>
            ) : null}
            {canApproveOrReject && onApprove ? (
              <Button type="button" size="sm" onClick={() => setApproveOpen(true)} disabled={loading || Boolean(actionLoading)}>
                {isApproveBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Approve
              </Button>
            ) : null}
            {canApproveOrReject && onReject ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setRejectOpen(true)} disabled={loading || Boolean(actionLoading)}>
                {isRejectBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Reject
              </Button>
            ) : null}
            {status === "APPROVED" ? (
              <Badge variant="outline" className="h-9 border-emerald-200 bg-emerald-50 px-3 text-emerald-700">
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                Approved
              </Badge>
            ) : null}
            {status === "REJECTED" ? (
              <Badge variant="outline" className="h-9 border-red-200 bg-red-50 px-3 text-red-700">
                <XCircle className="mr-1 h-3.5 w-3.5" />
                Rejected
              </Badge>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={handleDownloadPdf} disabled={!report || loading || isPdfBusy}>
              {isPdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {getPdfButtonLabel(status)}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setFullOpen(true)} disabled={!report || loading}>
              <Eye className="h-4 w-4" />
              View Full Report
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={!onRefresh || loading || refreshing}>
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh Report
            </Button>
            <span title="Regeneration will be enabled when backend support is available.">
              <Button type="button" variant="outline" size="sm" disabled>
                <RotateCw className="h-4 w-4" />
                Regenerate Report
              </Button>
            </span>
          </div>
        </div>

        <div className="bg-slate-50/70 p-4">
          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
              Loading audit review report...
            </div>
          ) : !report ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
              <h4 className="text-sm font-semibold text-slate-900">No report generated yet</h4>
              <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Generate a draft report after analysis to preview the compliance narrative, score summary, and review findings.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
                <MetadataItem label="Submitted by" value={report.submitted_by} />
                <MetadataItem label="Submitted date" value={formatDateTime(report.submitted_dt)} />
                <MetadataItem label="Reviewed by" value={report.reviewed_by} />
                <MetadataItem label="Reviewed date" value={formatDateTime(report.reviewed_dt)} />
                <div className="md:col-span-2">
                  <MetadataItem label="Submission notes" value={submissionNotesText} />
                </div>
                <div className="md:col-span-2">
                  <MetadataItem label="Reviewer comments" value={report.reviewer_comments} />
                </div>
              </div>
              {showRelatedPanels ? (
                <>
                  <AuditReviewNotificationsPanel
                    report={report}
                    defaultActor={defaultNotificationActor}
                    onNotificationsChanged={onNotificationsChanged}
                  />
                  <AuditReviewAiSummaryPanel report={report} defaultActor={defaultNotificationActor} />
                </>
              ) : null}
              <div className="mx-auto max-h-[36rem] overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <MarkdownPreview markdown={markdown} />
              </div>
            </div>
          )}
        </div>
      </section>

      <Dialog open={fullOpen} onOpenChange={setFullOpen}>
        <DialogContent className="max-h-[88vh] max-w-5xl overflow-hidden p-0">
          <DialogHeader className="border-b border-slate-200 bg-slate-50 px-6 py-5 text-left">
            <DialogTitle>Audit Review Report</DialogTitle>
            <DialogDescription className="mt-1 block text-sm text-slate-600">
              {report ? `Report ${report.report_id}` : "No report selected."}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto bg-slate-50/70 p-6">
            <div className="mx-auto max-w-4xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
              <MarkdownPreview markdown={markdown} />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Submit for QA Review</DialogTitle>
            <DialogDescription>Submit draft report for QA review.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmitReview}>
            <Input
              label="Submitted by"
              value={submittedBy}
              onChange={(event) => setSubmittedBy(event.target.value)}
              placeholder="qa.requester@example.com"
              disabled={isSubmitBusy}
              required
            />
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="audit-review-submission-notes">
                Submission notes
              </label>
              <Textarea
                id="audit-review-submission-notes"
                value={submissionNotes}
                onChange={(event) => setSubmissionNotes(event.target.value)}
                placeholder="Please review the draft audit trail report."
                disabled={isSubmitBusy}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSubmitOpen(false)} disabled={isSubmitBusy}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitBusy || !submittedBy.trim()}>
                {isSubmitBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Submit
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Approve Report</DialogTitle>
            <DialogDescription>Approve audit review report.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleApprove}>
            <Input
              label="Reviewed by"
              value={reviewedBy}
              onChange={(event) => setReviewedBy(event.target.value)}
              placeholder="qa.manager@example.com"
              disabled={isApproveBusy}
              required
            />
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="audit-review-approve-comments">
                Reviewer comments
              </label>
              <Textarea
                id="audit-review-approve-comments"
                value={approveComments}
                onChange={(event) => setApproveComments(event.target.value)}
                placeholder="Reviewed and approved. Minor findings accepted with follow-up action."
                disabled={isApproveBusy}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setApproveOpen(false)} disabled={isApproveBusy}>
                Cancel
              </Button>
              <Button type="submit" disabled={isApproveBusy || !reviewedBy.trim() || !approveComments.trim()}>
                {isApproveBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Approve
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Reject Report</DialogTitle>
            <DialogDescription>Reject audit review report.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleReject}>
            <Input
              label="Reviewed by"
              value={reviewedBy}
              onChange={(event) => setReviewedBy(event.target.value)}
              placeholder="qa.manager@example.com"
              disabled={isRejectBusy}
              required
            />
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="audit-review-reject-comments">
                Reviewer comments
              </label>
              <Textarea
                id="audit-review-reject-comments"
                value={rejectComments}
                onChange={(event) => setRejectComments(event.target.value)}
                placeholder="Rejected. Missing justification for off-hours activities."
                disabled={isRejectBusy}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRejectOpen(false)} disabled={isRejectBusy}>
                Cancel
              </Button>
              <Button type="submit" variant="outline" disabled={isRejectBusy || !reviewedBy.trim() || !rejectComments.trim()}>
                {isRejectBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Reject
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
