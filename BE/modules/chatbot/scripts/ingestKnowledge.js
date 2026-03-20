require('dotenv').config();

const fs = require('fs/promises');
const path = require('path');

const chatbotService = require('../services/chatbot.service');

const KNOWLEDGE_DIR = path.join(__dirname, '..', 'knowledge');

const loadKnowledgeDocuments = async () => {
  const names = await fs.readdir(KNOWLEDGE_DIR);
  const mdFiles = names.filter((name) => name.toLowerCase().endsWith('.md'));

  const documents = [];

  for (const name of mdFiles) {
    const fullPath = path.join(KNOWLEDGE_DIR, name);
    const content = await fs.readFile(fullPath, 'utf8');

    documents.push({
      id: `knowledge-${name.replace(/\.md$/i, '')}`,
      text: content,
      metadata: {
        source: 'chatbot-knowledge',
        filename: name,
      },
    });
  }

  return documents;
};

const main = async () => {
  try {
    const docs = await loadKnowledgeDocuments();

    if (!docs.length) {
      // eslint-disable-next-line no-console
      console.log('No knowledge files found.');
      return;
    }

    const result = await chatbotService.ingest({ documents: docs });

    // eslint-disable-next-line no-console
    console.log('Ingest completed:', result);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Ingest failed:', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      details: error.details,
    });
    process.exit(1);
  }
};

main();
