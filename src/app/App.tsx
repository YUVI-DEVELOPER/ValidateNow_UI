import React, { useState, useEffect } from "react";
import { AppShell } from "./components/layout/AppShell";
import { DEFAULT_NAV_PAGE, NavPage } from "./components/layout/AppSidebar";
import { LoginPage } from "./pages/LoginPage";
import { OrgStructurePage } from "./pages/OrgStructurePage";
import { SupplierPage } from "./pages/SupplierPage";
import { AssetListPage } from "./pages/assets/AssetListPage";
import { AssetDashboardPage } from "./pages/assets/AssetDashboardPage";
import { AssetGroupingPage } from "./pages/assets/AssetGroupingPage";
import { AssetInventoryReportingPage } from "./pages/assets/AssetInventoryReportingPage";
import { AssetSpecsPage } from "./pages/assets/AssetSpecsPage";
import { DocumentPortalPage } from "./pages/assets/DocumentPortalPage";
import { LookupMasterPage } from "./pages/LookupMasterPage";
import { LookupValuesPage } from "./pages/LookupValuesPage";
import { GraphHierarchyPage } from "./pages/graph/GraphHierarchyPage";

import { getPageHeaderConfig } from "./components/layout/pageHeaderConfig";

function isNavPage(value: string): value is NavPage {
  return Boolean(getPageHeaderConfig(value as NavPage));
}

export default function App() {
  const [page, setPage] = useState<NavPage>(() => {
    const savedPage = localStorage.getItem("app_current_page");

    if (savedPage === "dashboard") {
      return DEFAULT_NAV_PAGE;
    }

    return savedPage && isNavPage(savedPage) ? savedPage : "login";
  });

  useEffect(() => {
    localStorage.setItem("app_current_page", page);
  }, [page]);

  if (page === "login") {
    return <LoginPage onLogin={setPage} />;
  }

  return (
    <AppShell activePage={page} onNavigate={setPage}>
      {page === "org-structure" && <OrgStructurePage />}
      {page === "supplier" && <SupplierPage />}
      {page === "asset" && <AssetListPage />}
      {page === "asset-dashboard" && <AssetDashboardPage onNavigate={(p: string) => setPage(p as NavPage)} />}
      {page === "asset-grouping" && <AssetGroupingPage />}
      {page === "asset-specs" && <AssetSpecsPage onNavigate={setPage} />}
      {page === "document-portal" && <DocumentPortalPage />}
      {page === "lookup-master" && <LookupMasterPage onNavigate={setPage} />}
      {page === "lookup-values" && <LookupValuesPage onNavigate={setPage} />}
      {page === "data-entry" && (
        <div className="flex items-center justify-center h-full w-full relative">
          <div className="absolute inset-0 bg-slate-100/50 backdrop-blur-md -z-10" />
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-200 mb-4">
              <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-700 mb-2">NOT READY</h2>
            <p className="text-slate-500">This page is under construction</p>
          </div>
        </div>
      )}
      {page === "reports" && <AssetInventoryReportingPage />}
      {page === "infrastructure-graph" && <GraphHierarchyPage />}
    </AppShell>
  );
}


