import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  AuthoredDocumentRecord,
  deleteAuthoredDocument,
  getAssetAuthoredDocuments,
  getReleaseAuthoredDocuments,
} from "../../../services/authored-document.service";
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
import { AuthoredDocumentEditorModal } from "./AuthoredDocumentEditorModal";
import { AuthoredDocumentTable } from "./AuthoredDocumentTable";
import { AuthoredDocumentContext, mapAuthoredDocumentAxiosError } from "./authoredDocumentForm.shared";

interface AuthoredDocumentPanelProps {
  enabled: boolean;
  context: AuthoredDocumentContext;
  title?: string;
  description?: string;
  emptyMessage?: string;
}

const formatValue = (value?: string | null): string => {
  if (!value || !value.trim()) return "-";
  return value;
};

export function AuthoredDocumentPanel({
  enabled,
  context,
  title = "Authored Documents",
  description = "Application-owned authored URS documents with deterministic or AI-assisted draft generation, controlled review workflow, and approved-document publishing to Veeva.",
  emptyMessage,
}: AuthoredDocumentPanelProps) {
  const [documents, setDocuments] = useState<AuthoredDocumentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<AuthoredDocumentRecord | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadDocuments = useCallback(async () => {
    const targetId = context.type === "asset" ? context.assetId : context.releaseId;
    if (!targetId) return;

    setLoading(true);
    try {
      const data =
        context.type === "asset"
          ? await getAssetAuthoredDocuments(targetId)
          : await getReleaseAuthoredDocuments(targetId);
      setDocuments(data);
    } catch (error) {
      const mapped = mapAuthoredDocumentAxiosError(error);
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
  }, [enabled]);

  const openCreate = () => {
    setEditingDocumentId(null);
    setEditorOpen(true);
  };

  const openEdit = (document: AuthoredDocumentRecord) => {
    setEditingDocumentId(document.authored_document_id);
    setEditorOpen(true);
  };

  const handleDelete = async () => {
    if (!documentToDelete) return;

    setDeleting(true);
    try {
      await deleteAuthoredDocument(documentToDelete.authored_document_id);
      toast.success("Authored document deleted successfully");
      await loadDocuments();
    } catch (error) {
      const mapped = mapAuthoredDocumentAxiosError(error);
      toast.error(mapped.message);
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
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
                    {context.type === "release" ? "Release-linked URS workflow" : "Asset-linked URS workflow"}
                  </p>
                </div>
              </div>
            </div>

            <Button type="button" size="sm" onClick={openCreate} disabled={!enabled}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New URS Draft
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 max-w-xs">
          <p className="text-xs text-slate-500">Authored Documents</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{documents.length}</p>
        </div>

        <AuthoredDocumentTable
          documents={documents}
          loading={loading}
          onOpen={openEdit}
          onDelete={(document) => {
            setDocumentToDelete(document);
            setDeleteDialogOpen(true);
          }}
          emptyMessage={emptyMessage}
        />
      </div>

      <AuthoredDocumentEditorModal
        open={enabled && editorOpen}
        context={context}
        authoredDocumentId={editingDocumentId}
        onClose={() => {
          setEditorOpen(false);
          setEditingDocumentId(null);
        }}
        onSaved={loadDocuments}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Authored Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{documentToDelete?.title}"? This action cannot be undone.
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
