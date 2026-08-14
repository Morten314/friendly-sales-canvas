const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * Agentic chat around ONE outreach touch. Takes the current draft plus the
 * conversation so far and returns a short reply + the revised subject/body.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { headline, snippet, cohortLabel, relevance, touch, subject, body, history, message } =
      await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI is not configured." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const system = `You are a B2B outreach copywriter working with a salesperson on ONE message.

SIGNAL: ${headline}
CONTEXT: ${snippet}
COHORT: ${cohortLabel} (relevance tier: ${relevance})
TOUCH: Day ${touch?.day} · ${touch?.channel} · ${touch?.action}

CURRENT DRAFT
Subject: ${subject || "(none)"}
Body:
${body || "(empty)"}

Rules:
- Apply the user's instruction and return the FULL revised message, never a diff.
- Keep the merge tokens {{firstName}}, {{company}}, {{title}} unless asked otherwise.
- Email: subject under 60 characters, body under 120 words, sign off "[Your name]".
- LinkedIn/call touches: subject must be an empty string.
- No emojis, no markdown, no hype.
- "reply" is one or two sentences telling the user what you changed.`;

    const messages = [
      { role: "system", content: system },
      ...(Array.isArray(history) ? (history as ChatTurn[]) : []).slice(-8),
      { role: "user", content: String(message ?? "") },
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        tools: [
          {
            type: "function",
            function: {
              name: "return_revision",
              description: "Return the revised copy plus a short note about the change.",
              parameters: {
                type: "object",
                properties: {
                  reply: { type: "string" },
                  subject: { type: "string" },
                  body: { type: "string" },
                },
                required: ["reply", "subject", "body"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_revision" } },
      }),
    });

    if (res.status === 429 || res.status === 402) {
      return new Response(
        JSON.stringify({
          error:
            res.status === 429
              ? "Rate limit reached. Try again in a moment."
              : "AI credits exhausted.",
        }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!res.ok) {
      console.error("gateway error", res.status, await res.text());
      return new Response(JSON.stringify({ error: "Could not revise the copy." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : {};
    return new Response(
      JSON.stringify({
        reply: parsed.reply ?? "Updated the draft.",
        subject: parsed.subject ?? subject ?? "",
        body: parsed.body ?? body ?? "",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("refine-outreach-copy failed", e);
    return new Response(JSON.stringify({ error: "Could not revise the copy." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
