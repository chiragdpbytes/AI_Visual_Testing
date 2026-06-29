import { PresetCase, Issue } from "./types";

// Helper to make mock mockup SVGs with distinct styles (Figma Perfect vs Implementations)
export const presetDesignHero = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" style="background:%230F172A; font-family:'Inter', sans-serif;">
  <!-- Figma Grid & Margins -->
  <line x1="80" y1="0" x2="80" y2="600" stroke="%2338BDF8" stroke-dasharray="4 4" stroke-opacity="0.3"/>
  <line x1="720" y1="0" x2="720" y2="600" stroke="%2338BDF8" stroke-dasharray="4 4" stroke-opacity="0.3"/>
  
  <!-- Navigation Header -->
  <rect x="80" y="24" width="640" height="64" rx="12" fill="%231E293B"/>
  <circle cx="120" cy="56" r="16" fill="%236366F1"/>
  <text x="146" y="62" fill="%23FFFFFF" font-size="18" font-weight="700" letter-spacing="-0.025em">Veloce QA</text>
  
  <text x="400" y="60" fill="%2394A3B8" font-size="14" font-weight="500">Features</text>
  <text x="480" y="60" fill="%2394A3B8" font-size="14" font-weight="500">Pricing</text>
  <text x="560" y="60" fill="%2394A3B8" font-size="14" font-weight="500">Docs</text>
  <rect x="620" y="40" width="80" height="32" rx="6" fill="%236366F1"/>
  <text x="635" y="60" fill="%23FFFFFF" font-size="12" font-weight="600">Sign Up</text>
  
  <!-- Hero Section Layout -->
  <!-- Centered Headline with generous margin (y=160 to 280) -->
  <text x="400" y="200" fill="%23FFFFFF" font-size="44" font-weight="800" text-anchor="middle" letter-spacing="-0.03em">Automated Frontend QA</text>
  <text x="400" y="246" fill="%236366F1" font-size="44" font-weight="800" text-anchor="middle" letter-spacing="-0.03em">Powered by Spatial AI</text>
  <text x="400" y="290" fill="%2394A3B8" font-size="16" font-weight="400" text-anchor="middle">Compare your Figma frames to actual developer builds in real-time.</text>
  
  <!-- Balanced CTA Button (y=330) -->
  <rect x="310" y="330" width="180" height="48" rx="8" fill="%236366F1"/>
  <text x="400" y="359" fill="%23FFFFFF" font-size="15" font-weight="600" text-anchor="middle">Get Started For Free</text>
  
  <!-- Responsive Dashboard Cards -->
  <g transform="translate(80, 420)">
    <!-- Card 1 -->
    <rect x="0" y="0" width="190" height="120" rx="12" fill="%231E293B" stroke="%23334155" stroke-width="1"/>
    <text x="20" y="35" fill="%2394A3B8" font-size="12" font-weight="600">ACCURACY RATING</text>
    <text x="20" y="75" fill="%23FFFFFF" font-size="32" font-weight="800">99.8%</text>
    <rect x="20" y="90" width="150" height="4" rx="2" fill="%23334155"/>
    <rect x="20" y="90" width="140" height="4" rx="2" fill="%2310B981"/>
    
    <!-- Card 2 -->
    <rect x="225" y="0" width="190" height="120" rx="12" fill="%231E293B" stroke="%23334155" stroke-width="1"/>
    <text x="245" y="35" fill="%2394A3B8" font-size="12" font-weight="600">AUDITS COMPLETED</text>
    <text x="245" y="75" fill="%23FFFFFF" font-size="32" font-weight="800">12,480</text>
    <text x="245" y="95" fill="%2310B981" font-size="11" font-weight="500">+14% this week</text>
    
    <!-- Card 3 -->
    <rect x="450" y="0" width="190" height="120" rx="12" fill="%231E293B" stroke="%23334155" stroke-width="1"/>
    <text x="470" y="35" fill="%2394A3B8" font-size="12" font-weight="600">AVG QA CYCLES</text>
    <text x="470" y="75" fill="%23FFFFFF" font-size="32" font-weight="800">1.2 hrs</text>
    <text x="470" y="95" fill="%23EF4444" font-size="11" font-weight="500">-32% time saved</text>
  </g>
</svg>`;

export const presetSiteHero = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" style="background:%23111827; font-family:'Inter', sans-serif;">
  <!-- Navigation Header Broken Spacing & Alignment (y=40 instad of 24) -->
  <rect x="80" y="40" width="640" height="52" rx="0" fill="%231F2937"/> <!-- Issue: Border-radius missing (is square) and incorrect height (52 instead of 64) -->
  <circle cx="110" cy="66" r="14" fill="%234F46E5"/> <!-- Issue: Secondary branding color is off-color indigo and misaligned left -->
  <text x="134" y="72" fill="%23F3F4F6" font-size="17" font-weight="600">Veloce QA</text>
  
  <text x="360" y="71" fill="%239CA3AF" font-size="14" font-weight="500">Features</text> <!-- Issue: Links shifted left -->
  <text x="440" y="71" fill="%239CA3AF" font-size="14" font-weight="500">Pricing</text>
  <text x="520" y="71" fill="%239CA3AF" font-size="14" font-weight="500">Docs</text>
  <rect x="640" y="50" width="70" height="30" rx="3" fill="%234F46E5"/> <!-- Issue: Button size and rounded corners mismatch -->
  <text x="652" y="68" fill="%23FFFFFF" font-size="11" font-weight="500">Sign Up</text>
  
  <!-- Hero Section Mismatch -->
  <!-- Issue: Title is too low, spacing feels packed, layout text wrap is ugly -->
  <text x="400" y="210" fill="%23FFFFFF" font-size="38" font-weight="750" text-anchor="middle" letter-spacing="0">Automated Frontend QA</text> <!-- Issue: Title font size is 38px instead of 44px, weight is slightly less -->
  <text x="400" y="250" fill="%23EF4444" font-size="38" font-weight="750" text-anchor="middle" letter-spacing="0">Powered by Spatial AI</text> <!-- Issue: Wrong color! Red instead of Indigo -->
  <text x="400" y="295" fill="%236B7280" font-size="15" font-weight="400" text-anchor="middle">Compare your figma frames to actual developer builds in real-time.</text> <!-- Issue: Description is lower-case 'figma' and color has poor contrast -->
  
  <!-- CTA Button Spacing Mismatch -->
  <rect x="320" y="325" width="160" height="40" rx="3" fill="%234F46E5"/> <!-- Issue: CTA is 160x40 rx=3 instead of 180x48 rx=8. Feels visually compressed. -->
  <text x="400" y="349" fill="%23FFFFFF" font-size="13" font-weight="500" text-anchor="middle">Get Started For Free</text>
  
  <!-- Broken Dashboard Cards Grid Layout (shifted columns and missing height margins) -->
  <g transform="translate(80, 410)"> <!-- Issue: Grid shifted up too close to the CTA button -->
    <!-- Card 1 -->
    <rect x="0" y="0" width="180" height="135" rx="6" fill="%231F2937" stroke="%23374151" stroke-width="1"/> <!-- Issue: Card size width 180 height 135 instead of 190x120, rx=6 instead of 12 -->
    <text x="15" y="30" fill="%236B7280" font-size="11" font-weight="600">ACCURACY RATING</text>
    <text x="15" y="70" fill="%23FFFFFF" font-size="28" font-weight="800">99.8%</text> <!-- Issue: Smaller text size -->
    <rect x="15" y="90" width="150" height="4" rx="2" fill="%23374151"/>
    <rect x="15" y="90" width="140" height="4" rx="2" fill="%2310B981"/>
    
    <!-- Card 2 -->
    <!-- Issue: Spacing gap is 200 instead of 225, causing cards to overlap or layout gap to look inconsistent -->
    <rect x="210" y="0" width="180" height="135" rx="6" fill="%231F2937" stroke="%23374151" stroke-width="1"/>
    <text x="225" y="30" fill="%236B7280" font-size="11" font-weight="600">AUDITS COMPLETED</text>
    <text x="225" y="70" fill="%23FFFFFF" font-size="28" font-weight="800">12,480</text>
    <text x="225" y="95" fill="%2310B981" font-size="10" font-weight="500">+14% this week</text>
    
    <!-- Card 3 -->
    <rect x="420" y="0" width="220" height="135" rx="6" fill="%231F2937" stroke="%23374151" stroke-width="1"/> <!-- Issue: Card width is stretched (220) to fill leftover space, breaking grid symmetry -->
    <text x="440" y="30" fill="%236B7280" font-size="11" font-weight="600">AVG QA CYCLES</text>
    <text x="440" y="70" fill="%23FFFFFF" font-size="28" font-weight="800">1.2 hrs</text>
    <text x="440" y="95" fill="%23EF4444" font-size="10" font-weight="500">-32% time saved</text>
  </g>
</svg>`;

// Preset 2: SaaS Pricing Cards & Borders
export const presetDesignPricing = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" style="background:%23F8FAFC; font-family:'Inter', sans-serif;">
  <!-- Background dot pattern -->
  <circle cx="100" cy="100" r="1.5" fill="%23CBD5E1"/>
  <circle cx="200" cy="100" r="1.5" fill="%23CBD5E1"/>
  <circle cx="300" cy="100" r="1.5" fill="%23CBD5E1"/>
  <circle cx="400" cy="100" r="1.5" fill="%23CBD5E1"/>
  <circle cx="500" cy="100" r="1.5" fill="%23CBD5E1"/>
  <circle cx="600" cy="100" r="1.5" fill="%23CBD5E1"/>
  <circle cx="700" cy="100" r="1.5" fill="%23CBD5E1"/>
  
  <text x="400" y="70" fill="%23475569" font-size="13" font-weight="600" text-anchor="middle" letter-spacing="0.1em">PRICING PLANS</text>
  <text x="400" y="110" fill="%230F172A" font-size="36" font-weight="800" text-anchor="middle" letter-spacing="-0.025em">Flexible pricing for any team scale</text>
  <text x="400" y="145" fill="%2364748B" font-size="15" font-weight="400" text-anchor="middle">Zero contracts. Cancel at any time you want.</text>
  
  <!-- Symmetric 3-Card Grid (y=190) -->
  <!-- Card 1 (Hobby) -->
  <g transform="translate(80, 190)">
    <rect x="0" y="0" width="195" height="340" rx="16" fill="%23FFFFFF" stroke="%23E2E8F0" stroke-width="1.5" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.02))"/>
    <text x="24" y="40" fill="%236366F1" font-size="12" font-weight="700" letter-spacing="0.05em">HOBBY</text>
    <text x="24" y="80" fill="%230F172A" font-size="36" font-weight="800">$19<tspan font-size="14" font-weight="500" fill="%2364748B">/mo</tspan></text>
    <text x="24" y="110" fill="%2364748B" font-size="12" font-weight="400">Essential spatial visual audits</text>
    
    <line x1="24" y1="135" x2="171" y2="135" stroke="%23F1F5F9" stroke-width="1.5"/>
    <circle cx="32" cy="165" r="4" fill="%236366F1"/>
    <text x="44" y="169" fill="%23334155" font-size="12" font-weight="500">1 active website project</text>
    
    <circle cx="32" cy="195" r="4" fill="%236366F1"/>
    <text x="44" y="199" fill="%23334155" font-size="12" font-weight="500">50 runs / month</text>
    
    <circle cx="32" cy="225" r="4" fill="%236366F1"/>
    <text x="44" y="229" fill="%23334155" font-size="12" font-weight="500">Dual viewport testing</text>
    
    <rect x="24" y="270" width="147" height="42" rx="8" fill="%23F1F5F9"/>
    <text x="97" y="296" fill="%23334155" font-size="13" font-weight="600" text-anchor="middle">Select Plan</text>
  </g>

  <!-- Card 2 (Pro - Featured with Accent) -->
  <g transform="translate(302, 180)"> <!-- Shifted up 10px to look standout, rx=16, custom border -->
    <rect x="0" y="0" width="195" height="360" rx="16" fill="%23FFFFFF" stroke="%236366F1" stroke-width="2.5" />
    <!-- Standout Popular Badge -->
    <rect x="57" y="-12" width="80" height="24" rx="12" fill="%236366F1"/>
    <text x="97" y="4" fill="%23FFFFFF" font-size="9" font-weight="700" text-anchor="middle">MOST POPULAR</text>
    
    <text x="24" y="50" fill="%230F172A" font-size="12" font-weight="700" letter-spacing="0.05em">PROFESSIONAL</text>
    <text x="24" y="90" fill="%230F172A" font-size="36" font-weight="800">$49<tspan font-size="14" font-weight="500" fill="%2364748B">/mo</tspan></text>
    <text x="24" y="120" fill="%2364748B" font-size="12" font-weight="400">For active builders &amp; agencies</text>
    
    <line x1="24" y1="145" x2="171" y2="145" stroke="%23F1F5F9" stroke-width="1.5"/>
    <circle cx="32" cy="175" r="4" fill="%236366F1"/>
    <text x="44" y="179" fill="%23334155" font-size="12" font-weight="500">Unlimited projects</text>
    
    <circle cx="32" cy="205" r="4" fill="%236366F1"/>
    <text x="44" y="209" fill="%23334155" font-size="12" font-weight="500">500 runs / month</text>
    
    <circle cx="32" cy="235" r="4" fill="%236366F1"/>
    <text x="44" y="239" fill="%23334155" font-size="12" font-weight="500">All responsive presets</text>
    
    <circle cx="32" cy="265" r="4" fill="%236366F1"/>
    <text x="44" y="269" fill="%23334155" font-size="12" font-weight="500">CSS suggestion engine</text>
    
    <rect x="24" y="295" width="147" height="42" rx="8" fill="%236366F1"/>
    <text x="97" y="321" fill="%23FFFFFF" font-size="13" font-weight="600" text-anchor="middle">Start 14-day Trial</text>
  </g>

  <!-- Card 3 (Enterprise) -->
  <g transform="translate(525, 190)">
    <rect x="0" y="0" width="195" height="340" rx="16" fill="%23FFFFFF" stroke="%23E2E8F0" stroke-width="1.5" />
    <text x="24" y="40" fill="%23475569" font-size="12" font-weight="700" letter-spacing="0.05em">ENTERPRISE</text>
    <text x="24" y="80" fill="%230F172A" font-size="36" font-weight="800">Custom</text>
    <text x="24" y="110" fill="%2364748B" font-size="12" font-weight="400">Scale automation and pipelines</text>
    
    <line x1="24" y1="135" x2="171" y2="135" stroke="%23F1F5F9" stroke-width="1.5"/>
    <circle cx="32" cy="165" r="4" fill="%236366F1"/>
    <text x="44" y="169" fill="%23334155" font-size="12" font-weight="500">SAML SSO &amp; Custom integration</text>
    
    <circle cx="32" cy="195" r="4" fill="%236366F1"/>
    <text x="44" y="199" fill="%23334155" font-size="12" font-weight="500">Dedicated processing servers</text>
    
    <circle cx="32" cy="225" r="4" fill="%236366F1"/>
    <text x="44" y="229" fill="%23334155" font-size="12" font-weight="500">Personal SLA support</text>
    
    <rect x="24" y="270" width="147" height="42" rx="8" fill="%23F1F5F9"/>
    <text x="97" y="296" fill="%23334155" font-size="13" font-weight="600" text-anchor="middle">Contact Sales</text>
  </g>
</svg>`;

export const presetSitePricing = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" style="background:%23FFFFFF; font-family:'Inter', sans-serif;">
  <!-- PRICING SECTION - WEBSITE BUILD (Bugs: No dots, alignment slightly off, Card heights are unequal, Badge misaligned, Contrast color bug) -->
  <text x="400" y="70" fill="%23475569" font-size="13" font-weight="600" text-anchor="middle" letter-spacing="0.1em">PRICING PLANS</text>
  <text x="400" y="115" fill="%230F172A" font-size="32" font-weight="700" text-anchor="middle" letter-spacing="0">Flexible pricing for any team scale</text> <!-- Issue: Headline font-size too small (32 vs 36) and lacks tracking -->
  <text x="400" y="145" fill="%2394A3B8" font-size="15" font-weight="400" text-anchor="middle">Zero contracts. Cancel at any time you want.</text> <!-- Issue: Poor contrast of color #94A3B8 vs design #64748B -->
  
  <!-- Symmetric Grid broken (Unequal horizontal gaps, spacing shifted left) -->
  <!-- Card 1 (Hobby) -->
  <g transform="translate(60, 190)"> <!-- Issue: Left margin is 60 instead of 80, shifting cards off-center -->
    <rect x="0" y="0" width="205" height="340" rx="4" fill="%23FFFFFF" stroke="%23E2E8F0" stroke-width="1.5" /> <!-- Issue: Border radius rx=4 instead of rx=16, width too wide (205 vs 195) -->
    <text x="24" y="40" fill="%234F46E5" font-size="12" font-weight="700" letter-spacing="0">HOBBY</text> <!-- Issue: No tracking on subtitle -->
    <text x="24" y="80" fill="%230F172A" font-size="36" font-weight="850">$19<tspan font-size="14" font-weight="500" fill="%2364748B">/mo</tspan></text>
    <text x="24" y="110" fill="%2364748B" font-size="12" font-weight="400">Essential spatial visual audits</text>
    
    <line x1="24" y1="135" x2="171" y2="135" stroke="%23F1F5F9" stroke-width="1.5"/>
    <circle cx="32" cy="165" r="3" fill="%234F46E5"/>
    <text x="44" y="169" fill="%23334155" font-size="11" font-weight="500">1 active website project</text>
    
    <circle cx="32" cy="195" r="3" fill="%234F46E5"/>
    <text x="44" y="199" fill="%23334155" font-size="11" font-weight="500">50 runs / month</text>
    
    <circle cx="32" cy="225" r="3" fill="%234F46E5"/>
    <text x="44" y="229" fill="%23334155" font-size="11" font-weight="500">Dual viewport testing</text>
    
    <rect x="24" y="270" width="157" height="42" rx="4" fill="%23F1F5F9"/>
    <text x="102" y="296" fill="%23334155" font-size="13" font-weight="600" text-anchor="middle">Select Plan</text> <!-- Issue: Button centering is off due to wider card -->
  </g>

  <!-- Card 2 (Pro - Featured with Accent) -->
  <g transform="translate(290, 190)"> <!-- Issue: Not shifted up 10px (y=190 instead of 180), so heights align flatly. Breaking custom floating layout -->
    <rect x="0" y="0" width="195" height="340" rx="4" fill="%23FFFFFF" stroke="%234F46E5" stroke-width="1.5" /> <!-- Issue: rx=4 instead of rx=16, stroke too thin (1.5 vs 2.5), lacks prominence -->
    
    <!-- Standout Popular Badge Badly Placed -->
    <rect x="42" y="-12" width="110" height="24" rx="4" fill="%2310B981" /> <!-- Issue: Placed off-center, colored Green instead of Indigo, rx=4 instead of 12 -->
    <text x="97" y="4" fill="%23FFFFFF" font-size="9" font-weight="700" text-anchor="middle">MOST POPULAR</text>
    
    <text x="24" y="50" fill="%230F172A" font-size="12" font-weight="700" letter-spacing="0">PROFESSIONAL</text>
    <text x="24" y="90" fill="%230F172A" font-size="36" font-weight="800">$49<tspan font-size="14" font-weight="500" fill="%2364748B">/mo</tspan></text>
    <text x="24" y="120" fill="%2364748B" font-size="10" font-weight="400">For active builders &amp; agencies</text>
    
    <line x1="24" y1="145" x2="171" y2="145" stroke="%23F1F5F9" stroke-width="1.5"/>
    <circle cx="32" cy="175" r="3" fill="%234F46E5"/>
    <text x="44" y="179" fill="%23334155" font-size="11" font-weight="500">Unlimited projects</text>
    
    <circle cx="32" cy="205" r="3" fill="%234F46E5"/>
    <text x="44" y="209" fill="%23334155" font-size="11" font-weight="500">500 runs / month</text>
    
    <circle cx="32" cy="235" r="3" fill="%234F46E5"/>
    <text x="44" y="239" fill="%23334155" font-size="11" font-weight="500">All responsive presets</text>
    
    <circle cx="32" cy="261" r="3" fill="%234F46E5"/>
    <text x="44" y="265" fill="%23334155" font-size="11" font-weight="500">CSS suggestion engine</text> <!-- Issue: Text sizing and vertical padding are overly compact -->
    
    <rect x="24" y="282" width="147" height="42" rx="4" fill="%234F46E5"/>
    <text x="97" y="308" fill="%23FFFFFF" font-size="13" font-weight="600" text-anchor="middle">Start Trial</text> <!-- Issue: Font size and positioning on button cuts off early -->
  </g>

  <!-- Card 3 (Enterprise) -->
  <g transform="translate(510, 190)"> <!-- Issue: Horizontal gaps are uneven (Card1_gap=230, Card2_gap=220) -->
    <rect x="0" y="0" width="215" height="340" rx="4" fill="%23FFFFFF" stroke="%23E2E8F0" stroke-width="1.5" /> <!-- Issue: rx=4, width shifted (215) -->
    <text x="24" y="40" fill="%23475569" font-size="12" font-weight="700">ENTERPRISE</text>
    <text x="24" y="80" fill="%230F172A" font-size="36" font-weight="800">Custom</text>
    <text x="24" y="110" fill="%2364748B" font-size="12" font-weight="400">Scale automation and pipelines</text>
    
    <line x1="24" y1="135" x2="171" y2="135" stroke="%23F1F5F9" stroke-width="1.5"/>
    <circle cx="32" cy="165" r="3" fill="%234F46E5"/>
    <text x="44" y="169" fill="%23334155" font-size="11" font-weight="500">SAML SSO &amp; Custom integration</text>
    
    <circle cx="32" cy="195" r="3" fill="%234F46E5"/>
    <text x="44" y="199" fill="%23334155" font-size="11" font-weight="500">Dedicated processing servers</text>
    
    <circle cx="32" cy="225" r="3" fill="%234F46E5"/>
    <text x="44" y="229" fill="%23334155" font-size="11" font-weight="500">Personal SLA support</text>
    
    <rect x="24" y="270" width="167" height="42" rx="4" fill="%23F1F5F9"/>
    <text x="107" y="296" fill="%23334155" font-size="13" font-weight="600" text-anchor="middle">Contact Sales</text>
  </g>
</svg>`;

export const presetCatalog = {
  id: "preset-hero",
  name: "SaaS Landing Page - Hero",
  category: "Layout & Spacing Grid",
  description: "SaaS landing section containing a navigation bar, a centered hero title and subtitles, primary CTA button, and balanced performance analytics metric cards on a dark canvas. Compare spacing proportions, boundary grid alignments, and token accuracy.",
  designImage: presetDesignHero,
  siteImage: presetSiteHero,
  score: 86,
  issues: [
    {
      id: "issue-1",
      severity: "minor",
      category: "layout",
      title: "Header Border Radius Mismatch",
      description: "Figma design utilizes a refined `rx=12` border-radius layout, whereas the actual live implementation compiles a straight square header box. This degrades clean aesthetics.",
      xPercent: 50,
      yPercent: 8,
      cssSuggestion: "header-nav {\n  border-radius: 12px;\n  height: 64px;\n}",
      estimatedImpact: "Consistency & edge alignment refinement."
    },
    {
      id: "issue-2",
      severity: "minor",
      category: "color",
      title: "Branding Contrast & Hex Token Mismatch",
      description: "Visual contrast brand logo uses primary Purple `#6366F1` in design frame, but live development renders as a lower-contrast dark purple `#4F46E5` which doesn't match design guidelines.",
      xPercent: 12,
      yPercent: 9,
      cssSuggestion: ".logo-accent {\n  background-color: #6366F1;\n}",
      estimatedImpact: "Brand identity enforcement."
    },
    {
      id: "issue-3",
      severity: "major",
      category: "layout",
      title: "Sub-hero Text Color is Stressed",
      description: "Second line of the hero subtitle utilizes pure brand purple `#6366F1` in design but utilizes Warning red `#EF4444` in the developed layout, creating an unintended urgent vibe.",
      xPercent: 50,
      yPercent: 41,
      cssSuggestion: ".hero-sub-text {\n  color: #6366F1;\n  font-size: 44px;\n}",
      estimatedImpact: "Aesthetic focus is disrupted on initial page load."
    },
    {
      id: "issue-4",
      severity: "major",
      category: "layout",
      title: "CTA Button Sizing Compressed",
      description: "The primary 'Get Started' CTA has compressed spatial breathing room. The design defines `180px` wide and `48px` high with a standard `8px` rounded borders. Actual live compiles as `160px` by `40px` and sharp `3px` corners.",
      xPercent: 50,
      yPercent: 58,
      cssSuggestion: ".cta-button {\n  width: 180px;\n  height: 48px;\n  border-radius: 8px;\n  padding: 12px 24px;\n}",
      estimatedImpact: "CTA prominence and finger touch accessibility on mobile devices."
    },
    {
      id: "issue-5",
      severity: "critical",
      category: "layout",
      title: "Metric Cards Overlap Grid Conflict",
      description: "Due to uneven column sizing gaps (Card 3 gets stretched width to fill content), the grid is asymmetrical and shifted upwards 10px. Spacing offsets break visual coherence.",
      xPercent: 50,
      yPercent: 82,
      cssSuggestion: ".metric-grid {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  gap: 24px;\n  margin-top: 40px;\n}",
      estimatedImpact: "Layout collapses on desktop-minimum monitors (1024px-1200px), pushing the rightmost card off-screen."
    }
  ] as Issue[]
};

export const presetPricing = {
  id: "preset-pricing",
  name: "SaaS Application - Pricing Suite",
  category: "Typography & Symmetrical Tokens",
  description: "A gorgeous modern light-theme SaaS pricing module detailing 3 balanced plans. This audit detects extreme card border discrepancies, bad floating tier contrast, and misaligned prominent visual labels.",
  designImage: presetDesignPricing,
  siteImage: presetSitePricing,
  score: 74,
  issues: [
    {
      id: "pricing-1",
      severity: "major",
      category: "layout",
      title: "Card Edge Curvature Degradation",
      description: "Design specs detailed luxurious smooth `rounded-2xl` (16px) corners. Actual website implementation compiles dry rigid inline borders at `4px`. This disrupts the soft friendly startup aesthetics.",
      xPercent: 20,
      yPercent: 45,
      cssSuggestion: ".pricing-card {\n  border-radius: 16px;\n  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05);\n}",
      estimatedImpact: "Brand feeling and aesthetic warmth in enterprise visual systems."
    },
    {
      id: "pricing-2",
      severity: "critical",
      category: "layout",
      title: "STANDOUT Featured Plan Floating Height Defect",
      description: "The 'Professional' card is designed to float 10px higher with an organic Indigo accent. In staging/production, it sits completely flat at `y=190` alongside other columns, missing its critical interactive hierarchy prominence.",
      xPercent: 50,
      yPercent: 30,
      cssSuggestion: ".pricing-card.featured {\n  transform: translateY(-10px);\n  border: 2.5px solid #6366F1;\n}",
      estimatedImpact: "Featured plan selection rates are likely reduced because visual focus is lost."
    },
    {
      id: "pricing-3",
      severity: "major",
      category: "color",
      title: "Standout Popularity Badge Miscoloration",
      description: "The centered stand-out tag uses a green badge `#10B981` instead of the design's elegant indigo brand accent. Bad alignment shifts the badge off-center left.",
      xPercent: 50,
      yPercent: 28,
      cssSuggestion: ".popular-badge {\n  background-color: #6366F1;\n  margin: 0 auto;\n  border-radius: 12px;\n}",
      estimatedImpact: "Conversion rate optimization and visual alignment."
    },
    {
      id: "pricing-4",
      severity: "minor",
      category: "typography",
      title: "Paragraph Contrast Ratio Infraction",
      description: "Sub-title text color is compiled as `#94A3B8` (grey) which triggers a WCAG Contrast failure on pure white backgrounds, failing design's `#64748B` specification.",
      xPercent: 50,
      yPercent: 25,
      cssSuggestion: ".pricing-subtitle {\n  color: #64748B;\n  font-size: 15px;\n}",
      estimatedImpact: "Readability for visually impaired accessibility users."
    }
  ] as Issue[]
};

export const presetCatalogCollection: PresetCase[] = [
  presetCatalog,
  presetPricing
];
