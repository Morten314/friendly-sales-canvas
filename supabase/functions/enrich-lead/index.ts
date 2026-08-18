const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LeadInput {
  name?: string;
  title?: string;
  company?: string;
  extra?: string;
}

/**
 * Agentic lead enrichment for the Artefacts lead sheet. Given an attribute the
 * user asked for (e.g. "Phone number", "Recent funding") and one or more leads,
 * returns one value per lead plus a confidence marker so the sheet can flag
 * guessed contact data when no data connector is live.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { attribute, instruction, leads, context, apolloConnected } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI is not configured." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const list = (Array.isArray(leads) ? (leads as LeadInput[]) : []).slice(0, 40);
    if (list.length === 0) {
      return new Response(JSON.stringify({ values: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const system = `You enrich B2B lead records for a salesperson.

ATTRIBUTE REQUESTED: ${attribute}
${instruction ? `USER INSTRUCTION: ${instruction}` : ""}
${context ? `SIGNAL CONTEXT: ${context}` : ""}
CONTACT DATA CONNECTOR: ${apolloConnected ? "connected" : "NOT connected"}

Rules:
- Return exactly one entry per lead, in the same order as given.
- Keep each value short: a phone number, an email, a URL, or at most 20 words.
- Never invent a verified contact detail. If the attribute is an email, phone or
  direct contact detail and no connector is live, give your best inference and
  set confidence to "low".
- Use "high" only for facts that follow directly from the lead record itself.
- If you cannot produce anything useful, return an empty string with confidence "low".`;

    const leadLines = list
      .map(
        (l, i) =>
          `${i + 1}. ${[l.name, l.title, l.company].filter(Boolean).join(" | ")}${l.extra ? ` — ${l.extra}` : ""}`,
      )
      .join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Leads:\n${leadLines}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_enrichment",
              description: "Return one enriched value per lead, in order.",
              parameters: {
                type: "object",
                properties: {
                  values: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        value: { type: "string" },
                        confidence: { type: "string", enum: ["high", "medium", "low"] },
                      },
                      required: ["value", "confidence"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["values"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_enrichment" } },
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
      return new Response(JSON.stringify({ error: "Could not enrich these leads." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : {};
    const values = Array.isArray(parsed.values) ? parsed.values : [];
    return new Response(
      JSON.stringify({
        values: list.map((_, i) => ({
          value: String(values[i]?.value ?? ""),
          confidence: String(values[i]?.confidence ?? "low"),
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("enrich-lead failed", e);
    return new Response(JSON.stringify({ error: "Could not enrich these leads." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
