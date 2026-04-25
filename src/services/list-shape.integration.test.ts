import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server, INV_BASE } from "@/test/msw";
import { countService } from "@/services/counts.service";
import { documentService } from "@/services/documents.service";
import { workflowService } from "@/services/workflows.service";
import { customFieldService, integrationService, webhookService, importService, tenantConfigService, moduleConfigService, attachmentService } from "@/services/settings.service";
import { documentTypeService } from "@/services/master-data.service";
import { partyService } from "@/services/parties.service";
import { locationService } from "@/services/locations.service";

// ═══════════════════════════════════════════════════════════════════
// List-shape resilience tests.
//
// Background: backend list endpoints are inconsistent — some return a
// `PaginatedResponse<T>` envelope `{data: T[], pagination: {...}}` and
// some return a plain `T[]` array. This caused a real production bug
// where the Counts page silently rendered empty after creating a count.
//
// These tests pin every list-returning service method to the contract
// "returns T[] regardless of which shape the backend ships". If the
// backend changes shape on us tomorrow, the tests still pass; if a
// service regresses to the broken pattern, the test fails.
// ═══════════════════════════════════════════════════════════════════

const sampleId = "00000000-0000-0000-0000-000000000001";
const sampleRow = (id = sampleId) => ({
  id,
  tenant_id: "tenant-1",
  created_at: "2026-04-25T00:00:00Z",
  updated_at: "2026-04-25T00:00:00Z",
});

const envelope = <T>(rows: T[]) => ({
  data: rows,
  pagination: { limit: 200, next_cursor: null, has_more: false },
});

// Each entry is: [name, fn that runs the call, the URL pattern, sample row factory].
type Case = {
  name: string;
  call: () => Promise<unknown[]>;
  path: string;
};

const cases: Case[] = [
  // Inventory service — endpoints currently returning plain arrays.
  {
    name: "countService.list",
    call: () => countService.list({ limit: 10 }),
    path: `${INV_BASE}/counts`,
  },
  {
    name: "documentService.list",
    call: () => documentService.list({ limit: 10 }),
    path: `${INV_BASE}/documents`,
  },
  {
    name: "documentService.listLines",
    call: () => documentService.listLines("doc-1"),
    path: `${INV_BASE}/documents/doc-1/lines`,
  },
  {
    name: "workflowService.list",
    call: () => workflowService.list({ limit: 10 }),
    path: `${INV_BASE}/workflows`,
  },
  {
    name: "workflowService.listStates",
    call: () => workflowService.listStates("wf-1"),
    path: `${INV_BASE}/workflows/wf-1/states`,
  },
  {
    name: "workflowService.listTransitions",
    call: () => workflowService.listTransitions("wf-1"),
    path: `${INV_BASE}/workflows/wf-1/transitions`,
  },
  {
    name: "customFieldService.listDefinitions",
    call: () => customFieldService.listDefinitions({ limit: 10 }),
    path: `${INV_BASE}/custom-field-definitions`,
  },
  {
    name: "integrationService.list",
    call: () => integrationService.list({ limit: 10 }),
    path: `${INV_BASE}/integrations`,
  },
  {
    name: "webhookService.list",
    call: () => webhookService.list({ limit: 10 }),
    path: `${INV_BASE}/webhooks`,
  },
  {
    name: "importService.list",
    call: () => importService.list({ limit: 10 }),
    path: `${INV_BASE}/imports`,
  },
  {
    name: "tenantConfigService.list",
    call: () => tenantConfigService.list({ limit: 10 }),
    path: `${INV_BASE}/tenant-config`,
  },
  {
    name: "moduleConfigService.list",
    call: () => moduleConfigService.list({ limit: 10 }),
    path: `${INV_BASE}/module-config`,
  },
  {
    name: "attachmentService.list",
    call: () => attachmentService.list({ limit: 10 }),
    path: `${INV_BASE}/attachments`,
  },
  {
    name: "documentTypeService.list",
    call: () => documentTypeService.list({ limit: 10 }),
    path: `${INV_BASE}/document-types`,
  },
  {
    name: "partyService.listAddresses",
    call: () => partyService.listAddresses("party-1"),
    path: `${INV_BASE}/parties/party-1/addresses`,
  },
  {
    name: "partyService.listContacts",
    call: () => partyService.listContacts("party-1"),
    path: `${INV_BASE}/parties/party-1/contacts`,
  },
  {
    name: "locationService.listBins",
    call: () => locationService.listBins("loc-1"),
    path: `${INV_BASE}/inventory-locations/loc-1/bins`,
  },
];

describe("list-shape resilience — every service must return T[]", () => {
  for (const c of cases) {
    describe(c.name, () => {
      it("returns array when backend sends a plain JSON array", async () => {
        const rows = [sampleRow("plain-1"), sampleRow("plain-2")];
        server.use(
          http.get(c.path, () => HttpResponse.json(rows)),
        );
        const result = await c.call();
        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(2);
        expect((result[0] as { id: string }).id).toBe("plain-1");
      });

      it("returns array when backend sends a PaginatedResponse envelope", async () => {
        const rows = [sampleRow("env-1")];
        server.use(
          http.get(c.path, () => HttpResponse.json(envelope(rows))),
        );
        const result = await c.call();
        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(1);
        expect((result[0] as { id: string }).id).toBe("env-1");
      });

      it("returns empty array on empty array response", async () => {
        server.use(http.get(c.path, () => HttpResponse.json([])));
        const result = await c.call();
        expect(result).toEqual([]);
      });

      it("returns empty array on empty envelope response", async () => {
        server.use(
          http.get(c.path, () => HttpResponse.json(envelope([]))),
        );
        const result = await c.call();
        expect(result).toEqual([]);
      });

      it("returns empty array when response body is null/undefined-ish", async () => {
        // Defensive: backend should never send this, but if it does the
        // helper must not blow up.
        server.use(http.get(c.path, () => HttpResponse.json(null)));
        const result = await c.call();
        expect(result).toEqual([]);
      });
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// Counts-specific regression — the bug that motivated this whole sweep.
// Reproduces the real-world scenario: POST 201 followed by GET that
// must surface the just-created row.
// ═══════════════════════════════════════════════════════════════════

describe("counts list — POST then GET shows the new row (regression)", () => {
  it("a count created via POST appears in the subsequent GET", async () => {
    const created = {
      ...sampleRow("count-new"),
      count_number: "CT-2026-04-25-1234",
      count_date: "2026-04-25",
      location_id: "loc-1",
    };

    server.use(
      http.post(`${INV_BASE}/counts`, async () =>
        HttpResponse.json(created, { status: 201 }),
      ),
      // Backend returns plain array for /counts (the original bug).
      http.get(`${INV_BASE}/counts`, () => HttpResponse.json([created])),
    );

    const createResp = await countService.create({
      count_number: created.count_number,
      count_date: created.count_date,
      location_id: created.location_id,
    });
    expect(createResp.id).toBe("count-new");

    const listResp = await countService.list();
    expect(listResp).toHaveLength(1);
    expect(listResp[0].id).toBe("count-new");
    expect(listResp[0].count_number).toBe(created.count_number);
  });
});
