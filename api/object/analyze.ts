import { analyzeObjectRequestSchema } from "../../src/generation/contracts.js";
import { getGenerationConfig } from "../_lib/config.js";
import {
  handleApi,
  jsonResponse,
  readJson,
  requireMethod,
  requireSameOrigin,
} from "../_lib/http.js";
import { validateImage } from "../_lib/image.js";
import { analyzeWithOpenAI } from "../_lib/openai.js";
import { createSessionToken } from "../_lib/token.js";

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
