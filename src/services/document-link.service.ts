import { api } from "./api";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface DocumentLinkRecord {
  document_link_id: string;
  asset_id: string | null;
  release_id: string | null;
  source_system: string | null;
  external_document_id: string | null;
  document_name: string | null;
  document_version: string | null;
  upload_dt: string | null;
  access_url: string | null;
  source_reference: string | null;
  notes: string | null;
  created_by: string | null;
  created_dt: string | null;
  modified_by: string | null;
  modified_dt: string | null;
}

export type CreateDocumentLinkPayload = {
  source_system: string;
  external_document_id: string;
  document_name: string;
  document_version: string;
  upload_dt: string;
  access_url: string;
  created_by: string;
  source_reference?: string | null;
  notes?: string | null;
};

export type UpdateDocumentLinkPayload = {
  modified_by: string;
  source_system?: string;
  external_document_id?: string;
  document_name?: string;
  document_version?: string;
  upload_dt?: string;
  access_url?: string;
  source_reference?: string | null;
  notes?: string | null;
};

type ListResponse<T> = T[] | ApiResponse<T[]>;
type SingleResponse<T> = T | ApiResponse<T>;

const parseListResponse = <T>(payload: ListResponse<T>): T[] => {
  if (Array.isArray(payload)) return payload;
  if (!payload.success) {
    throw new Error(payload.message || "Request failed");
  }
  return payload.data ?? [];
};

const parseSingleResponse = <T>(payload: SingleResponse<T>): T => {
  if (typeof payload === "object" && payload !== null && "success" in payload) {
    const wrapped = payload as ApiResponse<T>;
    if (!wrapped.success) {
      throw new Error(wrapped.message || "Request failed");
    }
    return wrapped.data;
  }

  return payload as T;
};

const mapDocumentLinkRecord = (record: Partial<DocumentLinkRecord>): DocumentLinkRecord => ({
  document_link_id: record.document_link_id ?? "",
  asset_id: record.asset_id ?? null,
  release_id: record.release_id ?? null,
  source_system: record.source_system ?? null,
  external_document_id: record.external_document_id ?? null,
  document_name: record.document_name ?? null,
  document_version: record.document_version ?? null,
  upload_dt: record.upload_dt ?? null,
  access_url: record.access_url ?? null,
  source_reference: record.source_reference ?? null,
  notes: record.notes ?? null,
  created_by: record.created_by ?? null,
  created_dt: record.created_dt ?? null,
  modified_by: record.modified_by ?? null,
  modified_dt: record.modified_dt ?? null,
});

export const getAssetDocuments = async (assetId: string): Promise<DocumentLinkRecord[]> => {
  const response = await api.get<ListResponse<DocumentLinkRecord>>(`/asset/${assetId}/documents`);
  return parseListResponse(response.data).map(mapDocumentLinkRecord);
};

export const createAssetDocument = async (
  assetId: string,
  payload: CreateDocumentLinkPayload,
): Promise<DocumentLinkRecord> => {
  const response = await api.post<SingleResponse<DocumentLinkRecord>>(`/asset/${assetId}/documents`, payload);
  return mapDocumentLinkRecord(parseSingleResponse(response.data));
};

export const getReleaseDocuments = async (releaseId: string): Promise<DocumentLinkRecord[]> => {
  const response = await api.get<ListResponse<DocumentLinkRecord>>(`/release/${releaseId}/documents`);
  return parseListResponse(response.data).map(mapDocumentLinkRecord);
};

export const createReleaseDocument = async (
  releaseId: string,
  payload: CreateDocumentLinkPayload,
): Promise<DocumentLinkRecord> => {
  const response = await api.post<SingleResponse<DocumentLinkRecord>>(`/release/${releaseId}/documents`, payload);
  return mapDocumentLinkRecord(parseSingleResponse(response.data));
};

export const getDocumentLink = async (documentLinkId: string): Promise<DocumentLinkRecord> => {
  const response = await api.get<SingleResponse<DocumentLinkRecord>>(`/document-link/${documentLinkId}`);
  return mapDocumentLinkRecord(parseSingleResponse(response.data));
};

export const updateDocumentLink = async (
  documentLinkId: string,
  payload: UpdateDocumentLinkPayload,
): Promise<DocumentLinkRecord> => {
  const response = await api.put<SingleResponse<DocumentLinkRecord>>(`/document-link/${documentLinkId}`, payload);
  return mapDocumentLinkRecord(parseSingleResponse(response.data));
};

export const deleteDocumentLink = async (documentLinkId: string): Promise<void> => {
  const response = await api.delete<SingleResponse<null>>(`/document-link/${documentLinkId}`);
  parseSingleResponse(response.data);
};
