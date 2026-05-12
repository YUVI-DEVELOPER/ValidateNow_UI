import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileText, Loader2, Send, XCircle } from "lucide-react";

import {
  AuditReviewReportDetail,
  AuditReviewReportReviewDecisionPayload,
  AuditReviewReportSubmitReviewPayload,
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
import {
  formatAuditReviewDateTime,
  formatAuditReviewLabel,
  getAuditReviewReportStatusBadgeClass,
} from "./auditReviewUi.shared";

interface AuditReviewApprovalPanelProps {
  report: AuditReviewReportDetail | null;
  actionLoading?: "submit-review" | "approve" | "reject" | null;
  defaultActor?: string | null;
  requestedAction?: "submit" | "decision" | null;
  requestToken?: number;
  onSubmitReview?: (payload: AuditReviewReportSubmitReviewPayload) => Promise<void>;
  onApprove?: (payload: AuditReviewReportReviewDecisionPayload) => Promise<void>;
  onReject?: (payload: AuditReviewReportReviewDecisionPayload) => Promise<void>;
}

const getSubmissionNotes = (approvalDecision?: Record<string, unknown> | null): string | null => {
  const submission = approvalDecision?.submission;
  if (submission && typeof submission === "object" && !Array.isArray(submission)) {
    const notes = (submission as Record<string, unknown>).submission_notes;
    if (typeof notes === "string" && notes.trim()) return notes;
  }

  const fallback = approvalDecision?.submission_notes;
  return typeof fallback === "string" && fallback.trim() ? fallback : null;
};

const getDecisionHistory = (approvalDecision?: Record<string, unknown> | null): Array<Record<string, unknown>> => {
  const history = approvalDecision?.history;
  return Array.isArray(history)
    ? history.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
};

const getHistoryActor = (entry: Record<string, unknown>): string => {
  const actor = entry.submitted_by || entry.reviewed_by || entry.actor;
  return typeof actor === "string" && actor.trim() ? actor : "-";
};

const getHistoryDate = (entry: Record<string, unknown>): string | null => {
  const value = entry.submitted_dt || entry.reviewed_dt || entry.created_dt;
  return typeof value === "string" ? value : null;
};

const MetadataItem = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-3">
    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 break-words text-sm font-medium text-slate-900">{value && value.trim() ? value : "-"}</p>
  </div>
);

export function AuditReviewApprovalPanel({
  report,
  actionLoading = null,
  defaultActor,
  requestedAction = null,
  requestToken = 0,
  onSubmitReview,
  onApprove,
  onReject,
}: AuditReviewApprovalPanelProps) {
  const [submitOpen, setSubmitOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [submittedBy, setSubmittedBy] = useState(report?.submitted_by || defaultActor?.trim() || "");
  const [submissionNotes, setSubmissionNotes] = useState("Please review the draft audit trail report.");
  const [reviewedBy, setReviewedBy] = useState(report?.reviewed_by || defaultActor?.trim() || "");
  const [approveComments, setApproveComments] = useState("");
  const [rejectComments, setRejectComments] = useState("");
  const submissionNotesText = getSubmissionNotes(report?.approval_decision_json);
  const decisionHistory = useMemo(() => getDecisionHistory(report?.approval_decision_json), [report?.approval_decision_json]);
  const canSubmitReview = Boolean(report && report.status === "DRAFT" && onSubmitReview);
  const canApproveOrReject = Boolean(report && report.status === "UNDER_REVIEW");
  const isSubmitBusy = actionLoading === "submit-review";
  const isApproveBusy = actionLoading === "approve";
  const isRejectBusy = actionLoading === "reject";

  useEffect(() => {
    setSubmittedBy(report?.submitted_by || defaultActor?.trim() || "");
    setReviewedBy(report?.reviewed_by || defaultActor?.trim() || "");
  }, [defaultActor, report?.report_id, report?.reviewed_by, report?.submitted_by]);

  useEffect(() => {
    if (!report || requestToken === 0) return;
    if (requestedAction === "submit" && report.status === "DRAFT") {
      setSubmitOpen(true);
    }
    if (requestedAction === "decision" && report.status === "UNDER_REVIEW") {
      setApproveOpen(true);
    }
  }, [report, requestedAction, requestToken]);

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

  return (
    <>
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Audit review approval">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900">Approval & Closure</h3>
                {report ? (
                  <Badge variant="outline" className={getAuditReviewReportStatusBadgeClass(report.status)}>
                    {formatAuditReviewLabel(report.status)}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Human QA review remains authoritative. Scheduler and AI features do not approve reports.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {canSubmitReview ? (
              <Button type="button" size="sm" onClick={() => setSubmitOpen(true)} disabled={Boolean(actionLoading)}>
                {isSubmitBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Submit for QA Review
              </Button>
            ) : null}
            {canApproveOrReject && onApprove ? (
              <Button type="button" size="sm" onClick={() => setApproveOpen(true)} disabled={Boolean(actionLoading)}>
                {isApproveBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Approve Report
              </Button>
            ) : null}
            {canApproveOrReject && onReject ? (
              <Button type="button" size="sm" variant="outline" onClick={() => setRejectOpen(true)} disabled={Boolean(actionLoading)}>
                {isRejectBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Reject Report
              </Button>
            ) : null}
          </div>
        </div>

        <div className="space-y-4 p-4">
          {!report ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
              <FileText className="mx-auto h-8 w-8 text-slate-400" />
              <h4 className="mt-3 text-sm font-semibold text-slate-900">No report is ready for approval</h4>
              <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Generate a draft audit review report before submitting it for QA review.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <MetadataItem label="Submitted by" value={report.submitted_by} />
                <MetadataItem label="Submitted date" value={formatAuditReviewDateTime(report.submitted_dt)} />
                <MetadataItem label="Reviewed by" value={report.reviewed_by} />
                <MetadataItem label="Reviewed date" value={formatAuditReviewDateTime(report.reviewed_dt)} />
                <div className="md:col-span-2">
                  <MetadataItem label="Submission notes" value={submissionNotesText} />
                </div>
                <div className="md:col-span-2">
                  <MetadataItem label="Reviewer comments" value={report.reviewer_comments} />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <h4 className="text-sm font-semibold text-slate-900">Decision History</h4>
                </div>
                <div className="divide-y divide-slate-200">
                  {decisionHistory.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-slate-500">
                      No approval decision history is available yet.
                    </div>
                  ) : (
                    decisionHistory.map((entry, index) => (
                      <div key={`${String(entry.action || "event")}-${index}`} className="grid grid-cols-1 gap-2 px-4 py-3 text-sm md:grid-cols-[12rem_1fr_12rem]">
                        <div>
                          <Badge variant="outline" className={getAuditReviewReportStatusBadgeClass(String(entry.action || ""))}>
                            {formatAuditReviewLabel(String(entry.action || "Event"))}
                          </Badge>
                        </div>
                        <div className="text-slate-700">
                          <span className="font-medium text-slate-900">{getHistoryActor(entry)}</span>
                          {typeof entry.submission_notes === "string" && entry.submission_notes ? (
                            <p className="mt-1 text-slate-600">{entry.submission_notes}</p>
                          ) : null}
                          {typeof entry.reviewer_comments === "string" && entry.reviewer_comments ? (
                            <p className="mt-1 text-slate-600">{entry.reviewer_comments}</p>
                          ) : null}
                        </div>
                        <div className="text-slate-500">{formatAuditReviewDateTime(getHistoryDate(entry))}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Submit for QA Review</DialogTitle>
            <DialogDescription>Submit the draft audit trail report for human QA review.</DialogDescription>
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
              <label className="text-sm font-medium text-slate-700" htmlFor="audit-review-approval-submission-notes">
                Submission notes
              </label>
              <Textarea
                id="audit-review-approval-submission-notes"
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
            <DialogDescription>Approve the audit review report after QA review.</DialogDescription>
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
              <label className="text-sm font-medium text-slate-700" htmlFor="audit-review-approval-comments">
                Reviewer comments
              </label>
              <Textarea
                id="audit-review-approval-comments"
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
            <DialogDescription>Reject the report and capture the QA reason.</DialogDescription>
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

