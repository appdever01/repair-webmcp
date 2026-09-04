import { generateDiagnosticViewBodySchema } from "../../src/generation/contracts.js";
import { getGenerationConfig } from "../_lib/config.js";
import {
  handleApi,
  jsonResponse,
  readJson,
  requireBearerToken,
  requireMethod,
  requireSameOrigin,
} from "../_lib/http.js";
import { validateImage } from "../_lib/image.js";
import { generateDiagnosticImage } from "../_lib/openai.js";
import { consumeSessionAction } from "../_lib/quota.js";
import { assertSessionBindings, verifySessionToken } from "../_lib/token.js";

export function handler(request: Request): Promise<Response> {
  return handleApi(async () => {
    requireMethod(request, ["POST"]);
    requireSameOrigin(request);
    const config = getGenerationConfig();
    const session = verifySessionToken(requireBearerToken(request), config.sessionSigningSecret);
    const input = await readJson(request, generateDiagnosticViewBodySchema);
    const image = validateImage(input.image);
    assertSessionBindings(session, image.sha256, input.analysis);
    consumeSessionAction(session.sessionId, "diagnostic");
    const diagnostic = await generateDiagnosticImage(image, input.analysis, config, request.signal);
    return jsonResponse({ image: diagnostic });
  });
}

export default { fetch: handler };
