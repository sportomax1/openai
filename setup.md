# AI Chat App - Multi-Model Setup Guide

## Files to Replace in Your Project

1. **`api/ask.js`** → Replace with `ask-universal.js`
2. **`index.html`** → Replace with `index-universal.html`
3. **`package.json`** → Already correct (includes openai dependency)

## Environment Variables in Vercel

Go to **Vercel Dashboard → Project Settings → Environment Variables**

Add BOTH (or just the one you want to use):

```
GOOGLE_GEMINI_API_KEY = your-gemini-key-here
OPENAI_API_KEY = your-openai-key-here (optional)
```

## Getting API Keys

### Gemini (FREE - Recommended)
1. Go to: https://aistudio.google.com/app/apikey
2. Click "Create API Key"
3. Copy the key

### OpenAI (PAID)
1. Go to: https://platform.openai.com/account/billing/overview
2. Add payment method
3. Go to: https://platform.openai.com/account/api-keys
4. Create new secret key

## How to Use

1. **In the app**, there's a toggle at the top:
   - **✨ Gemini (FREE)** - Default, no payment needed, 1500 requests/day
   - **🔴 OpenAI** - Requires paid plan, faster, more reliable

2. Click either button to switch models before sending

3. The console log shows which model is being used:
   - Green `[GEMINI]` logs = Gemini API
   - Blue `[OPENAI]` logs = OpenAI API

## Push to GitHub and Deploy

```bash
git add .
git commit -m "Add dual-model support (Gemini + OpenAI)"
git push origin main
```

Vercel will auto-deploy! Test both models in the app.

## Troubleshooting

**Gemini returning 400 error?**
- Check API key is correct in Vercel env vars
- Make sure key hasn't been regenerated

**OpenAI returning 429?**
- Add payment method to OpenAI account
- Check account billing/credits

**Can't toggle between models?**
- Verify both API keys are in Vercel environment
- Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)

## Console Colors

- 🔵 **Blue** = Info/Status
- 🟢 **Green** = Gemini API calls
- ⚪ **Cyan** = OpenAI API calls
- 🔴 **Red** = Errors
- 🟡 **Yellow** = Warnings
