# Groq Setup & Rate Limits

**User Question:** "groq after how many charges after free quata limete excide"
**Answer:** Groq is currently in a **Free Beta**.
*   It does **not** charge you automatically.
*   If you exceed the limit, it will just **stop working temporary** (you will see a "Rate Limit" error) until the next minute/day.
*   You don't need to worry about surprise costs unless you added a credit card and picked a paid plan.

## Why I updated the Model?
You asked to "revert back", but the old model (`llama3-70b-8192`) was **shut down by Groq today**.
*   If I revert, the app will break with the same error you just saw.
*   I have set it to **`llama-3.3-70b-versatile`**, which is the newer, working version.

## Usage Limits (Free Tier)
*   **Requests per Day:** ~1,000 requests.
*   **Tokens per Minute:** ~6,000 tokens.
*   If you hit these, wait a minute or try again later.

**Please Restart (`npm start`) to use the fixed/working version.**
