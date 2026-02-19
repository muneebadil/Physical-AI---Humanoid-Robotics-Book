const MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b','gemini-2.5-flash'];

function extractText(data) {
  const c = data?.candidates?.[0];
  const blockReason = c?.finishReason;
  if (blockReason === 'SAFETY' || blockReason === 'RECITATION') {
    throw new Error('Response blocked by safety filters.');
  }
  const text = c?.content?.parts?.map((p) => p?.text).filter(Boolean).join('') ?? '';
  return String(text).trim();
}

export async function generateGeminiReply({ message, history = [], apiKey = null }) {
  const userText = String(message ?? '').trim();
  if (!userText) throw new Error('Message is empty.');

  if (apiKey) {
    const contents = [{ role: 'user', parts: [{ text: userText }] }];
    let lastError;
    for (const model of MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents,
            systemInstruction: { parts: [{ text: 'Answer briefly and concisely.' }] },
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 256,
            },
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const err = data?.error?.message || data?.error || await res.text().catch(() => '') || res.statusText;
          lastError = new Error(`Gemini (${model}): ${err}`);
          continue;
        }
        const out = extractText(data);
        if (out) return out;
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError || new Error('Gemini request failed.');
  }

  // Production-safe path: call your server proxy (keeps API key off the client).
  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: userText,
      history,
      instruction: 'Answer briefly and concisely.',
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Server request failed (${res.status}): ${txt || res.statusText}`);
  }

  const data = await res.json();
  const out = String(data?.text ?? '').trim();
  if (!out) throw new Error('Server returned an empty response.');
  return out;
}

