// api/submit.js — Vercel serverless function
// Proxies survey responses to your Notion database

const NOTION_DB_ID = '8c09b844448a4fae9f46b0c280929215';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.NOTION_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'NOTION_TOKEN env var not set' });
  }

  const d = req.body;

  // -----------------------------
  // Helpers (fixed Notion formats)
  // -----------------------------
  const sel = (val) => {
    if (!val) return { select: null };

    return {
      select: {
        name: String(val).trim()
      }
    };
  };

  const ms = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) {
      return { multi_select: [] };
    }

    return {
      multi_select: arr
        .filter(v => v && v !== 'none')
        .map(v => ({
          name: String(v).trim()
        }))
    };
  };

  const rt = (val) => {
    if (!val) return { rich_text: [] };

    return {
      rich_text: [
        {
          text: {
            content: String(val)
          }
        }
      ]
    };
  };

  // -----------------------------
  // Properties mapping (FIXED)
  // -----------------------------
  const properties = {
    'Name': {
      title: [
        {
          text: {
            content: d.name || ''
          }
        }
      ]
    },

    'Email': {
      email: d.email || null
    },

    'Neighborhood': rt(d.neighborhood),

    'Tenure in SF': sel(d.tenure),
    'Current Situation': sel(d.situation),

    'How They Meet People': ms(d.howMeet),
    'Ease vs Other Cities': sel(d.ease),
    'Friction Points': ms(d.friction),
    'Preferred Formats': ms(d.formats),

    'Pop-up Likelihood': {
      number: d.popupLikelihood ?? null
    },

    'Preferred Timing': sel(d.timing),

    'Apps Used': ms(d.appsUsed),
    'Check Frequency': sel(d.checkFreq),
    'App Purpose': ms(d.appPurpose),

    'LinkedIn Frequency': sel(d.linkedinFreq),
    'LinkedIn Frustrations': ms(d.linkedinFrustrations),
    'After Connecting on LinkedIn': sel(d.linkedinAfter),
    'LinkedIn Led to IRL': sel(d.linkedinIRL),

    'Stay in Touch Via': ms(d.stayInTouch),
  };

  try {
    const r = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        parent: {
          database_id: NOTION_DB_ID
        },
        properties
      }),
    });

    if (!r.ok) {
      const err = await r.json();
      console.error('Notion API error:', err);

      return res.status(500).json({
        error: 'Notion rejected the request',
        detail: err
      });
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to reach Notion' });
  