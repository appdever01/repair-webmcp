import { draftRepairPlanBodySchema } from "../../src/generation/contracts.js";
import { getGenerationConfig } from "../_lib/config.js";
import {
  handleApi,
  jsonResponse,
  readJson,
  requireBearerToken,
  requireMethod,
  requireSameOrigin,
} from "../_lib/http.js";
import { planWithOpenAI } from "../_lib/openai.js";
import { professionalHelpPlan, requiresProfessionalHelp } from "../_lib/safety.js";
import { assertSessionBindings, verifySessionToken } from "../_lib/token.js";

export function handler(request: Request): Promise<Response> {
  return handleApi(async () => {
    requireMethod(request, ["POST"]);
    requireSameOrigin(request);
    const config = getGenerationConfig();
    const session = verifySessionToken(requireBearerToken(request), config.sessionSigningSecret);
    const input = await readJson(request, draftRepairPlanBodySchema);
    assertSessionBindings(session, null, input.analysis);
    const plan = requiresProfessionalHelp(input.analysis)
      ? professionalHelpPlan(input.analysis)
      : await planWithOpenAI(input, config, request.signal);
    return jsonResponse({ plan });
  });
}

export default { fetch: handler };
