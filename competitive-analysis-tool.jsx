import { useState, useRef, useEffect } from "react";

const SYSTEM_PROMPT = `You are a senior competitive intelligence analyst for product managers. Your job is to conduct deep, multi-source competitive research.

CRITICAL RULES — NO HALLUCINATIONS:
- Never invent numbers. If you can't find traffic, downloads, funding, or follower data, write "Not found / unavailable"
- Only report funding if confirmed via press release, Crunchbase mention, or news
- Cite your source inline when reporting specific data points
- If data conflicts across sources, note both

You will receive a problem statement and a competitor name. Use your web search tool to research:
1. Company basics: website, country/HQ, founded year
2. Website traffic: monthly visits, trend, top country (check seranking.com/website-traffic-checker.html or similarweb references)
3. Mobile apps: Play Store + App Store — live?, installs, rating, reviews
4. Funding: total raised, rounds, investor names, revenue, losses
5. Reviews: Google reviews rating+count, Trustpilot rating+count
6. Social media: Instagram (exists? followers), X/Twitter (exists? followers), YouTube (exists? subs), LinkedIn (exists? employee count, growth)
7. Founders: names, education background, professional background, LinkedIn URL
8. Employee growth: headcount and trend
9. Press coverage: news outlets and blogs that featured them

Then produce a SWOT analysis.

Return your response as a valid JSON object with this exact structure:
{
  "name": "Company Name",
  "website": "url",
  "country": "Country/HQ",
  "founded": "Year",
  "description": "One-line description",
  "traffic": {
    "monthly_visits": "X million / Not found",
    "trend": "up/down/stable/Not found",
    "top_country": "Country / Not found"
  },
  "apps": {
    "android": { "live": true/false, "installs": "1M+ / Not found", "rating": "4.2 / Not found", "reviews": "12k / Not found" },
    "ios": { "live": true/false, "installs": "Not found", "rating": "4.5 / Not found", "reviews": "8k / Not found" }
  },
  "funding": {
    "total_raised": "$10M / Not found",
    "rounds": "Seed, Series A / Not found",
    "investors": ["Investor 1", "Investor 2"],
    "revenue": "$5M ARR / Not found",
    "losses": "Not found"
  },
  "reviews": {
    "google": { "rating": "4.1 / Not found", "count": "200 / Not found" },
    "trustpilot": { "rating": "3.8 / Not found", "count": "500 / Not found" }
  },
  "social": {
    "instagram": { "exists": true/false, "followers": "50k / Not found" },
    "twitter": { "exists": true/false, "followers": "20k / Not found" },
    "youtube": { "exists": true/false, "subscribers": "5k / Not found" },
    "linkedin": { "exists": true/false, "employees": "150 / Not found", "growth": "growing/shrinking/stable/Not found" }
  },
  "founders": [
    { "name": "Jane Doe", "education": "MIT, CS", "background": "Ex-Google PM", "linkedin": "url or Not found" }
  ],
  "press": ["TechCrunch (2023)", "Forbes (2024)"],
  "swot": {
    "strengths": ["Strong funding", "High app rating"],
    "weaknesses": ["No Trustpilot presence", "Unknown founders"],
    "opportunities": ["Expanding to EU", "No Android app from rivals"],
    "threats": ["Big Tech entering space", "Negative reviews trend"]
  }
}

Return ONLY valid JSON. No markdown fences. No preamble. No explanation outside the JSON.`;

const COMPETITOR_DISCOVERY_PROMPT = `You are a competitive intelligence researcher. Given a problem statement, identify the top 6 most relevant competitors or products solving this problem.

Search using these angles:
- Google: "[problem] software/tool/startup alternatives"
- Product Hunt: top products in this category
- Y Combinator: companies solving this
- Crunchbase/Tracxn: startups in this space

Return ONLY a valid JSON array of objects, no markdown fences:
[
  { "name": "Company Name", "description": "One line what they do", "website": "url if known or null" }
]

Return 5-8 competitors. Only include real, verifiable companies. No hallucinations.`;

const colors = {
  bg: "#0a0a0f",
  surface: "#12121a",
  card: "#1a1a26",
  border: "#2a2a3e",
  accent: "#6c63ff",
  accentDim: "#3d3875",
  gold: "#f5c842",
  green: "#4ade80",
  red: "#f87171",
  text: "#e2e0f0",
  muted: "#7b79a0",
};

function Badge({ children, color = colors.accent }) {
  return (
    <span style={{
      background: color + "22",
      color,
      border: `1px solid ${color}44`,
      borderRadius: 6,
      padding: "2px 10px",
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: 0.5,
    }}>{children}</span>
  );
}

function DataRow({ label, value, highlight }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${colors.border}22` }}>
      <span style={{ color: colors.muted, fontSize: 13 }}>{label}</span>
      <span style={{ color: highlight ? colors.gold : colors.text, fontSize: 13, fontWeight: highlight ? 600 : 400, maxWidth: "60%", textAlign: "right" }}>
        {value || "—"}
      </span>
    </div>
  );
}

function SWOTBox({ title, items, icon, bg, border }) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: border, marginBottom: 10 }}>{icon} {title}</div>
      {(items || []).map((item, i) => (
        <div key={i} style={{ fontSize: 12, color: colors.text, marginBottom: 6, paddingLeft: 8, borderLeft: `2px solid ${border}44` }}>
          {item}
        </div>
      ))}
    </div>
  );
}

function SocialChip({ platform, exists, value }) {
  const icons = { instagram: "📸", twitter: "𝕏", youtube: "▶", linkedin: "in" };
  if (!exists) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "6px 12px", fontSize: 12 }}>
      <span>{icons[platform] || platform}</span>
      <span style={{ color: colors.muted }}>{platform}</span>
      <span style={{ color: colors.gold, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function CompetitorCard({ data }) {
  const [open, setOpen] = useState(false);
  if (!data) return null;

  return (
    <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 14, marginBottom: 16, overflow: "hidden" }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ padding: "18px 22px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: colors.accentDim, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: colors.accent, fontSize: 18 }}>
            {data.name?.[0] || "?"}
          </div>
          <div>
            <div style={{ fontWeight: 700, color: colors.text, fontSize: 16 }}>{data.name}</div>
            <div style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{data.country} · Founded {data.founded}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {data.funding?.total_raised && data.funding.total_raised !== "Not found" &&
            <Badge color={colors.green}>{data.funding.total_raised}</Badge>}
          <span style={{ color: colors.muted, fontSize: 18 }}>{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {open && (
        <div style={{ padding: "0 22px 22px", borderTop: `1px solid ${colors.border}` }}>
          <div style={{ color: colors.muted, fontSize: 13, margin: "12px 0 18px", fontStyle: "italic" }}>{data.description}</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Traffic */}
            <div>
              <div style={{ color: colors.accent, fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>📊 Website Traffic</div>
              <DataRow label="Monthly Visits" value={data.traffic?.monthly_visits} highlight />
              <DataRow label="Trend" value={data.traffic?.trend} />
              <DataRow label="Top Country" value={data.traffic?.top_country} />
            </div>

            {/* Funding */}
            <div>
              <div style={{ color: colors.accent, fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>💰 Funding</div>
              <DataRow label="Total Raised" value={data.funding?.total_raised} highlight />
              <DataRow label="Rounds" value={data.funding?.rounds} />
              <DataRow label="Revenue" value={data.funding?.revenue} />
              <DataRow label="Losses" value={data.funding?.losses} />
              {data.funding?.investors?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>Investors</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {data.funding.investors.map((inv, i) => <Badge key={i} color={colors.gold}>{inv}</Badge>)}
                  </div>
                </div>
              )}
            </div>

            {/* Apps */}
            <div>
              <div style={{ color: colors.accent, fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>📱 Mobile Apps</div>
              <div style={{ fontSize: 12, marginBottom: 8 }}>
                <div style={{ color: colors.muted, marginBottom: 4 }}>Android</div>
                {data.apps?.android?.live
                  ? <><DataRow label="Installs" value={data.apps.android.installs} highlight />
                     <DataRow label="Rating" value={data.apps.android.rating} />
                     <DataRow label="Reviews" value={data.apps.android.reviews} /></>
                  : <div style={{ color: colors.muted }}>No Android app</div>}
              </div>
              <div style={{ fontSize: 12 }}>
                <div style={{ color: colors.muted, marginBottom: 4 }}>iOS</div>
                {data.apps?.ios?.live
                  ? <><DataRow label="Rating" value={data.apps.ios.rating} />
                     <DataRow label="Reviews" value={data.apps.ios.reviews} /></>
                  : <div style={{ color: colors.muted }}>No iOS app</div>}
              </div>
            </div>

            {/* Reviews */}
            <div>
              <div style={{ color: colors.accent, fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>⭐ Reviews</div>
              <DataRow label="Google Rating" value={data.reviews?.google?.rating} highlight />
              <DataRow label="Google Count" value={data.reviews?.google?.count} />
              <DataRow label="Trustpilot Rating" value={data.reviews?.trustpilot?.rating} highlight />
              <DataRow label="Trustpilot Count" value={data.reviews?.trustpilot?.count} />
            </div>
          </div>

          {/* Social */}
          <div style={{ marginTop: 20 }}>
            <div style={{ color: colors.accent, fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>📣 Social Media</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <SocialChip platform="instagram" exists={data.social?.instagram?.exists} value={data.social?.instagram?.followers} />
              <SocialChip platform="twitter" exists={data.social?.twitter?.exists} value={data.social?.twitter?.followers} />
              <SocialChip platform="youtube" exists={data.social?.youtube?.exists} value={data.social?.youtube?.subscribers} />
              <SocialChip platform="linkedin" exists={data.social?.linkedin?.exists} value={`${data.social?.linkedin?.employees || "?"} employees · ${data.social?.linkedin?.growth || "?"}`} />
            </div>
          </div>

          {/* Founders */}
          {data.founders?.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ color: colors.accent, fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>👥 Founders</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {data.founders.map((f, i) => (
                  <div key={i} style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "10px 14px", fontSize: 12, minWidth: 180 }}>
                    <div style={{ fontWeight: 700, color: colors.text }}>{f.name}</div>
                    <div style={{ color: colors.muted, marginTop: 2 }}>{f.education}</div>
                    <div style={{ color: colors.muted, marginTop: 2 }}>{f.background}</div>
                    {f.linkedin && f.linkedin !== "Not found" && (
                      <a href={f.linkedin} target="_blank" rel="noreferrer" style={{ color: colors.accent, fontSize: 11, marginTop: 4, display: "block" }}>LinkedIn →</a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Press */}
          {data.press?.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ color: colors.accent, fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>📰 Press Coverage</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {data.press.map((p, i) => <Badge key={i} color={colors.muted}>{p}</Badge>)}
              </div>
            </div>
          )}

          {/* SWOT */}
          <div style={{ marginTop: 20 }}>
            <div style={{ color: colors.accent, fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>🔍 SWOT Analysis</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <SWOTBox title="Strengths" items={data.swot?.strengths} icon="✅" bg="#0f2318" border="#4ade80" />
              <SWOTBox title="Weaknesses" items={data.swot?.weaknesses} icon="⚠️" bg="#2a1212" border="#f87171" />
              <SWOTBox title="Opportunities" items={data.swot?.opportunities} icon="🚀" bg="#0f1a2a" border="#60a5fa" />
              <SWOTBox title="Threats" items={data.swot?.threats} icon="🔴" bg="#2a2012" border="#fb923c" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

async function callClaude(messages, tools) {
  const body = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system: SYSTEM_PROMPT,
    messages,
  };
  if (tools) body.tools = tools;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function discoverCompetitors(problem) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      system: COMPETITOR_DISCOVERY_PROMPT,
      messages: [{ role: "user", content: `Problem to solve: ${problem}\n\nFind the top 6 competitors/products solving this problem. Search broadly. Return only valid JSON array.` }],
    }),
  });
  const data = await res.json();
  const textBlocks = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  try {
    const clean = textBlocks.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return [];
  }
}

async function researchCompetitor(problem, competitor) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `Problem space: "${problem}"\n\nResearch this competitor thoroughly: ${competitor.name} (${competitor.website || "find their website"})\n\nSearch for all required data points. Return ONLY valid JSON, no markdown.`
      }],
    }),
  });
  const data = await res.json();
  const textBlocks = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  try {
    const clean = textBlocks.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return { name: competitor.name, description: competitor.description, error: "Could not parse data" };
  }
}

export default function App() {
  const [stage, setStage] = useState("input"); // input | discovering | researching | done
  const [problem, setProblem] = useState("");
  const [competitors, setCompetitors] = useState([]);
  const [results, setResults] = useState([]);
  const [currentStep, setCurrentStep] = useState("");
  const [progress, setProgress] = useState(0);

  async function runAnalysis() {
    if (!problem.trim()) return;
    setStage("discovering");
    setCurrentStep("Searching for competitors across Product Hunt, Y Combinator, Crunchbase...");

    const found = await discoverCompetitors(problem);
    setCompetitors(found);
    setStage("researching");

    const collected = [];
    for (let i = 0; i < found.length; i++) {
      const c = found[i];
      setCurrentStep(`Researching ${c.name} — traffic, funding, apps, social media, founders...`);
      setProgress(Math.round(((i + 0.5) / found.length) * 100));
      const data = await researchCompetitor(problem, c);
      collected.push(data);
      setResults([...collected]);
    }

    setProgress(100);
    setStage("done");
  }

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, color: colors.text, fontFamily: "'SF Pro Display', -apple-system, sans-serif", padding: "0 0 60px" }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${colors.surface} 0%, #1a1030 100%)`, borderBottom: `1px solid ${colors.border}`, padding: "28px 32px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: colors.accentDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🔬</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: -0.5 }}>Competitive Intelligence</div>
              <div style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>For Product Managers · Powered by real-time web research</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        {/* Input Stage */}
        {(stage === "input" || stage === "discovering" || stage === "researching") && (
          <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 28, marginBottom: 28 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>What problem are you solving?</div>
            <div style={{ color: colors.muted, fontSize: 13, marginBottom: 18 }}>
              Describe the core problem your product addresses in 1–2 sentences. Be specific — this drives how competitors are found.
            </div>
            <textarea
              value={problem}
              onChange={e => setProblem(e.target.value)}
              disabled={stage !== "input"}
              placeholder="e.g. Freelancers struggle to send professional invoices and track payments without expensive accounting software..."
              style={{
                width: "100%", minHeight: 90, background: colors.surface, border: `1px solid ${colors.border}`,
                borderRadius: 10, color: colors.text, fontSize: 14, padding: 14, resize: "vertical",
                outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                opacity: stage !== "input" ? 0.6 : 1,
              }}
            />
            {stage === "input" && (
              <button
                onClick={runAnalysis}
                disabled={!problem.trim()}
                style={{
                  marginTop: 14, background: problem.trim() ? colors.accent : colors.accentDim,
                  color: "#fff", border: "none", borderRadius: 10, padding: "12px 28px",
                  fontWeight: 700, fontSize: 14, cursor: problem.trim() ? "pointer" : "not-allowed",
                  transition: "all 0.2s",
                }}
              >
                🚀 Run Competitive Analysis
              </button>
            )}

            {/* Progress */}
            {(stage === "discovering" || stage === "researching") && (
              <div style={{ marginTop: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ color: colors.muted, fontSize: 13 }}>{currentStep}</span>
                  <span style={{ color: colors.accent, fontSize: 13, fontWeight: 600 }}>{progress}%</span>
                </div>
                <div style={{ height: 6, background: colors.surface, borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${progress}%`, background: `linear-gradient(90deg, ${colors.accent}, ${colors.gold})`, borderRadius: 99, transition: "width 0.5s ease" }} />
                </div>
                {stage === "discovering" && (
                  <div style={{ color: colors.muted, fontSize: 12, marginTop: 10 }}>Searching Product Hunt, Y Combinator, Crunchbase, Google...</div>
                )}
                {stage === "researching" && competitors.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ color: colors.muted, fontSize: 12, marginBottom: 8 }}>Analyzing {competitors.length} competitors:</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {competitors.map((c, i) => (
                        <Badge key={i} color={i < results.length ? colors.green : colors.muted}>
                          {i < results.length ? "✓ " : ""}{c.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Partial / done results */}
        {results.length > 0 && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 20 }}>
                  {stage === "done" ? "✅ Analysis Complete" : `⏳ Analyzing... (${results.length}/${competitors.length})`}
                </div>
                <div style={{ color: colors.muted, fontSize: 13, marginTop: 3 }}>Click any company to expand full details</div>
              </div>
              {stage === "done" && (
                <button
                  onClick={() => { setStage("input"); setResults([]); setCompetitors([]); setProblem(""); setProgress(0); }}
                  style={{ background: "transparent", border: `1px solid ${colors.border}`, color: colors.muted, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13 }}
                >
                  ↩ New Analysis
                </button>
              )}
            </div>
            {results.map((r, i) => <CompetitorCard key={i} data={r} />)}
          </div>
        )}

        {stage === "input" && results.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 0", color: colors.muted }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔭</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: colors.text }}>Deep competitive research, automated</div>
            <div style={{ fontSize: 13, marginTop: 8, maxWidth: 420, margin: "8px auto 0" }}>
              Describe your product problem above. Claude will discover competitors and research traffic, funding, apps, social presence, founders, press coverage, and build a SWOT for each — using live web data.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
