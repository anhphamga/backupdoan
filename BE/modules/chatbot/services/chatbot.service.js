const { searchContext, ingestDocuments } = require('./retrieval.service');
const { generateResponse } = require('./groq.service');
const { validateChatInput, normalizeDocumentsInput } = require('../utils/validators');

const chat = async (payload) => {
  const { message, topK } = validateChatInput(payload);
  const contexts = await searchContext({ query: message, topK });

  const contextBlocks = contexts.map((item) => item.text);
  const llmResult = await generateResponse({
    question: message,
    contextBlocks,
  });

  return {
    answer: llmResult.answer,
    usage: llmResult.usage,
    model: llmResult.model,
    contexts: contexts.map((item) => ({
      id: item.id,
      score: Number(item.score.toFixed(4)),
      metadata: item.metadata,
      preview: item.text.slice(0, 200),
    })),
  };
};

const ingest = async (payload) => {
  const docs = normalizeDocumentsInput(payload);
  const result = await ingestDocuments(docs);

  return {
    ...result,
    ingestedAt: new Date().toISOString(),
  };
};

module.exports = {
  chat,
  ingest,
};
