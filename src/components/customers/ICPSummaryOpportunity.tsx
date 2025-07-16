import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Save, MessageSquare, Target, Globe, Settings, DollarSign, TrendingUp, MapPin, Lightbulb, Copy, MoreHorizontal, ChevronDown, Bot, Users, Building, Download, FileText, User, Flame, Zap } from "lucide-react";
import MiniLineChart from "@/components/MiniLineChart";
import MiniPieChart from "@/components/MiniPieChart";

interface ICPSummaryOpportunityProps {
  activeICP?: {
    id: string;
    industry: string;
    segment: string;
  };
}

export const ICPSummaryOpportunity = ({ activeICP }: ICPSummaryOpportunityProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isBuyerMapExpanded, setIsBuyerMapExpanded] = useState(false);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [showProfilerChat, setShowProfilerChat] = useState(false);
  const [showBuyerMapProfilerChat, setShowBuyerMapProfilerChat] = useState(false);
  const [editHistory, setEditHistory] = useState<string[]>([]);

  // Reset expanded state when activeICP changes
  useEffect(() => {
    console.log('Active ICP changed:', activeICP);
    setIsExpanded(false);
    setIsBuyerMapExpanded(false);
    setShowProfilerChat(false);
    setShowBuyerMapProfilerChat(false);
  }, [activeICP?.id, activeICP?.industry, activeICP?.segment]);

  const handleEdit = (section: string) => {
    setEditingSection(section);
    if (!editHistory.includes(section)) {
      setEditHistory([...editHistory, section]);
    }
  };

  const handleSave = (section: string) => {
    setEditingSection(null);
    setShowProfilerChat(true);
  };

  const handleCopyInsight = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Dynamic content based on active ICP
  const getICPContent = () => {
    console.log('Getting ICP content for:', activeICP);
    
    if (!activeICP) {
      console.log('No active ICP, using default');
      return getDefaultContent();
    }

    // Match by ID or industry/segment combination
    const icpKey = activeICP.id || `${activeICP.industry}-${activeICP.segment}`.toLowerCase().replace(/\s+/g, '-');
    console.log('ICP Key:', icpKey);
    
    switch (icpKey) {
      case "healthcare-saas":
      case "healthcare-saas-patient-data-analytics":
        console.log('Matched Healthcare SaaS');
        return {
          blurb: "Patient Data Analytics platforms in healthcare SaaS are experiencing accelerated growth across North America and EU, driven by HIPAA compliance requirements and AI/ML integration demands. Companies with 100–500 employees are leading digital health innovation while navigating complex regulatory frameworks and data privacy mandates. The sector is increasingly investing in real-time analytics and predictive modeling to enhance patient outcomes and operational efficiency.",
          stats: [
            { icon: TrendingUp, label: "Market Growth", value: "8.2% CAGR", color: "green" },
            { icon: DollarSign, label: "Market Size", value: "$6.8B TAM in North America, $4.2B in EU", color: "green" },
            { icon: Users, label: "Active Players", value: "~280 Healthcare Analytics firms", color: "blue" },
            { icon: Building, label: "Investment Activity", value: "$4.1B raised in past 12 months", color: "orange" }
          ],
          marketSize: "$11.0B",
          sam: "$8.5B",
          regions: "North America + EU",
          topVertical: "Patient Data Analytics",
          cagr: "8.2%",
          reportTitle: "Healthcare SaaS Market Intelligence Report",
          marketContent: {
            forecast: "$11.0B by 2027",
            drivers: [
              "HIPAA and GDPR compliance requirements",
              "AI-driven diagnostic and predictive analytics",
              "Interoperability standards (FHIR, HL7)"
            ],
            insight: "8.2% CAGR reflects strong demand for data-driven healthcare solutions."
          },
          segments: {
            "North America": [
              "Strong regulatory framework with HIPAA compliance",
              "High adoption of EHR systems driving data availability",
              "Major health systems investing in analytics platforms"
            ],
            "EU": [
              "GDPR creating robust data protection standards",
              "Government-led digital health initiatives",
              "Growing focus on population health management"
            ]
          },
          challenges: [
            "Complex data integration across disparate healthcare systems",
            "Stringent regulatory requirements for patient data handling",
            "High customer acquisition costs in healthcare sector"
          ],
          recommendations: {
            goToMarket: [
              "Lead with compliance and security credentials",
              "Partner with EHR vendors for seamless integration"
            ],
            targetProfile: [
              "HIPAA-compliant infrastructure",
              "Active EHR implementation projects",
              "Recent healthcare IT investments"
            ]
          },
          signals: [
            { category: "Regulatory", description: "New healthcare data regulations" },
            { category: "Technology", description: "AI/ML adoption in clinical settings" },
            { category: "Funding", description: "Healthcare IT funding rounds above $25M" }
          ],
          buyerMap: {
            blurb: "Healthcare analytics buyers span clinical and IT leadership, driven by patient outcomes pressure and regulatory compliance deadlines. Chief Medical Officers and IT Directors collaborate on vendor selection, prioritizing data security, interoperability, and measurable ROI on clinical efficiency gains.",
            corePersonas: 4,
            topPainPoint: "Data silos preventing unified patient view",
            buyingTriggers: 6,
            personas: [
              {
                role: "Chief Medical Officer",
                influence: "High",
                painPoints: ["Fragmented patient data", "Clinical workflow inefficiencies", "Quality metrics reporting"],
                triggers: ["New patient safety regulations", "Quality scores decline", "Competitor advantage in outcomes"]
              },
              {
                role: "IT Director",
                influence: "High", 
                painPoints: ["Legacy system integration", "Data security compliance", "Vendor management complexity"],
                triggers: ["HIPAA audit findings", "System downtime incidents", "Budget approval cycles"]
              },
              {
                role: "Clinical Data Manager",
                influence: "Medium",
                painPoints: ["Manual data extraction", "Report generation delays", "Inconsistent data formats"],
                triggers: ["Monthly reporting deadlines", "Clinical research demands", "Accreditation reviews"]
              },
              {
                role: "Chief Financial Officer",
                influence: "Medium",
                painPoints: ["ROI measurement difficulty", "Budget allocation decisions", "Operational cost pressures"],
                triggers: ["Budget planning cycles", "Cost reduction mandates", "Revenue optimization needs"]
              }
            ]
          }
        };

      case "logistics-tech":
      case "logistics-tech-last-mile-delivery":
        console.log('Matched Logistics Tech');
        return {
          blurb: "Last-Mile Delivery platforms in logistics tech are revolutionizing supply chain efficiency across SEA and North America, driven by e-commerce growth and real-time tracking demands. Companies with 200–800 employees are pioneering API-first solutions while addressing urbanization challenges and sustainability requirements. The sector is rapidly adopting IoT integration and route optimization algorithms to meet consumer expectations for faster, more transparent deliveries.",
          stats: [
            { icon: TrendingUp, label: "Market Growth", value: "12.1% CAGR", color: "green" },
            { icon: DollarSign, label: "Market Size", value: "$8.3B TAM in SEA, $15.7B in North America", color: "green" },
            { icon: Users, label: "Active Players", value: "~190 Last-Mile Tech firms", color: "blue" },
            { icon: Building, label: "Investment Activity", value: "$6.2B raised in past 12 months", color: "orange" }
          ],
          marketSize: "$24.0B",
          sam: "$18.5B",
          regions: "SEA + North America",
          topVertical: "Last-Mile Delivery",
          cagr: "12.1%",
          reportTitle: "Logistics Tech Market Intelligence Report",
          marketContent: {
            forecast: "$24.0B by 2027",
            drivers: [
              "E-commerce boom driving delivery demand",
              "Consumer expectations for real-time tracking",
              "Urban density requiring optimized routing solutions"
            ],
            insight: "12.1% CAGR driven by explosive e-commerce growth and urbanization trends."
          },
          segments: {
            "SEA": [
              "Rapid e-commerce growth in emerging markets",
              "Infrastructure challenges creating innovation opportunities",
              "Government support for digital logistics initiatives"
            ],
            "North America": [
              "Mature e-commerce market demanding efficiency gains",
              "Focus on sustainability and carbon footprint reduction",
              "Integration with autonomous delivery technologies"
            ]
          },
          challenges: [
            "Complex urban logistics and traffic congestion",
            "Rising fuel costs impacting delivery economics",
            "Competition from established logistics giants"
          ],
          recommendations: {
            goToMarket: [
              "Emphasize real-time visibility and customer experience",
              "Target mid-market e-commerce companies seeking differentiation"
            ],
            targetProfile: [
              "High delivery volume operations",
              "Customer experience focus",
              "Technology modernization initiatives"
            ]
          },
          signals: [
            { category: "Market", description: "E-commerce penetration rates in target regions" },
            { category: "Technology", description: "Autonomous delivery pilot programs" },
            { category: "Regulatory", description: "Urban delivery regulations and sustainability mandates" }
          ],
          buyerMap: {
            blurb: "Logistics technology buyers prioritize operational efficiency and customer satisfaction metrics. Supply Chain VPs and Operations Directors lead procurement decisions, focusing on real-time visibility, cost reduction, and scalability during peak delivery periods.",
            corePersonas: 3,
            topPainPoint: "Last-mile delivery cost optimization",
            buyingTriggers: 5,
            personas: [
              {
                role: "VP of Supply Chain",
                influence: "High",
                painPoints: ["Rising delivery costs", "Customer satisfaction scores", "Peak season scalability"],
                triggers: ["Q4 planning cycles", "Customer complaints surge", "Competitor delivery improvements"]
              },
              {
                role: "Operations Director",
                influence: "High",
                painPoints: ["Route optimization inefficiencies", "Driver productivity", "Real-time tracking gaps"],
                triggers: ["Operational KPI misses", "Technology refresh cycles", "New market expansion"]
              },
              {
                role: "CTO",
                influence: "Medium",
                painPoints: ["System integration complexity", "API reliability", "Data analytics capabilities"],
                triggers: ["Platform migration needs", "Scalability bottlenecks", "Innovation initiatives"]
              }
            ]
          }
        };

      case "edtech-platforms":
      case "edtech-learning-management":
        console.log('Matched EdTech');
        return {
          blurb: "Learning Management platforms in EdTech are transforming educational delivery across Global and LATAM markets, driven by mobile-first adoption and analytics-driven personalization. Companies with 80–300 employees are pioneering adaptive learning technologies while addressing diverse linguistic and cultural requirements. The sector is increasingly focusing on outcomes measurement and AI-powered content recommendation to enhance learning effectiveness and student engagement.",
          stats: [
            { icon: TrendingUp, label: "Market Growth", value: "9.4% CAGR", color: "green" },
            { icon: DollarSign, label: "Market Size", value: "$12.8B TAM globally, $3.2B in LATAM", color: "green" },
            { icon: Users, label: "Active Players", value: "~350 EdTech LMS firms", color: "blue" },
            { icon: Building, label: "Investment Activity", value: "$3.8B raised in past 12 months", color: "orange" }
          ],
          marketSize: "$16.0B",
          sam: "$12.5B",
          regions: "Global + LATAM",
          topVertical: "Learning Management",
          cagr: "9.4%",
          reportTitle: "EdTech Market Intelligence Report",
          marketContent: {
            forecast: "$16.0B by 2027",
            drivers: [
              "Mobile-first learning preferences among students",
              "Demand for personalized learning experiences",
              "Analytics-driven educational outcomes measurement"
            ],
            insight: "9.4% CAGR reflects sustained investment in digital learning transformation."
          },
          segments: {
            "Global": [
              "Widespread digital transformation in education",
              "Hybrid learning models becoming standard",
              "Integration with productivity and collaboration tools"
            ],
            "LATAM": [
              "Rapid smartphone adoption enabling mobile learning",
              "Government initiatives for digital education access",
              "Growing demand for multilingual learning platforms"
            ]
          },
          challenges: [
            "Diverse educational standards and curriculum requirements",
            "Digital divide affecting student access to technology",
            "Complex procurement processes in educational institutions"
          ],
          recommendations: {
            goToMarket: [
              "Focus on measurable learning outcomes and ROI",
              "Develop partnerships with educational content providers"
            ],
            targetProfile: [
              "Digital transformation initiatives",
              "Student engagement improvement goals",
              "Recent educational technology investments"
            ]
          },
          signals: [
            { category: "Education", description: "Hybrid learning policy changes" },
            { category: "Technology", description: "AI adoption in educational content" },
            { category: "Funding", description: "EdTech funding rounds above $15M" }
          ]
        };

      case "proptech-crm":
      case "proptech-real-estate-crm":
        console.log('Matched PropTech');
        return {
          blurb: "Real Estate CRM platforms in PropTech are streamlining property management across North America and ANZ, driven by integration capabilities and workflow automation demands. Companies with 150–600 employees are modernizing traditional real estate operations while addressing complex transaction management and client relationship needs. The sector is increasingly adopting AI-powered lead scoring and automated marketing workflows to enhance agent productivity and deal closure rates.",
          stats: [
            { icon: TrendingUp, label: "Market Growth", value: "6.8% CAGR", color: "green" },
            { icon: DollarSign, label: "Market Size", value: "$7.2B TAM in North America, $2.1B in ANZ", color: "green" },
            { icon: Users, label: "Active Players", value: "~220 PropTech CRM firms", color: "blue" },
            { icon: Building, label: "Investment Activity", value: "$2.9B raised in past 12 months", color: "orange" }
          ],
          marketSize: "$9.3B",
          sam: "$7.8B",
          regions: "North America + ANZ",
          topVertical: "Real Estate CRM",
          cagr: "6.8%",
          reportTitle: "PropTech Market Intelligence Report",
          marketContent: {
            forecast: "$9.3B by 2027",
            drivers: [
              "Digital transformation in real estate operations",
              "Integration with MLS and property listing platforms",
              "Automated workflow and lead management needs"
            ],
            insight: "6.8% CAGR driven by real estate industry digitization and agent productivity focus."
          },
          segments: {
            "North America": [
              "Mature real estate market with established MLS systems",
              "High agent adoption of digital tools",
              "Integration with mortgage and title service providers"
            ],
            "ANZ": [
              "Growing real estate investment market",
              "Government digitization initiatives for property transactions",
              "Increasing focus on data analytics for market insights"
            ]
          },
          challenges: [
            "Fragmented real estate technology ecosystem",
            "Resistance to change among traditional real estate professionals",
            "Complex integration requirements with existing systems"
          ],
          recommendations: {
            goToMarket: [
              "Emphasize ROI through improved agent productivity",
              "Partner with MLS providers and real estate franchises"
            ],
            targetProfile: [
              "High transaction volume brokerages",
              "Technology modernization projects",
              "Agent productivity improvement initiatives"
            ]
          },
          signals: [
            { category: "Market", description: "Real estate transaction volume trends" },
            { category: "Technology", description: "MLS integration announcements" },
            { category: "Regulatory", description: "Real estate technology compliance requirements" }
          ]
        };

      case "cybersecurity-startups":
      case "cybersecurity-zero-trust-solutions":
        console.log('Matched Cybersecurity');
        return {
          blurb: "Zero Trust Solutions in cybersecurity are securing enterprise networks across North America and EU, driven by SOC 2 compliance and cloud-native architecture adoption. Companies with 75–400 employees are pioneering identity-centric security models while addressing remote work challenges and sophisticated threat landscapes. The sector is rapidly integrating AI-powered threat detection and behavioral analytics to provide comprehensive security postures for distributed organizations.",
          stats: [
            { icon: TrendingUp, label: "Market Growth", value: "15.3% CAGR", color: "green" },
            { icon: DollarSign, label: "Market Size", value: "$18.7B TAM in North America, $12.4B in EU", color: "green" },
            { icon: Users, label: "Active Players", value: "~180 Zero Trust firms", color: "blue" },
            { icon: Building, label: "Investment Activity", value: "$8.3B raised in past 12 months", color: "orange" }
          ],
          marketSize: "$31.1B",
          sam: "$25.2B",
          regions: "North America + EU",
          topVertical: "Zero Trust Solutions",
          cagr: "15.3%",
          reportTitle: "Cybersecurity Market Intelligence Report",
          marketContent: {
            forecast: "$31.1B by 2027",
            drivers: [
              "Remote work driving perimeter security obsolescence",
              "Increasing sophistication of cyber threats",
              "Regulatory compliance requirements (SOC 2, ISO 27001)"
            ],
            insight: "15.3% CAGR reflects urgent enterprise need for modern security architectures."
          },
          segments: {
            "North America": [
              "High cybersecurity spending driven by regulatory requirements",
              "Mature cloud adoption creating security transformation needs",
              "Strong venture capital investment in security technologies"
            ],
            "EU": [
              "GDPR creating stringent data protection requirements",
              "Government initiatives for cybersecurity resilience",
              "Growing focus on supply chain security"
            ]
          },
          challenges: [
            "Complex migration from legacy security architectures",
            "Skills shortage in cybersecurity professionals",
            "Integration complexity with existing security tools"
          ],
          recommendations: {
            goToMarket: [
              "Lead with compliance and risk reduction messaging",
              "Target organizations with recent security incidents or audits"
            ],
            targetProfile: [
              "Cloud transformation initiatives",
              "Remote work security challenges",
              "Recent cybersecurity investments or incidents"
            ]
          },
          signals: [
            { category: "Security", description: "High-profile cybersecurity breaches" },
            { category: "Compliance", description: "New data protection regulations" },
            { category: "Technology", description: "Cloud migration announcements" }
          ]
        };

      case "insurtech-platforms":
      case "insurtech-digital-claims-processing":
        console.log('Matched InsurTech');
        return {
          blurb: "Digital Claims Processing platforms in InsurTech are revolutionizing insurance operations across North America and UK, driven by automation focus and regulatory expertise demands. Companies with 100–350 employees are transforming traditional claims workflows while addressing fraud prevention and customer experience expectations. The sector is increasingly leveraging AI-powered damage assessment and automated decision-making to reduce processing times and operational costs.",
          stats: [
            { icon: TrendingUp, label: "Market Growth", value: "11.7% CAGR", color: "green" },
            { icon: DollarSign, label: "Market Size", value: "$9.4B TAM in North America, $3.8B in UK", color: "green" },
            { icon: Users, label: "Active Players", value: "~160 InsurTech Claims firms", color: "blue" },
            { icon: Building, label: "Investment Activity", value: "$3.6B raised in past 12 months", color: "orange" }
          ],
          marketSize: "$13.2B",
          sam: "$10.8B",
          regions: "North America + UK",
          topVertical: "Digital Claims Processing",
          cagr: "11.7%",
          reportTitle: "InsurTech Market Intelligence Report",
          marketContent: {
            forecast: "$13.2B by 2027",
            drivers: [
              "Customer expectations for faster claims resolution",
              "Regulatory pressure for transparent claims processes",
              "AI and automation reducing manual processing costs"
            ],
            insight: "11.7% CAGR driven by digital transformation pressure and cost reduction needs."
          },
          segments: {
            "North America": [
              "Mature insurance market with legacy system modernization needs",
              "Regulatory focus on consumer protection and transparency",
              "High adoption of mobile-first claims reporting"
            ],
            "UK": [
              "Strong regulatory framework driving innovation",
              "Government initiatives for insurance sector digitization",
              "Growing focus on parametric and usage-based insurance"
            ]
          },
          challenges: [
            "Legacy system integration in established insurance companies",
            "Regulatory compliance across different insurance products",
            "Fraud detection and prevention in automated processes"
          ],
          recommendations: {
            goToMarket: [
              "Emphasize cost reduction and processing time improvements",
              "Target insurers with high claims volume and complexity"
            ],
            targetProfile: [
              "Legacy system modernization projects",
              "High claims processing volumes",
              "Customer experience improvement initiatives"
            ]
          },
          signals: [
            { category: "Insurance", description: "Claims processing cost pressures" },
            { category: "Technology", description: "AI adoption in insurance operations" },
            { category: "Regulatory", description: "Insurance industry digital transformation mandates" }
          ]
        };

      case "renewable-energy":
      case "clean-energy-solar-management-platforms":
        console.log('Matched Clean Energy');
        return {
          blurb: "Solar Management Platforms in clean energy are optimizing renewable installations across North America, EU, and ANZ, driven by IoT integration and sustainability reporting demands. Companies with 120–500 employees are pioneering smart grid technologies while addressing regulatory incentives and environmental compliance requirements. The sector is rapidly adopting predictive maintenance algorithms and real-time performance monitoring to maximize energy output and operational efficiency.",
          stats: [
            { icon: TrendingUp, label: "Market Growth", value: "18.2% CAGR", color: "green" },
            { icon: DollarSign, label: "Market Size", value: "$8.9B TAM in North America, $6.7B in EU, $2.2B in ANZ", color: "green" },
            { icon: Users, label: "Active Players", value: "~85 Solar Management firms", color: "blue" },
            { icon: Building, label: "Investment Activity", value: "$5.4B raised in past 12 months", color: "orange" }
          ],
          marketSize: "$17.8B",
          sam: "$14.3B",
          regions: "North America + EU + ANZ",
          topVertical: "Solar Management Platforms",
          cagr: "18.2%",
          reportTitle: "Clean Energy Market Intelligence Report",
          marketContent: {
            forecast: "$17.8B by 2027",
            drivers: [
              "Government renewable energy mandates and incentives",
              "IoT sensor technology enabling real-time monitoring",
              "Corporate sustainability commitments driving solar adoption"
            ],
            insight: "18.2% CAGR reflects accelerating renewable energy transition and technology maturation."
          },
          segments: {
            "North America": [
              "Strong federal and state incentives for solar adoption",
              "Mature installation market creating management needs",
              "Grid integration requirements driving software demand"
            ],
            "EU": [
              "Aggressive renewable energy targets by 2030",
              "Green Deal policies supporting clean energy investment",
              "Focus on energy independence driving solar installations"
            ],
            "ANZ": [
              "High solar irradiance creating optimal conditions",
              "Government renewable energy targets",
              "Growing commercial and utility-scale installations"
            ]
          },
          challenges: [
            "Complex grid integration and energy storage coordination",
            "Varying regulatory frameworks across different regions",
            "Technology standardization across diverse solar installations"
          ],
          recommendations: {
            goToMarket: [
              "Emphasize ROI through performance optimization and predictive maintenance",
              "Partner with solar installers and energy management companies"
            ],
            targetProfile: [
              "Large-scale solar installations",
              "Sustainability reporting requirements",
              "Recent renewable energy investments"
            ]
          },
          signals: [
            { category: "Policy", description: "Renewable energy policy changes and incentives" },
            { category: "Technology", description: "Battery storage and grid integration developments" },
            { category: "Investment", description: "Clean energy funding rounds above $30M" }
          ]
        };

      default:
        console.log('No match found, using default Neobanks content');
        return getDefaultContent();
    }
  };

  const getDefaultContent = () => {
    return {
      blurb: "Neobanks in the fintech sector are rapidly scaling across North America and DACH, driven by high cloud adoption and strong regulatory compliance demands. Mid-sized players (50–200 employees) are emerging as innovators yet face margin pressures and evolving regulatory landscapes. These financial institutions are increasingly investing in advanced API-first infrastructure to compete with traditional banks. The sector shows strong momentum toward embedded finance solutions and customer-centric digital experiences.",
      stats: [
        { icon: TrendingUp, label: "Market Growth", value: "5.6% CAGR", color: "green" },
        { icon: DollarSign, label: "Market Size", value: "$3.2B TAM in North America, $1.1B in DACH", color: "green" },
        { icon: Users, label: "Active Players", value: "~150 Neobank firms in target segments", color: "blue" },
        { icon: Building, label: "Investment Activity", value: "$2.4B raised in past 12 months", color: "orange" }
      ],
      marketSize: "$4.3B",
      sam: "$3.2B",
      regions: "North America + DACH",
      topVertical: "Neobanks",
      cagr: "5.6%",
      reportTitle: "Neobank Market Intelligence Report",
      marketContent: {
        forecast: "$4.3B by 2027",
        drivers: [
          "Cloud-native banking architectures",
          "Customer demand for digital-first experiences", 
          "Agile regulatory frameworks for fintech entrants"
        ],
        insight: "5.6% CAGR indicates moderate but sustainable growth, especially in mid-sized firms."
      },
      segments: {
        "North America": [
          "High consumer digital adoption",
          "Regulatory scrutiny increasing around data privacy and AML",
          "Competitive landscape includes Chime, Varo, and new regional entrants"
        ],
        "DACH": [
          "Fintech hubs emerging in Germany and Switzerland",
          "Preference for strong compliance credentials",
          "Investors attracted to scalable B2B neobank models"
        ]
      },
      challenges: [
        "Tightening margins due to rising customer acquisition costs",
        "Heightened regulatory expectations (Basel IV, PSD2 updates)",
        "Talent competition in digital product and compliance roles"
      ],
      recommendations: {
        goToMarket: [
          "Prioritize compliance-forward messaging in go-to-market",
          "Explore partnerships with RegTech vendors for differentiation"
        ],
        targetProfile: [
          "High cloud maturity",
          "Digital transformation mandates",
          "New funding rounds in past 12–18 months"
        ]
      },
      signals: [
        { category: "Regulatory", description: "New fintech regulations in Europe" },
        { category: "Funding", description: "Funding rounds above $20M in Neobank space" },
        { category: "Metrics", description: "Shifts in customer acquisition cost metrics" }
      ],
      buyerMap: {
        blurb: "Neobank buyers balance innovation with compliance, led by CTOs and Chief Risk Officers. Decision-makers prioritize regulatory readiness, scalability, and competitive differentiation while managing tight timelines for market entry and customer acquisition.",
        corePersonas: 3,
        topPainPoint: "Regulatory compliance complexity",
        buyingTriggers: 4,
        personas: [
          {
            role: "Chief Technology Officer",
            influence: "High",
            painPoints: ["Regulatory compliance automation", "Scalability bottlenecks", "Security requirements"],
            triggers: ["Regulatory deadline pressures", "Customer growth milestones", "Funding round preparations"]
          },
          {
            role: "Chief Risk Officer",
            influence: "High",
            painPoints: ["AML/KYC compliance", "Fraud detection accuracy", "Regulatory reporting"],
            triggers: ["Audit findings", "New regulation announcements", "Risk threshold breaches"]
          },
          {
            role: "Head of Product",
            influence: "Medium",
            painPoints: ["Time-to-market pressure", "Feature parity with competitors", "User experience optimization"],
            triggers: ["Product roadmap deadlines", "Customer feedback patterns", "Competitive feature launches"]
          }
        ]
      }
    };
  };

  const content = getICPContent();

  const marketSegmentationData = content.regions.includes("North America + DACH") ? [
    { name: "North America", value: 65, color: "#0064FF" },
    { name: "DACH", value: 25, color: "#00A3FF" },
    { name: "Other EU", value: 10, color: "#66C2FF" }
  ] : content.regions.includes("SEA") ? [
    { name: "SEA", value: 45, color: "#0064FF" },
    { name: "North America", value: 40, color: "#00A3FF" },
    { name: "Other", value: 15, color: "#66C2FF" }
  ] : [
    { name: "Primary Region", value: 60, color: "#0064FF" },
    { name: "Secondary Region", value: 30, color: "#00A3FF" },
    { name: "Other", value: 10, color: "#66C2FF" }
  ];

  const marketSizeValue = parseFloat(content.marketSize.replace(/[^0-9.]/g, ''));
  const tamGrowthData = [
    { name: "2022", value: marketSizeValue * 0.7 },
    { name: "2023", value: marketSizeValue * 0.8 },
    { name: "2024", value: marketSizeValue * 0.9 },
    { name: "2025", value: marketSizeValue * 0.95 },
    { name: "2026", value: marketSizeValue * 0.98 },
    { name: "2027", value: marketSizeValue }
  ];

  return (
    <div className="space-y-6">
      {/* ICP Summary & Market Opportunity Section */}
      {!isExpanded ? (
        // Collapsed Default View
        <div className="bg-white rounded-lg border border-gray-200 p-6 relative">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">ICP Summary & Market Opportunity</h2>
              <p className="text-sm text-gray-600">
                High-level snapshot of market fit & revenue potential
              </p>
            </div>
            <div className="flex items-center gap-2">
              {editHistory.length > 0 && (
                <Button variant="ghost" size="sm" className="text-xs text-gray-500">
                  <MoreHorizontal className="h-3 w-3 mr-1" />
                  Edit History
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleEdit("summary")} 
                className="text-gray-600 hover:text-gray-800 hover:bg-gray-100" 
                title="Edit ICP"
              >
                <Edit className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Collapsed Content */}
          <div className="space-y-4">
            {/* Introduction Paragraph */}
            <p className="text-gray-700 text-sm leading-relaxed">
              {content.blurb}
            </p>

            {/* Quick Highlights Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {content.stats.map((stat, index) => (
                <div key={index} className="bg-white rounded-md p-3 border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <stat.icon className={`h-4 w-4 text-${stat.color}-600`} />
                    <Badge variant="secondary" className={`text-xs bg-${stat.color}-100 text-${stat.color}-700`}>
                      {stat.label}
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 leading-tight">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsExpanded(true)} 
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 flex items-center gap-1"
              >
                Read More
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Floating Profiler Chat Icon */}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowProfilerChat(true)} 
            className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg" 
            title="Explore More with Profiler"
          >
            <Bot className="h-5 w-5" />
          </Button>
        </div>
      ) : (
        // Expanded Full Report View
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {content.reportTitle}
              </h2>
              <p className="text-sm text-gray-600">
                Comprehensive market analysis and strategic recommendations
              </p>
            </div>
            <div className="flex items-center gap-2">
              {editHistory.length > 0 && (
                <Button variant="ghost" size="sm" className="text-xs text-gray-500">
                  <MoreHorizontal className="h-3 w-3 mr-1" />
                  Edit History
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowProfilerChat(true)} 
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50" 
                title="Explore More with Profiler"
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Summary Blurb */}
          <div className="bg-white rounded-lg p-4 mb-6">
            <p className="text-gray-700 leading-relaxed">{content.blurb}</p>
          </div>

          {/* Quick Highlights Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {content.stats.map((stat, index) => (
              <div key={index} className="bg-white rounded-md p-3 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <stat.icon className={`h-4 w-4 text-${stat.color}-600`} />
                  <Badge variant="secondary" className={`text-xs bg-${stat.color}-100 text-${stat.color}-700`}>
                    {stat.label}
                  </Badge>
                </div>
                <p className="text-sm font-semibold text-gray-900 leading-tight">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Market Size & Growth */}
          <div className="bg-white rounded-lg border p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900">Market Size & Growth</h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <p className="text-gray-700 text-sm leading-relaxed">
                  The {content.topVertical.toLowerCase()} sector in {content.regions.replace(' + ', ' and ')} is forecasted to reach {content.marketContent.forecast}. Growth is propelled by:
                </p>
                <ul className="space-y-2 text-sm text-gray-700 ml-4">
                  {content.marketContent.drivers.map((driver, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                      {driver}
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
                  <strong>{content.cagr} CAGR</strong> {content.marketContent.insight}
                </p>
              </div>
              <div className="flex justify-center">
                <MiniLineChart data={tamGrowthData} title="TAM Growth Forecast ($B)" color="#0064FF" />
              </div>
            </div>
          </div>

          {/* Segment Breakdown */}
          <div className="bg-white rounded-lg border p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Segment Breakdown</h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                {Object.entries(content.segments).map(([region, points], index) => (
                  <div key={region}>
                    <h4 className="font-semibold text-gray-900 mb-2">{region}</h4>
                    <ul className="space-y-1 text-sm text-gray-700 ml-4">
                      {points.map((point, pointIndex) => (
                        <li key={pointIndex} className="flex items-start gap-2">
                          <div className={`w-1.5 h-1.5 ${index === 0 ? 'bg-green-600' : index === 1 ? 'bg-purple-600' : 'bg-orange-600'} rounded-full mt-2 flex-shrink-0`}></div>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="flex justify-center">
                <MiniPieChart data={marketSegmentationData} title="Regional Market Share" />
              </div>
            </div>
          </div>

          {/* Key Challenges */}
          <div className="bg-white rounded-lg border p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Target className="h-5 w-5 text-orange-600" />
              <h3 className="text-lg font-semibold text-gray-900">Key Challenges</h3>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <ul className="space-y-2 text-sm text-orange-800">
                {content.challenges.map((challenge, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-orange-600 rounded-full mt-2 flex-shrink-0"></div>
                    {challenge}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Strategic Recommendations */}
          <div className="bg-white rounded-lg border p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="h-5 w-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">Strategic Recommendations</h3>
            </div>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Go-to-Market Strategy</h4>
                <ul className="space-y-1 text-sm text-gray-700 ml-4">
                  {content.recommendations.goToMarket.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-purple-600 rounded-full mt-2 flex-shrink-0"></div>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Target Profile</h4>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-800 mb-2">Target firms with:</p>
                  <ul className="space-y-1 text-sm text-green-700 ml-4">
                    {content.recommendations.targetProfile.map((profile, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                        {profile}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Signals to Monitor */}
          <div className="bg-white rounded-lg border p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="h-5 w-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Signals to Monitor</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {content.signals.map((signal, index) => (
                <div key={index} className={`${
                  index === 0 ? 'bg-blue-50 border-blue-200' : 
                  index === 1 ? 'bg-green-50 border-green-200' : 
                  'bg-purple-50 border-purple-200'
                } border rounded-lg p-3`}>
                  <h5 className={`font-medium text-sm mb-1 ${
                    index === 0 ? 'text-blue-900' : 
                    index === 1 ? 'text-green-900' : 
                    'text-purple-900'
                  }`}>{signal.category}</h5>
                  <p className={`text-xs ${
                    index === 0 ? 'text-blue-700' : 
                    index === 1 ? 'text-green-700' : 
                    'text-purple-700'
                  }`}>{signal.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-6 border-t border-gray-200">
            <Button 
              variant="outline" 
              onClick={() => setIsExpanded(false)}
              className="flex items-center gap-2"
            >
              <ChevronDown className="h-4 w-4 rotate-180" />
              Show Less
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                Save Report
              </Button>
              <Button variant="outline" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export PDF
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Buyer Map & Roles, Pain Points, Triggers Section */}
      {!isBuyerMapExpanded ? (
        // Collapsed Default View
        <div className="bg-white rounded-lg border border-gray-200 p-6 relative">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Buyer Map & Roles, Pain Points, Triggers</h2>
              <p className="text-sm text-gray-600">
                Key decision makers, their challenges, and purchase catalysts
              </p>
            </div>
            <div className="flex items-center gap-2">
              {editHistory.length > 0 && (
                <Button variant="ghost" size="sm" className="text-xs text-gray-500">
                  <MoreHorizontal className="h-3 w-3 mr-1" />
                  Edit History
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleEdit("buyer-map")} 
                className="text-gray-600 hover:text-gray-800 hover:bg-gray-100" 
                title="Edit Buyer Map"
              >
                <Edit className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Collapsed Content */}
          <div className="space-y-4">
            {/* Introduction Paragraph */}
            <p className="text-gray-700 text-sm leading-relaxed">
              {content.buyerMap.blurb}
            </p>

            {/* Quick Highlights Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-md p-3 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <User className="h-4 w-4 text-blue-600" />
                  <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                    Core Personas
                  </Badge>
                </div>
                <p className="text-sm font-semibold text-gray-900 leading-tight">{content.buyerMap.corePersonas} buyer roles</p>
              </div>
              
              <div className="bg-white rounded-md p-3 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Flame className="h-4 w-4 text-red-600" />
                  <Badge variant="secondary" className="text-xs bg-red-100 text-red-700">
                    Top Pain Point
                  </Badge>
                </div>
                <p className="text-sm font-semibold text-gray-900 leading-tight">{content.buyerMap.topPainPoint}</p>
              </div>

              <div className="bg-white rounded-md p-3 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4 text-yellow-600" />
                  <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-700">
                    Buying Triggers
                  </Badge>
                </div>
                <p className="text-sm font-semibold text-gray-900 leading-tight">{content.buyerMap.buyingTriggers} identified</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsBuyerMapExpanded(true)} 
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 flex items-center gap-1"
              >
                Read More
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Floating Profiler Chat Icon */}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowBuyerMapProfilerChat(true)} 
            className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg" 
            title="Explore More with Profiler"
          >
            <Bot className="h-5 w-5" />
          </Button>
        </div>
      ) : (
        // Expanded Full View
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Buyer Map & Roles, Pain Points, Triggers
              </h2>
              <p className="text-sm text-gray-600">
                Comprehensive analysis of decision makers and purchase drivers
              </p>
            </div>
            <div className="flex items-center gap-2">
              {editHistory.length > 0 && (
                <Button variant="ghost" size="sm" className="text-xs text-gray-500">
                  <MoreHorizontal className="h-3 w-3 mr-1" />
                  Edit History
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowBuyerMapProfilerChat(true)} 
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50" 
                title="Explore More with Profiler"
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Summary Blurb */}
          <div className="bg-white rounded-lg p-4 mb-6">
            <p className="text-gray-700 leading-relaxed">{content.buyerMap.blurb}</p>
          </div>

          {/* Quick Highlights Grid */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white rounded-md p-3 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <User className="h-4 w-4 text-blue-600" />
                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                  Core Personas
                </Badge>
              </div>
              <p className="text-sm font-semibold text-gray-900 leading-tight">{content.buyerMap.corePersonas} buyer roles</p>
            </div>
            
            <div className="bg-white rounded-md p-3 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Flame className="h-4 w-4 text-red-600" />
                <Badge variant="secondary" className="text-xs bg-red-100 text-red-700">
                  Top Pain Point
                </Badge>
              </div>
              <p className="text-sm font-semibold text-gray-900 leading-tight">{content.buyerMap.topPainPoint}</p>
            </div>

            <div className="bg-white rounded-md p-3 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-4 w-4 text-yellow-600" />
                <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-700">
                  Buying Triggers
                </Badge>
              </div>
              <p className="text-sm font-semibold text-gray-900 leading-tight">{content.buyerMap.buyingTriggers} identified</p>
            </div>
          </div>

          {/* Buyer Personas Details */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Buyer Personas</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {content.buyerMap.personas.map((persona, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-900">{persona.role}</h4>
                      <Badge 
                        variant={persona.influence === "High" ? "default" : "secondary"}
                        className={persona.influence === "High" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}
                      >
                        {persona.influence} Influence
                      </Badge>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-1">Pain Points</h5>
                        <ul className="space-y-1">
                          {persona.painPoints.map((pain, painIndex) => (
                            <li key={painIndex} className="text-sm text-gray-600 flex items-start gap-2">
                              <div className="w-1.5 h-1.5 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
                              {pain}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-1">Buying Triggers</h5>
                        <ul className="space-y-1">
                          {persona.triggers.map((trigger, triggerIndex) => (
                            <li key={triggerIndex} className="text-sm text-gray-600 flex items-start gap-2">
                              <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></div>
                              {trigger}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-6 border-t border-gray-200">
            <Button 
              variant="outline" 
              onClick={() => setIsBuyerMapExpanded(false)}
              className="flex items-center gap-2"
            >
              <ChevronDown className="h-4 w-4 rotate-180" />
              Show Less
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                Save Analysis
              </Button>
              <Button variant="outline" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export PDF
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Profiler Chat Panels */}
      {showProfilerChat && (
        <Card className="border-blue-200 bg-blue-50/40">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="bg-white rounded-lg p-3 mb-3">
                  <p className="text-sm font-medium text-blue-900 mb-1">Profiler</p>
                  <p className="text-sm text-gray-700">
                    Hey! I can help you dive deeper into your {content.topVertical} ICP analysis. What would you like to explore?
                  </p>
                </div>
                <div className="space-y-2">
                  <Button variant="ghost" size="sm" className="justify-start text-xs bg-white hover:bg-blue-50">
                    🔍 Which 3 competitors are growing fastest in this segment?
                  </Button>
                  <Button variant="ghost" size="sm" className="justify-start text-xs bg-white hover:bg-blue-50">
                    🎯 Where's your TAM saturated vs underserved?
                  </Button>
                  <Button variant="ghost" size="sm" className="justify-start text-xs bg-white hover:bg-blue-50">
                    💬 What's your main monetization route in this ICP?
                  </Button>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowProfilerChat(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showBuyerMapProfilerChat && (
        <Card className="border-blue-200 bg-blue-50/40">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="bg-white rounded-lg p-3 mb-3">
                  <p className="text-sm font-medium text-blue-900 mb-1">Profiler</p>
                  <p className="text-sm text-gray-700">
                    Great analysis of the buyer personas! Want me to help you craft targeted messaging or identify specific prospect signals?
                  </p>
                </div>
                <div className="space-y-2">
                  <Button variant="ghost" size="sm" className="justify-start text-xs bg-white hover:bg-blue-50">
                    🎯 Create messaging for each buyer persona
                  </Button>
                  <Button variant="ghost" size="sm" className="justify-start text-xs bg-white hover:bg-blue-50">
                    📧 Draft email templates by role
                  </Button>
                  <Button variant="ghost" size="sm" className="justify-start text-xs bg-white hover:bg-blue-50">
                    🔍 Find prospects showing these pain points
                  </Button>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowBuyerMapProfilerChat(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
