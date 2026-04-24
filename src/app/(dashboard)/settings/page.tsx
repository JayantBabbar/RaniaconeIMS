"use client";

import React from "react";
import Link from "next/link";
import { TopBar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/ui/page-header";
import {
  Lock, Users, FileCode, Flag, Hash, Ruler, Scale,
  ArrowLeftRight, Tag, Folder, Puzzle, Webhook, Upload, Workflow,
  Settings2, Boxes, Shield,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════
// Settings hub — central entry point to admin/config sections
// ═══════════════════════════════════════════════════════════

const SECTIONS = [
  {
    title: "Master Data",
    description: "Reference data that underpins items, documents, and stock",
    items: [
      { label: "Status Master", href: "/master-data/status-master", icon: Flag },
      { label: "Number Series", href: "/master-data/number-series", icon: Hash },
      { label: "UoM Categories", href: "/master-data/uom-categories", icon: Ruler },
      { label: "UoMs", href: "/master-data/uoms", icon: Scale },
      { label: "UoM Conversions", href: "/master-data/uom-conversions", icon: ArrowLeftRight },
      { label: "Item Brands", href: "/master-data/brands", icon: Tag },
      { label: "Item Categories", href: "/master-data/categories", icon: Folder },
      { label: "Document Types", href: "/master-data/document-types", icon: FileCode },
    ],
  },
  {
    title: "Access & Permissions",
    description: "Users, roles, and workspace access",
    items: [
      { label: "Users", href: "/admin/users", icon: Users },
      { label: "Roles", href: "/admin/roles", icon: Shield },
      { label: "Permissions Reference", href: "/admin/permissions", icon: Lock },
      { label: "Change Password", href: "/account/change-password", icon: Lock },
    ],
  },
  {
    title: "Workflow & Custom Fields",
    description: "Model document lifecycles and capture custom data",
    items: [
      { label: "Workflows", href: "/settings/workflows", icon: Workflow },
      { label: "Custom Fields", href: "/settings/custom-fields", icon: Puzzle },
    ],
  },
  {
    title: "Configuration",
    description: "Tenant-wide and module-scoped settings",
    items: [
      { label: "Tenant Configuration", href: "/settings/tenant-config", icon: Settings2 },
      { label: "Module Configuration", href: "/settings/module-config", icon: Boxes },
    ],
  },
  {
    title: "Integrations",
    description: "Connect external systems and move data in/out",
    items: [
      { label: "Integrations", href: "/settings/integrations", icon: Puzzle },
      { label: "Webhooks", href: "/settings/webhooks", icon: Webhook },
      { label: "Imports", href: "/settings/imports", icon: Upload },
    ],
  },
];

export default function SettingsPage() {
  return (
    <div className="flex-1 bg-surface flex flex-col overflow-auto">
      <TopBar crumbs={["Settings"]} />
      <div className="p-5 space-y-6">
        <PageHeader
          title="Settings"
          description="The control room for your workspace. Set up the reference data every other screen relies on, control who can do what, automate document lifecycles, and connect outside systems."
          learnMore="If you're new to this workspace, work through the sections top-to-bottom. Master Data first (the nouns your business uses — units, brands, categories), then Access (who your team is), then Workflows (how documents flow), and finally Integrations (plugging in other tools)."
        />

        {SECTIONS.map((s) => (
          <div key={s.title} className="space-y-2">
            <div>
              <h2 className="text-sm font-semibold">{s.title}</h2>
              <p className="text-xs text-foreground-muted">{s.description}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 max-w-4xl">
              {s.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="bg-white border border-hairline rounded-md p-3 flex items-center gap-2.5 hover:border-brand/40 transition-colors"
                  >
                    <div className="w-7 h-7 rounded bg-brand-light flex items-center justify-center text-brand">
                      <Icon size={14} />
                    </div>
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
