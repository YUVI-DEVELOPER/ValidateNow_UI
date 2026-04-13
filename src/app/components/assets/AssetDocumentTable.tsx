import React from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { DocumentLinkRecord } from "../../../services/document-link.service";
import { LookupOption } from "../../services/lookupValue.service";
import {
  formatDocumentLinkDate,
  formatDocumentSourceSystem,
  getSafeDocumentAccessUrl,
} from "./documentLinkForm.shared";

interface AssetDocumentTableProps {
  documents: DocumentLinkRecord[];
  loading: boolean;
  onEdit: (document: DocumentLinkRecord) => void;
  onDelete: (document: DocumentLinkRecord) => void;
  sourceSystemOptions?: LookupOption[];
  emptyMessage?: string;
}

export function AssetDocumentTable({
  documents,
  loading,
  onEdit,
  onDelete,
  sourceSystemOptions = [],
  emptyMessage = "No documents linked for this asset. Add the first validated document.",
}: AssetDocumentTableProps) {
  return (
    <div className="border rounded-lg bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="font-semibold">Document Name</TableHead>
            <TableHead className="font-semibold">Version</TableHead>
            <TableHead className="font-semibold">Source System</TableHead>
            <TableHead className="font-semibold">External Document ID</TableHead>
            <TableHead className="font-semibold">Upload Date</TableHead>
            <TableHead className="font-semibold">Access</TableHead>
            <TableHead className="font-semibold text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-slate-500">
                Loading documents...
              </TableCell>
            </TableRow>
          ) : documents.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-slate-500">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            documents.map((document) => {
              const safeAccessUrl = getSafeDocumentAccessUrl(document.access_url);
              const documentName = document.document_name?.trim() || "-";
              const externalDocumentId = document.external_document_id?.trim() || "-";
              const sourceSystemLabel = formatDocumentSourceSystem(document.source_system, sourceSystemOptions);

              return (
                <TableRow key={document.document_link_id} className="hover:bg-slate-50">
                  <TableCell className="max-w-0">
                    <div
                      className="max-w-[16rem] overflow-hidden text-ellipsis whitespace-nowrap font-medium text-slate-900"
                      title={documentName}
                    >
                      {documentName}
                    </div>
                  </TableCell>
                  <TableCell>{document.document_version || "-"}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="border-slate-200 bg-slate-50 text-slate-700"
                      title={sourceSystemLabel}
                    >
                      {sourceSystemLabel}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-0">
                    <div
                      className="max-w-[12rem] overflow-hidden text-ellipsis whitespace-nowrap text-slate-600"
                      title={externalDocumentId}
                    >
                      {externalDocumentId}
                    </div>
                  </TableCell>
                  <TableCell title={document.upload_dt ?? undefined}>
                    {formatDocumentLinkDate(document.upload_dt)}
                  </TableCell>
                  <TableCell>
                    {safeAccessUrl ? (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={safeAccessUrl} target="_blank" rel="noopener noreferrer">
                          Open
                        </a>
                      </Button>
                    ) : (
                      <span className="text-sm text-slate-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(document)}
                        title="Edit Document"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(document)}
                        title="Delete Document"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
