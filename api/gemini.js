function toGeminiContents(history, userMessage) {
  const normalized = Array.isArray(history) ? history : [];
  const contents = normalized
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.text ?? '') }],
    }));

  contents.push({
    role: 'user',
    parts: [{ text: String(userMessage ?? '') }],
  });

  return contents;
}

function extractText(data) {
  const text =
    data?.candidates?.[0]?.content?.parts?.map((p) => p?.text).filter(Boolean).join('') ?? '';
  return String(text).trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Missing GEMINI_API_KEY on server' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const message = String(body?.message ?? '').trim();
    const instruction = String(body?.instruction ?? 'Answer briefly and concisely.').trim();
    const history = body?.history ?? [];

    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instruction }] },
        contents: toGeminiContents(history, message),
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 200,
        },
      }),
    });

    if (!upstream.ok) {
      const txt = await upstream.text().catch(() => '');
      res.status(502).json({
        error: `Upstream Gemini error (${upstream.status})`,
        details: txt || upstream.statusText,
      });
      return;
    }

    const data = await upstream.json();
    const text = extractText(data);
    if (!text) {
      res.status(502).json({ error: 'Gemini returned empty response' });
      return;
    }

    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: 'Server error', details: e instanceof Error ? e.message : String(e) });
  }
}

