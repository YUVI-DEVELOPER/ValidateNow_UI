import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Modal } from "../ui/Modal";
import { LookupOption } from "../../services/lookupValue.service";
import {
  getDocumentLink,
  updateDocumentLink,
} from "../../../services/document-link.service";
import {
  buildUpdateDocumentLinkPayload,
  documentLinkToForm,
  DocumentLinkContext,
  DocumentLinkFieldErrors,
  DocumentLinkFormState,
  EMPTY_DOCUMENT_LINK_FORM,
  OMS_SOURCE_SYSTEM_FALLBACK_OPTIONS,
  formatDocumentLinkDate,
  mapDocumentLinkAxiosError,
  renderDocumentLinkFieldError,
  validateDocumentLinkForm,
} from "./documentLinkForm.shared";

interface EditDocumentLinkModalProps {
  open: boolean;
  documentLinkId: string | null;
  context: DocumentLinkContext;
  sourceSystemOptions?: LookupOption[];
  onClose: () => void;
  onUpdated: () => Promise<void> | void;
}

const DEFAULT_MODIFIED_BY = "admin";

const formatValue = (value?: string | null): string => {
  if (!value || !value.trim()) return "-";
  return value;
};

export function EditDocumentLinkModal({
  open,
  documentLinkId,
  context,
  sourceSystemOptions = [],
  onClose,
  onUpdated,
}: EditDocumentLinkModalProps) {
  const [formData, setFormData] = useState<DocumentLinkFormState>(EMPTY_DOCUMENT_LINK_FORM);
  const [initialFormData, setInitialFormData] = useState<DocumentLinkFormState>(EMPTY_DOCUMENT_LINK_FORM);
  const [fieldErrors, setFieldErrors] = useState<DocumentLinkFieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const availableSourceSystemOptions = useMemo(
    () => (sourceSystemOptions.length > 0 ? sourceSystemOptions : OMS_SOURCE_SYSTEM_FALLBACK_OPTIONS),
    [sourceSystemOptions],
  );

  useEffect(() => {
    if (!open || !documentLinkId) return;

    let cancelled = false;
    setLoading(true);
    setFieldErrors({});

    const run = async () => {
      try {
        const detail = await getDocumentLink(documentLinkId);
        if (cancelled) return;

        const nextForm = documentLinkToForm(detail);
        setFormData(nextForm);
        setInitialFormData(nextForm);
      } catch (error) {
        if (cancelled) return;
        const mapped = mapDocumentLinkAxiosError(error);
        toast.error(mapped.message);
        onClose();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [documentLinkId, onClose, open]);

  useEffect(() => {
    if (open) return;

    setFormData(EMPTY_DOCUMENT_LINK_FORM);
    setInitialFormData(EMPTY_DOCUMENT_LINK_FORM);
    setFieldErrors({});
    setLoading(false);
    setSubmitting(false);
  }, [open]);

  const updateField = <K extends keyof DocumentLinkFormState>(key: K, value: DocumentLinkFormState[K]) => {
    setFormData((previous) => ({ ...previous, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!documentLinkId || submitting) return;

    const validationErrors = validateDocumentLinkForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    const payload = buildUpdateDocumentLinkPayload(initialFormData, formData, DEFAULT_MODIFIED_BY);
    if (Object.keys(payload).length === 1 && payload.modified_by) {
      toast.message("No changes to save");
      return;
    }

    setSubmitting(true);
    setFieldErrors({});

    try {
      await updateDocumentLink(documentLinkId, payload);
      toast.success("Document link updated successfully");
      await onUpdated();
      onClose();
    } catch (error) {
      const mapped = mapDocumentLinkAxiosError(error);
      if (mapped.fieldErrors) setFieldErrors(mapped.fieldErrors);
      toast.error(mapped.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Document"
      description="Only modified fields are sent to the backend. Target context remains fixed."
      size="lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="edit-document-link-form" disabled={loading || submitting || !documentLinkId}>
            {submitting ? "Saving..." : "Save Changes"}
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="text-sm text-slate-600">Loading document link...</div>
      ) : (
        <form id="edit-document-link-form" className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
          {renderDocumentLinkFieldError(fieldErrors, "form")}

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {context.type === "asset" ? (
                <>
                  <div>
                    <p className="text-xs text-slate-500">Asset Name</p>
                    <p className="text-sm font-medium text-slate-900">{formatValue(context.assetName)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Asset Code</p>
                    <p className="text-sm font-medium text-slate-900">{formatValue(context.assetCode)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Asset Version</p>
                    <p className="text-sm font-medium text-slate-900">{formatValue(context.assetVersion)}</p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-xs text-slate-500">Asset Name</p>
                    <p className="text-sm font-medium text-slate-900">{formatValue(context.assetName)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Release Version</p>
                    <p className="text-sm font-medium text-slate-900">{formatValue(context.releaseVersion)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Release Created</p>
                    <p className="text-sm font-medium text-slate-900">{formatDocumentLinkDate(context.createdDt)}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-800">Document Info</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Source System</label>
                <select
                  className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm bg-input-background"
                  value={formData.source_system}
                  onChange={(event) => updateField("source_system", event.target.value)}
                >
                  <option value="">Select source system</option>
                  {availableSourceSystemOptions.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.value}
                    </option>
                  ))}
                </select>
                {renderDocumentLinkFieldError(fieldErrors, "source_system")}
              </div>

              <div className="space-y-1">
                <Input
                  label="External Document ID"
                  value={formData.external_document_id}
                  onChange={(event) => updateField("external_document_id", event.target.value)}
                />
                {renderDocumentLinkFieldError(fieldErrors, "external_document_id")}
              </div>

              <div className="space-y-1">
                <Input
                  label="Document Name"
                  value={formData.document_name}
                  onChange={(event) => updateField("document_name", event.target.value)}
                />
                {renderDocumentLinkFieldError(fieldErrors, "document_name")}
              </div>

              <div className="space-y-1">
                <Input
                  label="Document Version"
                  value={formData.document_version}
                  onChange={(event) => updateField("document_version", event.target.value)}
                />
                {renderDocumentLinkFieldError(fieldErrors, "document_version")}
              </div>

              <div className="space-y-1">
                <Input
                  label="Upload Date"
                  type="datetime-local"
                  value={formData.upload_dt}
                  onChange={(event) => updateField("upload_dt", event.target.value)}
                />
                {renderDocumentLinkFieldError(fieldErrors, "upload_dt")}
              </div>

              <div className="space-y-1">
                <Input
                  label="Access URL"
                  type="url"
                  value={formData.access_url}
                  onChange={(event) => updateField("access_url", event.target.value)}
                />
                {renderDocumentLinkFieldError(fieldErrors, "access_url")}
              </div>

              <div className="space-y-1 col-span-2">
                <Input
                  label="Source Reference"
                  value={formData.source_reference}
                  onChange={(event) => updateField("source_reference", event.target.value)}
                />
                {renderDocumentLinkFieldError(fieldErrors, "source_reference")}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-800">Notes</h4>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Notes</label>
              <Textarea
                rows={4}
                value={formData.notes}
                onChange={(event) => updateField("notes", event.target.value)}
                placeholder="Add optional context for this validated document link"
              />
              {renderDocumentLinkFieldError(fieldErrors, "notes")}
            </div>
          </section>
        </form>
      )}
    </Modal>
  );
}
