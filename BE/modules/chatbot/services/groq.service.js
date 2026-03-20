const { requestWithRetry } = require('../utils/httpClient');
const ChatbotError = require('../utils/chatbotError');

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const buildSystemPrompt = (contextBlocks) => {
  const contextText = contextBlocks.length > 0
    ? contextBlocks.map((block, index) => `(${index + 1}) ${block}`).join('\n')
    : 'No relevant context found in vector store.';

  return [
    'You are a customer support chatbot for InHere.',
    'Answer only from the provided context.',
    'Never mention API, endpoint, backend, database, or internal systems.',
    'Never give technical implementation guidance.',
    'If context is missing, reply exactly: "Toi khong tim thay thong tin phu hop."',
    'Keep answers concise and direct, maximum 3 sentences.',
    `Context:\n${contextText}`,
  ].join('\n\n');
};

const generateResponse = async ({ question, contextBlocks }) => {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  if (!apiKey) {
    throw new ChatbotError('GROQ_API_KEY is missing', {
      statusCode: 500,
      code: 'GROQ_CONFIG_MISSING',
    });
  }

  const payload = await requestWithRetry({
    url: 'https://api.groq.com/openai/v1/chat/completions',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt(contextBlocks),
        },
        {
          role: 'user',
          content: question,
        },
      ],
    }),
    timeoutMs: toNumber(process.env.CHATBOT_GROQ_TIMEOUT_MS, 20000),
    maxRetries: toNumber(process.env.CHATBOT_MAX_RETRIES, 3),
    baseDelayMs: toNumber(process.env.CHATBOT_RETRY_BASE_DELAY_MS, 800),
    requestName: 'groq-chat-completion',
  });

  const content = payload?.choices?.[0]?.message?.content;

  if (!content) {
    throw new ChatbotError('Groq returned empty response', {
      statusCode: 502,
      code: 'EMPTY_GROQ_RESPONSE',
      details: { payload },
    });
  }

  return {
    answer: content,
    usage: payload?.usage || null,
    model,
  };
};

module.exports = {
  generateResponse,
};
