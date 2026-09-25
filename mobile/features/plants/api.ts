import { PlantProfile, WhatIfResponse, type ImageInput } from "@rootsight/shared/schema";
import { post } from "@/lib/api/client";

export const analyze = (photo: ImageInput) => post("analyze", photo, PlantProfile);

export const refine = (photo: ImageInput, renderScreenshot: ImageInput, profile: PlantProfile) =>
  post("refine", { photo, renderScreenshot, profile }, PlantProfile);

export const whatIf = (profile: PlantProfile, question: string) =>
  post("whatif", { profile, question }, WhatIfResponse);
