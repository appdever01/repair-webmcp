import {
  nextQuestionBodySchema,
  nextQuestionResponseSchema,
} from "../../src/generation/contracts.js";
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
import { chooseNextQuestionWithOpenAI } from "../_lib/openai.js";
import { requiresProfessionalHelp } from "../_lib/safety.js";
import { assertSessionBindings, verifySessionToken } from "../_lib/token.js";

export function handler(request: Request): Promise<Response> {
  return handleApi(async () => {
    requireMethod(request, ["POST"]);
    requireSameOrigin(request);
    const config = getGenerationConfig();
    const session = verifySessionToken(requireBearerToken(request), config.sessionSigningSecret);
    const input = await readJson(request, nextQuestionBodySchema);
    const image = validateImage(input.image);
    assertSessionBindings(session, image.sha256, input.analysis);
    const decision = requiresProfessionalHelp(input.analysis)
      ? {
          status: "ready" as const,
          question: null,
          message: "The safety classification requires qualified help instead of more questions.",
        }
      : await chooseNextQuestionWithOpenAI(
          image,
          input.analysis,
          input.problemDescription,
          input.answers,
          config,
          request.signal,
        );
    const response =
      decision.status === "ask"
        ? {
            ...decision,
            question: { ...decision.question, id: `question.${input.answers.length + 1}` },
          }
        : decision;
    return jsonResponse(nextQuestionResponseSchema.parse(response));
  });
}

export default { fetch: handler };
