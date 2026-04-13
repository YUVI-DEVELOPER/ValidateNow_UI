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
} from "../../../services/document-link.service";
import { ReleaseRecord } from "../../../services/release.service";
import { AssetDocumentTable } from "./AssetDocumentTable";
import { CreateDocumentLinkModal } from "./CreateDocumentLinkModal";
import { EditDocumentLinkModal } from "./EditDocumentLinkModal";
import { DocumentLinkContext, mapDocumentLinkAxiosError } from "./documentLinkForm.shared";

interface ReleaseDocumentsModalProps {
  open: boolean;
  release: ReleaseRecord | null;
  assetName?: string | null;
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

  const loadDocuments = useCallback(async () => {
    if (!releaseId) return;

    setLoading(true);
    try {
      const data = await getReleaseDocuments(releaseId);
      setDocuments(data);
    } catch (error) {
      const mapped = mapDocumentLinkAxiosError(error);
      toast.error(mapped.message);
    } finally {
      setLoading(false);
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

          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 max-w-xs">
            <p className="text-xs text-slate-500">Linked Documents</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{documents.length}</p>
          </div>

          <AssetDocumentTable
            documents={documents}
            loading={loading}
            onEdit={(document) => setEditDocumentId(document.document_link_id)}
            onDelete={handleDeleteClick}
            sourceSystemOptions={sourceSystemOptions}
            emptyMessage="No documents linked for this release. Add the first validated document."
          />
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
