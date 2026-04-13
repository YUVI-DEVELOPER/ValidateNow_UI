import React, { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area
} from "recharts";
import { Card, CardHeader, CardBody, KPICard } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge, StatusBadge } from "../components/ui/Badge";
import { Tabs } from "../components/ui/Tabs";
import { Select } from "../components/ui/Input";

const monthlyActivity = [
  { month: "Sep", created: 18, modified: 24, deleted: 2 },
  { month: "Oct", created: 22, modified: 31, deleted: 3 },
  { month: "Nov", created: 15, modified: 28, deleted: 1 },
  { month: "Dec", created: 12, modified: 19, deleted: 2 },
  { month: "Jan", created: 28, modified: 35, deleted: 4 },
  { month: "Feb", created: 34, modified: 42, deleted: 3 },
];

const orgTypeData = [
  { type: "Corporate", count: 2, active: 2, inactive: 0 },
  { type: "Region", count: 4, active: 4, inactive: 0 },
  { type: "Division", count: 12, active: 11, inactive: 1 },
  { type: "Plant", count: 38, active: 35, inactive: 3 },
  { type: "Section", count: 94, active: 88, inactive: 6 },
  { type: "Dept", count: 98, active: 90, inactive: 8 },
];

const supplierTypeData = [
  { name: "Tier 1", value: 24, color: "#2563eb" },
  { name: "Tier 2", value: 31, color: "#64748b" },
  { name: "Tier 3", value: 18, color: "#94a3b8" },
  { name: "Partner", value: 14, color: "#cbd5e1" },
];

const auditLog = [
  { ts: "Feb 26, 09:30", module: "Org Structure", entity: "Chennai Plant", action: "Updated", user: "admin", field: "Status", from: "Pending", to: "Active" },
  { ts: "Feb 25, 14:15", module: "Supplier", entity: "Infosys Ltd", action: "Created", user: "mgr1", field: "—", from: "—", to: "New Record" },
  { ts: "Feb 25, 11:00", module: "Lookup Master", entity: "ORG_TYPE", action: "Modified", user: "admin", field: "Description", from: "Old text", to: "New text" },
  { ts: "Feb 24, 16:45", module: "Lookup Values", entity: "ORG_TYPE / CORP", action: "Updated", user: "admin", field: "Sort Order", from: "2", to: "1" },
  { ts: "Feb 24, 10:20", module: "Org Structure", entity: "Austin Division", action: "Created", user: "admin", field: "—", from: "—", to: "New Record" },
];

const moduleColors: Record<string, "primary" | "success" | "warning" | "info"> = {
  "Org Structure": "primary",
  "Supplier": "success",
  "Lookup Master": "warning",
  "Lookup Values": "info",
};

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reports & Analytics</h1>
          <p className="text-sm text-slate-500 mt-0.5">Summary views and activity analytics across all modules</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date range */}
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-600">
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Jan 1 – Feb 26, 2026
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </div>
          <Button variant="secondary" size="sm">⟳ Refresh</Button>
          <Button variant="secondary" size="sm">↑ Export PDF</Button>
          <Button variant="secondary" size="sm">↑ Excel</Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { key: "overview", label: "Overview" },
          { key: "org", label: "Org Structure" },
          { key: "supplier", label: "Suppliers" },
          { key: "audit", label: "Audit Trail" },
        ]}
        active={activeTab}
        onChange={setActiveTab}
        variant="underline"
        className="bg-white rounded-xl px-2 border border-slate-200 shadow-xs"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { title: "Org Nodes", value: "248", change: "+12", dir: "up" as const },
          { title: "Active Suppliers", value: "79", change: "+3", dir: "up" as const },
          { title: "Lookup Categories", value: "14", change: "0", dir: "neutral" as const },
          { title: "Lookup Values", value: "312", change: "+8", dir: "up" as const },
          { title: "Modified (Month)", value: "34", change: "+18%", dir: "up" as const },
          { title: "Pending Approvals", value: "6", change: "-2", dir: "down" as const },
        ].map(kpi => (
          <div key={kpi.title} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">{kpi.title}</span>
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${kpi.dir === "up" ? "bg-green-50 text-green-600" : kpi.dir === "down" ? "bg-red-50 text-red-500" : "bg-slate-100 text-slate-500"}`}>
                {kpi.dir === "up" ? "↑" : kpi.dir === "down" ? "↓" : "→"} {kpi.change}
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900">{kpi.value}</div>
            <div className="mt-2 h-1 bg-slate-100 rounded-full">
              <div className="h-1 bg-blue-500 rounded-full" style={{ width: "65%" }} />
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Bar chart */}
        <Card padding="none">
          <CardHeader title="Org Nodes by Type" description="Active vs Inactive breakdown" action={
            <Select options={[{ value: "count", label: "Count" }, { value: "pct", label: "Percent" }]} className="w-28 h-7 text-xs" />
          } />
          <CardBody>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={orgTypeData} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="type" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <Bar dataKey="active" name="Active" fill="#2563eb" radius={[4, 4, 0, 0]} stackId="a" />
                <Bar dataKey="inactive" name="Inactive" fill="#e2e8f0" radius={[4, 4, 0, 0]} stackId="a" />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        {/* Pie chart */}
        <Card padding="none">
          <CardHeader title="Suppliers by Type" description="Current distribution" />
          <CardBody>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={supplierTypeData} cx="50%" cy="45%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                  {supplierTypeData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
              </PieChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        {/* Area chart */}
        <Card padding="none">
          <CardHeader title="Monthly Activity" description="Last 6 months" />
          <CardBody>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyActivity} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
                <defs>
                  <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorModified" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#64748b" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#64748b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <Area type="monotone" dataKey="created" name="Created" stroke="#2563eb" strokeWidth={2} fill="url(#colorCreated)" />
                <Area type="monotone" dataKey="modified" name="Modified" stroke="#64748b" strokeWidth={2} fill="url(#colorModified)" />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>

      {/* Summary Tables */}
      <div className="grid grid-cols-2 gap-4">
        {/* Org summary */}
        <Card padding="none">
          <CardHeader title="Org Structure Summary" action={<Button variant="ghost" size="xs">↑ Export</Button>} />
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {["Node Type", "Total", "Active", "Inactive", "% Active"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orgTypeData.map(row => (
                  <tr key={row.type} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{row.type}</td>
                    <td className="px-4 py-2.5 text-slate-700">{row.count}</td>
                    <td className="px-4 py-2.5 text-slate-700">{row.active}</td>
                    <td className="px-4 py-2.5 text-slate-500">{row.inactive}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full max-w-16">
                          <div className="h-1.5 bg-blue-500 rounded-full" style={{ width: `${Math.round(row.active / row.count * 100)}%` }} />
                        </div>
                        <span className="text-xs font-medium text-slate-600">{Math.round(row.active / row.count * 100)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td className="px-4 py-2.5 font-bold text-slate-900">TOTAL</td>
                  <td className="px-4 py-2.5 font-bold text-slate-900">248</td>
                  <td className="px-4 py-2.5 font-bold text-slate-900">230</td>
                  <td className="px-4 py-2.5 font-semibold text-slate-600">18</td>
                  <td className="px-4 py-2.5 font-semibold text-slate-700">92.7%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        {/* Supplier summary */}
        <Card padding="none">
          <CardHeader title="Supplier Summary" action={<Button variant="ghost" size="xs">↑ Export</Button>} />
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {["Supplier Type", "Count", "First Enrolled", "Countries"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { type: "Tier 1", count: 24, enrolled: "Jan 2024", countries: 3 },
                  { type: "Tier 2", count: 31, enrolled: "Feb 2024", countries: 5 },
                  { type: "Tier 3", count: 18, enrolled: "Mar 2024", countries: 4 },
                  { type: "Partner", count: 14, enrolled: "Apr 2024", countries: 8 },
                ].map(row => (
                  <tr key={row.type} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5"><Badge variant="outline" size="sm">{row.type}</Badge></td>
                    <td className="px-4 py-2.5 font-bold text-slate-900">{row.count}</td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">{row.enrolled}</td>
                    <td className="px-4 py-2.5 text-slate-600">{row.countries}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td className="px-4 py-2.5 font-bold text-slate-900">TOTAL</td>
                  <td className="px-4 py-2.5 font-bold text-slate-900">87</td>
                  <td className="px-4 py-2.5 text-slate-400 text-xs">—</td>
                  <td className="px-4 py-2.5 font-semibold text-slate-700">12</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Audit Log */}
      <Card padding="none">
        <CardHeader
          title="Audit Trail — Recent Changes"
          action={
            <div className="flex gap-2">
              <Select placeholder="All Modules" options={["Org Structure","Supplier","Lookup Master","Lookup Values"].map(v => ({ value: v.toLowerCase().replace(/\s+/g,"_"), label: v }))} className="w-36 h-8 text-xs" />
              <Button variant="ghost" size="xs">↑ Export</Button>
            </div>
          }
        />
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {["Timestamp", "Module", "Entity", "Action", "Changed By", "Field", "Old Value", "New Value"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLog.map((log, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 text-xs text-slate-400 font-mono whitespace-nowrap">{log.ts}</td>
                  <td className="px-4 py-2.5"><Badge variant={moduleColors[log.module] || "default"} size="sm">{log.module}</Badge></td>
                  <td className="px-4 py-2.5 font-medium text-slate-800">{log.entity}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-medium ${log.action === "Created" ? "text-green-600" : log.action === "Deleted" ? "text-red-500" : "text-amber-600"}`}>{log.action}</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{log.user}</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{log.field}</td>
                  <td className="px-4 py-2.5 text-slate-400 text-xs">{log.from}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-700 text-xs">{log.to}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
