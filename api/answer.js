// api/answer.js - Vercel Serverless Function for Gemini API
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { questions, context, mode } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  if (!questions || !Array.isArray(questions)) return res.status(400).json({ error: 'questions array required' });

  try {
    // Build prompt for Gemini
    const prompt = `You are a helpful tutor for Dutch secondary education (learnbeat).
Answer these questions accurately and concisely.

Return ONLY valid JSON in this exact format:
{
  "answers": [
    {"answer": "your answer here", "type": "text"},
    {"answer": "true", "type": "checkbox"}
  ]
}

Questions:
${questions.map((q, i) => `${i+1}. [${q.type || 'text'}] ${q.text}`).join('\n')}`;

    // Call Gemini API (using gemini-1.5-flash - fast & free)
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2000,
            responseMimeType: 'application/json'
          }
        })
      }
    );

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      throw new Error(`Gemini API error: ${geminiRes.status} - ${err}`);
    }

    const geminiData = await geminiRes.json();
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) throw new Error('No response from Gemini');

    // Parse JSON from Gemini response
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Try to extract JSON from markdown code blocks
      const match = text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error('Invalid JSON from Gemini');
    }

    const answers = parsed.answers || parsed;
    if (!Array.isArray(answers)) throw new Error('Expected answers array');

    res.json({ answers });

  } catch (e) {
    console.error('Proxy error:', e);
    res.status(500).json({ error: e.message });
  }
}
