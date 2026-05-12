import React from "react";
import { Brain, BellRing, CheckCircle2, FileText, History, ListChecks, Rows3 } from "lucide-react";

import {
  AuditReviewFinding,
  AuditReviewJobDetail,
  AuditReviewJobListItem,
  AuditReviewReportDetail,
  AuditReviewReportListItem,
  AuditReviewReportReviewDecisionPayload,
  AuditReviewReportSubmitReviewPayload,
  AuditReviewScheduleRun,
  AuditReviewScore,
} from "../../../services/audit-review.service";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { AuditReviewAiSummaryPanel } from "./AuditReviewAiSummaryPanel";
import { AuditReviewApprovalPanel } from "./AuditReviewApprovalPanel";
import { AuditReviewFindingsTable } from "./AuditReviewFindingsTable";
import { AuditReviewHistoryPanel } from "./AuditReviewHistoryPanel";
import { AuditReviewNotificationsPanel } from "./AuditReviewNotificationsPanel";
import { AuditReviewOverviewPanel } from "./AuditReviewOverviewPanel";
import { AuditReviewReportView } from "./AuditReviewReportView";
import {
  AuditReviewUiAction,
  AuditReviewUiActionKey,
} from "./auditReviewUi.shared";

export type AuditReviewWorkspaceTab =
  | "overview"
  | "findings"
  | "report"
  | "approval"
  | "notifications"
  | "ai-summary"
  | "history";

interface AuditReviewTabsProps {
  activeTab: AuditReviewWorkspaceTab;
  onTabChange: (tab: AuditReviewWorkspaceTab) => void;
  job: AuditReviewJobDetail | null;
  jobs: AuditReviewJobListItem[];
  selectedJobId: string | null;
  report: AuditReviewReportDetail | null;
  reports: AuditReviewReportListItem[];
  findings: AuditReviewFinding[];
  scores: AuditReviewScore[];
  scheduleRuns: AuditReviewScheduleRun[];
  severityCounts: {
    high: number;
    medium: number;
    low: number;
  };
  totalFindings: number;
  refreshing: boolean;
  reportAction: "submit-review" | "approve" | "reject" | null;
  approvalRequest?: {
    action: "submit" | "decision" | null;
    token: number;
  };
  nextAction: AuditReviewUiAction;
  defaultActor?: string | null;
  onAction: (action: AuditReviewUiActionKey) => void;
  onSelectJob: (jobId: string) => void;
  onOpenReport: (jobId: string) => void;
  onRefresh: () => void;
  onSubmitReview: (payload: AuditReviewReportSubmitReviewPayload) => Promise<void>;
  onApprove: (payload: AuditReviewReportReviewDecisionPayload) => Promise<void>;
  onReject: (payload: AuditReviewReportReviewDecisionPayload) => Promise<void>;
}

const EmptyPanel = ({ title, description }: { title: string; description: string }) => (
  <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center shadow-sm">
    <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
    <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
  </div>
);

export function AuditReviewTabs({
  activeTab,
  onTabChange,
  job,
  jobs,
  selectedJobId,
  report,
  reports,
  findings,
  scores,
  scheduleRuns,
  severityCounts,
  totalFindings,
  refreshing,
  reportAction,
  approvalRequest,
  nextAction,
  defaultActor,
  onAction,
  onSelectJob,
  onOpenReport,
  onRefresh,
  onSubmitReview,
  onApprove,
  onReject,
}: AuditReviewTabsProps) {
  return (
    <section id="audit-review-workspace" className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm" aria-label="Audit review workspace">
      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as AuditReviewWorkspaceTab)} className="gap-4">
        <div className="overflow-x-auto">
          <TabsList className="h-auto w-max rounded-lg bg-slate-100 p-1">
            <TabsTrigger value="overview" className="rounded-md px-3 py-2 text-xs">
              <Rows3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="findings" className="rounded-md px-3 py-2 text-xs">
              <ListChecks className="h-4 w-4" />
              Findings
            </TabsTrigger>
            <TabsTrigger value="report" className="rounded-md px-3 py-2 text-xs">
              <FileText className="h-4 w-4" />
              Report
            </TabsTrigger>
            <TabsTrigger value="approval" className="rounded-md px-3 py-2 text-xs">
              <CheckCircle2 className="h-4 w-4" />
              Approval
            </TabsTrigger>
            <TabsTrigger value="notifications" className="rounded-md px-3 py-2 text-xs">
              <BellRing className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="ai-summary" className="rounded-md px-3 py-2 text-xs">
              <Brain className="h-4 w-4" />
              AI Summary
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-md px-3 py-2 text-xs">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-0">
          <AuditReviewOverviewPanel
            job={job}
            report={report}
            findings={findings}
            scores={scores}
            severityCounts={severityCounts}
            totalFindings={totalFindings}
            nextAction={nextAction}
            onAction={onAction}
          />
        </TabsContent>

        <TabsContent value="findings" className="mt-0">
          {job ? (
            <AuditReviewFindingsTable findings={findings} loading={refreshing && findings.length === 0} />
          ) : (
            <EmptyPanel
              title="Findings are not available yet"
              description="Create and analyze an audit review job before reviewing findings."
            />
          )}
        </TabsContent>

        <TabsContent value="report" className="mt-0">
          <AuditReviewReportView
            report={report}
            loading={refreshing && Boolean(job?.latest_report_id) && !report}
            refreshing={refreshing}
            onRefresh={onRefresh}
            showRelatedPanels={false}
          />
        </TabsContent>

        <TabsContent value="approval" className="mt-0">
          <AuditReviewApprovalPanel
            report={report}
            actionLoading={reportAction}
            defaultActor={defaultActor}
            requestedAction={approvalRequest?.action}
            requestToken={approvalRequest?.token}
            onSubmitReview={onSubmitReview}
            onApprove={onApprove}
            onReject={onReject}
          />
        </TabsContent>

        <TabsContent value="notifications" className="mt-0">
          {report ? (
            <AuditReviewNotificationsPanel
              report={report}
              defaultActor={defaultActor}
              onNotificationsChanged={onRefresh}
            />
          ) : (
            <EmptyPanel
              title="Notifications are not prepared"
              description="Generate a report before preparing stakeholder notifications."
            />
          )}
        </TabsContent>

        <TabsContent value="ai-summary" className="mt-0">
          {report ? (
            <AuditReviewAiSummaryPanel report={report} defaultActor={defaultActor} />
          ) : (
            <EmptyPanel
              title="AI summary is not available"
              description="Generate a report before requesting an AI-assisted narrative summary."
            />
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <AuditReviewHistoryPanel
            jobs={jobs}
            reports={reports}
            scheduleRuns={scheduleRuns}
            selectedJobId={selectedJobId}
            onSelectJob={onSelectJob}
            onOpenReport={onOpenReport}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}

