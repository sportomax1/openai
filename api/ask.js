import OpenAI from "openai";

export default async function handler(req,res){

const openai = new OpenAI({
apiKey: process.env.OPENAI_API_KEY
});

const {prompt} = req.body;

const response = await openai.responses.create({
model:"gpt-5-mini",
input: prompt
});

res.status(200).json({
reply: response.output_text
});

}
