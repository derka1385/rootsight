import Constants from 'expo-constants';
import type { z } from 'zod';
import { PlantProfile, WhatIfResponse, type ImageInput } from '@rootsight/shared/schema';

// No Vite proxy on native, so the API needs an absolute URL. EXPO_PUBLIC_API_URL wins; in dev we fall back
// to the machine running Metro (same host the phone already reaches), port 8787.
function resolveApiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
  return `http://${host}:8787`;
}

export const API_URL = resolveApiUrl();

async function post<S extends z.ZodType>(path: string, body: unknown, schema: S): Promise<z.infer<S>> {
  const res = await fetch(`${API_URL}/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw new Error([json.error, json.details].filter(Boolean).join(': '));
  return schema.parse(json);
}

export const analyze = (photo: ImageInput) => post('analyze', photo, PlantProfile);

export const refine = (photo: ImageInput, renderScreenshot: ImageInput, profile: PlantProfile) =>
  post('refine', { photo, renderScreenshot, profile }, PlantProfile);

export const whatIf = (profile: PlantProfile, question: string) =>
  post('whatif', { profile, question }, WhatIfResponse);
