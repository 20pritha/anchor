import { generateText } from "ai-sdk-ollama";
import { gemmaModel } from "@/lib/ollama";

export const runtime = "nodejs";

// Single still-frame perception (doc 02 Pipeline B note: still-frame stays
// local via Ollama vision; only live streaming goes to the cloud path).
const PERCEPTION_SYSTEM = `You are Anchor, a calm memory companion. Describe what is in the image in one or two short, plain sentences. If it looks like a common personal object (keys, glasses, umbrella, medication, etc.), name it plainly. Never sound clinical.`;

interface PerceptionRequestBody {
  imageBase64?: string;
  mediaType?: string;
  question?: string;
}

export async function POST(req: Request): Promise<Response> {
  let body: PerceptionRequestBody;
  try {
    body = (await req.json()) as PerceptionRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.imageBase64) {
    return Response.json({ error: "`imageBase64` is required" }, { status: 400 });
  }

  try {
    const { text } = await generateText({
      model: gemmaModel,
      system: PERCEPTION_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: body.question?.trim() || "What is this?" },
            { type: "image", image: body.imageBase64, mediaType: body.mediaType ?? "image/jpeg" },
          ],
        },
      ],
    });
    return Response.json({ answer: text.trim() });
  } catch (err) {
    console.error("[api/perception] failed:", err);
    return Response.json(
      { error: "Local vision model is unreachable. Is Ollama running?" },
      { status: 503 },
    );
  }
}
