import {
  Sun,
  BarChart3,
  Building,
  Factory,
  TrendingUp,
  Users,
  Scale,
  Shield,
  AlertTriangle,
  Globe,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { RegulatoryKeyDataPoint, UntypedRegulatoryUpdate } from "./types";

export function getIconByName(iconName: string): LucideIcon {
  switch (iconName) {
    case "sun":
      return Sun;
    case "chart":
    case "chart-line":
      return BarChart3;
    case "government":
      return Building;
    case "competition":
      return Factory;
    case "arrow-up":
      return TrendingUp;
    case "users":
      return Users;
    case "gavel":
      return Scale;
    case "scale":
      return Scale;
    default:
      return Scale;
  }
}

export function getBadgeColor(tag: string): string {
  switch (tag) {
    case "New":
      return "bg-blue-100 text-blue-800";
    case "Update":
      return "bg-yellow-100 text-yellow-800";
    case "Support":
      return "bg-green-100 text-green-800";
    case "Competitive":
      return "bg-purple-100 text-purple-800";
    case "Risk":
      return "bg-red-100 text-red-800";
    case "Market Leaders":
      return "bg-green-100 text-green-800";
    case "Regulatory":
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function deriveKeyDataPoints(
  keyUpdates: UntypedRegulatoryUpdate[] | undefined,
  fields: {
    euAiActDeadline: string;
    gdprCompliance: string;
    potentialFines: string;
    dataLocalization: string;
  },
): RegulatoryKeyDataPoint[] {
  if (keyUpdates && Array.isArray(keyUpdates)) {
    return keyUpdates
      .filter((update: UntypedRegulatoryUpdate) => update)
      .map((update: UntypedRegulatoryUpdate, index: number) => {
        // Parse if update is a JSON string
        let parsedUpdate = update;
        if (typeof update === "string") {
          try {
            parsedUpdate = JSON.parse(update);
          } catch (_e) {
            parsedUpdate = update;
          }
        }

        // Try multiple possible field names for title and value/description
        const title =
          parsedUpdate.title ||
          parsedUpdate.name ||
          parsedUpdate.label ||
          parsedUpdate.heading ||
          `Update ${index + 1}`;
        const value =
          parsedUpdate.description ||
          parsedUpdate.value ||
          parsedUpdate.content ||
          parsedUpdate.text ||
          parsedUpdate.details ||
          "";

        return {
          id: title?.toLowerCase().replace(/\s+/g, "-") || `update-${index}`,
          icon: getIconByName(parsedUpdate.icon || "scale"),
          title: title,
          value: value,
          badge: parsedUpdate.tag || parsedUpdate.badge || parsedUpdate.category || "Update",
          badgeColor: getBadgeColor(
            parsedUpdate.tag || parsedUpdate.badge || parsedUpdate.category,
          ),
          tooltip: value || title,
        };
      });
  }

  return [
    {
      id: "eu-ai-act",
      icon: Scale,
      title: "EU AI Act enforcement starts Q1 2026",
      value: fields.euAiActDeadline,
      badge: "New",
      badgeColor: "bg-blue-100 text-blue-800",
      tooltip:
        "New European AI Act comes into effect with strict compliance requirements for AI systems.",
    },
    {
      id: "gdpr-compliance",
      icon: Shield,
      title: "GDPR compliance among SaaS providers",
      value: fields.gdprCompliance,
      badge: "Update",
      badgeColor: "bg-yellow-100 text-yellow-800",
      tooltip:
        "Current adoption rates show varying levels of GDPR compliance across different SaaS categories.",
    },
    {
      id: "potential-fines",
      icon: AlertTriangle,
      title: "Potential fines: up to 6% revenue",
      value: fields.potentialFines,
      badge: "Risk",
      badgeColor: "bg-red-100 text-red-800",
      tooltip: "Maximum penalty levels for non-compliance with major data protection regulations.",
    },
    {
      id: "data-localization",
      icon: Globe,
      title: "China data localization laws impacting global SaaS",
      value: fields.dataLocalization,
      badge: "High Priority",
      badgeColor: "bg-purple-100 text-purple-800",
      tooltip:
        "New data residency requirements affecting international SaaS deployment strategies.",
    },
  ];
}
