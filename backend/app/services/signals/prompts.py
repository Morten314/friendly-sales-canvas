"""Prompt templates for signals/ -- persona-specific search prompts.

Templates stay as inline Python strings. They are .format()-friendly:
- _SCOUT_PROMPT_TEMPLATE, _PROFILER_PROMPT_TEMPLATE: context_json,
  leads_section, existing_headlines_section (used by search_signals).
- _LEADS_SECTION_TEMPLATE, _LEADS_SECTION_FALLBACK_TEMPLATE:
  signal_label, leads_count, leads_json (used by search_signals to
  build the leads_section placeholder above).
- _EXISTING_HEADLINES_SECTION_TEMPLATE: headlines_list (used by
  search_signals to build the existing_headlines_section placeholder).
- _SIGNAL_ASK_PROMPT_TEMPLATE: context, history_text, question (used
  by signal_ask).
- _SIGNAL_ASK_CLAUDE_PROMPT_TEMPLATE: context, history_text,
  web_search_results, question (used by signal_ask_claude).
"""

_SCOUT_PROMPT_TEMPLATE = """Task: Research and identify a high-quality, actionable market signal for a sales scout agent. This signal should help the sales team understand market opportunities, competitor movements, or industry trends that could impact their sales strategy.

STEP 1 - COMPANY PROFILE DATA:
Review the complete company profile data below. Extract all relevant information about the company's industry, target markets, regions, company size, strategic goals, and any other relevant attributes.

Company Profile Data:
{context_json}
{leads_section}
{existing_headlines_section}

STEP 2 - RESEARCH REQUIREMENTS (CRITICAL):
You MUST use the WebSearch tool to find a REAL, RECENT, and ACTIONABLE market signal. Based on the company profile above, perform comprehensive research to identify:

1. Market Opportunity Signals:
   - Search for recent market growth, trends, or opportunities in the company's industry
   - Find market size changes, adoption rates, or emerging segments
   - Example searches: "[industry] market trends [regions] 2026"
   - Example searches: "[industry] growth opportunities 2026"

2. Competitor Activity Signals:
   - Search for competitor funding rounds, product launches, or strategic moves
   - Find market share changes or competitive landscape shifts
   - Example searches: "[industry] competitor funding 2026"
   - Example searches: "[industry] competitor product launch 2026"

3. Industry Trend Signals:
   - Search for technology adoption, regulatory changes, or industry shifts
   - Find emerging trends that could impact sales strategy
   - Example searches: "[industry] technology adoption 2026"
   - Example searches: "[industry] regulatory changes 2026"

4. Market Dynamics Signals:
   - Search for buying behavior changes, market disruptions, or new opportunities
   - Find signals that indicate market readiness or buying intent
   - Example searches: "[industry] buying trends [regions] 2026"
   - Example searches: "[industry] market disruption 2026"

IMPORTANT RESEARCH GUIDELINES:
- Perform at least 5-7 WebSearch queries to find the BEST signal
- Focus on RECENT signals from 2026 and recent past (within last 1-3 months when possible)
- CURRENT YEAR IS 2026 - Do NOT use future dates like 2027 in signals. Use actual current dates from 2026 or recent past dates.
- The signal must be REAL and ACTIONABLE - not generic
- Extract industry and target markets from the company profile
- Cross-reference multiple sources to verify signal accuracy
- Find 1-2 different source URLs for the signal (preferably from different publications/sources)
- Prioritize signals that are relevant to the company's specific industry and target markets
- Generate 3 thoughtful NBA questions that help users dive deeper into the signal's implications

STEP 3 - OUTPUT FORMAT:
Return your findings in the following exact JSON format (use exact keys as shown):

{{
  "headline": "[Compelling, specific headline about the signal - must be real and recent]",
  "snippet": "[Brief 1-2 sentence summary of the signal]",
  "description": "[One full paragraph (4-6 sentences) providing detailed context about the signal. Explain what the signal means, why it matters for the company's sales strategy, what opportunities or challenges it presents, and how the sales team should respond. Make it descriptive and actionable.]",
  "sourceUrl": "[Real source URL where this signal was found]",
  "sourceLabel": "[Source type: Industry report, News article, Research report, Funding news, etc.]",
  "source": [
    {{
      "citation": "[Publication name - Article title - Date if available, e.g., 'TechCrunch - AI Market Growth Report - January 15, 2026']. Use actual dates from 2026 or recent past, NOT future dates.",
      "url": "[First source URL where this signal was found]"
    }},
    {{
      "citation": "[Publication name - Article title - Date if available, e.g., 'Industry Research Report - Market Trends Analysis - January 2026']",
      "url": "[Second source URL (if available from different source)]"
    }}
  ],
  "nextBestMoves": [
    "[Actionable question/suggestion #1 related to the signal]",
    "[Actionable question/suggestion #2 related to the signal]"
  ],
  "NBAs": [
    {{
      "nba": "[First suggested question the user should ask based on this signal]",
      "prompt": "[Detailed prompt that includes the signal context, company profile information, and specific question to ask an LLM for a comprehensive answer. The prompt should be self-contained and provide all necessary context for the LLM to answer the question in detail.]"
    }},
    {{
      "nba": "[Second suggested question the user should ask based on this signal]",
      "prompt": "[Detailed prompt that includes the signal context, company profile information, and specific question to ask an LLM for a comprehensive answer. The prompt should be self-contained and provide all necessary context for the LLM to answer the question in detail.]"
    }},
    {{
      "nba": "[Third suggested question the user should ask based on this signal]",
      "prompt": "[Detailed prompt that includes the signal context, company profile information, and specific question to ask an LLM for a comprehensive answer. The prompt should be self-contained and provide all necessary context for the LLM to answer the question in detail.]"
    }}
  ],
  "contextualSuggestions": [
    {{"icon": "[icon name]", "text": "[Suggestion text related to signal]"}},
    {{"icon": "[icon name]", "text": "[Suggestion text related to signal]"}}
  ]
}}

⚠️ OUTPUT NOTES:
- headline must be REAL and SPECIFIC - include actual numbers, dates, or company names when available
- snippet should be concise (1-2 sentences)
- description must be ONE FULL PARAGRAPH (4-6 sentences) with detailed context
- sourceUrl must be a REAL, accessible URL
- sourceLabel should accurately describe the source type
- source must be an array with 1-2 objects, each containing "citation" and "url" fields
- citation should include publication name, article title, and date if available (e.g., "TechCrunch - AI Market Growth Report - January 15, 2026")
- IMPORTANT: Use actual dates from 2026 or recent past. Do NOT use future dates like 2027. Current year is 2026.
- url must be a REAL, accessible URL
- If only one source found, include one object in the array; if two sources found, include both
- nextBestMoves should be actionable questions related to the specific signal
- NBAs must contain exactly 3 suggested questions with detailed prompts for LLM queries
- Each NBA prompt should include: signal headline, signal description, company profile context, and the specific question to answer
- contextualSuggestions should be relevant to the signal content
- Return ONLY valid JSON, nothing else

When you have reached the final answer, respond only with:
Final Answer: <your JSON answer here>
Do not include any additional reasoning, thoughts, or steps after that.
"""

_PROFILER_PROMPT_TEMPLATE = """Task: Research and identify a high-quality, actionable ICP/customer signal for a profiler agent. This signal should help the sales team understand customer buying behavior, ICP trends, or customer acquisition opportunities.

STEP 1 - COMPANY PROFILE AND ICP DATA:
Review the complete company profile and ICP data below. Extract all relevant information about the company's industry, target markets, regions, ICP segments, company sizes, buyer personas, and any other relevant attributes.

Company Profile and ICP Data:
{context_json}
{leads_section}
{existing_headlines_section}

STEP 2 - RESEARCH REQUIREMENTS (CRITICAL):
You MUST use the WebSearch tool to find a REAL, RECENT, and ACTIONABLE ICP/customer signal. Based on the company profile and ICP data above, perform comprehensive research to identify:

1. ICP Buying Behavior Signals:
   - Search for buying trends, purchase patterns, or buying signals in the company's ICP segments
   - Find customer acquisition trends or buying committee changes
   - Example searches: "[industry] [ICP segment] buying trends 2026"
   - Example searches: "[industry] customer acquisition [ICP segment] 2026"

2. Customer Spending Signals:
   - Search for tech spending, budget allocation, or investment trends in target ICP segments
   - Find customer spending patterns or budget increases
   - Example searches: "[industry] tech spending [company size] 2026"
   - Example searches: "[industry] budget allocation [ICP segment] 2026"

3. ICP Market Dynamics Signals:
   - Search for ICP segment growth, market expansion, or customer behavior changes
   - Find signals about target customer needs or pain points
   - Example searches: "[industry] [ICP segment] market trends 2026"
   - Example searches: "[industry] customer needs [ICP segment] 2026"

4. Customer Success Signals:
   - Search for customer success metrics, retention trends, or customer satisfaction in ICP segments
   - Find signals about customer lifecycle or engagement patterns
   - Example searches: "[industry] customer success [ICP segment] 2026"
   - Example searches: "[industry] customer retention [company size] 2026"

5. Buyer Persona Signals:
   - Search for decision maker trends, buying committee changes, or buyer behavior in target segments
   - Find signals about how target customers make purchasing decisions
   - Example searches: "[industry] buying committee [ICP segment] 2026"
   - Example searches: "[industry] decision maker trends 2026"

IMPORTANT RESEARCH GUIDELINES:
- Perform at least 5-7 WebSearch queries to find the BEST signal
- Focus on RECENT signals from 2026 and recent past (within last 1-3 months when possible)
- CURRENT YEAR IS 2026 - Do NOT use future dates like 2027 in signals. Use actual current dates from 2026 or recent past dates.
- The signal must be REAL and ACTIONABLE - not generic
- Extract industry, ICP segments, and target markets from the provided data
- Cross-reference multiple sources to verify signal accuracy
- Find 1-2 different source URLs for the signal (preferably from different publications/sources)
- Prioritize signals that are relevant to the company's specific ICP segments and target customers
- If ICP data is available, use it to make the signal more specific and relevant
- Generate 3 thoughtful NBA questions that help users dive deeper into the signal's implications for their ICP and sales strategy

STEP 3 - OUTPUT FORMAT:
Return your findings in the following exact JSON format (use exact keys as shown):

{{
  "headline": "[Compelling, specific headline about the ICP/customer signal - must be real and recent]",
  "snippet": "[Brief 1-2 sentence summary of the signal]",
  "description": "[One full paragraph (4-6 sentences) providing detailed context about the signal. Explain what the signal means for the company's ICP and target customers, why it matters for customer acquisition and sales strategy, what opportunities or challenges it presents for reaching the target ICP, and how the sales/profiling team should respond. Make it descriptive and actionable.]",
  "sourceUrl": "[Real source URL where this signal was found]",
  "sourceLabel": "[Source type: Market research, Customer research, Sales report, ICP analysis, etc.]",
  "source": [
    {{
      "citation": "[Publication name - Article title - Date if available, e.g., 'Market Research Report - Customer Buying Trends - January 15, 2026']. Use actual dates from 2026 or recent past, NOT future dates.",
      "url": "[First source URL where this signal was found]"
    }},
    {{
      "citation": "[Publication name - Article title - Date if available, e.g., 'Sales Report - ICP Analysis - January 2026']",
      "url": "[Second source URL (if available from different source)]"
    }}
  ],
  "nextBestMoves": [
    "[Actionable question/suggestion #1 related to the ICP signal]",
    "[Actionable question/suggestion #2 related to the ICP signal]"
  ],
  "NBAs": [
    {{
      "nba": "[First suggested question the user should ask based on this ICP signal]",
      "prompt": "[Detailed prompt that includes the signal context, company profile information, ICP data, and specific question to ask an LLM for a comprehensive answer. The prompt should be self-contained and provide all necessary context for the LLM to answer the question in detail.]"
    }},
    {{
      "nba": "[Second suggested question the user should ask based on this ICP signal]",
      "prompt": "[Detailed prompt that includes the signal context, company profile information, ICP data, and specific question to ask an LLM for a comprehensive answer. The prompt should be self-contained and provide all necessary context for the LLM to answer the question in detail.]"
    }},
    {{
      "nba": "[Third suggested question the user should ask based on this ICP signal]",
      "prompt": "[Detailed prompt that includes the signal context, company profile information, ICP data, and specific question to ask an LLM for a comprehensive answer. The prompt should be self-contained and provide all necessary context for the LLM to answer the question in detail.]"
    }}
  ],
  "contextualSuggestions": [
    {{"icon": "[icon name]", "text": "[Suggestion text related to ICP signal]"}},
    {{"icon": "[icon name]", "text": "[Suggestion text related to ICP signal]"}}
  ]
}}

⚠️ OUTPUT NOTES:
- headline must be REAL and SPECIFIC - include actual numbers, dates, or ICP segment details when available
- snippet should be concise (1-2 sentences)
- description must be ONE FULL PARAGRAPH (4-6 sentences) with detailed context about ICP/customer implications
- sourceUrl must be a REAL, accessible URL
- sourceLabel should accurately describe the source type
- source must be an array with 1-2 objects, each containing "citation" and "url" fields
- citation should include publication name, article title, and date if available (e.g., "Market Research Report - Customer Buying Trends - January 15, 2026")
- IMPORTANT: Use actual dates from 2026 or recent past. Do NOT use future dates like 2027. Current year is 2026.
- url must be a REAL, accessible URL
- If only one source found, include one object in the array; if two sources found, include both
- nextBestMoves should be actionable questions related to the specific ICP signal
- NBAs must contain exactly 3 suggested questions with detailed prompts for LLM queries
- Each NBA prompt should include: signal headline, signal description, company profile context, ICP data, and the specific question to answer
- contextualSuggestions should be relevant to the ICP signal content
- Return ONLY valid JSON, nothing else

When you have reached the final answer, respond only with:
Final Answer: <your JSON answer here>
Do not include any additional reasoning, thoughts, or steps after that.
"""


_LEADS_SECTION_TEMPLATE = """
STEP 1.2 - LEADS DATA (CRITICAL - Use this to prioritize {signal_label} relevance):
Your organization has {leads_count} active leads in your pipeline. Below is the complete lead data with all available fields. You MUST analyze this data and use it when generating {signal_label}s.

Complete Leads Data (showing up to 50 most recent leads):
{leads_json}

CRITICAL INSTRUCTIONS:
- Analyze ALL fields in the leads data above - do not assume any specific field names
- Extract any company names, industries, regions, technologies, or other relevant information from whatever fields exist
- Prioritize {signal_label}s that relate to companies, industries, regions, or any other attributes found in your leads pipeline
- If a {signal_label} mentions a company or organization, check if it matches any entity in your leads data
- Focus on {signal_label}s that would be relevant to your actual sales pipeline based on the lead data structure
- Use the lead data to understand your target market, customer segments, and sales priorities
- This will make the {signal_label}s more actionable for your sales team
"""


_LEADS_SECTION_FALLBACK_TEMPLATE = """
STEP 1.2 - LEADS DATA:
Your organization has {leads_count} active leads in your pipeline. Use this information to prioritize {signal_label}s relevant to your actual sales pipeline.
"""


_EXISTING_HEADLINES_SECTION_TEMPLATE = """
STEP 1.5 - EXISTING SIGNALS (CRITICAL - AVOID DUPLICATES):
You MUST avoid generating signals similar to these existing signal headlines. Review them carefully and ensure your new signal is completely different and unique:

Existing Signal Headlines:
{headlines_list}

IMPORTANT: Your new signal headline must be about a DIFFERENT news story, market development, or industry trend. Do NOT generate a signal about the same event, company news, or market development as any of the above headlines, even if worded differently. Search for NEW and UNIQUE signals that haven't been covered yet.
"""


_SIGNAL_ASK_PROMPT_TEMPLATE = """You are an intelligent assistant helping answer questions about market signals, company strategy, and customer insights.

{context}
{history_text}

CURRENT QUESTION:
{question}

INSTRUCTIONS:
1. Use the WebSearch tool to find the most up-to-date and accurate information to answer the question
2. Consider the company profile and customer profile (ICPs) when providing context-specific answers
3. Reference the conversation history to maintain context and continuity
4. Provide a comprehensive, well-structured answer that directly addresses the question
5. If the question relates to market signals, trends, or industry insights, use WebSearch to find recent data (2026-2027)
6. Cite sources when using information from WebSearch
7. Be specific and actionable in your response

Please use the WebSearch tool to gather current information and provide a detailed answer."""


_SIGNAL_ASK_CLAUDE_PROMPT_TEMPLATE = """You are an intelligent assistant helping answer questions about market signals, company strategy, and customer insights.

{context}
{history_text}

WEB SEARCH RESULTS:
{web_search_results}

CURRENT QUESTION:
{question}

INSTRUCTIONS:
1. Use the provided web search results as the freshest external context.
2. Consider the company profile and customer profile (ICPs) when providing context-specific answers.
3. Reference the conversation history to maintain context and continuity.
4. Provide a comprehensive, well-structured answer that directly addresses the question.
5. If the question relates to market signals, trends, or industry insights, prioritize recent data (2026-2027).
6. Cite sources if they appear in web search results.
7. Be specific and actionable in your response.
"""
