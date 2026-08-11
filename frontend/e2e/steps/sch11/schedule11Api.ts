import { type APIRequestContext, expect } from '@playwright/test';
import {
  type ScheduleKey,
  checkStatusUrl,
  locationUrl,
  locationsUrl,
  scheduleUrl,
} from '../../fixtures/sch11/schedule11-test-data';

/**
 * Thin API helpers for the Schedule 11 locations sub-resource (Schedule11Api). Used to seed a
 * precondition row, to read back writes the UI made, and to clean up rows a scenario created. The
 * specs stay pure-UI: these run only inside Given preconditions and teardown, always through the app's
 * own real endpoints (never direct SQL — Schedule 11 exposes a full CRUD surface, so the skill's
 * "prefer the app's DELETE endpoint" rule applies and no DB fallback is needed).
 */

/**
 * One location row as served by `GET /api/v1/schedule11` (`SilvicultureLocation`).
 *
 * Every nullable member is declared OPTIONAL because Jackson is configured non_null: a null column is
 * omitted from the JSON entirely, so it arrives as `undefined` rather than `null`. Treat absent and null
 * as the same "no value" (see `asText` in schedule11.steps.ts).
 */
export interface Sch11Location {
  locationId: number;
  location: string;
  enhancedIndicator: boolean;
  biogeoclimaticCatalogueId: number;
  becLabel?: string | null;
  netArea?: number | null;
  actualCost?: number | null;
  plannedCost?: number | null;
  totalCost?: number | null;
  costPerNetArea?: number | null;
  comments?: string | null;
  revisionCount: number;
}

/** Footer totals (`SilvicultureTotals`) — any field with no contributors is ABSENT, never zero. */
export interface Sch11Totals {
  netArea?: number | null;
  actualCost?: number | null;
  plannedCost?: number | null;
  totalCost?: number | null;
  costPerNetArea?: number | null;
}

/** The Schedule 11 document (`Schedule11Response`). */
export interface Sch11Document {
  millId: number;
  year: number;
  trackStatus: string | null;
  editable: boolean;
  locations: Sch11Location[];
  totals: Sch11Totals;
  message?: { key: string; text: string } | null;
}

/** One check-status result (`Schedule11CheckStatusResponse`). `requirementsMetMessage` is OMITTED when unmet. */
export interface Sch11CheckStatus {
  requirementsMet: boolean;
  errors: { key: string; text: string }[];
  requirementsMetMessage?: { key: string; text: string };
  message: { key: string; text: string };
}

/** The fields a seeded precondition row carries. Costs are nullable so S05/S06 can omit one. */
export interface SeedLocation {
  location: string;
  enhancedIndicator: boolean;
  biogeoclimaticCatalogueId: number;
  netArea: number;
  actualCost?: number | null;
  plannedCost?: number | null;
  comments?: string | null;
}

/** GET the Schedule 11 document, failing loud on a non-200 (a drifted anchor must not look like a UI bug). */
export async function getSchedule11(
  request: APIRequestContext,
  { millId, year }: ScheduleKey,
): Promise<Sch11Document> {
  const res = await request.get(scheduleUrl(millId, year));
  expect(res.ok(), `GET schedule11 ${millId}/${year} returned HTTP ${res.status()}`).toBeTruthy();
  return (await res.json()) as Sch11Document;
}

/** POST one location and return its assigned id. Used only to SEED a precondition, never to assert. */
export async function addLocation(
  request: APIRequestContext,
  { millId, year }: ScheduleKey,
  seed: SeedLocation,
): Promise<number> {
  const res = await request.post(locationsUrl(millId, year), {
    data: {
      actualCost: null,
      plannedCost: null,
      comments: null,
      ...seed,
    },
  });
  expect(
    res.ok(),
    `seed POST location "${seed.location}" on ${millId}/${year} returned HTTP ${res.status()}: ${await res.text()}`,
  ).toBeTruthy();
  const doc = (await res.json()) as Sch11Document;
  const added = doc.locations.find((l) => l.location === seed.location);
  expect(added, `seeded location "${seed.location}" not present in the POST response`).toBeTruthy();
  return added!.locationId;
}

/** Every location currently on the schedule whose `location` text equals `marker`. */
export async function locationsByMarker(
  request: APIRequestContext,
  key: ScheduleKey,
  marker: string,
): Promise<Sch11Location[]> {
  const doc = await getSchedule11(request, key);
  return doc.locations.filter((l) => l.location === marker);
}

/**
 * The single location carrying `marker`, asserting exactly one exists. This is the read-back used to
 * PROVE a UI write persisted — the skill's "verify by API read-back" rule: assert the full stored
 * record, not merely that a toast appeared.
 */
export async function locationByMarker(
  request: APIRequestContext,
  key: ScheduleKey,
  marker: string,
): Promise<Sch11Location> {
  const matches = await locationsByMarker(request, key, marker);
  expect(
    matches.length,
    `expected exactly one Schedule 11 location "${marker}" on ${key.millId}/${key.year}, found ${matches.length}`,
  ).toBe(1);
  return matches[0];
}

/** POST check-status (read-only validation — mutates nothing). */
export async function checkStatus(
  request: APIRequestContext,
  { millId, year }: ScheduleKey,
): Promise<Sch11CheckStatus> {
  const res = await request.post(checkStatusUrl(millId, year));
  expect(res.ok(), `POST check-status ${millId}/${year} returned HTTP ${res.status()}`).toBeTruthy();
  return (await res.json()) as Sch11CheckStatus;
}

/**
 * Delete every location carrying `marker`, then PROVE none remain (fail loud). A 404 means the UI
 * already deleted it — the expected outcome for the S07 happy path — so it counts as already-gone.
 */
export async function deleteLocationsByMarker(
  request: APIRequestContext,
  key: ScheduleKey,
  marker: string,
): Promise<void> {
  for (const row of await locationsByMarker(request, key, marker)) {
    const res = await request.delete(locationUrl(row.locationId, key.millId, key.year));
    expect(
      [200, 404].includes(res.status()),
      `DELETE location ${row.locationId} ("${marker}") returned HTTP ${res.status()}`,
    ).toBeTruthy();
  }
  const remaining = await locationsByMarker(request, key, marker);
  expect(
    remaining.length,
    `Schedule 11 locations "${marker}" left behind on ${key.millId}/${key.year} after cleanup`,
  ).toBe(0);
}
