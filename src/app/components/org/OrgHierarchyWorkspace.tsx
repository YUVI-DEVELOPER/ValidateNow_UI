import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ChevronRight,
  CircleDot,
  GitBranch,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { LookupOption, getLookupOptionsByMasterCode } from "../../services/lookupValue.service";
import {
  OrgNode,
  OrgPayload,
  createOrg,
  deleteOrg,
  getOrgById,
  getOrgHealth,
  getOrgTree,
  searchOrg,
  updateOrg,
} from "../../../services/org.service";
import { OrgRoleAssignmentsPanel } from "./OrgRoleAssignmentsPanel";
import { buildLookupLabelMap, getLookupLabel } from "./orgUiLabels";
import { Button } from "../ui/Button";
import { Card, CardBody, CardFooter, CardHeader } from "../ui/Card";
import { Input, SearchInput } from "../ui/Input";
import { ConfirmDialog, Modal } from "../ui/Modal";
import { cn } from "../ui/utils";

interface OrgHierarchyWorkspaceProps {
  defaultUser: string;
  onSummaryChange?: (summary: {
    total: number;
    active: number;
    leaders: number;
    topLevel: number;
  }) => void;
}

interface FieldErrors {
  [key: string]: string;
}

interface OrgFormState {
  name: string;
  code: string;
  type: string;
  status: string;
  parent_id: string;
  address: string;
  city: string;
  state: string;
  country: string;
  lat: string;
  long: string;
}

interface ParentOption {
  id: string;
  name: string;
  type: string;
  status: string;
  level: number;
}

type OrgFormMode = "createRoot" | "addChild" | "editNode";

const LEGACY_ORG_TYPES = ["GROUP", "COMPANY", "DIVISION", "PLANT", "SECTION", "DEPARTMENT"] as const;
const ROOT_TYPE = "GROUP";
const CODE_PATTERN = /^[A-Z0-9-]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LEGACY_STATUS_OPTIONS = [
  { code: "ACTIVE", label: "Active" },
  { code: "INACTIVE", label: "Inactive" },
  { code: "MERGED", label: "Merged" },
  { code: "CLOSED", label: "Closed" },
  { code: "UNDER_CONSTRUCTION", label: "Under Construction" },
] as const;
const NEXT_TYPE_BY_PARENT = LEGACY_ORG_TYPES.reduce<Record<string, string | null>>((accumulator, type, index) => {
  accumulator[type] = LEGACY_ORG_TYPES[index + 1] ?? null;
  return accumulator;
}, {});

const EMPTY_FORM: OrgFormState = {
  name: "",
  code: "",
  type: "",
  status: "ACTIVE",
  parent_id: "",
  address: "",
  city: "",
  state: "",
  country: "",
  lat: "",
  long: "",
};

const typeColors: Record<string, string> = {
  GROUP: "bg-blue-100 text-blue-700 border-blue-200",
  COMPANY: "bg-violet-100 text-violet-700 border-violet-200",
  DIVISION: "bg-emerald-100 text-emerald-700 border-emerald-200",
  PLANT: "bg-amber-100 text-amber-700 border-amber-200",
  SECTION: "bg-rose-100 text-rose-700 border-rose-200",
  DEPARTMENT: "bg-slate-100 text-slate-700 border-slate-200",
};

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700 border-green-200",
  INACTIVE: "bg-slate-100 text-slate-700 border-slate-200",
  MERGED: "bg-violet-100 text-violet-700 border-violet-200",
  CLOSED: "bg-slate-200 text-slate-700 border-slate-300",
  UNDER_CONSTRUCTION: "bg-amber-100 text-amber-700 border-amber-200",
};

const normalizeNode = (node: OrgNode): OrgNode => ({
  ...node,
  parent_id: node.parent_id ?? null,
  type: node.type.toUpperCase(),
  status: node.status.toUpperCase(),
  children: (node.children ?? []).map(normalizeNode),
});

const formatCoord = (value?: number | null): string => {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  return String(value);
};

const flattenTree = (nodes: OrgNode[], level = 0): ParentOption[] => {
  const items: ParentOption[] = [];
  nodes.forEach((node) => {
    items.push({ id: node.id, name: node.name, type: node.type, status: node.status, level });
    items.push(...flattenTree(node.children ?? [], level + 1));
  });
  return items;
};

const buildNodeMap = (nodes: OrgNode[]): Map<string, OrgNode> => {
  const map = new Map<string, OrgNode>();
  const stack = [...nodes];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    map.set(current.id, current);
    (current.children ?? []).forEach((child) => stack.push(child));
  }
  return map;
};

const buildParentIndex = (nodes: OrgNode[]): Map<string | null, OrgNode[]> => {
  const index = new Map<string | null, OrgNode[]>();
  const stack = [...nodes];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    const bucket = index.get(current.parent_id);
    if (bucket) bucket.push(current);
    else index.set(current.parent_id, [current]);
    (current.children ?? []).forEach((child) => stack.push(child));
  }
  return index;
};

const treeHasRoot = (nodes: OrgNode[]): boolean => nodes.some((node) => node.parent_id === null || treeHasRoot(node.children ?? []));

const collectDescendantIds = (node: OrgNode | null | undefined): Set<string> => {
  const ids = new Set<string>();
  const stack = [...(node?.children ?? [])];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    ids.add(current.id);
    (current.children ?? []).forEach((child) => stack.push(child));
  }
  return ids;
};

const sortOrgTypeCodes = (codes: string[]): string[] => {
  const seen = new Set(codes);
  const legacyOrdered = LEGACY_ORG_TYPES.filter((code) => seen.has(code));
  const extras = codes.filter((code) => !LEGACY_ORG_TYPES.includes(code as (typeof LEGACY_ORG_TYPES)[number])).sort();
  return [...legacyOrdered, ...extras];
};

const getSuggestedChildType = (parentType: string | null | undefined, availableTypes: string[]): string => {
  const suggested = parentType ? NEXT_TYPE_BY_PARENT[parentType.toUpperCase()] : null;
  if (suggested && availableTypes.includes(suggested)) return suggested;
  if (availableTypes.includes(ROOT_TYPE)) return ROOT_TYPE;
  return availableTypes[0] ?? "";
};

const getDeleteAuditUserId = (): string | undefined => {
  if (typeof window === "undefined") return undefined;
  const localUserId = window.localStorage.getItem("current_user_id")?.trim();
  if (localUserId && UUID_PATTERN.test(localUserId)) return localUserId;
  const sessionUserId = window.sessionStorage.getItem("current_user_id")?.trim();
  if (sessionUserId && UUID_PATTERN.test(sessionUserId)) return sessionUserId;
  return undefined;
};

const mapAxiosError = (error: unknown): { message: string; status?: number; fieldErrors?: FieldErrors } => {
  if (!axios.isAxiosError(error)) {
    return { message: error instanceof Error ? error.message : "Unexpected error occurred" };
  }
  const status = error.response?.status;
  const data = error.response?.data as { message?: string; detail?: unknown } | undefined;
  const message =
    (typeof data?.detail === "string" && data.detail.trim())
    || (typeof data?.message === "string" && data.message.trim())
    || error.message
    || "Request failed";
  const fieldErrors: FieldErrors = {};
  if (Array.isArray(data?.detail)) {
    data.detail.forEach((item) => {
      if (typeof item === "object" && item !== null) {
        const loc = (item as { loc?: unknown }).loc;
        const msg = (item as { msg?: string }).msg;
        const field = Array.isArray(loc) && loc.length > 0 ? String(loc[loc.length - 1]) : "form";
        fieldErrors[field] = msg ?? "Invalid value";
      }
    });
  }
  return { message, status, fieldErrors: Object.keys(fieldErrors).length ? fieldErrors : undefined };
};

const getStatusLabel = (status: string, options: LookupOption[]): string =>
  options.find((option) => option.code === status)?.value
  ?? LEGACY_STATUS_OPTIONS.find((option) => option.code === status)?.label
  ?? status;

const TreeNodeItem = ({
  node,
  depth,
  isLast = true,
  selectedOrgId,
  onSelect,
  resolveTypeLabel,
  resolveStatusLabel,
}: {
  node: OrgNode;
  depth: number;
  isLast?: boolean;
  selectedOrgId: string | null;
  onSelect: (orgId: string) => void;
  resolveTypeLabel: (typeCode: string) => string;
  resolveStatusLabel: (statusCode: string) => string;
}) => {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isSelected = selectedOrgId === node.id;
  const childCount = node.children?.length ?? 0;

  return (
    <div className={cn("relative", depth > 0 && "pl-6")}>
      {depth > 0 && (
        <>
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute left-[9px] top-0 w-px bg-slate-200",
              isLast ? "h-7" : "bottom-0",
            )}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute left-[9px] top-7 h-px w-3.5 bg-slate-200"
          />
        </>
      )}

      <div className="pb-1.5">
        <div
          className={cn(
            "group cursor-pointer rounded-lg border px-3 py-2.5 transition-all",
            isSelected
              ? "border-blue-200 bg-blue-50/80 shadow-[inset_3px_0_0_0_rgb(37_99_235)]"
              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
          )}
          onClick={() => onSelect(node.id)}
        >
          <div className="flex items-start gap-3">
            {hasChildren ? (
              <button
                type="button"
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                onClick={(event) => {
                  event.stopPropagation();
                  setExpanded((current) => !current);
                }}
              >
                <ChevronRight className={cn("h-4 w-4 transition-transform", expanded && "rotate-90")} />
              </button>
            ) : (
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400">
                <CircleDot className={cn("h-3.5 w-3.5", isSelected && "text-blue-500")} />
              </span>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <div className={cn("truncate text-sm font-semibold", isSelected ? "text-slate-950" : "text-slate-900")}>
                      {node.name}
                    </div>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${typeColors[node.type] || "border-slate-200 bg-slate-100 text-slate-700"}`}>
                      {resolveTypeLabel(node.type)}
                    </span>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <span className="font-mono uppercase tracking-wide text-slate-500">{node.code}</span>
                    <span className="text-slate-300">�</span>
                    <span className="text-slate-500">
                      {hasChildren ? `${childCount} reporting unit${childCount === 1 ? "" : "s"}` : "No child units"}
                    </span>
                  </div>
                </div>

                <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusColors[node.status] || "border-slate-200 bg-slate-100 text-slate-700"}`}>
                  {resolveStatusLabel(node.status)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {expanded && hasChildren && (
        <div className="space-y-1.5">
          {node.children?.map((child, index) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              isLast={index === (node.children?.length ?? 1) - 1}
              selectedOrgId={selectedOrgId}
              onSelect={onSelect}
              resolveTypeLabel={resolveTypeLabel}
              resolveStatusLabel={resolveStatusLabel}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export function OrgHierarchyWorkspace({ defaultUser, onSummaryChange }: OrgHierarchyWorkspaceProps) {
  const [isHealthy, setIsHealthy] = useState(true);
  const [healthMessage, setHealthMessage] = useState<string | null>(null);
  const [tree, setTree] = useState<OrgNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<OrgNode | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState<OrgNode[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [formMode, setFormMode] = useState<OrgFormMode>("createRoot");
  const [formData, setFormData] = useState<OrgFormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [orgTypeOptions, setOrgTypeOptions] = useState<LookupOption[]>([]);
  const [statusOptions, setStatusOptions] = useState<LookupOption[]>([]);
  const [countryOptions, setCountryOptions] = useState<LookupOption[]>([]);

  const nodeMap = useMemo(() => buildNodeMap(tree), [tree]);
  const parentIndex = useMemo(() => buildParentIndex(tree), [tree]);
  const selectedTreeNode = useMemo(() => (selectedOrgId ? nodeMap.get(selectedOrgId) ?? null : null), [nodeMap, selectedOrgId]);
  const selectedChildren = useMemo(() => (selectedOrgId ? parentIndex.get(selectedOrgId) ?? [] : []), [parentIndex, selectedOrgId]);
  const selectedNodeDescendantIds = useMemo(() => collectDescendantIds(selectedTreeNode), [selectedTreeNode]);
  const rootExists = useMemo(() => treeHasRoot(tree), [tree]);
  const allOrgTypeCodes = useMemo(() => {
    const codes = orgTypeOptions.map((option) => option.code.toUpperCase());
    return sortOrgTypeCodes(codes.length ? codes : [...LEGACY_ORG_TYPES]);
  }, [orgTypeOptions]);
  const allStatusOptions = useMemo(
    () => (statusOptions.length ? statusOptions : LEGACY_STATUS_OPTIONS.map((option) => ({ code: option.code, value: option.label }))),
    [statusOptions],
  );
  const typeLabelMap = useMemo(() => buildLookupLabelMap(orgTypeOptions), [orgTypeOptions]);
  const statusLabelMap = useMemo(() => buildLookupLabelMap(allStatusOptions), [allStatusOptions]);
  const countryLabelMap = useMemo(() => buildLookupLabelMap(countryOptions), [countryOptions]);
  const parentOptions = useMemo(() => flattenTree(tree), [tree]);
  const allOrganizations = useMemo(() => Array.from(nodeMap.values()), [nodeMap]);
  const organizationSummary = useMemo(() => ({
    total: allOrganizations.length,
    active: allOrganizations.filter((organization) => organization.status === "ACTIVE").length,
    leaders: allOrganizations.filter((organization) => (organization.children?.length ?? 0) > 0).length,
    topLevel: tree.length,
  }), [allOrganizations, tree]);
  const resolveTypeLabel = useCallback((typeCode: string) => getLookupLabel(typeCode, typeLabelMap), [typeLabelMap]);
  const resolveStatusDisplay = useCallback(
    (statusCode: string) => getLookupLabel(statusCode, statusLabelMap, getStatusLabel(statusCode, allStatusOptions)),
    [allStatusOptions, statusLabelMap],
  );
  const disabled = !isHealthy;

  const loadTree = useCallback(async (preferredSelectionId?: string | null) => {
    setTreeLoading(true);
    setTreeError(null);
    try {
      const data = await getOrgTree();
      const normalized = data.map(normalizeNode);
      setTree(normalized);
      const nextMap = buildNodeMap(normalized);
      const candidate = preferredSelectionId ?? selectedOrgId;
      if (candidate && nextMap.has(candidate)) setSelectedOrgId(candidate);
      else setSelectedOrgId(normalized[0]?.id ?? null);
    } catch (error) {
      setTreeError(mapAxiosError(error).message);
    } finally {
      setTreeLoading(false);
    }
  }, [selectedOrgId]);

  const loadDetail = useCallback(async (orgId: string) => {
    setDetailLoading(true);
    try {
      const detail = normalizeNode(await getOrgById(orgId));
      setSelectedNode(detail);
      setSelectedOrgId(orgId);
    } catch (error) {
      const mapped = mapAxiosError(error);
      if (mapped.status === 404) await loadTree(null);
      else setTreeError(mapped.message);
    } finally {
      setDetailLoading(false);
    }
  }, [loadTree]);

  useEffect(() => {
    void (async () => {
      try {
        await getOrgHealth();
        setIsHealthy(true);
        setHealthMessage(null);
      } catch (error) {
        const mapped = mapAxiosError(error);
        setIsHealthy(false);
        setHealthMessage(mapped.message);
      }
      try {
        const [orgTypes, statuses, countries] = await Promise.all([
          getLookupOptionsByMasterCode("ORG_TYPE"),
          getLookupOptionsByMasterCode("ORG_STATUS"),
          getLookupOptionsByMasterCode("COUNTRY"),
        ]);
        setOrgTypeOptions(orgTypes);
        setStatusOptions(statuses);
        setCountryOptions(countries);
      } catch (error) {
        toast.error(mapAxiosError(error).message);
      }
      await loadTree(null);
    })();
  }, [loadTree]);

  useEffect(() => {
    if (!selectedOrgId) {
      setSelectedNode(null);
      return;
    }
    void loadDetail(selectedOrgId);
  }, [selectedOrgId, loadDetail]);

  useEffect(() => {
    const query = searchInput.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      void (async () => {
        setSearchLoading(true);
        try {
          const data = await searchOrg(query);
          setSearchResults(data.map(normalizeNode));
        } catch (error) {
          setTreeError(mapAxiosError(error).message);
        } finally {
          setSearchLoading(false);
        }
      })();
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    onSummaryChange?.(organizationSummary);
  }, [onSummaryChange, organizationSummary]);

  const selectedNodeCanAddChild = Boolean(selectedNode && selectedNode.status !== "CLOSED");
  const selectedNodeHasChildren = selectedChildren.length > 0;
  const availableParentOptions = useMemo(() => {
    if (formMode !== "editNode") return [];
    return parentOptions.filter((option) => {
      if (option.id === selectedOrgId) return false;
      if (selectedNodeDescendantIds.has(option.id)) return false;
      if (option.status === "CLOSED" && option.id !== formData.parent_id) return false;
      return true;
    });
  }, [formData.parent_id, formMode, parentOptions, selectedNodeDescendantIds, selectedOrgId]);
  const siblings = useMemo(() => {
    if (!selectedNode) return [];
    return (parentIndex.get(selectedNode.parent_id) ?? []).filter((node) => node.id !== selectedNode.id);
  }, [parentIndex, selectedNode]);
  const selectedLineage = useMemo(() => {
    if (!selectedTreeNode) return [];

    const lineage: OrgNode[] = [];
    let current: OrgNode | null = selectedTreeNode;
    while (current) {
      lineage.unshift(current);
      current = current.parent_id ? nodeMap.get(current.parent_id) ?? null : null;
    }

    return lineage;
  }, [nodeMap, selectedTreeNode]);

  const openCreateRoot = (): void => {
    setFormMode("createRoot");
    setFieldErrors({});
    setFormMessage(null);
    setFormData({
      ...EMPTY_FORM,
      type: allOrgTypeCodes.includes(ROOT_TYPE) ? ROOT_TYPE : allOrgTypeCodes[0] ?? "",
      status: allStatusOptions[0]?.code ?? "ACTIVE",
    });
    setShowForm(true);
  };

  const openAddChild = (): void => {
    if (!selectedOrgId || !selectedNodeCanAddChild) return;
    setFormMode("addChild");
    setFieldErrors({});
    setFormMessage(null);
    setFormData({
      ...EMPTY_FORM,
      parent_id: selectedOrgId,
      type: getSuggestedChildType(selectedNode?.type, allOrgTypeCodes),
      status: allStatusOptions[0]?.code ?? "ACTIVE",
    });
    setShowForm(true);
  };

  const openEdit = async (): Promise<void> => {
    if (!selectedOrgId) return;
    setFormMode("editNode");
    setFieldErrors({});
    setFormMessage(null);
    setShowForm(true);
    try {
      const detail = await getOrgById(selectedOrgId);
      setFormData({
        name: detail.name ?? "",
        code: detail.code ?? "",
        type: detail.type ?? "",
        status: detail.status ?? "ACTIVE",
        parent_id: detail.parent_id ?? "",
        address: detail.address ?? "",
        city: detail.city ?? "",
        state: detail.state ?? "",
        country: detail.country ?? "",
        lat: detail.lat === undefined || detail.lat === null ? "" : String(detail.lat),
        long: detail.long === undefined || detail.long === null ? "" : String(detail.long),
      });
    } catch (error) {
      setFormMessage(mapAxiosError(error).message);
    }
  };

  const validateForm = (): boolean => {
    const nextErrors: FieldErrors = {};
    if (!formData.name.trim()) nextErrors.name = "Organization name is required";
    if (!formData.code.trim()) nextErrors.code = "Organization code is required";
    else if (!CODE_PATTERN.test(formData.code.trim().toUpperCase())) nextErrors.code = "Use only letters, numbers, and hyphens";
    if (!formData.type.trim()) nextErrors.type = "Organization type is required";
    if (!formData.status.trim()) nextErrors.status = "Operating status is required";
    if (!formData.address.trim()) nextErrors.address = "Address is required";
    if (!formData.city.trim()) nextErrors.city = "City is required";
    if (!formData.state.trim()) nextErrors.state = "State is required";
    if (!formData.country.trim()) nextErrors.country = "Country is required";
    if (formData.lat.trim() && Number.isNaN(Number(formData.lat))) nextErrors.lat = "Latitude must be a number";
    if (formData.long.trim() && Number.isNaN(Number(formData.long))) nextErrors.long = "Longitude must be a number";
    if (formMode === "editNode" && !formData.parent_id && rootExists && selectedNode?.parent_id !== null) nextErrors.parent_id = "Another top-level organization is already active";
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (disabled || submitting || !validateForm()) return;
    setSubmitting(true);
    const payload: OrgPayload = {
      name: formData.name.trim(),
      code: formData.code.trim().toUpperCase(),
      type: formData.type.trim().toUpperCase(),
      status: formData.status.trim().toUpperCase(),
      parent_id: formData.parent_id || null,
      address: formData.address.trim() || null,
      city: formData.city.trim() || null,
      state: formData.state.trim() || null,
      country: formData.country.trim() || null,
      lat: formData.lat.trim() ? Number(formData.lat) : null,
      long: formData.long.trim() ? Number(formData.long) : null,
      ...(formMode === "editNode" ? { modified_by: defaultUser } : { created_by: defaultUser }),
    };
    try {
      if (formMode === "editNode") {
        if (!selectedOrgId) return;
        await updateOrg(selectedOrgId, payload);
        toast.success("Organization updated successfully");
        await loadTree(selectedOrgId);
      } else {
        const created = await createOrg(payload);
        toast.success("Organization created successfully");
        await loadTree(created.id);
      }
      setShowForm(false);
    } catch (error) {
      const mapped = mapAxiosError(error);
      setFormMessage(mapped.message);
      if (mapped.fieldErrors) setFieldErrors((current) => ({ ...current, ...mapped.fieldErrors }));
      toast.error(mapped.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!selectedOrgId || disabled || submitting) return;
    setSubmitting(true);
    try {
      await deleteOrg(selectedOrgId, getDeleteAuditUserId());
      toast.success("Organization removed successfully");
      setShowDelete(false);
      setSelectedOrgId(null);
      setSelectedNode(null);
      await loadTree(null);
    } catch (error) {
      const mapped = mapAxiosError(error);
      setFormMessage(mapped.message);
      toast.error(mapped.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedParentName = selectedNode?.parent_id
    ? nodeMap.get(selectedNode.parent_id)?.name ?? selectedNode.parent_id
    : "Top-level organization";
  const selectedLocationSummary = [
    selectedNode?.address,
    selectedNode?.city,
    selectedNode?.state,
    selectedNode?.country ? getLookupLabel(selectedNode.country, countryLabelMap, selectedNode.country) : null,
  ]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(", ");

  return (
    <div className="space-y-5">
      {!isHealthy && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Organization services are currently unavailable. {healthMessage ?? "Actions stay disabled until the health check passes."}
        </div>
      )}
      {(treeError || formMessage) && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formMessage || treeError}
        </div>
      )}

      <Card padding="none" className="overflow-visible border-slate-200 shadow-sm">
        <CardBody className="px-6 py-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <SearchInput
                placeholder="Search organizations, organization codes, or business types"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onClear={() => setSearchInput("")}
                className="h-10"
              />
              {searchInput.trim() && (
                <div className="absolute left-0 right-0 top-12 z-20 max-h-72 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                  {searchLoading && <div className="px-4 py-3 text-sm text-slate-500">Searching organizations...</div>}
                  {!searchLoading && searchResults.length === 0 && (
                    <div className="px-4 py-3 text-sm text-slate-500">No matching organizations found.</div>
                  )}
                  {!searchLoading && searchResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      className="w-full border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50 last:border-b-0"
                      onClick={() => {
                        setSearchInput("");
                        setSelectedOrgId(result.id);
                      }}
                    >
                      <div className="text-sm font-semibold text-slate-900">{result.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>{resolveTypeLabel(result.type)}</span>
                        <span>{result.code}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                disabled={treeLoading}
                onClick={() => void loadTree(selectedOrgId)}
              >
                <RefreshCw className={`h-4 w-4 ${treeLoading ? "animate-spin" : ""}`} />
                {treeLoading ? "Refreshing..." : "Refresh Data"}
              </Button>
              {!rootExists && (
                <Button size="sm" type="button" disabled={disabled} onClick={openCreateRoot}>
                  <Plus className="h-4 w-4" />
                  Add Top-Level Organization
                </Button>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]" style={{ minHeight: "560px" }}>
        <Card padding="none" className="flex h-full min-h-[560px] flex-col overflow-hidden border-slate-200 bg-white shadow-sm">
          <CardHeader
            className="border-b border-slate-200 bg-slate-50/70 pb-4"
            title="Organization Map"
            description="Browse the enterprise structure and choose an organization to review."
            action={(
              <Button variant="ghost" size="sm" type="button" onClick={() => void loadTree(selectedOrgId)}>
                <RefreshCw className={cn("h-4 w-4", treeLoading && "animate-spin")} />
                {treeLoading ? "Refreshing..." : "Refresh"}
              </Button>
            )}
          />
          <div className="border-b border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{nodeMap.size} organization{nodeMap.size === 1 ? "" : "s"}</span>
              <span>{tree.length} top-level branch{tree.length === 1 ? "" : "es"}</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto bg-slate-50/40 px-3 py-3">
            {treeLoading && (
              <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
                Loading organization map...
              </div>
            )}
            {!treeLoading && tree.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
                No organizations have been configured yet.
              </div>
            )}
            {!treeLoading && tree.length > 0 && (
              <div className="space-y-1.5">
                {tree.map((root, index) => (
                  <TreeNodeItem
                    key={root.id}
                    node={root}
                    depth={0}
                    isLast={index === tree.length - 1}
                    selectedOrgId={selectedOrgId}
                    onSelect={setSelectedOrgId}
                    resolveTypeLabel={resolveTypeLabel}
                    resolveStatusLabel={resolveStatusDisplay}
                  />
                ))}
              </div>
            )}
          </div>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <Card padding="none" className="border-slate-200 shadow-sm">
            <CardHeader
              title={selectedNode?.name ?? "Select an Organization"}
              description={
                selectedNode
                  ? `${resolveTypeLabel(selectedNode.type)} • ${selectedNode.code}`
                  : "Choose an organization from the map to review its profile and governance coverage."
              }
              action={(
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" type="button" disabled={disabled || !selectedOrgId || !selectedNodeCanAddChild} onClick={openAddChild}>
                    <Plus className="h-4 w-4" />
                    Add Child Organization 
                  </Button>
                  <Button variant="secondary" size="sm" type="button" disabled={disabled || !selectedOrgId} onClick={() => void openEdit()}>
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button variant="destructive" size="sm" type="button" disabled={disabled || !selectedOrgId} onClick={() => setShowDelete(true)}>
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                </div>
              )}
            />
            <CardBody className="space-y-5">
              {detailLoading && <div className="text-sm text-slate-500">Loading organization profile...</div>}
              {!detailLoading && !selectedNode && (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
                  Select an organization from the map to see business details, reporting relationships, and governance coverage.
                </div>
              )}
              {!detailLoading && selectedNode && (
                <>
                  {selectedLineage.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Reporting Map</div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                        {selectedLineage.map((organization, index) => (
                          <React.Fragment key={organization.id}>
                            {index > 0 && <ChevronRight className="h-4 w-4 text-slate-300" />}
                            <button
                              type="button"
                              className={`rounded-full border px-3 py-1 transition-colors ${organization.id === selectedOrgId ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`}
                              onClick={() => setSelectedOrgId(organization.id)}
                            >
                              {organization.name}
                            </button>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Reporting Units</div>
                      <div className="mt-2 text-2xl font-semibold text-slate-900">{selectedChildren.length}</div>
                      <p className="mt-2 text-sm text-slate-500">
                        {selectedChildren.length === 0 ? "No downstream organizations yet." : "Organizations that report directly here."}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Peer Organizations</div>
                      <div className="mt-2 text-2xl font-semibold text-slate-900">{siblings.length}</div>
                      <p className="mt-2 text-sm text-slate-500">
                        {siblings.length === 0 ? "No peer organizations at this level." : "Other organizations with the same parent."}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Structure Level</div>
                      <div className="mt-2 text-2xl font-semibold text-slate-900">{selectedLineage.length}</div>
                      <p className="mt-2 text-sm text-slate-500">Depth of this organization within the reporting line.</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm">
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Location Summary</div>
                        <div className="mt-1 text-sm text-slate-700">
                          {selectedLocationSummary || "Location details are still being captured for this organization."}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {[
                      { label: "Organization Name", value: selectedNode.name },
                      { label: "Organization Type", value: resolveTypeLabel(selectedNode.type), kind: "type" },
                      { label: "Organization Code", value: selectedNode.code },
                      { label: "Reports To", value: selectedParentName },
                      { label: "Operating Status", value: resolveStatusDisplay(selectedNode.status), kind: "status" },
                      { label: "Direct Reporting Units", value: String(selectedChildren.length) },
                      { label: "Street Address", value: selectedNode.address || "-" },
                      { label: "City", value: selectedNode.city || "-" },
                      { label: "State / Province", value: selectedNode.state || "-" },
                      { label: "Country", value: selectedNode.country ? getLookupLabel(selectedNode.country, countryLabelMap, selectedNode.country) : "-" },
                      { label: "Latitude", value: formatCoord(selectedNode.lat) },
                      { label: "Longitude", value: formatCoord(selectedNode.long) },
                    ].map((item) => (
                      <div key={item.label}>
                        <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
                        {item.kind === "status" ? (
                          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${statusColors[selectedNode.status] || "border-slate-200 bg-slate-100 text-slate-700"}`}>
                            {item.value}
                          </span>
                        ) : item.kind === "type" ? (
                          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${typeColors[selectedNode.type] || "border-slate-200 bg-slate-100 text-slate-700"}`}>
                            {item.value}
                          </span>
                        ) : (
                          <div className="text-sm font-medium text-slate-800">{item.value}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardBody>
            <CardFooter className="justify-between gap-3 border-t border-slate-100 pt-4">
              <span className="text-xs text-slate-500">Only one top-level organization can remain active at a time.</span>
              <span className="text-xs text-slate-500">Each organization reports to one parent organization.</span>
            </CardFooter>
          </Card>

          <OrgRoleAssignmentsPanel orgId={selectedOrgId} orgName={selectedNode?.name ?? null} disabled={disabled} defaultUser={defaultUser} />

          {selectedNode && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card padding="none" className="border-slate-200 shadow-sm">
                <CardHeader
                  title="Peer Organizations"
                  description={
                    siblings.length === 0
                      ? "No peer organizations at this reporting level."
                      : `${siblings.length} organization${siblings.length === 1 ? "" : "s"} share the same parent.`
                  }
                />
                <CardBody className="space-y-3 px-6 pb-6">
                  {siblings.length === 0 && <div className="text-sm text-slate-500">No peer organizations found.</div>}
                  {siblings.map((sibling) => (
                    <button
                      key={sibling.id}
                      type="button"
                      onClick={() => setSelectedOrgId(sibling.id)}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
                    >
                      <div className="text-sm font-semibold text-slate-900">{sibling.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>{resolveTypeLabel(sibling.type)}</span>
                        <span>{sibling.code}</span>
                      </div>
                    </button>
                  ))}
                </CardBody>
              </Card>

              <Card padding="none" className="border-slate-200 shadow-sm">
                <CardHeader
                  title="Reporting Organizations"
                  description={`${selectedChildren.length} organization${selectedChildren.length === 1 ? "" : "s"} report directly here.`}
                />
                <CardBody className="space-y-3 px-6 pb-6">
                  {selectedChildren.length === 0 && <div className="text-sm text-slate-500">No reporting organizations found.</div>}
                  {selectedChildren.map((child) => (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => setSelectedOrgId(child.id)}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{child.name}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span>{resolveTypeLabel(child.type)}</span>
                            <span>{child.code}</span>
                          </div>
                        </div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                          <GitBranch className="h-4 w-4" />
                        </div>
                      </div>
                    </button>
                  ))}
                </CardBody>
              </Card>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={showForm}
        onClose={() => {
          if (!submitting) setShowForm(false);
        }}
        title={
          formMode === "editNode"
            ? `Update ${selectedNode?.name ?? "Organization"}`
            : formMode === "createRoot"
              ? "Create Top-Level Organization"
              : "Add Reporting Organization"
        }
        description={
          formMode === "editNode"
            ? "Update the selected organization while preserving clean reporting relationships and circular-reference protection."
            : formMode === "createRoot"
              ? "Create the single top-level organization that anchors the enterprise structure."
              : "Add a reporting organization beneath the selected parent. The form suggests the next organizational level when available."
        }
        size="lg"
        footer={(
          <>
            <Button variant="ghost" type="button" disabled={submitting} onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" form="org-form" disabled={submitting || disabled}>
              {submitting ? "Saving..." : "Save Organization"}
            </Button>
          </>
        )}
      >
        <form id="org-form" className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={(event) => void handleSubmit(event)}>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Organization Name</label>
            <Input
              value={formData.name}
              onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
              placeholder="e.g. Global Quality Operations"
            />
            {fieldErrors.name && <p className="text-xs text-red-600">{fieldErrors.name}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Organization Type</label>
            <select
              className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm disabled:bg-slate-50"
              value={formData.type}
              onChange={(event) => setFormData((current) => ({ ...current, type: event.target.value }))}
              disabled={formMode === "editNode" && selectedChildren.length > 0}
            >
              <option value="">Select Organization Type</option>
              {allOrgTypeCodes.map((typeCode) => (
                <option key={typeCode} value={typeCode}>
                  {resolveTypeLabel(typeCode)}
                </option>
              ))}
            </select>
            {fieldErrors.type && <p className="text-xs text-red-600">{fieldErrors.type}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Organization Code</label>
            <Input
              value={formData.code}
              maxLength={25}
              onChange={(event) => setFormData((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
              placeholder="e.g. GQO-001"
            />
            {fieldErrors.code && <p className="text-xs text-red-600">{fieldErrors.code}</p>}
          </div>

          {formMode !== "createRoot" && (
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Reports To</label>
              {formMode === "addChild" ? (
                <div className="flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
                  {selectedNode?.name ?? "-"}
                </div>
              ) : (
                <select
                  className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
                  value={formData.parent_id}
                  onChange={(event) => setFormData((current) => ({ ...current, parent_id: event.target.value }))}
                >
                  {(!rootExists || selectedNode?.parent_id === null) && <option value="">Top-level organization</option>}
                  {availableParentOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {`${"— ".repeat(option.level)}${option.name} (${resolveTypeLabel(option.type)})`}
                    </option>
                  ))}
                </select>
              )}
              {fieldErrors.parent_id && <p className="text-xs text-red-600">{fieldErrors.parent_id}</p>}
            </div>
          )}

          <div className="md:col-span-2 space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Street Address</label>
            <Input
              value={formData.address}
              onChange={(event) => setFormData((current) => ({ ...current, address: event.target.value }))}
              placeholder="Building, street, or campus address"
            />
            {fieldErrors.address && <p className="text-xs text-red-600">{fieldErrors.address}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">City</label>
            <Input
              value={formData.city}
              onChange={(event) => setFormData((current) => ({ ...current, city: event.target.value }))}
            />
            {fieldErrors.city && <p className="text-xs text-red-600">{fieldErrors.city}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">State / Province</label>
            <Input
              value={formData.state}
              onChange={(event) => setFormData((current) => ({ ...current, state: event.target.value }))}
            />
            {fieldErrors.state && <p className="text-xs text-red-600">{fieldErrors.state}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Country</label>
            <select
              className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
              value={formData.country}
              onChange={(event) => setFormData((current) => ({ ...current, country: event.target.value }))}
            >
              <option value="">Select Country</option>
              {countryOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.value}
                </option>
              ))}
            </select>
            {fieldErrors.country && <p className="text-xs text-red-600">{fieldErrors.country}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Operating Status</label>
            <select
              className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
              value={formData.status}
              onChange={(event) => setFormData((current) => ({ ...current, status: event.target.value }))}
            >
              {allStatusOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.value}
                </option>
              ))}
            </select>
            {fieldErrors.status && <p className="text-xs text-red-600">{fieldErrors.status}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Latitude</label>
            <Input
              value={formData.lat}
              onChange={(event) => setFormData((current) => ({ ...current, lat: event.target.value }))}
              placeholder="e.g. 17.3850"
            />
            {fieldErrors.lat && <p className="text-xs text-red-600">{fieldErrors.lat}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Longitude</label>
            <Input
              value={formData.long}
              onChange={(event) => setFormData((current) => ({ ...current, long: event.target.value }))}
              placeholder="e.g. 78.4867"
            />
            {fieldErrors.long && <p className="text-xs text-red-600">{fieldErrors.long}</p>}
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={showDelete}
        onConfirm={() => void handleDelete()}
        onCancel={() => {
          if (!submitting) setShowDelete(false);
        }}
        title="Remove this organization?"
        message={`"${selectedNode?.name ?? "Selected organization"}" will be marked as deleted. Organizations with reporting units cannot be removed.`}
        confirmLabel={submitting ? "Removing..." : "Remove Organization"}
      />
    </div>
  );
}


