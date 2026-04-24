import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { OrgTreePanel } from "../../components/assets/OrgTreePanel";
import { AssetTable } from "../../components/assets/AssetTable";
import { AssetDetailDrawer } from "../../components/assets/AssetDetailDrawer";
import { CreateAssetModal } from "../../components/assets/CreateAssetModal";
import { EditAssetModal } from "../../components/assets/EditAssetModal";
import {
  AssetRecord,
  deleteAsset,
  getAssets,
  getAssetsByOrg,
  searchAssets,
} from "../../../services/asset.service";
import { getOrgTree, OrgNode } from "../../../services/org.service";
import { getSuppliers, SupplierRecord } from "../../../services/supplier.service";
import { LookupOption } from "../../services/lookupValue.service";
import {
  getAssetClassGlOptions,
  getAssetClasses,
  getAssetCategories,
  getAssetSubCategories,
  getAssetTypes,
  getAssetStatuses,
  getCurrencies,
  getDepreciationMethods,
  getCriticalities,
  getAssetNatures,
} from "../../services/lookupOption.service";
import { filterAllowedAssetStatusOptions } from "../../components/assets/assetForm.shared";
import { CommonPageHeader, PAGE_CONTENT_CLASS, PAGE_LAYOUT_SHELL_CLASS } from "../../components/layout/CommonPageHeader";
import { buildPageHeaderStats, getPageHeaderConfig } from "../../components/layout/pageHeaderConfig";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";

interface AssetDashboardPageProps {
  onNavigate?: (page: string) => void;
}

const ORG_PANEL_WIDTH = 280;

export function AssetDashboardPage({ onNavigate }: AssetDashboardPageProps) {
  const header = getPageHeaderConfig("asset-dashboard");
  // Data state
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [orgTree, setOrgTree] = useState<OrgNode[]>([]);
  const [supplierList, setSupplierList] = useState<SupplierRecord[]>([]);
  const [assetClasses, setAssetClasses] = useState<LookupOption[]>([]);
  const [assetCategories, setAssetCategories] = useState<LookupOption[]>([]);
  const [assetSubCategories, setAssetSubCategories] = useState<LookupOption[]>([]);
  const [assetTypes, setAssetTypes] = useState<LookupOption[]>([]);
  const [assetStatuses, setAssetStatuses] = useState<LookupOption[]>([]);
  const [currencies, setCurrencies] = useState<LookupOption[]>([]);
  const [depreciationMethods, setDepreciationMethods] = useState<LookupOption[]>([]);
  const [assetClassGlOptions, setAssetClassGlOptions] = useState<LookupOption[]>([]);
  const [criticalities, setCriticalities] = useState<LookupOption[]>([]);
  const [assetNatures, setAssetNatures] = useState<LookupOption[]>([]);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<OrgNode | null>(null);

  // Modal/Drawer states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<AssetRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load dependency data
  const loadDependencyData = useCallback(async () => {
    try {
      const [
        orgs,
        suppliers,
        classes,
        categories,
        subCategories,
        types,
        statuses,
        currs,
        financeMethods,
        assetClassGlValues,
        crits,
        natures,
      ] = await Promise.all([
        getOrgTree(),
        getSuppliers(),
        getAssetClasses(),
        getAssetCategories(),
        getAssetSubCategories(),
        getAssetTypes(),
        getAssetStatuses(),
        getCurrencies(),
        getDepreciationMethods(),
        getAssetClassGlOptions(),
        getCriticalities(),
        getAssetNatures(),
      ]);
      setOrgTree(orgs);
      setSupplierList(suppliers);
      setAssetClasses(classes);
      setAssetCategories(categories);
      setAssetSubCategories(subCategories);
      setAssetTypes(types);
      setAssetStatuses(filterAllowedAssetStatusOptions(statuses));
      setCurrencies(currs);
      setDepreciationMethods(financeMethods);
      setAssetClassGlOptions(assetClassGlValues);
      setCriticalities(crits);
      setAssetNatures(natures);
    } catch (error) {
      console.error("Failed to load dependency data:", error);
      toast.error("Failed to load form data");
    }
  }, []);

  // Load assets based on org selection and search
  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      let data: AssetRecord[];
      if (searchQuery.trim()) {
        data = await searchAssets(searchQuery.trim());
      } else if (selectedOrgId) {
        data = await getAssetsByOrg(selectedOrgId);
      } else {
        data = await getAssets();
      }
      setAssets(data);
    } catch (error) {
      console.error("Failed to load assets:", error);
      toast.error("Failed to load assets");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedOrgId]);

  // Initial load
  useEffect(() => {
    Promise.all([loadDependencyData()]);
  }, [loadDependencyData]);

  // Load assets when org or search changes
  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // Helper function to find org node by ID
  const findOrgNode = (nodes: OrgNode[], id: string): OrgNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findOrgNode(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  // Handle org selection
  const handleSelectOrg = useCallback((orgId: string | null) => {
    setSelectedOrgId(orgId);
    setSelectedOrg(orgId ? findOrgNode(orgTree, orgId) : null);
    setSearchQuery("");
  }, [orgTree]);

  // Handle create
  const handleCreated = async () => {
    await loadAssets();
    setCreateModalOpen(false);
  };

  // Handle edit
  const handleEdit = (asset: AssetRecord) => {
    setSelectedAssetId(asset.asset_uuid);
    setEditModalOpen(true);
  };

  const handleUpdated = async () => {
    await loadAssets();
    setEditModalOpen(false);
    setSelectedAssetId(null);
  };

  // Handle view
  const handleView = (asset: AssetRecord) => {
    setSelectedAssetId(asset.asset_uuid);
    setDetailDrawerOpen(true);
  };

  // Handle delete
  const handleDeleteClick = (asset: AssetRecord) => {
    setAssetToDelete(asset);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!assetToDelete) return;
    setDeleting(true);
    try {
      await deleteAsset(assetToDelete.asset_uuid);
      toast.success("Asset deleted successfully");
      await loadAssets();
    } catch (error) {
      console.error("Failed to delete asset:", error);
      toast.error("Failed to delete asset");
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setAssetToDelete(null);
    }
  };

  // Open create modal - preserve selectedOrg for default organization in modal
  const handleCreateClick = () => {
    setSelectedAssetId(null);
    setCreateModalOpen(true);
  };

  const headerStats = buildPageHeaderStats(header.stats, {
    total: assets.length,
    orgs: orgTree.length,
    suppliers: supplierList.length,
  });

  return (
    <div className={PAGE_LAYOUT_SHELL_CLASS}>
      <CommonPageHeader
        breadcrumbs={header.breadcrumbs}
        sectionLabel={header.sectionLabel}
        title={header.title}
        subtitle={selectedOrgId
          ? "Viewing asset master records for the selected organization."
          : header.subtitle}
        search={header.searchPlaceholder ? {
          value: searchQuery,
          placeholder: header.searchPlaceholder,
          onChange: setSearchQuery,
          onClear: () => {
            setSearchQuery("");
            void loadAssets();
          },
          disabled: loading,
        } : undefined}
        stats={headerStats}
        primaryAction={header.primaryAction ? { ...header.primaryAction, onClick: handleCreateClick, disabled: loading } : undefined}
        secondaryActions={[
          {
            ...(header.secondaryActions?.[0] ?? { key: "refresh", label: "Refresh", variant: "secondary" }),
            onClick: () => void loadAssets(),
            disabled: loading,
          },
        ]}
      />

      <div className={PAGE_CONTENT_CLASS}>
        <div className="flex min-h-[620px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div
            className="flex-shrink-0 overflow-hidden border-r border-slate-200"
            style={{ width: ORG_PANEL_WIDTH }}
          >
            <OrgTreePanel
              orgTree={orgTree}
              selectedOrgId={selectedOrgId}
              onSelectOrg={handleSelectOrg}
            />
          </div>

          <div className="flex-1 overflow-auto bg-slate-50 p-6">
            <AssetTable
              assets={assets}
              loading={loading}
              searchQuery={searchQuery}
              orgTree={orgTree}
              suppliers={supplierList}
              assetClasses={assetClasses}
              assetTypes={assetTypes}
              assetStatuses={assetStatuses}
              criticalities={criticalities}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
            />
          </div>
        </div>
      </div>

      <CreateAssetModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={handleCreated}
        defaultOrganization={selectedOrg}
        orgTree={orgTree}
        supplierList={supplierList}
        assetClasses={assetClasses}
        assetCategories={assetCategories}
        assetSubCategories={assetSubCategories}
        assetTypes={assetTypes}
        assetStatuses={assetStatuses}
        currencies={currencies}
        criticalities={criticalities}
        assetNatures={assetNatures}
      />

      <EditAssetModal
        open={editModalOpen}
        assetId={selectedAssetId}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedAssetId(null);
        }}
        onUpdated={handleUpdated}
        orgTree={orgTree}
        supplierList={supplierList}
        assetClasses={assetClasses}
        assetCategories={assetCategories}
        assetSubCategories={assetSubCategories}
        assetTypes={assetTypes}
        assetStatuses={assetStatuses}
        currencies={currencies}
        criticalities={criticalities}
        assetNatures={assetNatures}
      />

      <AssetDetailDrawer
        open={detailDrawerOpen}
        assetId={selectedAssetId}
        onClose={() => {
          setDetailDrawerOpen(false);
          setSelectedAssetId(null);
        }}
        orgTree={orgTree}
        suppliers={supplierList}
        assetClasses={assetClasses}
        assetCategories={assetCategories}
        assetSubCategories={assetSubCategories}
        assetTypes={assetTypes}
        assetStatuses={assetStatuses}
        currencies={currencies}
        depreciationMethods={depreciationMethods}
        assetClassGlOptions={assetClassGlOptions}
        criticalities={criticalities}
        assetNatures={assetNatures}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{assetToDelete?.asset_name}"? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
