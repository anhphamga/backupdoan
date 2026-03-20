const ChatbotError = require('./chatbotError');
const { sanitizeText } = require('./sanitize');
const { getToolSearchConfig, toNumber } = require('./tool-search.config');

const ensureIsoDate = (value, fieldName) => {
  if (!value) {
    return null;
  }

  const normalized = sanitizeText(value);
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new ChatbotError(`${fieldName} must be a valid date`, {
      statusCode: 400,
      code: 'INVALID_TOOL_SEARCH_FILTER',
      details: { fieldName, value },
    });
  }

  return parsed;
};

const validateToolSearchPayload = (payload = {}) => {
  const config = getToolSearchConfig();

  const entity = sanitizeText(payload.entity).toLowerCase();
  const query = sanitizeText(payload.query);

  if (!entity || !config.allowedEntities.includes(entity)) {
    throw new ChatbotError('entity must be one of allowed values', {
      statusCode: 400,
      code: 'INVALID_TOOL_SEARCH_ENTITY',
      details: { entity, allowedEntities: config.allowedEntities },
    });
  }

  if (!query) {
    throw new ChatbotError('query is required', {
      statusCode: 400,
      code: 'INVALID_TOOL_SEARCH_QUERY',
    });
  }

  if (query.length > config.maxQueryLength) {
    throw new ChatbotError(`query exceeds max length (${config.maxQueryLength})`, {
      statusCode: 400,
      code: 'TOOL_SEARCH_QUERY_TOO_LONG',
    });
  }

  const filters = typeof payload.filters === 'object' && payload.filters !== null
    ? payload.filters
    : {};

  const page = Math.max(toNumber(filters.page, config.defaultPage), 1);
  const limit = Math.min(Math.max(toNumber(filters.limit, config.defaultLimit), 1), config.maxLimit);
  const status = sanitizeText(filters.status);
  const orderType = sanitizeText(filters.orderType).toLowerCase();
  const dateFrom = ensureIsoDate(filters.dateFrom, 'filters.dateFrom');
  const dateTo = ensureIsoDate(filters.dateTo, 'filters.dateTo');

  if (orderType && !['rent', 'sale', 'all'].includes(orderType)) {
    throw new ChatbotError('filters.orderType must be rent, sale or all', {
      statusCode: 400,
      code: 'INVALID_TOOL_SEARCH_FILTER',
      details: {
        fieldName: 'filters.orderType',
        value: orderType,
      },
    });
  }

  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new ChatbotError('filters.dateFrom must be earlier than or equal to filters.dateTo', {
      statusCode: 400,
      code: 'INVALID_TOOL_SEARCH_DATE_RANGE',
    });
  }

  const requestId = sanitizeText(payload.requestId || '');
  if (requestId.length > config.maxRequestIdLength) {
    throw new ChatbotError(`requestId exceeds max length (${config.maxRequestIdLength})`, {
      statusCode: 400,
      code: 'TOOL_SEARCH_REQUEST_ID_TOO_LONG',
    });
  }

  return {
    entity,
    query,
    filters: {
      status: status || null,
      orderType: orderType || null,
      dateFrom,
      dateTo,
      page,
      limit,
    },
    requestId,
  };
};

module.exports = {
  validateToolSearchPayload,
};
