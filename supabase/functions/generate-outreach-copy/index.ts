const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TouchIn {
  day: number;
  channel: string;
  action: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { headline, snippet, cohortLabel, relevance, touches, leads } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI is not configured." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const leadLines = (leads ?? [])
      .slice(0, 8)
      .map(
        (l: Record<string, string>) =>
          `- ${l.name || "Unknown"} — ${l.title || "unknown title"} at ${l.company || "unknown company"}${l.why ? ` (match reason: ${l.why})` : ""}`,
      )
      .join("\n");

    const touchLines = (touches ?? [])
      .map((t: TouchIn) => `Day ${t.day} · ${t.channel} · ${t.action}`)
      .join("\n");

    const prompt = `You are a B2B sales copywriter. Write outreach copy for one cohort of leads reacting to a market signal.

SIGNAL: ${headline}
CONTEXT: ${snippet}
COHORT: ${cohortLabel} (relevance tier: ${relevance})

LEADS IN THIS COHORT:
${leadLines || "(no lead detail available)"}

TOUCH PLAN (write copy for exactly these, in this order):
${touchLines}

Rules:
- Write ONE version per touch that works for the whole cohort. Use the merge tokens {{firstName}}, {{company}} and {{title}} instead of naming any individual.
- Email touches: a subject line under 60 characters plus a body under 120 words. Sign off with "[Your name]".
- LinkedIn touches: subject must be an empty string; body under 60 words, written as a connection note.
- Call touches: subject must be an empty string; body is a short spoken opener plus a voicemail fallback.
- High relevance is direct and asks for time. Medium is context-first with no hard ask. Low is nurture only.
- No emojis, no markdown, no hype.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        tools: [
          {
            type: "function",
            function: {
              name: "return_copy",
              description: "Return the outreach copy for each touch, in plan order.",
              parameters: {
                type: "object",
                properties: {
                  touches: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        day: { type: "number" },
                        channel: { type: "string" },
                        subject: { type: "string" },
                        body: { type: "string" },
                      },
                      required: ["day", "channel", "subject", "body"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["touches"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_copy" } },
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
      const detail = await res.text();
      console.error("gateway error", res.status, detail);
      return new Response(JSON.stringify({ error: "Could not generate copy." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : { touches: [] };

    return new Response(JSON.stringify({ touches: parsed.touches ?? [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-outreach-copy failed", e);
    return new Response(JSON.stringify({ error: "Could not generate copy." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});