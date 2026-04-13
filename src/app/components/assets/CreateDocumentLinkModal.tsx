import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Modal } from "../ui/Modal";
import { LookupOption } from "../../services/lookupValue.service";
import {
  createAssetDocument,
  createReleaseDocument,
} from "../../../services/document-link.service";
import {
  buildCreateDocumentLinkPayload,
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

interface CreateDocumentLinkModalProps {
  open: boolean;
  context: DocumentLinkContext;
  sourceSystemOptions?: LookupOption[];
  onClose: () => void;
  onCreated: () => Promise<void> | void;
}

const DEFAULT_CREATED_BY = "admin";

const formatValue = (value?: string | null): string => {
  if (!value || !value.trim()) return "-";
  return value;
};

export function CreateDocumentLinkModal({
  open,
  context,
  sourceSystemOptions = [],
  onClose,
  onCreated,
}: CreateDocumentLinkModalProps) {
  const [formData, setFormData] = useState<DocumentLinkFormState>(EMPTY_DOCUMENT_LINK_FORM);
  const [fieldErrors, setFieldErrors] = useState<DocumentLinkFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const availableSourceSystemOptions = useMemo(
    () => (sourceSystemOptions.length > 0 ? sourceSystemOptions : OMS_SOURCE_SYSTEM_FALLBACK_OPTIONS),
    [sourceSystemOptions],
  );
  const contextId = context.type === "asset" ? context.assetId : context.releaseId;

  useEffect(() => {
    if (!open) {
      setFormData(EMPTY_DOCUMENT_LINK_FORM);
      setFieldErrors({});
      setSubmitting(false);
      return;
    }

    setFormData((previous) => ({
      ...EMPTY_DOCUMENT_LINK_FORM,
      source_system: previous.source_system,
    }));
    setFieldErrors({});
  }, [open, context.type, contextId]);

  useEffect(() => {
    if (!open) return;

    if (availableSourceSystemOptions.length > 0) {
      setFormData((previous) => ({
        ...previous,
        source_system:
          previous.source_system || availableSourceSystemOptions[0]?.code || EMPTY_DOCUMENT_LINK_FORM.source_system,
      }));
    }
  }, [availableSourceSystemOptions, open]);

  const updateField = <K extends keyof DocumentLinkFormState>(key: K, value: DocumentLinkFormState[K]) => {
    setFormData((previous) => ({ ...previous, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!contextId || submitting) return;

    const validationErrors = validateDocumentLinkForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setFieldErrors({});

    try {
      const payload = buildCreateDocumentLinkPayload(formData, DEFAULT_CREATED_BY);
      if (context.type === "asset") {
        await createAssetDocument(contextId, payload);
      } else {
        await createReleaseDocument(contextId, payload);
      }

      toast.success("Document linked successfully");
      await onCreated();
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
      title="Add Document"
      description={
        context.type === "asset"
          ? "Link a validated document to the selected asset."
          : "Link a validated document to the selected release."
      }
      size="lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="create-document-link-form" disabled={submitting || !contextId}>
            {submitting ? "Linking..." : "Link Document"}
          </Button>
        </>
      }
    >
      <form id="create-document-link-form" className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
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
                required
              />
              {renderDocumentLinkFieldError(fieldErrors, "external_document_id")}
            </div>

            <div className="space-y-1">
              <Input
                label="Document Name"
                value={formData.document_name}
                onChange={(event) => updateField("document_name", event.target.value)}
                required
              />
              {renderDocumentLinkFieldError(fieldErrors, "document_name")}
            </div>

            <div className="space-y-1">
              <Input
                label="Document Version"
                value={formData.document_version}
                onChange={(event) => updateField("document_version", event.target.value)}
                required
              />
              {renderDocumentLinkFieldError(fieldErrors, "document_version")}
            </div>

            <div className="space-y-1">
              <Input
                label="Upload Date"
                type="datetime-local"
                value={formData.upload_dt}
                onChange={(event) => updateField("upload_dt", event.target.value)}
                required
              />
              {renderDocumentLinkFieldError(fieldErrors, "upload_dt")}
            </div>

            <div className="space-y-1">
              <Input
                label="Access URL"
                type="url"
                value={formData.access_url}
                onChange={(event) => updateField("access_url", event.target.value)}
                required
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
    </Modal>
  );
}
