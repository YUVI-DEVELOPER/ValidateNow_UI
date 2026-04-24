import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/button";
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
import { LookupOption } from "../../services/lookupValue.service";
import {
  deleteDocumentLink,
  DocumentLinkRecord,
  getReleaseDocuments,
  reprocessDocumentVectorization,
} from "../../../services/document-link.service";
import { ReleaseRecord } from "../../../services/release.service";
import { SupplierRecord } from "../../../services/supplier.service";
import { AuthoredDocumentPanel } from "./AuthoredDocumentPanel";
import { AssetDocumentTable } from "./AssetDocumentTable";
import { CreateDocumentLinkModal } from "./CreateDocumentLinkModal";
import { EditDocumentLinkModal } from "./EditDocumentLinkModal";
import {
  DocumentLinkContext,
  isDocumentVectorizationActive,
  mapDocumentLinkAxiosError,
} from "./documentLinkForm.shared";
import { QualificationDocumentPanel } from "./QualificationDocumentPanel";

interface ReleaseDocumentsModalProps {
  open: boolean;
  release: ReleaseRecord | null;
  assetName?: string | null;
  assetCode?: string | null;
  suppliers: SupplierRecord[];
  sourceSystemOptions?: LookupOption[];
  onClose: () => void;
}

const formatValue = (value?: string | null): string => {
  if (!value || !value.trim()) return "-";
  return value;
};

const formatDate = (value?: string | null): string => {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

export function ReleaseDocumentsModal({
  open,
  release,
  assetName,
  assetCode,
  suppliers,
  sourceSystemOptions = [],
  onClose,
}: ReleaseDocumentsModalProps) {
  const [documents, setDocuments] = useState<DocumentLinkRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editDocumentId, setEditDocumentId] = useState<string | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<DocumentLinkRecord | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const releaseId = release?.release_id ?? null;
  const context: DocumentLinkContext = useMemo(
    () => ({
      type: "release",
      releaseId,
      assetName,
      releaseVersion: release?.version ?? null,
      createdDt: release?.created_dt ?? null,
      endDt: release?.end_dt ?? null,
    }),
    [assetName, release?.created_dt, release?.end_dt, release?.version, releaseId],
  );

  const loadDocuments = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!releaseId) return;

    if (!options.silent) {
      setLoading(true);
    }
    try {
      const data = await getReleaseDocuments(releaseId);
      setDocuments(data);
    } catch (error) {
      if (options.silent) {
        console.error("Failed to refresh release document vectorization status:", error);
      } else {
        const mapped = mapDocumentLinkAxiosError(error);
        toast.error(mapped.message);
      }
    } finally {
      if (!options.silent) {
        setLoading(false);
      }
    }
  }, [releaseId]);

  useEffect(() => {
    if (!open || !releaseId) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    void loadDocuments();
  }, [loadDocuments, open, releaseId]);

  const hasActiveDocumentVectorization = useMemo(
    () => documents.some(isDocumentVectorizationActive),
    [documents],
  );

  useEffect(() => {
    if (!open || !releaseId || !hasActiveDocumentVectorization) return;

    const intervalId = window.setInterval(() => {
      void loadDocuments({ silent: true });
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [hasActiveDocumentVectorization, loadDocuments, open, releaseId]);

  useEffect(() => {
    if (open) return;

    setCreateOpen(false);
    setEditDocumentId(null);
    setDocumentToDelete(null);
    setDeleteDialogOpen(false);
    setDeleting(false);
  }, [open]);

  const handleDeleteClick = (document: DocumentLinkRecord) => {
    setDocumentToDelete(document);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!documentToDelete) return;

    setDeleting(true);
    try {
      await deleteDocumentLink(documentToDelete.document_link_id);
      toast.success("Document link deleted successfully");
      await loadDocuments();
    } catch (error) {
      const mapped = mapDocumentLinkAxiosError(error);
      toast.error(mapped.message);
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    }
  };

  const handleReprocessDocument = async (document: DocumentLinkRecord) => {
    try {
      await reprocessDocumentVectorization(document.document_link_id);
      toast.success("Document vectorization queued");
      await loadDocuments({ silent: true });
    } catch (error) {
      const mapped = mapDocumentLinkAxiosError(error);
      toast.error(mapped.message);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Release Documents"
        description="Manage validated documents linked to this release."
        size="xl"
        footer={
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-4">
                <div>
                  <p className="text-xs text-slate-500">Asset Name</p>
                  <p className="text-sm font-medium text-slate-900">{formatValue(assetName)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Release Version</p>
                  <p className="text-sm font-medium text-slate-900">{formatValue(release?.version)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Created Date</p>
                  <p className="text-sm font-medium text-slate-900">{formatDate(release?.created_dt)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">End Date</p>
                  <p className="text-sm font-medium text-slate-900">{formatDate(release?.end_dt)}</p>
                </div>
              </div>

              <Button type="button" size="sm" onClick={() => setCreateOpen(true)} disabled={!releaseId}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Document
              </Button>
            </div>
          </div>

          <AuthoredDocumentPanel
            enabled={open && Boolean(releaseId)}
            context={{
              type: "release",
              releaseId,
              assetName,
              assetCode,
              releaseVersion: release?.version ?? null,
            }}
            description="Create and route release-linked URS documents through deterministic or AI-assisted draft generation, then publish approved URS documents to Veeva while keeping external linked-document references intact."
            emptyMessage="No authored documents created for this release yet. Start with a URS draft."
          />

          <QualificationDocumentPanel
            enabled={open && Boolean(releaseId)}
            context={{
              type: "release",
              assetId: release?.asset_id ?? null,
              releaseId,
              assetName,
              assetCode,
              releaseVersion: release?.version ?? null,
            }}
            suppliers={suppliers}
            sourceSystemOptions={sourceSystemOptions}
            description="Manage supplier-submitted IQ/OQ/PQ evidence specific to this release, including supplier linkage, controlled review status, and audit history."
            emptyMessage="No qualification documents linked for this release yet. Register the first supplier IQ/OQ/PQ record."
          />

          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Linked Documents</p>
              <p className="mt-1 text-xs text-slate-500">
                External validated document references for this release remain managed here.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 max-w-xs">
              <p className="text-xs text-slate-500">Linked Documents</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{documents.length}</p>
            </div>

            <AssetDocumentTable
              documents={documents}
              loading={loading}
              onEdit={(document) => setEditDocumentId(document.document_link_id)}
              onDelete={handleDeleteClick}
              onReprocess={(document) => void handleReprocessDocument(document)}
              sourceSystemOptions={sourceSystemOptions}
              emptyMessage="No documents linked for this release. Add the first validated document."
            />
          </div>
        </div>
      </Modal>

      <CreateDocumentLinkModal
        open={open && createOpen}
        context={context}
        sourceSystemOptions={sourceSystemOptions}
        onClose={() => setCreateOpen(false)}
        onCreated={async () => {
          await loadDocuments();
          setCreateOpen(false);
        }}
      />

      <EditDocumentLinkModal
        open={open && Boolean(editDocumentId)}
        documentLinkId={editDocumentId}
        context={context}
        sourceSystemOptions={sourceSystemOptions}
        onClose={() => setEditDocumentId(null)}
        onUpdated={async () => {
          await loadDocuments();
          setEditDocumentId(null);
        }}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document Link</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete document "{documentToDelete?.document_name}" from this release?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmDelete();
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
