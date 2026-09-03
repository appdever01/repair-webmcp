import { MODEL_ASSET_PATH } from "../generation/contracts";

export function modelRequestHeaders(
  modelUrl: string,
  sessionToken: string | null,
): Record<string, string> {
  if (!sessionToken || !modelUrl.startsWith(`${MODEL_ASSET_PATH}?`)) return {};
  return { Authorization: `Bearer ${sessionToken}` };
}
