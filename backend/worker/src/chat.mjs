import { getDocument, insertDocument, listDocuments } from './db.mjs';
import { HttpError } from './errors.mjs';
import { json, protectedUser, readJson } from './http.mjs';

const round2 = (value) => Math.round(Number(value) * 100) / 100;
const monthStart = () => {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

function guessCategory(message, categories) {
  const text = message.toLowerCase();
  const hints = [
    [/food|dinner|lunch|breakfast|restaurant|swiggy|zomato|coffee|pizza|burger/, /food|dining/i],
    [/petrol|fuel|diesel|uber|ola|cab|auto|flight|train|bus/, /travel|commute/i],
    [/movie|netflix|spotify|game|concert/, /entertainment/i],
    [/electricity|water|bill|recharge|internet/, /bill|utilit/i],
    [/shirt|shoes|shopping|amazon|flipkart/, /shopping/i],
  ];
  const match = hints.find(([terms]) => terms.test(text));
  if (match) return categories.find((category) => match[1].test(category.name));
  return categories.find((category) => /others/i.test(category.name));
}

async function createExpense(env, userId, data) {
  const amount = Number.parseFloat(data.amount);
  const title = String(data.title || '').trim();
  if (!title || !Number.isFinite(amount) || amount <= 0) {
    throw new HttpError(400, 'Expense title and a positive amount are required');
  }
  const category = data.categoryId
    ? await getDocument(env, 'categories', data.categoryId)
    : null;
  const expense = {
    userId,
    title,
    amount,
    category: category?.name || data.category || 'Others',
    categoryId: category?._id || data.categoryId || null,
    paymentMethod: data.paymentMethod || 'UPI',
    date: data.date ? new Date(data.date).toISOString() : new Date().toISOString(),
    notes: data.notes || '',
  };
  return insertDocument(env, 'expenses', expense);
}

async function verifiedSummary(env, userId) {
  const start = monthStart().getTime();
  const [expenses, income] = await Promise.all([
    listDocuments(env, 'expenses', { ownerId: userId, startMs: start }),
    listDocuments(env, 'income', { ownerId: userId, startMs: start }),
  ]);
  return {
    monthExpense: round2(expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0)),
    monthIncome: round2(income.reduce((sum, item) => sum + Number(item.amount || 0), 0)),
    expenseCount: expenses.length,
    incomeCount: income.length,
  };
}

async function simpleChat(env, userId, body) {
  const message = String(body.message || '').trim();
  const categories = await listDocuments(env, 'categories', { ownerId: userId });
  const amountMatch = message.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)\s*(?:rs\.?|rupees?)?/i);
  if (amountMatch && /\b(spent|paid|bought|expense|purchase)\b/i.test(message)) {
    const category = guessCategory(message, categories);
    if (!category) {
      return json({
        response: 'I found an expense amount, but your categories are not loaded yet. Please create the expense from the Expenses screen.',
        intent: 'expense.category_missing',
      });
    }
    const amount = Number.parseFloat(amountMatch[1].replaceAll(',', ''));
    const form = {
      amount,
      category: category.name,
      categoryId: category._id,
      paymentMethod: 'UPI',
      date: new Date().toISOString(),
      title: message.replace(amountMatch[0], '').replace(/\b(i|spent|paid|bought|on|for|expense|purchase)\b/gi, '').trim() || `${category.name} expense`,
      isComplete: true,
      saved: false,
    };
    return json({
      response: `I prepared an expense of ₹${amount} in ${category.name}. Review and confirm before saving.`,
      intent: 'expense.create',
      form,
      actionCard: { type: 'expense_preview', data: form },
      pendingAction: { toolName: 'create_expense', params: form },
    });
  }

  if (/\b(summary|spent|spending|income|balance|expense total)\b/i.test(message)) {
    const verifiedData = await verifiedSummary(env, userId);
    return json({
      response: `This month you have recorded ₹${verifiedData.monthExpense.toFixed(2)} in expenses and ₹${verifiedData.monthIncome.toFixed(2)} in income.`,
      intent: 'finance.summary',
      verifiedData,
    });
  }
  return null;
}

export async function handleChatRequest(request, env, url) {
  if (request.method !== 'POST' || url.pathname !== '/api/chat') return null;
  const user = await protectedUser(request, env);
  const body = await readJson(request);
  const startedAt = Date.now();
  if (!body.message && !body.confirmedAction) {
    throw new HttpError(400, 'Message or confirmedAction is required');
  }

  if (body.confirmedAction) {
    if (body.confirmedAction.toolName !== 'create_expense') {
      throw new HttpError(400, 'This action is not supported by the serverless assistant');
    }
    const expense = await createExpense(env, user.id, body.confirmedAction.params || {});
    return json({
      response: 'Expense saved successfully.',
      intent: 'create_expense.executed',
      success: true,
      verifiedData: expense,
      form: { ...expense, saved: true, isComplete: true },
      latencyMs: Date.now() - startedAt,
    });
  }

  const simpleResponse = await simpleChat(env, user.id, body);
  if (simpleResponse) return simpleResponse;

  if (!env.GROQ_API_KEY) {
    return json({
      response: 'I can summarize this month or prepare an expense when you include its amount. General AI chat is not configured on this deployment.',
      intent: 'assistant.limited',
      latencyMs: Date.now() - startedAt,
    });
  }

  const history = Array.isArray(body.history)
    ? body.history.slice(-12).map((item) => ({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: String(item.content || item.text || '').slice(0, 2000),
    }))
    : [];
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.GROQ_MODEL || 'openai/gpt-oss-120b',
      messages: [
        {
          role: 'system',
          content: 'You are XpenseFlow, a concise personal finance assistant. Never claim to have saved, changed, or verified app data. For account data, ask the user to use the app summary. Never request passwords, OTPs, or payment credentials.',
        },
        ...history,
        { role: 'user', content: String(body.message).slice(0, 4000) },
      ],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    console.error('[chat] AI provider returned an error status:', response.status);
    throw new HttpError(502, 'The AI assistant is temporarily unavailable');
  }
  const text = result?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) {
    throw new HttpError(502, 'The AI assistant returned an empty response');
  }
  return json({ response: text.trim(), intent: 'chat.response', latencyMs: Date.now() - startedAt });
}
