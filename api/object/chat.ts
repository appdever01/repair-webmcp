import { askRepairAssistantBodySchema } from "../../src/generation/contracts.js";
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
import { answerRepairQuestionWithOpenAI } from "../_lib/openai.js";
import { assertSessionBindings, verifyPlanToken, verifySessionToken } from "../_lib/token.js";

export function handler(request: Request): Promise<Response> {
  return handleApi(async () => {
    requireMethod(request, ["POST"]);
    requireSameOrigin(request);
    const config = getGenerationConfig();
    const session = verifySessionToken(requireBearerToken(request), config.sessionSigningSecret);
    const input = await readJson(request, askRepairAssistantBodySchema);
    const image = validateImage(input.image);
    assertSessionBindings(session, image.sha256, input.analysis);
    verifyPlanToken(input.planToken, input.plan, session, config.sessionSigningSecret);
    if (input.messages.at(-1)?.role !== "user") {
      throw new ApiError(400, "INVALID_REQUEST", "A user question is required.");
    }
    const answer = await answerRepairQuestionWithOpenAI(image, input, config, request.signal);
    return jsonResponse({ answer });
  });
}

export default { fetch: handler };
