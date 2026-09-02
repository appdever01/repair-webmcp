import { analyzeObjectRequestSchema } from "../../src/generation/contracts";
import { getGenerationConfig } from "../_lib/config";
import { handleApi, jsonResponse, readJson, requireMethod, requireSameOrigin } from "../_lib/http";
import { validateImage } from "../_lib/image";
import { analyzeWithOpenAI } from "../_lib/openai";
import { createSessionToken } from "../_lib/token";

export default function handler(request: Request): Promise<Response> {
  return handleApi(async () => {
    requireMethod(request, ["POST"]);
    requireSameOrigin(request);
    const config = getGenerationConfig();
    const input = await readJson(request, analyzeObjectRequestSchema);
    const image = validateImage(input.image);
    const analysis = await analyzeWithOpenAI(
      image,
      input.problemDescription,
      config,
      request.signal,
    );
    const sessionToken = createSessionToken(
      image.sha256,
      analysis,
      config.sessionSigningSecret,
      config.sessionTtlSeconds,
    );
    return jsonResponse({ sessionToken, analysis });
  });
}
