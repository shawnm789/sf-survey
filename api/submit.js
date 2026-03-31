// api/submit.js — Vercel serverless function
// Proxies survey responses to your Notion database

const NOTION_DB_ID = '8c09b844448a4fae9f46b0c280929215';
function sel(val) {
  return val ? { select: { name: String(val) } } : null;
}

function msel(arr) {
  if (!arr || !Array.isArray(arr) || arr.length === 0) return null;
  return { multi_select: arr.map(function(n) { return { name: String(n) }; }) };
}

function rt(val) {
  return val ? { rich_text: [{ text: { content: String(val) } }] } : null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.NOTION_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'NOTION_TOKEN environment variable is not set' });
  }

  // Parse body — Vercel auto-parses JSON but handle both cases
  let d = req.body;
  if (typeof d === 'string') {
    try { d = JSON.parse(d); } catch(e) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }
  if (!d || typeof d !== 'object') {
    return res.status(400).json({ error: 'Missing request body' });
  }

  // Build Notion properties — values are already human-readable labels
  // e.g. "Under 1 year", "Coffee pop-up", ["Mutual friends", "Work / coworkers"]
  var props = {};

  props['Name'] = { title: [{ text: { content: d.name || 'Anonymous' } }] };

  if (d.email)                   props['Email']                  = { email: d.email };
  if (d.neighborhood)            props['Neighborhood']           = rt(d.neighborhood);
  if (d.tenure_in_sf)            props['Tenure in SF']           = sel(d.tenure_in_sf);
  if (d.current_situation)       props['Current Situation']      = sel(d.current_situation);
  if (d.how_meet_people && d.how_meet_people.length)
                                 props['How They Meet People']   = msel(d.how_meet_people);
  if (d.ease_vs_other_cities)    props['Ease vs Other Cities']   = sel(d.ease_vs_other_cities);
  if (d.friction_points && d.friction_points.length)
                                 props['Friction Points']        = msel(d.friction_points);
  if (d.preferred_formats && d.preferred_formats.length)
                                 props['Preferred Formats']      = msel(d.preferred_formats);
  if (d.popup_likelihood)        props['Pop-up Likelihood']      = { number: Number(d.popup_likelihood) };
  if (d.preferred_timing)        props['Preferred Timing']       = sel(d.preferred_timing);
  if (d.apps_used && d.apps_used.length)
                                 props['Apps Used']              = msel(d.apps_used);
  if (d.check_frequency)         props['Check Frequency']        = sel(d.check_frequency);
  if (d.app_purpose && d.app_purpose.length)
                                 props['App Purpose']            = msel(d.app_purpose);
  if (d.linkedin_frequency)      props['LinkedIn Frequency']     = sel(d.linkedin_frequency);
  if (d.linkedin_frustrations && d.linkedin_frustrations.length)
                                 props['LinkedIn Frustrations']  = msel(d.linkedin_frustrations);
  if (d.linkedin_after_connect)  props['After Connecting']       = sel(d.linkedin_after_connect);
  if (d.linkedin_led_to_irl)     props['LinkedIn Led to IRL']    = sel(d.linkedin_led_to_irl);
  if (d.stay_in_touch_via && d.stay_in_touch_via.length)
                                 props['Stay in Touch Via']      = msel(d.stay_in_touch_via);

  try {
    var response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        parent: { database_id: NOTION_DB_ID },
        properties: props,
      }),
    });

    var json = await response.json();

    if (!response.ok) {
      console.error('Notion API error:', JSON.stringify(json));
      return res.status(500).json({
        error: json.message || 'Notion API returned an error',
        code: json.code,
      });
    }

    return res.status(200).json({ success: true, id: json.id });

  } catch (err) {
    console.error('Fetch error:', err);
    return res.status(500).json({ error: err.message || 'Network error reaching Notion' });
  }
};