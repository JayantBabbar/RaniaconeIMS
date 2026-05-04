import { api } from "@/lib/api-client";
import { IMPORTS } from "@/lib/api-constants";
import type {
  ImportEntityType,
  ImportPreviewResponse,
  ImportCommitResponse,
} from "@/types";

// ═══════════════════════════════════════════════════════════════════
// Imports service — Phase 7 (REQ-11).
//
// Three operations:
//
//   getTemplate(entity)  — returns a CSV string with the header row
//                          and one example row. Users download this,
//                          fill in rows, and re-upload.
//
//   preview(payload)     — sends parsed rows to the server, gets back
//                          per-row validation. NOTHING IS PERSISTED.
//                          User reviews; fixes the source CSV; re-runs.
//
//   commit(payload)      — actually creates the entities. Backend
//                          re-validates as the last line of defence;
//                          partial failures are surfaced in `errors`.
//
// Two-step flow exists so users can spot errors (especially dependency
// errors like "brand 'Acme' doesn't exist yet") before any state
// changes hit the database.
// ═══════════════════════════════════════════════════════════════════

interface PreviewPayload {
  entity: ImportEntityType;
  rows: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

interface CommitPayload {
  entity: ImportEntityType;
  /** Only the rows the user has approved. Server will skip any that
   *  re-fail validation. */
  rows: Array<Record<string, unknown>>;
  /** Filename for audit-log purposes. */
  file_name?: string;
  [key: string]: unknown;
}

export const importsService = {
  /** Fetch the CSV template. Returns plain text (CSV body) — caller
   *  triggers the download via Blob. */
  getTemplate: (entity: ImportEntityType) =>
    api.get<string>(IMPORTS.TEMPLATE(entity)),

  preview: (payload: PreviewPayload) =>
    api.post<ImportPreviewResponse>(IMPORTS.PREVIEW, payload),

  commit: (payload: CommitPayload) =>
    api.post<ImportCommitResponse>(IMPORTS.COMMIT, payload),
};
