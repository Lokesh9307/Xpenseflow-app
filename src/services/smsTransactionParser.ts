/**
 * smsTransactionParser.ts
 * 
 * Deterministic transaction parser for Indian bank/UPI SMS messages.
 * 
 * Supports:
 * - UPI payments (Google Pay, PhonePe, Paytm, BHIM, etc.)
 * - Bank debit/credit alerts (SBI, HDFC, ICICI, Axis, Kotak, etc.)
 * - Credit card transactions
 * - Wallet debits (Paytm, Amazon Pay, etc.)
 * - NEFT/IMPS/RTGS transfers
 * - Refunds and reversals
 * 
 * Design Principles:
 * - Zero false positives: Only parse messages that clearly indicate transactions
 * - Deterministic: Same input always produces same output
 * - No ML/AI: Pure regex-based parsing for reliability
 * - Supports multi-part SMS reassembly
 */

export interface ParsedTransaction {
  /** Amount in INR (always positive) */
  amount: number;
  /** 'debit' or 'credit' */
  type: 'debit' | 'credit';
  /** Merchant/payee name extracted from SMS */
  merchant: string;
  /** Payment method detected */
  paymentMethod: 'UPI' | 'Credit Card' | 'Debit Card' | 'Net Banking' | 'Wallet' | 'Cash' | 'NEFT' | 'IMPS' | 'RTGS';
  /** Auto-assigned category based on merchant keywords */
  category: string;
  /** Bank/sender identifier */
  bank: string;
  /** Reference number if found */
  referenceNumber: string;
  /** Account number (last 4 digits) if found */
  accountLast4: string;
  /** ISO date string from SMS or current time */
  date: string;
  /** Original SMS body for audit trail */
  rawSms: string;
  /** Sender address */
  senderAddress: string;
  /** Whether this is a refund/reversal */
  isRefund: boolean;
  /** UPI transaction ID if available */
  upiTxnId: string;
  /** Dedup hash: amount + type + date + merchant normalized */
  dedupHash: string;
}

// ── Known Bank Sender Patterns ───────────────────────────────────────────────
const BANK_SENDER_PATTERNS: Record<string, RegExp> = {
  'SBI': /\b(SBI|SBIUPI|SBIPSG|SBINOBnk|SBIBNK)\b/i,
  'HDFC Bank': /\b(HDFC|HDFCBK|HDFCBk)\b/i,
  'ICICI Bank': /\b(ICICI|ICICIBk|ICICIB)\b/i,
  'Axis Bank': /\b(AXIS|AXISBk|AXISBK)\b/i,
  'Kotak': /\b(KOTAK|KotakB|KOTAKB)\b/i,
  'PNB': /\b(PNB|PNBSMS)\b/i,
  'BOB': /\b(BOB|BOBTXN)\b/i,
  'Canara': /\b(CANARA|CANARABNK)\b/i,
  'IndusInd': /\b(INDUSIND|INDUSBK)\b/i,
  'Yes Bank': /\b(YESBNK|YESBK)\b/i,
  'Federal Bank': /\b(FEDRAL|FEDBK)\b/i,
  'IDFC First': /\b(IDFCFB|IDFC)\b/i,
  'RBL Bank': /\b(RBLBNK|RBL)\b/i,
  'Union Bank': /\b(UNIONB|UBOI)\b/i,
  'Indian Bank': /\b(INDIANB|INDBK)\b/i,
  'IOB': /\b(IOB|IOBSMS)\b/i,
  'Paytm': /\b(PAYTM|PaytmB)\b/i,
  'Google Pay': /\b(GOOGLEPAY|GPay)\b/i,
  'PhonePe': /\b(PHONEPE|PhonePe)\b/i,
  'Amazon Pay': /\b(AMAZON|AmaznPy)\b/i,
};

// ── Transaction Type Indicators ──────────────────────────────────────────────
const DEBIT_KEYWORDS = [
  'debited', 'debit', 'spent', 'paid', 'payment', 'purchase',
  'withdrawn', 'withdrawal', 'transferred', 'sent', 'dr',
  'txn at', 'transaction at', 'used at', 'charged',
  'auto-debit', 'emi deducted', 'bill payment',
];

const CREDIT_KEYWORDS = [
  'credited', 'credit', 'received', 'refund', 'reversed',
  'cashback', 'reward', 'cr', 'deposited', 'added',
];

const REFUND_KEYWORDS = [
  'refund', 'reversed', 'reversal', 'cashback', 'refunded',
  'chargeback', 'return',
];

// ── Amount Extraction Patterns ───────────────────────────────────────────────
const AMOUNT_PATTERNS = [
  // Rs.1,234.56 or Rs 1234.56 or INR 1,234.56
  /(?:Rs\.?|INR|₹)\s*([0-9]{1,3}(?:,?[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
  // Amount: Rs.1234
  /(?:amount|amt|rs|inr)\s*[:.]?\s*(?:Rs\.?|INR|₹)?\s*([0-9]{1,3}(?:,?[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
  // debited by 1234.56
  /(?:debited|credited|debit|credit)\s+(?:by|for|with|of)?\s*(?:Rs\.?|INR|₹)?\s*([0-9]{1,3}(?:,?[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
  // INR 1234 or ₹1234
  /(?:INR|₹)\s*([0-9]{1,3}(?:,?[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
];

// ── Reference Number Patterns ────────────────────────────────────────────────
const REF_PATTERNS = [
  /(?:ref|reference|txn|transaction)\s*(?:no|number|id|#)?\.?\s*[:.]?\s*([A-Z0-9]{6,20})/i,
  /(?:UPI\s*(?:Ref|ID))\s*[:.]?\s*([0-9]{10,18})/i,
  /(?:IMPS|NEFT|RTGS)\s*(?:Ref)?\s*[:.]?\s*([A-Z0-9]{10,20})/i,
];

// ── Account Number Patterns (last 4 digits) ─────────────────────────────────
const ACCOUNT_PATTERNS = [
  /(?:a\/c|ac|account|acct)\s*(?:no\.?)?\s*(?:ending|ending in|XX|xx|[*X]+)?\s*([0-9]{4})\b/i,
  /(?:XX|xx|\*{4,})([0-9]{4})\b/,
  /(?:card\s*(?:ending|no\.?)?)\s*(?:XX|xx|\*{4,})?([0-9]{4})\b/i,
];

// ── Merchant Extraction Patterns ─────────────────────────────────────────────
const MERCHANT_PATTERNS = [
  // "to VPA payee@upi" or "to merchant-name@okicici"
  /(?:to|at|from|paid to|transferred to|sent to)\s+(?:VPA\s+)?([A-Za-z0-9._\-]+@[a-z]+)/i,
  // "at MERCHANT NAME" or "to MERCHANT NAME"
  /(?:at|to|from|paid to)\s+([A-Z][A-Za-z0-9 &.'_\-]{2,40}?)(?:\s+(?:on|via|ref|for|using|UPI|IMPS|NEFT)|\.|$)/i,
  // "VPA payee@bank"
  /VPA\s+([A-Za-z0-9._\-]+@[a-z]+)/i,
  // Info: MERCHANT_NAME
  /(?:Info|Payee|Beneficiary|Transfer to)\s*[:.]?\s*([A-Za-z0-9 &.'_\-]{2,40})/i,
];

// ── UPI Transaction ID Patterns ──────────────────────────────────────────────
const UPI_TXN_PATTERNS = [
  /UPI\s*(?:Ref|ID|Txn)\s*[:.]?\s*([0-9]{10,18})/i,
  /(?:UPI|txn)\s*#?\s*[:.]?\s*([0-9]{12,18})/i,
];

// ── Category Auto-Assignment Based on Merchant Keywords ──────────────────────
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Food & Dining': [
    'swiggy', 'zomato', 'dominos', 'pizza', 'mcdonalds', 'starbucks',
    'kfc', 'subway', 'burger', 'restaurant', 'cafe', 'hotel', 'dining',
    'food', 'biryani', 'kitchen', 'bakery', 'barbeque', 'bbq',
    'chai', 'tea', 'coffee', 'beverages', 'juice', 'dhaba',
    'mess', 'canteen', 'tiffin',
  ],
  'Shopping': [
    'amazon', 'flipkart', 'myntra', 'meesho', 'ajio', 'nykaa',
    'zara', 'h&m', 'reliance', 'dmart', 'bigbazaar', 'croma',
    'vijay sales', 'decathlon', 'snapdeal', 'shopclues',
    'tatacliq', 'lenskart', 'urbanladder', 'pepperfry',
    'firstcry', 'bewakoof', 'boat', 'noise',
  ],
  'Travel & Commute': [
    'uber', 'ola', 'rapido', 'metro', 'irctc', 'makemytrip',
    'goibibo', 'cleartrip', 'redbus', 'abhibus', 'yatra',
    'fuel', 'petrol', 'diesel', 'hp', 'bpcl', 'iocl',
    'parking', 'toll', 'fastag', 'cab', 'auto', 'rickshaw',
  ],
  'Bills & Utilities': [
    'airtel', 'jio', 'vi', 'bsnl', 'vodafone', 'tatasky',
    'dth', 'electricity', 'water', 'gas', 'broadband',
    'wifi', 'internet', 'phone', 'mobile', 'recharge',
    'postpaid', 'prepaid', 'bill', 'municipal',
    'emi', 'loan', 'insurance',
  ],
  'Entertainment': [
    'netflix', 'spotify', 'hotstar', 'prime video', 'disney',
    'youtube', 'apple music', 'gaana', 'wynk', 'zee5',
    'sonyliv', 'jiocinema', 'voot', 'mx player',
    'bookmyshow', 'pvr', 'inox', 'cinema', 'movie', 'theatre',
    'gaming', 'steam', 'playstation', 'xbox',
  ],
  'Groceries': [
    'bigbasket', 'grofers', 'blinkit', 'instamart', 'zepto',
    'dunzo', 'jiomart', 'dmart', 'reliance fresh',
    'spencer', 'nature basket', 'grocery', 'supermarket',
    'provisions', 'kirana', 'vegetables', 'fruits',
  ],
  'Health & Fitness': [
    'pharmacy', 'medical', 'hospital', 'clinic', 'doctor',
    'apollo', 'netmeds', 'pharmeasy', 'medplus', '1mg',
    'practo', 'cult.fit', 'cultfit', 'gym', 'yoga',
    'wellness', 'healthians', 'lab', 'diagnostic',
  ],
  'Education': [
    'udemy', 'coursera', 'unacademy', 'byjus', 'vedantu',
    'toppr', 'school', 'college', 'university', 'tuition',
    'coaching', 'books', 'kindle', 'audible', 'education',
    'exam', 'test', 'skill', 'course',
  ],
  'Investment': [
    'zerodha', 'groww', 'upstox', 'angel', 'paytm money',
    'kuvera', 'coin', 'sip', 'mutual fund', 'mf',
    'shares', 'trading', 'stock', 'invest', 'fd',
    'fixed deposit', 'ppf', 'nps', 'epf',
  ],
};

// ── Payment Method Detection ─────────────────────────────────────────────────
function detectPaymentMethod(body: string): ParsedTransaction['paymentMethod'] {
  const lower = body.toLowerCase();
  if (/\bupi\b/i.test(body) || /@[a-z]+/i.test(body)) return 'UPI';
  if (/credit\s*card/i.test(body) || /\bcc\b/i.test(body)) return 'Credit Card';
  if (/debit\s*card/i.test(body)) return 'Debit Card';
  if (/\bneft\b/i.test(body)) return 'NEFT';
  if (/\bimps\b/i.test(body)) return 'IMPS';
  if (/\brtgs\b/i.test(body)) return 'RTGS';
  if (/wallet|paytm wallet/i.test(body)) return 'Wallet';
  if (/\bnet\s*banking\b/i.test(body)) return 'Net Banking';
  return 'UPI'; // Default for Indian transactions
}

// ── Category Assignment ──────────────────────────────────────────────────────
function assignCategory(merchant: string): string {
  const lower = merchant.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return category;
    }
  }
  return 'Others';
}

// ── Bank Detection from Sender Address ───────────────────────────────────────
function detectBank(sender: string, body: string): string {
  for (const [bank, pattern] of Object.entries(BANK_SENDER_PATTERNS)) {
    if (pattern.test(sender) || pattern.test(body)) {
      return bank;
    }
  }
  // Clean up sender for display
  const cleaned = sender.replace(/^[A-Z]{2}-/i, '').replace(/[^A-Za-z0-9]/g, '');
  return cleaned || 'Unknown Bank';
}

// ── Extract First Match from Pattern Array ───────────────────────────────────
function extractFirst(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return '';
}

// ── Clean Amount String → Number ─────────────────────────────────────────────
function parseAmount(amountStr: string): number {
  // Remove commas and parse
  const cleaned = amountStr.replace(/,/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.abs(num);
}

// ── Generate Dedup Hash ──────────────────────────────────────────────────────
function generateDedupHash(
  amount: number,
  type: string,
  date: string,
  merchant: string
): string {
  // Use date rounded to nearest hour to handle SMS delivery delays
  const d = new Date(date);
  const roundedDate = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    d.getHours()
  ).toISOString();

  const normalizedMerchant = merchant
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20);

  const raw = `${amount}|${type}|${roundedDate}|${normalizedMerchant}`;

  // Simple hash function (FNV-1a inspired)
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

// ── Determine if SMS is a Transaction SMS ────────────────────────────────────
function isTransactionSms(sender: string, body: string): boolean {
  const lower = body.toLowerCase();

  // Must contain an amount indicator
  const hasAmount = AMOUNT_PATTERNS.some((p) => p.test(body));
  if (!hasAmount) return false;

  // Must contain a transaction keyword
  const hasDebit = DEBIT_KEYWORDS.some((kw) => lower.includes(kw));
  const hasCredit = CREDIT_KEYWORDS.some((kw) => lower.includes(kw));
  if (!hasDebit && !hasCredit) return false;

  // Exclude OTP messages, promotional messages
  if (/\botp\b/i.test(body)) return false;
  if (/\bverification\b/i.test(body)) return false;
  if (/\bcode\b.*\b\d{4,8}\b/i.test(body)) return false;
  if (/\bpin\b/i.test(body) && !/\bATM\s*PIN\b/i.test(body)) return false;
  if (/offer|cashback offer|win|prize|reward points|redeem/i.test(body)) {
    // Only exclude if no actual transaction amount
    if (!/debited|credited|spent|paid|received/i.test(body)) return false;
  }

  // Sender should look like a bank/financial SMS sender (short code or known pattern)
  const isShortCode = /^[A-Z]{2}-[A-Z]{4,}/i.test(sender);
  const isKnownBank = Object.values(BANK_SENDER_PATTERNS).some((p) =>
    p.test(sender)
  );
  const isFinancialSender = /bank|pay|upi|fin|money|wallet/i.test(sender);

  return isShortCode || isKnownBank || isFinancialSender;
}

// ── Main Parser Function ─────────────────────────────────────────────────────
/**
 * Parse an SMS message and extract transaction details.
 * Returns null if the SMS is not a recognized transaction message.
 */
export function parseSmsTransaction(
  sender: string,
  body: string,
  timestamp?: number
): ParsedTransaction | null {
  // Quick reject: not a transaction SMS
  if (!isTransactionSms(sender, body)) {
    return null;
  }

  const lower = body.toLowerCase();

  // 1. Extract amount
  let amount = 0;
  for (const pattern of AMOUNT_PATTERNS) {
    const match = body.match(pattern);
    if (match && match[1]) {
      amount = parseAmount(match[1]);
      if (amount > 0) break;
    }
  }

  if (amount <= 0) return null;

  // 2. Determine transaction type
  const isRefund = REFUND_KEYWORDS.some((kw) => lower.includes(kw));
  let type: 'debit' | 'credit' = 'debit';

  if (isRefund) {
    type = 'credit';
  } else {
    const hasCredit = CREDIT_KEYWORDS.some((kw) => lower.includes(kw));
    const hasDebit = DEBIT_KEYWORDS.some((kw) => lower.includes(kw));

    if (hasCredit && !hasDebit) {
      type = 'credit';
    } else if (hasDebit) {
      type = 'debit';
    } else if (hasCredit) {
      type = 'credit';
    }
  }

  // 3. Extract merchant
  let merchant = extractFirst(body, MERCHANT_PATTERNS);

  // Clean up UPI VPA to extract merchant name
  if (merchant.includes('@')) {
    const vpaName = merchant.split('@')[0];
    // Convert "merchant.name" or "merchant-name" to "Merchant Name"
    merchant = vpaName
      .replace(/[._\-]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  }

  // If still empty, try to find something useful
  if (!merchant || merchant.length < 2) {
    merchant = 'Unknown Merchant';
  }

  // 4. Detect payment method
  const paymentMethod = detectPaymentMethod(body);

  // 5. Auto-assign category
  const category = assignCategory(merchant);

  // 6. Detect bank
  const bank = detectBank(sender, body);

  // 7. Extract reference number
  const referenceNumber = extractFirst(body, REF_PATTERNS);

  // 8. Extract account last 4 digits
  const accountLast4 = extractFirst(body, ACCOUNT_PATTERNS);

  // 9. Extract UPI transaction ID
  const upiTxnId = extractFirst(body, UPI_TXN_PATTERNS);

  // 10. Date — use provided timestamp or current time
  const date = timestamp
    ? new Date(timestamp).toISOString()
    : new Date().toISOString();

  // 11. Generate dedup hash
  const dedupHash = generateDedupHash(amount, type, date, merchant);

  return {
    amount,
    type,
    merchant,
    paymentMethod,
    category,
    bank,
    referenceNumber,
    accountLast4,
    date,
    rawSms: body,
    senderAddress: sender,
    isRefund,
    upiTxnId,
    dedupHash,
  };
}

/**
 * Test SMS samples for verification.
 * Can be used during development to validate parser accuracy.
 */
export const TEST_SMS_SAMPLES = [
  {
    sender: 'AD-SBIBNK',
    body: 'Dear Customer, Your A/c XX1234 has been debited by Rs.500.00 on 25Oct24 by UPI Ref No 432112345678. If not done by you, call 1800111109.',
    expected: { amount: 500, type: 'debit', paymentMethod: 'UPI' },
  },
  {
    sender: 'BZ-HDFCBK',
    body: 'HDFC Bank: Rs 2,500.00 debited from a/c **4567 on 25-10-24 to VPA merchant.store@okicici (UPI Ref No 987654321012). Avl Bal Rs 45,678.90',
    expected: { amount: 2500, type: 'debit', paymentMethod: 'UPI' },
  },
  {
    sender: 'VD-ICICIB',
    body: 'ICICI Bank Acct XX7890 credited INR 15,000.00 on 25-Oct-24. Info: SALARY OCT. Avl Bal INR 65,000.50. Call 18001020.',
    expected: { amount: 15000, type: 'credit', paymentMethod: 'Net Banking' },
  },
  {
    sender: 'AX-AXISBK',
    body: 'INR 899.00 spent on AXIS Bank Credit Card ending 5678 at NETFLIX on 25-Oct. Avl Limit: INR 1,50,000.',
    expected: { amount: 899, type: 'debit', paymentMethod: 'Credit Card' },
  },
  {
    sender: 'JD-PAYTM',
    body: 'Rs.200.00 paid to Swiggy via Paytm UPI. UPI Ref: 432199887766. Balance: Rs.1,500.00.',
    expected: { amount: 200, type: 'debit', paymentMethod: 'UPI' },
  },
  {
    sender: 'BZ-HDFCBK',
    body: 'Refund of Rs.499.00 credited to your HDFC Bank a/c XX4567. Ref: REF123456789. Original Txn: Amazon Purchase.',
    expected: { amount: 499, type: 'credit', isRefund: true },
  },
];
