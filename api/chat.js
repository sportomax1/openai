export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    const { message } = await req.json();
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

    // The order of models to try (Newest to Oldest stable)
    const models = [
      'gemini-3.1-flash-lite-preview', 
      'gemini-3-flash-preview', 
      'gemini-2.0-flash',
      'gemini-1.5-flash'
    ];

    let lastError = "";

    for (const model of models) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: message }] }]
          })
        });

        const data = await response.json();

        if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
          return new Response(JSON.stringify({ 
            reply: data.candidates[0].content.parts[0].text,
            model_used: model 
          }), { headers: { 'Content-Type': 'application/json' } });
        } else {
          lastError = data.error?.message || "Model not supported";
          console.log(`Model ${model} failed: ${lastError}`);
          continue; // Try the next model
        }
      } catch (e) {
        continue;
      }
    }

    return new Response(JSON.stringify({ reply: `All models failed. Last error: ${lastError}` }), { status: 500 });

  } catch (err) {
    return new Response(JSON.stringify({ reply: "Request error. Check input format." }), { status: 500 });
  }
}
