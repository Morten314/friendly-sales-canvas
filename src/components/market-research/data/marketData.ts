export const marketData = {
  "UK Fintech": {
    name: "UK Fintech Market",
    score: "87/100",
    size: "$24.5B",
    competition: "Medium",
    barriers: "Low",
    details: {
      summary: "The UK fintech market shows strong growth potential with a solid regulatory framework and established financial infrastructure.",
      subMarkets: [
        { name: "Digital Banking", size: "$8.7B", growth: "+12% YoY" },
        { name: "Payment Solutions", size: "$6.3B", growth: "+9% YoY" },
        { name: "Wealth Management", size: "$5.2B", growth: "+7% YoY" },
        { name: "Insurtech", size: "$2.8B", growth: "+15% YoY" },
        { name: "Regtech", size: "$1.5B", growth: "+19% YoY" }
      ],
      keyInsights: [
        "Strong regulatory support through FCA's Sandbox program",
        "High digital adoption rate among consumers (78%)",
        "Established financial center with access to capital",
        "Brexit concerns creating some market uncertainty",
        "Growing competition from EU fintech hubs"
      ],
      recommendedActions: [
        "Focus on partnerships with traditional banks",
        "Target digital-first customer segments",
        "Leverage UK's open banking framework",
        "Consider regulatory compliance solutions"
      ]
    }
  },
  "Germany Healthtech": {
    name: "Germany Healthtech Market",
    score: "72/100",
    size: "$18.2B",
    competition: "High",
    barriers: "Medium",
    details: {
      summary: "The German healthtech market presents solid opportunities but comes with regulatory complexities and established competitors.",
      subMarkets: [
        { name: "Digital Health Records", size: "$5.3B", growth: "+8% YoY" },
        { name: "Telemedicine", size: "$4.7B", growth: "+22% YoY" },
        { name: "Health Monitoring", size: "$4.1B", growth: "+11% YoY" },
        { name: "Digital Therapeutics", size: "$2.6B", growth: "+16% YoY" },
        { name: "Healthcare AI", size: "$1.5B", growth: "+25% YoY" }
      ],
      keyInsights: [
        "Strict regulatory framework with recent digital health laws",
        "Aging population driving demand for health solutions",
        "Strong public healthcare system with increasing digital adoption",
        "Conservative approach to new health technologies",
        "High data privacy standards and GDPR compliance requirements"
      ],
      recommendedActions: [
        "Partner with established healthcare providers",
        "Invest in obtaining necessary German certifications",
        "Focus on solutions for chronic disease management",
        "Ensure robust data protection measures"
      ]
    }
  },
  "France SaaS": {
    name: "France SaaS Market",
    score: "65/100",
    size: "$12.8B",
    competition: "Medium",
    barriers: "Medium",
    details: {
      summary: "The French SaaS market shows moderate growth potential with government initiatives supporting digital transformation.",
      subMarkets: [
        { name: "Business Management", size: "$3.9B", growth: "+8% YoY" },
        { name: "Customer Experience", size: "$2.8B", growth: "+11% YoY" },
        { name: "HR & Productivity", size: "$2.5B", growth: "+7% YoY" },
        { name: "Marketing & Sales", size: "$2.1B", growth: "+9% YoY" },
        { name: "Industry Solutions", size: "$1.5B", growth: "+12% YoY" }
      ],
      keyInsights: [
        "Growing adoption of cloud solutions in enterprises",
        "Government initiatives supporting digital transformation",
        "Preference for local vendors with French language support",
        "Concerns about US tech dominance affecting buying decisions",
        "Strong protection for workers affecting HR software requirements"
      ],
      recommendedActions: [
        "Localize products with full French language support",
        "Target mid-market enterprises undergoing digital transformation",
        "Establish local presence or French partnerships",
        "Highlight EU data residency and GDPR compliance"
      ]
    }
  }
};

export const marketAnalysisData = {
  competitorData: [
    { name: "Rival Fintech", marketShare: "23%", growthRate: "+8%", strengths: "Established brand, Strong partnerships", weaknesses: "Legacy systems, Slow innovation" },
    { name: "Tech Banking", marketShare: "18%", growthRate: "+15%", strengths: "Strong tech stack, Seamless UX", weaknesses: "Limited reach, Higher fees" },
    { name: "Finance Plus", marketShare: "12%", growthRate: "+5%", strengths: "Wide product range, Global presence", weaknesses: "Fragmented offerings, Poor customer service" },
    { name: "NextPay", marketShare: "9%", growthRate: "+22%", strengths: "Rapid innovation, Mobile-first", weaknesses: "Limited features, Small customer base" }
  ],
  swotAnalysis: {
    strengths: ["Innovative product offerings", "Lower operational costs", "Superior user experience", "Faster time-to-market"],
    weaknesses: ["Limited market recognition", "Smaller customer base", "Less regulatory experience", "Capital constraints"],
    opportunities: ["Growing digital adoption", "Underserved market segments", "Open banking regulations", "Strategic partnerships"],
    threats: ["Increasing competition", "Regulatory changes", "Cybersecurity risks", "Economic uncertainty"]
  },
  marketSegments: [
    { segment: "Young Professionals", size: "32%", growthPotential: "High", acquisitionCost: "Medium", needsMatch: "Strong" },
    { segment: "Small Businesses", size: "28%", growthPotential: "Very High", acquisitionCost: "High", needsMatch: "Strong" },
    { segment: "Enterprise Clients", size: "15%", growthPotential: "Medium", acquisitionCost: "Very High", needsMatch: "Moderate" },
    { segment: "Senior Adopters", size: "12%", growthPotential: "Low", acquisitionCost: "High", needsMatch: "Weak" },
    { segment: "Students", size: "13%", growthPotential: "Medium", acquisitionCost: "Low", needsMatch: "Strong" }
  ]
};

export const trendSpottingData = {
  emergingTrends: [
    { 
      trend: "Embedded Finance", 
      growthRate: "+35%", 
      adoption: "Early Mainstream", 
      impact: "High",
      description: "Integration of financial services into non-financial platforms and apps"
    },
    { 
      trend: "DeFi Integration", 
      growthRate: "+62%", 
      adoption: "Early Adopters", 
      impact: "Medium",
      description: "Incorporating decentralized finance into traditional financial services"
    },
    { 
      trend: "Hyper-personalization", 
      growthRate: "+28%", 
      adoption: "Early Mainstream", 
      impact: "High",
      description: "AI-powered personalized financial advice and services"
    },
    { 
      trend: "Green Finance", 
      growthRate: "+45%", 
      adoption: "Growing", 
      impact: "Medium-High",
      description: "Sustainable investment options and environmental impact tracking"
    },
    { 
      trend: "Voice Banking", 
      growthRate: "+20%", 
      adoption: "Early", 
      impact: "Medium",
      description: "Voice-activated banking through smart assistants and devices"
    }
  ],
  technologyDrivers: [
    { technology: "Artificial Intelligence", maturity: "Growing", relevance: "Critical", timeToAdopt: "Now" },
    { technology: "Blockchain", maturity: "Emerging", relevance: "High", timeToAdopt: "1-2 Years" },
    { technology: "IoT Financial Services", maturity: "Early", relevance: "Medium", timeToAdopt: "2-3 Years" },
    { technology: "Quantum Computing", maturity: "Experimental", relevance: "Potential", timeToAdopt: "5+ Years" }
  ],
  consumerTrends: [
    { trend: "Financial Wellness Focus", strength: "Strong", persistence: "Long-term", demographics: "All ages" },
    { trend: "Cashless Preference", strength: "Very Strong", persistence: "Long-term", demographics: "Under 40" },
    { trend: "Subscription Model Adoption", strength: "Growing", persistence: "Medium-term", demographics: "Millennials, Gen Z" },
    { trend: "Financial Transparency Demand", strength: "Strong", persistence: "Long-term", demographics: "All ages" }
  ]
};