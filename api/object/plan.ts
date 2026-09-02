import { draftRepairPlanBodySchema } from "../../src/generation/contracts";
import { getGenerationConfig } from "../_lib/config";
import {
  handleApi,
  jsonResponse,
  readJson,
  requireBearerToken,
  requireMethod,
  requireSameOrigin,
} from "../_lib/http";
import { planWithOpenAI } from "../_lib/openai";
import { professionalHelpPlan, requiresProfessionalHelp } from "../_lib/safety";
import { assertSessionBindings, verifySessionToken } from "../_lib/token";

export default function handler(request: Request): Promise<Response> {
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
