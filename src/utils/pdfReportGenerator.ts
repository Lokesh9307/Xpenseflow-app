import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from 'react-native';

export interface ReportExpenseItem {
  _id?: string;
  title: string;
  amount: number;
  category: string;
  paymentMethod?: string;
  date: string | Date;
  notes?: string;
}

export interface GeneratePdfOptions {
  monthKey: string; // 'YYYY-MM'
  monthLabel: string; // e.g. 'October 2026'
  userName: string;
  userEmail: string;
  expenses: ReportExpenseItem[];
  currencySymbol?: string;
}

export const generateAndShareMonthlyPdfReport = async (options: GeneratePdfOptions): Promise<void> => {
  const {
    monthLabel,
    userName,
    userEmail,
    expenses,
    currencySymbol = '₹',
  } = options;

  if (!expenses || expenses.length === 0) {
    Alert.alert('No Expenses Found', `There are no recorded expenses for ${monthLabel}.`);
    return;
  }

  const totalSpent = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const avgExpense = Math.round(totalSpent / expenses.length);

  // Group by category
  const categoryMap: Record<string, number> = {};
  expenses.forEach((e) => {
    const cat = e.category || 'Others';
    categoryMap[cat] = (categoryMap[cat] || 0) + (Number(e.amount) || 0);
  });

  const sortedCategories = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1]);

  const topCategory = sortedCategories.length > 0 ? sortedCategories[0][0] : 'None';
  const topCategorySpent = sortedCategories.length > 0 ? sortedCategories[0][1] : 0;

  // Format HTML rows
  const categoryRowsHtml = sortedCategories.map(([cat, amt]) => {
    const pct = totalSpent > 0 ? Math.round((amt / totalSpent) * 100) : 0;
    return `
      <tr>
        <td style="padding: 10px 14px; font-weight: 600; color: #1e293b; border-bottom: 1px solid #f1f5f9;">${cat}</td>
        <td style="padding: 10px 14px; text-align: right; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${currencySymbol}${amt.toLocaleString('en-IN')}</td>
        <td style="padding: 10px 14px; text-align: right; font-weight: 600; color: #0d9488; border-bottom: 1px solid #f1f5f9;">${pct}%</td>
      </tr>
    `;
  }).join('');

  const expenseRowsHtml = expenses.map((e, idx) => {
    const d = new Date(e.date);
    const dateFormatted = isNaN(d.getTime()) ? String(e.date).slice(0, 10) : d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    return `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 9px 12px; font-size: 12px; color: #64748b; border-bottom: 1px solid #f1f5f9;">#${idx + 1}</td>
        <td style="padding: 9px 12px; font-size: 12px; font-weight: 600; color: #334155; border-bottom: 1px solid #f1f5f9;">${dateFormatted}</td>
        <td style="padding: 9px 12px; font-size: 12px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;">
          ${e.title}
          ${e.notes ? `<div style="font-size: 10px; color: #94a3b8; font-weight: normal; margin-top: 2px;">${e.notes}</div>` : ''}
        </td>
        <td style="padding: 9px 12px; font-size: 12px; border-bottom: 1px solid #f1f5f9;">
          <span style="background-color: #f1f5f9; color: #475569; padding: 3px 8px; border-radius: 6px; font-weight: 600; font-size: 11px;">
            ${e.category || 'Others'}
          </span>
        </td>
        <td style="padding: 9px 12px; font-size: 12px; color: #64748b; border-bottom: 1px solid #f1f5f9;">${e.paymentMethod || 'UPI'}</td>
        <td style="padding: 9px 12px; font-size: 13px; font-weight: 800; text-align: right; color: #0f172a; border-bottom: 1px solid #f1f5f9;">
          ${currencySymbol}${Number(e.amount).toLocaleString('en-IN')}
        </td>
      </tr>
    `;
  }).join('');

  const nowFormatted = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Expense Report - ${monthLabel}</title>
        <style>
          @page {
            size: A4;
            margin: 16mm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 0;
            background-color: #ffffff;
            -webkit-print-color-adjust: exact;
          }
          .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24px;
            border-bottom: 2px solid #0d9488;
            padding-bottom: 16px;
          }
          .brand-name {
            font-size: 26px;
            font-weight: 900;
            color: #0d9488;
            letter-spacing: -0.5px;
          }
          .brand-subtitle {
            font-size: 12px;
            color: #64748b;
            margin-top: 4px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .report-meta {
            text-align: right;
            font-size: 12px;
            color: #475569;
          }
          .kpi-grid {
            display: table;
            width: 100%;
            margin-bottom: 26px;
          }
          .kpi-row {
            display: table-row;
          }
          .kpi-cell {
            display: table-cell;
            width: 25%;
            padding: 12px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
          }
          .kpi-label {
            font-size: 10px;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            margin-bottom: 6px;
          }
          .kpi-val {
            font-size: 18px;
            font-weight: 800;
            color: #0f172a;
          }
          .section-title {
            font-size: 14px;
            font-weight: 800;
            color: #1e293b;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            margin-top: 24px;
            margin-bottom: 12px;
          }
          table.data-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            overflow: hidden;
            margin-bottom: 24px;
          }
          table.data-table th {
            background-color: #f1f5f9;
            color: #475569;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            padding: 10px 12px;
            text-align: left;
            border-bottom: 2px solid #cbd5e1;
          }
          .footer {
            margin-top: 36px;
            padding-top: 14px;
            border-top: 1px solid #e2e8f0;
            font-size: 11px;
            color: #94a3b8;
            display: flex;
            justify-content: space-between;
          }
        </style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td style="vertical-align: middle;">
              <div class="brand-name">XPENSEFLOW</div>
              <div class="brand-subtitle">Monthly Expense Statement</div>
            </td>
            <td class="report-meta" style="vertical-align: middle;">
              <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">${monthLabel}</div>
              <div><b>Account:</b> ${userName}</div>
              <div><b>Email:</b> ${userEmail}</div>
              <div style="color: #94a3b8; font-size: 10px; margin-top: 2px;">Generated: ${nowFormatted}</div>
            </td>
          </tr>
        </table>

        <!-- Summary KPIs -->
        <table style="width: 100%; border-collapse: separate; border-spacing: 10px; margin-bottom: 20px;">
          <tr>
            <td style="background-color: #f0fdfa; border: 1px solid #99f6e4; border-radius: 10px; padding: 14px; width: 25%;">
              <div style="font-size: 10px; font-weight: 800; color: #0d9488; text-transform: uppercase; letter-spacing: 0.8px;">TOTAL EXPENDITURE</div>
              <div style="font-size: 20px; font-weight: 900; color: #115e59; margin-top: 4px;">${currencySymbol}${totalSpent.toLocaleString('en-IN')}</div>
            </td>
            <td style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; width: 25%;">
              <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px;">TRANSACTIONS</div>
              <div style="font-size: 20px; font-weight: 900; color: #0f172a; margin-top: 4px;">${expenses.length} Records</div>
            </td>
            <td style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; width: 25%;">
              <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px;">AVERAGE / BILL</div>
              <div style="font-size: 20px; font-weight: 900; color: #0f172a; margin-top: 4px;">${currencySymbol}${avgExpense.toLocaleString('en-IN')}</div>
            </td>
            <td style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; width: 25%;">
              <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px;">TOP SPEND CATEGORY</div>
              <div style="font-size: 16px; font-weight: 900; color: #0f172a; margin-top: 4px;">${topCategory}</div>
              <div style="font-size: 10px; color: #64748b; font-weight: 600;">${currencySymbol}${topCategorySpent.toLocaleString('en-IN')}</div>
            </td>
          </tr>
        </table>

        <!-- Category Breakdown -->
        <div class="section-title">Category Wise Distribution</div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Category</th>
              <th style="text-align: right;">Amount</th>
              <th style="text-align: right;">Share</th>
            </tr>
          </thead>
          <tbody>
            ${categoryRowsHtml}
          </tbody>
        </table>

        <!-- Itemized Transaction History -->
        <div class="section-title">Itemized Expense Ledger (${expenses.length} Entries)</div>
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 35px;">#</th>
              <th style="width: 85px;">Date</th>
              <th>Description / Notes</th>
              <th style="width: 130px;">Category</th>
              <th style="width: 75px;">Payment</th>
              <th style="width: 95px; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${expenseRowsHtml}
          </tbody>
        </table>

        <!-- Footer -->
        <div class="footer">
          <div>Report generated automatically by XpenseFlow Financial Management System.</div>
          <div style="text-align: right;">Confidential & Personal</div>
        </div>
      </body>
    </html>
  `;

  try {
    const { uri: tempUri, base64 } = await Print.printToFileAsync({
      html,
      base64: true,
    });

    const targetPdfName = `XpenseFlow_${(monthLabel || 'Monthly').replace(/[^a-zA-Z0-9]/g, '_')}_Report.pdf`;
    const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
    const targetUri = `${baseDir}${targetPdfName}`;

    let shareableUri = tempUri;
    if (base64) {
      try {
        await FileSystem.writeAsStringAsync(targetUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        shareableUri = targetUri;
      } catch (e) {
        console.warn('Fallback to tempUri for report share:', e);
      }
    }

    if (!shareableUri.startsWith('file://')) {
      shareableUri = `file://${shareableUri}`;
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(shareableUri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: `Share ${monthLabel} Expense Report`,
      });
    } else {
      await Print.printAsync({ uri: shareableUri });
    }
  } catch (error: any) {
    console.error('PDF Report generation error:', error);
    Alert.alert('Report Error', error?.message || 'Failed to generate PDF report.');
  }
};
