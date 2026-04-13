import React, { useState } from "react";
import { Toaster } from "sonner";

import { OrgHierarchyWorkspace } from "../components/org/OrgHierarchyWorkspace";
import { OrgRoleCatalogAdmin } from "../components/org/OrgRoleCatalogAdmin";
import { CommonPageHeader } from "../components/layout/CommonPageHeader";
import { buildPageHeaderStats, getPageHeaderConfig } from "../components/layout/pageHeaderConfig";

type OrgWorkspaceTab = "structure" | "roleCatalog";

const DEFAULT_USER = "admin@validatenow";

export function OrgStructurePage() {
  const header = getPageHeaderConfig("org-structure");
  const [activeTab, setActiveTab] = useState<OrgWorkspaceTab>("structure");
  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    leaders: 0,
    topLevel: 0,
  });

  const headerStats = buildPageHeaderStats(header.stats, {
    organizations: summary.total,
    "active-units": summary.active,
    leaders: summary.leaders,
  });

  return (
    <div className="space-y-5 p-6">
      <Toaster position="top-right" richColors />

      <CommonPageHeader
        breadcrumbs={header.breadcrumbs}
        sectionLabel={header.sectionLabel}
        title={header.title}
        subtitle={header.subtitle}
        stats={headerStats}
        tabs={(header.tabs ?? []).map((tab) => ({
          ...tab,
          active: tab.key === "organization-design" ? activeTab === "structure" : activeTab === "roleCatalog",
          onClick: () => setActiveTab(tab.key === "organization-design" ? "structure" : "roleCatalog"),
        }))}
      />

      {activeTab === "structure" ? (
        <OrgHierarchyWorkspace defaultUser={DEFAULT_USER} onSummaryChange={setSummary} />
      ) : (
        <OrgRoleCatalogAdmin defaultUser={DEFAULT_USER} />
      )}
    </div>
  );
}
