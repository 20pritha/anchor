# 06 — ADK Model Adapter (the core glue)

This is the highest-risk, highest-value component: the bridge between ADK's agent/orchestration world and on-device Gemma 4 running on LiteRT-LM. Build it in isolation first and prove it before wiring the rest.

## What ADK expects

ADK for Android drives models through a `Model` abstraction and consumes results as a **stream of events** — the runner uses a `runAsync(...).collect { }` pattern over a `Flow<Event>`. So the adapter must:

1. Accept an ADK request (messages + tool/function declarations + optional image/audio parts).
2. Format that into Gemma 4's prompt + tool-declaration format.
3. Run generation on the LiteRT-LM Gemma 4 session (async/streaming).
4. Parse Gemma 4's output, distinguishing **plain text** from **tool calls**.
5. Emit ADK `Event`s over a `Flow` — including tool-call events ADK can dispatch, and final text events.

## What Gemma 4 gives us

Gemma 4's function calling uses a specific token format. A tool call looks like:

```
<|tool_call>call:get_current_weather{location:<|"|>Tokyo, JP<|"|>}<tool_call|>
```

Tool declarations are injected in a `<|tool>declaration:name{...}<tool|>` block, and tool responses are appended in a `response:name{...}` form. Gemma 4 also supports a **thinking** mode that improves function-calling accuracy (emits reasoning before the call).

So the adapter owns two format-translation jobs:

- **Outbound:** ADK tool declarations → Gemma 4 `declaration:{…}` block; ADK messages (incl. image/audio parts) → Gemma 4 chat template.
- **Inbound:** Gemma 4 token stream → parsed `{name, arguments}` tool calls + plain text → ADK events.

## Adapter sketch (illustrative Kotlin)

```kotlin
class LocalGemmaModel(
    private val session: LiteRtLmSession,   // on-device Gemma 4 (E4B)
    private val tools: ToolRegistry,          // whitelist name -> impl (never eval by name)
) : Model {

    override fun generateContent(request: LlmRequest): Flow<Event> = callbackFlow {
        // 1. Outbound formatting
        val prompt = GemmaFormatter.build(
            system = request.systemInstruction,
            history = request.messages,          // includes image/audio parts if present
            toolDeclarations = request.tools,     // -> <|tool>declaration:...<tool|>
            enableThinking = request.needsReasoning
        )

        // 2. Async streaming generation from LiteRT-LM
        val buffer = StringBuilder()
        session.generateResponseAsync(prompt) { partial, done ->
            buffer.append(partial)

            // stream plain text to ADK as it arrives (for low-latency TTS)
            emitPlainTextDelta(partial)?.let { trySend(Event.textDelta(it)) }

            if (done) {
                val calls = GemmaToolCallParser.extract(buffer.toString())
                if (calls.isNotEmpty()) {
                    // 3. Emit tool-call events; ADK dispatches to registered tools
                    calls.forEach { c ->
                        require(tools.isAllowed(c.name))   // validate before dispatch
                        trySend(Event.toolCall(c.name, c.arguments))
                    }
                } else {
                    trySend(Event.finalText(buffer.toString()))
                }
                close()
            }
        }
        awaitClose { session.cancel() }
    }
}
```

## Tool-call parser

Gemma 4's format is regex-parseable. Extract each `<|tool_call>call:NAME{ARGS}<tool_call|>` block, then parse `key:<|"|>value<|"|>` (string) and `key:value` (numeric/bool) pairs. Cast numbers/bools; leave strings as-is.

**Security:** never resolve tool names dynamically to executable functions (no `globals()[name]` equivalent). Keep a fixed `ToolRegistry` whitelist mapping allowed names → implementations, and validate every parsed call's name and argument types before dispatch. The Gemma 4 docs call this out explicitly.

## The memory tools exposed to the model

The tools the agent (local or cloud) can call. Keep the surface small:

| Tool | Args | Returns |
| --- | --- | --- |
| `queryMemory` | `intent`, `entity?`, `window?` | grounded context (graph + vector blend) |
| `recordEpisode` | `text`, `entity_refs?` | ack (runs async write) |
| `getMedicationStatus` | `period` (morning/…) | taken? + timestamp |
| `locateObject` | `label` | last known place + confidence |
| `listUpcoming` | `window` | routines/visits ahead |

The same registry is shared by the cloud (Gemini Live) path so cloud reasoning stays grounded in local memory.

## Build & prove order (de-risk)

1. Load Gemma 4 E4B in a LiteRT-LM session on the Pixel 10; generate plain text. ✅ before anything else.
2. Get one **function call** round-trip working with the raw token format (no ADK yet) — declaration in, tool-call token out, parsed correctly.
3. Wrap in `callbackFlow`, emit ADK `Event`s, run through the ADK `Runner` with a single trivial tool.
4. Add the real memory tools + streaming text deltas to TTS.
5. Add image/audio input parts (multimodal) once text + tools are solid.

If step 2 (function-call reliability / parsing) is shaky, that's your signal to switch routing to FunctionGemma (D7) early rather than late.

## Open sub-decisions (resolve while building)

- Whether to stream text deltas to TTS incrementally (better perceived latency) or speak the full response (simpler). Recommend incremental if generation > ~600 ms.
- Whether `thinking` mode is on for routing (more accurate, slower) — likely off for routing, on for harder reasoning.
