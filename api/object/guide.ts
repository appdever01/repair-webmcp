import { generateRepairStepVisualBodySchema } from "../../src/generation/contracts.js";
import { repairGuideSteps } from "../../src/generation/repairGuide.js";
import { getGenerationConfig } from "../_lib/config.js";
import { ApiError } from "../_lib/errors.js";
import {
  handleApi,
  jsonResponse,
  readJson,
  requireBearerToken,
  requireMethod,
  requireSameOrigin,
} from "../_lib/http.js";
import { validateImage } from "../_lib/image.js";
import { generateRepairStepImage } from "../_lib/openai.js";
import { consumeSessionAction } from "../_lib/quota.js";
import { assertSessionBindings, verifyPlanToken, verifySessionToken } from "../_lib/token.js";

export function handler(request: Request): Promise<Response> {
  return handleApi(async () => {
    requireMethod(request, ["POST"]);
    requireSameOrigin(request);
    const config = getGenerationConfig();
    const session = verifySessionToken(requireBearerToken(request), config.sessionSigningSecret);
    const input = await readJson(request, generateRepairStepVisualBodySchema);
    const image = validateImage(input.image);
    assertSessionBindings(session, image.sha256, input.analysis);
    verifyPlanToken(input.planToken, input.plan, session, config.sessionSigningSecret);
    if (!repairGuideSteps(input.plan)[input.stepIndex]) {
      throw new ApiError(400, "INVALID_REQUEST", "The requested repair step is not available.");
    }
    consumeSessionAction(session.sessionId, "guide");
    const visual = await generateRepairStepImage(
      image,
      input.analysis,
      input.plan,
      input.stepIndex,
      config,
      request.signal,
    );
    return jsonResponse(visual);
  });
}

export default { fetch: handler };
