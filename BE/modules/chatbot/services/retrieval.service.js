const { chunkText } = require('../utils/chunkText');
const vectorStore = require('../vector-store/chromaVectorStore');

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const ingestDocuments = async (documents) => {
  const chunkSize = toNumber(process.env.CHATBOT_CHUNK_SIZE, 700);
  const overlap = toNumber(process.env.CHATBOT_CHUNK_OVERLAP, 120);

  const entries = [];

  for (const doc of documents) {
    const parts = chunkText(doc.text, chunkSize, overlap);

    for (let index = 0; index < parts.length; index += 1) {
      const chunk = parts[index];
      entries.push({
        id: `${doc.id}::${index}`,
        text: chunk,
        metadata: {
          ...doc.metadata,
          docId: doc.id,
          chunkIndex: index,
          createdAt: new Date().toISOString(),
        },
      });
    }
  }

  await vectorStore.upsertMany(entries);

  return {
    chunksInserted: entries.length,
    documentsInserted: documents.length,
  };
};

const searchContext = async ({ query, topK }) => {
  const hits = await vectorStore.query({ queryText: query, topK });

  return hits.map((item) => ({
    id: item.id,
    text: item.text,
    score: item.score,
    metadata: item.metadata,
  }));
};

module.exports = {
  ingestDocuments,
  searchContext,
};
