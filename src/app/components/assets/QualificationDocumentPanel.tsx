import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ReleaseRecord } from "../../../services/release.service";
import { SupplierRecord } from "../../../services/supplier.service";
import {
  deleteQualificationDocument,
  getAssetQualificationDocuments,
  getReleaseQualificationDocuments,
  QualificationDocumentRecord,
} from "../../../services/qualification-document.service";
import { LookupOption } from "../../services/lookupValue.service";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";
import { QualificationDocumentModal } from "./QualificationDocumentModal";
import { QualificationDocumentTable } from "./QualificationDocumentTable";
import {
  formatQualificationStatus,
  formatQualificationType,
  mapQualificationDocumentAxiosError,
  QualificationDocumentContext,
} from "./qualificationDocumentForm.shared";

interface QualificationDocumentPanelProps {
  enabled: boolean;
  context: QualificationDocumentContext;
  suppliers: SupplierRecord[];
  releaseOptions?: ReleaseRecord[];
  sourceSystemOptions?: LookupOption[];
  title?: string;
  description?: string;
  emptyMessage?: string;
}

const formatValue = (value?: string | null): string => {
  if (!value || !value.trim()) return "-";
  return value;
};

export function QualificationDocumentPanel({
  enabled,
  context,
  suppliers,
  releaseOptions = [],
  sourceSystemOptions = [],
  title = "Qualification Docs",
  description = "Supplier-submitted IQ/OQ/PQ evidence with explicit qualification type, supplier linkage, scoped asset or release context, and controlled review workflow.",
  emptyMessage = "No supplier qualification documents registered yet.",
}: QualificationDocumentPanelProps) {
  const [documents, setDocuments] = useState<QualificationDocumentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<QualificationDocumentRecord | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const loadDocuments = useCallback(async () => {
    const targetId = context.type === "asset" ? context.assetId : context.releaseId;
    if (!targetId) return;

    setLoading(true);
    try {
      const data =
        context.type === "asset"
          ? await getAssetQualificationDocuments(targetId)
          : await getReleaseQualificationDocuments(targetId);
      setDocuments(data);
    } catch (error) {
      const mapped = mapQualificationDocumentAxiosError(error);
      toast.error(mapped.message);
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    void loadDocuments();
  }, [enabled, loadDocuments]);

  useEffect(() => {
    if (enabled) return;

    setEditorOpen(false);
    setEditingDocumentId(null);
    setDocumentToDelete(null);
    setDeleteDialogOpen(false);
    setDeleting(false);
    setTypeFilter("ALL");
    setStatusFilter("ALL");
  }, [enabled]);

  const filteredDocuments = useMemo(
    () =>
      documents.filter((document) => {
        if (typeFilter !== "ALL" && document.qualification_type !== typeFilter) return false;
        if (statusFilter !== "ALL" && document.status !== statusFilter) return false;
        return true;
      }),
    [documents, statusFilter, typeFilter],
  );

  const acceptedCount = useMemo(
    () => documents.filter((document) => document.status === "ACCEPTED").length,
    [documents],
  );
  const inReviewCount = useMemo(
    () => documents.filter((document) => document.status === "IN_REVIEW").length,
    [documents],
  );

  const handleDelete = async () => {
    if (!documentToDelete) return;

    setDeleting(true);
    try {
      await deleteQualificationDocument(documentToDelete.qualification_document_id);
      toast.success("Qualification document deleted successfully");
      await loadDocuments();
    } catch (error) {
      const mapped = mapQualificationDocumentAxiosError(error);
      toast.error(mapped.message);
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    }
  };

  return (
    <>
      <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="mt-1 text-xs text-slate-500">{description}</p>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <p className="text-xs text-slate-500">Asset Name</p>
                <p className="text-sm font-medium text-slate-900">{formatValue(context.assetName)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">{context.type === "release" ? "Release Version" : "Asset ID"}</p>
                <p className="text-sm font-medium text-slate-900">
                  {formatValue(context.type === "release" ? context.releaseVersion : context.assetCode)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Context</p>
                <p className="text-sm font-medium text-slate-900">
                  {context.type === "release" ? "Release qualification workflow" : "Asset and release qualification workflow"}
                </p>
              </div>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={() => {
              setEditingDocumentId(null);
              setEditorOpen(true);
            }}
            disabled={!enabled}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Qualification Doc
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Total Docs</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{documents.length}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Accepted</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{acceptedCount}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">In Review</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{inReviewCount}</p>
          </div>
          <div className="space-y-1 rounded-lg border border-slate-200 bg-white px-4 py-3">
            <label className="text-xs text-slate-500">Filter Type</label>
            <select
              className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm bg-input-background"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="ALL">All types</option>
              <option value="IQ">{formatQualificationType("IQ")}</option>
              <option value="OQ">{formatQualificationType("OQ")}</option>
              <option value="PQ">{formatQualificationType("PQ")}</option>
            </select>
          </div>
          <div className="space-y-1 rounded-lg border border-slate-200 bg-white px-4 py-3">
            <label className="text-xs text-slate-500">Filter Status</label>
            <select
              className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm bg-input-background"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="ALL">All statuses</option>
              <option value="SUBMITTED">{formatQualificationStatus("SUBMITTED")}</option>
              <option value="IN_REVIEW">{formatQualificationStatus("IN_REVIEW")}</option>
              <option value="NEEDS_CLARIFICATION">{formatQualificationStatus("NEEDS_CLARIFICATION")}</option>
              <option value="ACCEPTED">{formatQualificationStatus("ACCEPTED")}</option>
              <option value="REJECTED">{formatQualificationStatus("REJECTED")}</option>
            </select>
          </div>
        </div>

        <QualificationDocumentTable
          documents={filteredDocuments}
          loading={loading}
          onOpen={(document) => {
            setEditingDocumentId(document.qualification_document_id);
            setEditorOpen(true);
          }}
          onDelete={(document) => {
            setDocumentToDelete(document);
            setDeleteDialogOpen(true);
          }}
          emptyMessage={emptyMessage}
        />
      </div>

      <QualificationDocumentModal
        open={enabled && editorOpen}
        context={context}
        suppliers={suppliers}
        releaseOptions={releaseOptions}
        sourceSystemOptions={sourceSystemOptions}
        qualificationDocumentId={editingDocumentId}
        onClose={() => {
          setEditorOpen(false);
          setEditingDocumentId(null);
        }}
        onSaved={loadDocuments}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Qualification Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{documentToDelete?.document_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
