import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarDays, ClipboardCheck, Loader2, ShieldCheck } from "lucide-react";

import { AuditReviewJobCreatePayload } from "../../../services/audit-review.service";
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

interface AuditReviewRunDialogProps {
  open: boolean;
  assetName?: string | null;
  assetCode?: string | null;
  defaultRequestedBy?: string | null;
  creating: boolean;
  onClose: () => void;
  onCreate: (payload: AuditReviewJobCreatePayload) => Promise<void>;
}

interface FormState {
  reviewStart: string;
  reviewEnd: string;
  auditTrailType: string;
  veevaInstanceName: string;
  veevaAppName: string;
  requestedBy: string;
}

const toDatetimeLocalValue = (date: Date): string => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
};

const VEEVA_AUDIT_INGESTION_LAG_MS = 6 * 60 * 60 * 1000;

const buildDefaultReviewWindow = (): Pick<FormState, "reviewStart" | "reviewEnd"> => {
  const now = new Date();
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() - 1);
  end.setHours(23, 59, 0, 0);

  if (now.getTime() - end.getTime() < VEEVA_AUDIT_INGESTION_LAG_MS) {
    end.setDate(end.getDate() - 1);
  }

  const start = new Date(end.getFullYear(), end.getMonth(), 1, 0, 0, 0, 0);

  return {
    reviewStart: toDatetimeLocalValue(start),
    reviewEnd: toDatetimeLocalValue(end),
  };
};

const buildDefaultState = (requestedBy?: string | null): FormState => {
  const reviewWindow = buildDefaultReviewWindow();

  return {
    reviewStart: reviewWindow.reviewStart,
    reviewEnd: reviewWindow.reviewEnd,
    auditTrailType: "login_audit_trail",
    veevaInstanceName: "Veeva Quality Vault",
    veevaAppName: "QualityDocs",
    requestedBy: requestedBy?.trim() || "",
  };
};

const toUtcIso = (value: string): string => new Date(value).toISOString();

export function AuditReviewRunDialog({
  open,
  assetName,
  assetCode,
  defaultRequestedBy,
  creating,
  onClose,
  onCreate,
}: AuditReviewRunDialogProps) {
  const defaultState = useMemo(() => buildDefaultState(defaultRequestedBy), [defaultRequestedBy]);
  const [form, setForm] = useState<FormState>(defaultState);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    if (!open) return;
    setForm(buildDefaultState(defaultRequestedBy));
    setErrors({});
  }, [defaultRequestedBy, open]);

  const updateField = (field: keyof FormState, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  };

  const validate = (): boolean => {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    const startDate = form.reviewStart ? new Date(form.reviewStart) : null;
    const endDate = form.reviewEnd ? new Date(form.reviewEnd) : null;

    if (!form.reviewStart) nextErrors.reviewStart = "Review start date is required.";
    if (!form.reviewEnd) nextErrors.reviewEnd = "Review end date is required.";
    if (!form.auditTrailType.trim()) nextErrors.auditTrailType = "Audit trail type is required.";
    if (startDate && Number.isNaN(startDate.getTime())) nextErrors.reviewStart = "Enter a valid start date.";
    if (endDate && Number.isNaN(endDate.getTime())) nextErrors.reviewEnd = "Enter a valid end date.";
    if (startDate && endDate && endDate <= startDate) {
      nextErrors.reviewEnd = "Review end must be after the start date.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;

    await onCreate({
      review_start_dt: toUtcIso(form.reviewStart),
      review_end_dt: toUtcIso(form.reviewEnd),
      audit_trail_type: form.auditTrailType.trim(),
      veeva_instance_name: form.veevaInstanceName.trim() || null,
      veeva_app_name: form.veevaAppName.trim() || null,
      requested_by: form.requestedBy.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen && !creating ? onClose() : undefined)}>
      <DialogContent className="max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b border-slate-200 bg-slate-50 px-6 py-5 text-left">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-slate-950">Run Audit Review</DialogTitle>
              <DialogDescription className="mt-1 block text-sm leading-5 text-slate-600">
                Create a periodic Veeva audit trail review job for {assetName || assetCode || "this asset"}.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5 px-6 py-5">
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Asset</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{assetName || "-"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Asset ID</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{assetCode || "-"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Default Source</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">Veeva Quality Vault</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Input
                  label="Review start"
                  type="datetime-local"
                  value={form.reviewStart}
                  onChange={(event) => updateField("reviewStart", event.target.value)}
                  iconLeft={<CalendarDays className="h-4 w-4" />}
                  aria-invalid={Boolean(errors.reviewStart)}
                  disabled={creating}
                />
                {errors.reviewStart ? <p className="mt-1 text-xs text-red-600">{errors.reviewStart}</p> : null}
              </div>
              <div>
                <Input
                  label="Review end"
                  type="datetime-local"
                  value={form.reviewEnd}
                  onChange={(event) => updateField("reviewEnd", event.target.value)}
                  iconLeft={<CalendarDays className="h-4 w-4" />}
                  aria-invalid={Boolean(errors.reviewEnd)}
                  disabled={creating}
                />
                {errors.reviewEnd ? <p className="mt-1 text-xs text-red-600">{errors.reviewEnd}</p> : null}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Input
                  label="Audit trail type"
                  value={form.auditTrailType}
                  onChange={(event) => updateField("auditTrailType", event.target.value)}
                  iconLeft={<ClipboardCheck className="h-4 w-4" />}
                  aria-invalid={Boolean(errors.auditTrailType)}
                  disabled={creating}
                />
                <p className="mt-1 text-xs text-slate-500">Default: login audit trail.</p>
                {errors.auditTrailType ? <p className="mt-1 text-xs text-red-600">{errors.auditTrailType}</p> : null}
              </div>
              <Input
                label="Requested by"
                value={form.requestedBy}
                onChange={(event) => updateField("requestedBy", event.target.value)}
                placeholder="Compliance reviewer"
                disabled={creating}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Veeva instance name"
                value={form.veevaInstanceName}
                onChange={(event) => updateField("veevaInstanceName", event.target.value)}
                disabled={creating}
              />
              <Input
                label="Veeva app name"
                value={form.veevaAppName}
                onChange={(event) => updateField("veevaAppName", event.target.value)}
                disabled={creating}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-slate-200 bg-slate-50 px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={creating}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {creating ? "Creating..." : "Create Review Job"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
