import OpenAI from "openai";

export default async function handler(req, res) {

  try {

    if (req.method !== "POST") {
      return res.status(405).json({ error: "POST only" });
    }

    // Check if API key exists
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY not set in environment" });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const body = typeof req.body === "string"
      ? JSON.parse(req.body)
      : req.body;

    const prompt = body.prompt;

    if (!prompt) {
      return res.status(400).json({ error: "prompt is required" });
    }

    console.log("Sending to OpenAI:", prompt);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "user", content: prompt }
      ],
      max_tokens: 500
    });

    console.log("Success:", completion.choices[0].message.content);

    res.status(200).json({
      reply: completion.choices[0].message.content
    });

  } catch (err) {

    console.error("API Error:", err);

    res.status(500).json({
      error: err.message,
      details: err.toString()
    });

  }

}
