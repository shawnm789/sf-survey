// api/submit.js — Vercel serverless function
// Proxies survey responses to your Notion database
//
// SETUP (one-time):
//   1. Go to https://www.notion.so/my-integrations → New integration
//   2. Give it a name (e.g. "SF Survey"), copy the token
//   3. Open the SF Social Survey database in Notion → ... → Add connections → select your integration
//   4. In Vercel: Settings → Environment Variables → add NOTION_TOKEN = your token
//   5. Deploy — done.

const NOTION_DB_ID = '8c09b844448a4fae9f46b0c280929215';

// Helper: single select property
function sel(val) {
return val ? { select: { name: val } } : undefined;
}

// Helper: multi select property (accepts array of already-mapped strings)
function msel(arr) {
if (!arr || !arr.length) return undefined;
return { multi_select: arr.map(n => ({ name: n })) };
}

// Helper: rich text property
function rt(val) {
return val ? { rich_text: [{ text: { content: val } }] } : undefined;
}

export default async function handler(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘POST, OPTIONS’);
res.setHeader(‘Access-Control-Allow-Headers’, ‘Content-Type’);
if (req.method === ‘OPTIONS’) return res.status(200).end();
if (req.method !== ‘POST’) return res.status(405).json({ error: ‘Method not allowed’ });

const token = process.env.NOTION_TOKEN;
if (!token) return res.status(500).json({ error: ‘NOTION_TOKEN env var missing’ });

const d = req.body;

// Values arrive pre-mapped from the survey HTML, e.g. “Under 1 year”, “Coffee pop-up”, etc.
const props = {
‘Name’:                 { title: [{ text: { content: d.name || ‘Anonymous’ } }] },
‘Email’:                d.email ? { email: d.email } : undefined,
‘Neighborhood’:         rt(d.neighborhood),
‘Tenure in SF’:         sel(d.tenure_in_sf),
‘Current Situation’:    sel(d.current_situation),
‘How They Meet People’: msel(d.how_meet_people),
‘Ease vs Other Cities’: sel(d.ease_vs_other_cities),
‘Friction Points’:      msel(d.friction_points),
‘Preferred Formats’:    msel(d.preferred_formats),
‘Pop-up Likelihood’:    d.popup_likelihood ? { number: Number(d.popup_likelihood) } : undefined,
‘Preferred Timing’:     sel(d.preferred_timing),
‘Apps Used’:            msel(d.apps_used),
‘Check Frequency’:      sel(d.check_frequency),
‘App Purpose’:          msel(d.app_purpose),
‘LinkedIn Frequency’:   sel(d.linkedin_frequency),
‘LinkedIn Frustrations’:msel(d.linkedin_frustrations),
‘After Connecting’:     sel(d.linkedin_after_connect),
‘LinkedIn Led to IRL’:  sel(d.linkedin_led_to_irl),
‘Stay in Touch Via’:    msel(d.stay_in_touch_via),
};

// Strip undefined values
Object.keys(props).forEach(k => props[k] === undefined && delete props[k]);

const r = await fetch(‘https://api.notion.com/v1/pages’, {
method: ‘POST’,
headers: {
‘Authorization’: `Bearer ${token}`,
‘Content-Type’: ‘application/json’,
‘Notion-Version’: ‘2022-06-28’,
},
body: JSON.stringify({
parent: { database_id: NOTION_DB_ID },
properties: props,
}),
});

const json = await r.json();
if (!r.ok) {
console.error(‘Notion error:’, JSON.stringify(json));
return res.status(500).json({ error: json.message || ‘Notion API error’ });
}

return res.status(200).json({ success: true });
}
