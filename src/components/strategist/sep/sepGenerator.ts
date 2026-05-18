import { APPROVER, BOARD_ID, boardCohorts } from "./boardData";
import { channelFileBuilders } from "./templates";
import { briefMd, accountsJson } from "./templates";
import type {
  ChannelId,
  Cohort,
  SEP,
  SEPCohortFolder,
  SEPImmediateAction,
  SEPManifest,
} from "./sepTypes";
import { PRIORITY_META, REVIEW_RANK, TREATMENT_RANK } from "./sepTypes";

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const buildCohortFolder = (
  cohort: Cohort,
  channels: ChannelId[],
): SEPCohortFolder => {
  const files = [
    {
      name: "brief.md",
      mime: "text/markdown" as const,
      content: briefMd(cohort, channels),
    },
    {
      name: "accounts.json",
      mime: "application/json" as const,
      content: accountsJson(cohort),
    },
    ...channels.flatMap((ch) => channelFileBuilders[ch](cohort)),
  ];
  return {
    cohortId: cohort.id,
    name: cohort.name,
    treatment: cohort.treatment,
    priority: cohort.priority,
    folderName: slug(cohort.name),
    channels,
    accountCount: cohort.accounts.length,
    files,
  };
};

const buildImmediateActions = (
  folders: SEPCohortFolder[],
  cohorts: Cohort[],
): SEPImmediateAction[] => {
  const cohortMap = new Map(cohorts.map((c) => [c.id, c]));
  const actions: SEPImmediateAction[] = [];
  for (const folder of folders) {
    if (folder.treatment === "EXCLUDE") continue;
    if (folder.channels.length === 0) {
      actions.push({
        cohortId: folder.cohortId,
        action: `Review ${folder.name} — no channels selected yet`,
        priority: folder.priority,
        channel: "none",
      });
      continue;
    }
    for (const ch of folder.channels) {
      const verb =
        ch === "meta" || ch === "tiktok"
          ? "Launch"
          : ch === "linkedin" || ch === "email" || ch === "personalized"
            ? "Send"
            : ch === "figma"
              ? "Brief"
              : "Enroll";
      actions.push({
        cohortId: folder.cohortId,
        action: `${verb} ${ch} ${ch === "crm" ? "workflow" : "campaign"} for ${folder.name}`,
        priority: folder.priority,
        channel: ch,
      });
    }
  }
  actions.sort((a, b) => {
    const ca = cohortMap.get(a.cohortId)!;
    const cb = cohortMap.get(b.cohortId)!;
    const pa = PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank;
    if (pa !== 0) return pa;
    const ta = TREATMENT_RANK[ca.treatment] - TREATMENT_RANK[cb.treatment];
    if (ta !== 0) return ta;
    return REVIEW_RANK[ca.reviewState] - REVIEW_RANK[cb.reviewState];
  });
  return actions;
};

export interface GenerateOpts {
  cohortIds: string[];
  channelsByCohort: Record<string, ChannelId[]>;
  scope: "board" | "cohort";
  status: "draft" | "approved";
  version: number;
  generatedAt?: string;
}

export const generateSEP = (opts: GenerateOpts): SEP => {
  const generatedAt = opts.generatedAt ?? new Date().toISOString();
  const cohorts = opts.cohortIds
    .map((id) => boardCohorts.find((c) => c.id === id))
    .filter(Boolean) as Cohort[];
  const folders = cohorts.map((c) =>
    buildCohortFolder(c, opts.channelsByCohort[c.id] ?? []),
  );
  const immediateActions = buildImmediateActions(folders, cohorts);
  const datePart = generatedAt.slice(0, 10);
  const id = `sep-${datePart}-v${opts.version}`;
  const manifest: SEPManifest = {
    id,
    version: opts.version,
    status: opts.status,
    generatedAt,
    approvedAt: opts.status === "approved" ? generatedAt : null,
    approvedBy: opts.status === "approved" ? APPROVER : null,
    boardId: BOARD_ID,
    scope: opts.scope,
    immediateActions,
    cohorts: folders.map((f) => ({
      id: f.cohortId,
      name: f.name,
      treatment: f.treatment,
      priority: f.priority,
      folderName: f.folderName,
      channels: f.channels,
      accountCount: f.accountCount,
    })),
  };
  return { manifest, cohorts: folders };
};

export const manifestFile = (sep: SEP): string =>
  JSON.stringify(sep.manifest, null, 2);