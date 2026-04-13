import React from "react";
import { ArrowLeft, Download, Filter, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "../ui/button";
import { Breadcrumb, SearchInput } from "../ui/input";
import { cn } from "../ui/utils";
import type {
  PageHeaderActionDefinition,
  PageHeaderBreadcrumbItem,
  PageHeaderStatValue,
  PageHeaderTabDefinition,
} from "./pageHeaderConfig";

interface PageHeaderAction extends PageHeaderActionDefinition {
  onClick: () => void;
  disabled?: boolean;
}

interface CommonPageHeaderProps {
  breadcrumbs?: PageHeaderBreadcrumbItem[];
  sectionLabel?: string;
  title: string;
  subtitle?: string;
  tabs?: Array<PageHeaderTabDefinition & { active?: boolean; onClick: () => void }>;
  search?: {
    value: string;
    placeholder: string;
    onChange: (value: string) => void;
    onClear?: () => void;
    disabled?: boolean;
  };
  stats?: PageHeaderStatValue[];
  primaryAction?: PageHeaderAction;
  secondaryActions?: PageHeaderAction[];
  backAction?: PageHeaderAction;
  rightSlot?: React.ReactNode;
}

const statToneStyles: Record<NonNullable<PageHeaderStatValue["tone"]>, { dot: string; value: string; hint: string }> = {
  blue: { dot: "bg-blue-500", value: "text-blue-700", hint: "text-blue-600/80" },
  emerald: { dot: "bg-emerald-500", value: "text-emerald-700", hint: "text-emerald-600/80" },
  amber: { dot: "bg-amber-500", value: "text-amber-700", hint: "text-amber-600/80" },
  violet: { dot: "bg-violet-500", value: "text-violet-700", hint: "text-violet-600/80" },
  slate: { dot: "bg-slate-400", value: "text-slate-800", hint: "text-slate-500" },
};

const resolveActionIcon = (key?: string) => {
  switch (key) {
    case "plus":
      return <Plus className="h-4 w-4" />;
    case "refresh":
      return <RefreshCw className="h-4 w-4" />;
    case "import":
      return <Download className="h-4 w-4" />;
    case "export":
      return <Download className="h-4 w-4 rotate-180" />;
    case "back":
      return <ArrowLeft className="h-4 w-4" />;
    case "fit":
      return <Filter className="h-4 w-4" />;
    case "edit":
      return <Pencil className="h-4 w-4" />;
    case "remove":
      return <Trash2 className="h-4 w-4" />;
    default:
      return null;
  }
};

function renderAction(action: PageHeaderAction, className?: string) {
  const icon = resolveActionIcon(action.icon);

  return (
    <Button
      key={action.key}
      type="button"
      variant={action.variant ?? "secondary"}
      size="sm"
      onClick={action.onClick}
      disabled={action.disabled}
      className={cn("shrink-0 rounded-lg", className)}
    >
      {icon}
      <span>{action.label}</span>
    </Button>
  );
}

function PageHeaderStats({ stats = [] }: { stats?: PageHeaderStatValue[] }) {
  if (!stats.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {stats.map((stat) => {
        const tone = statToneStyles[stat.tone ?? "slate"];
        return (
          <div
            key={stat.key}
            className="min-w-[132px] rounded-lg border border-slate-200 bg-white px-3 py-2"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {stat.label}
                </div>
                <div className={cn("mt-1 text-base font-semibold leading-none", tone.value)}>
                  {stat.value}
                </div>
              </div>
              <span className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", tone.dot)} />
            </div>
            {stat.hint ? (
              <div className={cn("mt-1.5 text-[11px] leading-4", tone.hint)}>
                {stat.hint}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function PageHeaderTabs({
  tabs = [],
}: {
  tabs?: Array<PageHeaderTabDefinition & { active?: boolean; onClick: () => void }>;
}) {
  if (!tabs.length) return null;

  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={tab.onClick}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
            tab.active
              ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
              : "text-slate-600 hover:bg-white hover:text-slate-900",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function CommonPageHeader({
  breadcrumbs,
  sectionLabel,
  title,
  subtitle,
  tabs,
  search,
  stats,
  primaryAction,
  secondaryActions = [],
  backAction,
  rightSlot,
}: CommonPageHeaderProps) {
  const hasStats = Boolean(stats && stats.length > 0);
  const hasSearch = Boolean(search);
  const showStatShowcase = hasStats && !hasSearch;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-5 py-3">
        <div className="min-w-0">
          {breadcrumbs && breadcrumbs.length > 0 ? (
            <Breadcrumb items={breadcrumbs} className="text-xs" />
          ) : null}
        </div>
        {sectionLabel ? (
          <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
            {sectionLabel}
          </div>
        ) : null}
      </div>

      <div className="space-y-4 px-5 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
              {subtitle ? (
                <p className="max-w-3xl text-sm leading-6 text-slate-500">{subtitle}</p>
              ) : null}
            </div>
            <PageHeaderTabs tabs={tabs} />
          </div>

          <div
            className={cn(
              "flex flex-wrap items-center justify-start gap-2 xl:justify-end",
              showStatShowcase && "xl:mr-4 xl:max-w-[48%] xl:flex-col xl:items-end xl:gap-3 xl:self-start",
            )}
          >
            <div className="flex flex-wrap items-center justify-start gap-2 xl:justify-end">
              {rightSlot}
              {backAction ? renderAction(backAction, "bg-white") : null}
              {secondaryActions.map((action) => renderAction(action, "bg-white"))}
              {primaryAction ? renderAction(primaryAction, "shadow-sm") : null}
            </div>
            {showStatShowcase ? <PageHeaderStats stats={stats} /> : null}
          </div>
        </div>

        {hasSearch ? (
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="w-full max-w-xl">
              <SearchInput
                placeholder={search.placeholder}
                value={search.value}
                onChange={(event) => search.onChange(event.target.value)}
                onClear={search.onClear}
                disabled={search.disabled}
                className="h-10"
              />
            </div>
            <PageHeaderStats stats={stats} />
          </div>
        ) : null}

      </div>
    </section>
  );
}
