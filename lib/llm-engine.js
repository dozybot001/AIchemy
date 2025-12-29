import { Store } from '../store.js';

export const LLMEngine = {
    async callAPI(messages) {
        const currentModel = Store.state.currentModel;
        if (currentModel !== 'Custom API') {
            throw new Error(`The selected model is: "${currentModel}"。Change it to "Use Custom API" to apply api configuration`);
        }
        const { baseUrl, apiKey, modelName } = Store.state.apiConfig;
        if (!apiKey) {
            throw new Error("Set API Key First");
        }
        const endpoint = baseUrl ? baseUrl.replace(/\/$/, '') : 'https://api.openai.com/v1';
        const url = `${endpoint}/chat/completions`;

        const payload = {
            model: modelName || "gpt-3.5-turbo",
            messages: messages,
            temperature: 0.7
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || `API Error: ${response.status}`);
            }

            const data = await response.json();
            return data.choices[0]?.message?.content || "";
        } catch (error) {
            console.error("LLM Call Failed:", error);
            throw error;
        }
    },
    async analyzeRequirements(userGoal) {
        const systemPrompt = `
You are an expert Software Architect and Requirements Analyst.
Your task is to analyze the user's brief input ("${userGoal}") and break it down into key technical or functional dimensions for the user to select.

Return ONLY valid JSON strictly adhering to this schema, no markdown:

{
  "dimensions": [
    {
      "name": "Tech Stack", 
      "key": "tech_stack",
      "options": ["Vanilla HTML/JS", "React", "Vue", "Python/Streamlit"]
    },
    {
      "name": "Key Features",
      "key": "features", 
      "multi": true,
      "options": ["Option A", "Option B"]
    }
  ]
}

Rules:
1. "name": The display title for the dimension.
2. "options": Specific choices relevant to the user's goal.
3. Dynamically generate 3-5 most relevant dimensions (e.g., UI Style, Data Source, Complexity, Framework) based on "${userGoal}".
`;
        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userGoal }
        ];
        const rawContent = await this.callAPI(messages);
        return this.cleanAndParseJSON(rawContent);
    },
    async generateFinalPrompt(userGoal, selections) {
        let selectionText = "";
        for (const [key, value] of Object.entries(selections)) {
            selectionText += `- ${key}: ${Array.isArray(value) ? value.join(', ') : value}\n`;
        }

        const prompt = `
Role: Senior Technical Lead & Prompt Engineer.
Task: Write a high-quality, detailed System Prompt for an AI coding assistant.

Context:
- Original User Goal: "${userGoal}"
- Selected Constraints:
${selectionText}

Requirement:
Generate a structured prompt that I can copy-paste to an AI. 
The prompt must include:
1. Role Definition.
2. Step-by-Step Implementation Plan.
3. Tech Stack & Coding Standards.
4. Specific Constraint Handling.

Output Format: Markdown.
`;
        const messages = [
            { role: "user", content: prompt }];
        return await this.callAPI(messages);
    },
    cleanAndParseJSON(text) {
        try {
            return JSON.parse(text);
        } catch (e) {
            const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (match && match[1]) {
                return JSON.parse(match[1]);
            }
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
                return JSON.parse(text.substring(start, end + 1));
            }
            throw new Error("无法解析 LLM 返回的 JSON");
        }
    }
};