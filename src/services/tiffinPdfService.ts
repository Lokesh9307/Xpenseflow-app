import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

export interface TiffinReportData {
  groupName: string;
  monthLabel: string;
  activeRate: number;
  totalCost: number;
  totalMeals: number;
  memberCount: number;
  members: any[];
  memberStats: any[];
  entries: any[];
}

export const generateAndShareTiffinReportPdf = async (data: TiffinReportData): Promise<void> => {
  const {
    groupName,
    monthLabel,
    activeRate,
    totalCost,
    totalMeals,
    memberCount,
    memberStats = [],
    entries = [],
  } = data;

  const generatedDateStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Build member rows HTML (with fallback to members list if memberStats isn't populated yet)
  const resolvedMembers =
    memberStats && memberStats.length > 0
      ? memberStats
      : (data.members && data.members.length > 0 ? data.members : [{ name: 'You' }]).map((m: any) => ({
          name: m.name || 'Member',
          mealsCount: totalMeals,
          extraTiffins: 0,
          baseTotal: memberCount > 0 ? Math.round(totalCost / memberCount) : totalCost,
          extraTotal: 0,
          totalDue: memberCount > 0 ? Math.round(totalCost / memberCount) : totalCost,
        }));

  const memberRowsHtml = resolvedMembers
    .map((m: any, idx: number) => {
      const extraCount = m.extraTiffins > 0 ? `+${m.extraTiffins}` : '-';
      const extraAmt = m.extraTotal > 0 ? `₹${Math.round(m.extraTotal)}` : '₹0';
      const baseAmt = `₹${Math.round(m.baseTotal || 0)}`;
      const totalDue = `₹${Math.round(m.totalDue || 0).toLocaleString('en-IN')}`;

      return `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f9fafb'}; border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 12px; font-weight: 600; color: #111827;">${m.name || 'Member'}</td>
          <td style="padding: 10px 12px; text-align: center; color: #4b5563;">${m.mealsCount || 0}</td>
          <td style="padding: 10px 12px; text-align: center; color: ${m.extraTiffins > 0 ? '#ea580c' : '#9ca3af'}; font-weight: ${m.extraTiffins > 0 ? '700' : '400'};">${extraCount}</td>
          <td style="padding: 10px 12px; text-align: right; color: #4b5563;">${baseAmt}</td>
          <td style="padding: 10px 12px; text-align: right; color: ${m.extraTotal > 0 ? '#ea580c' : '#9ca3af'};">${extraAmt}</td>
          <td style="padding: 10px 12px; text-align: right; font-weight: 800; color: #ea580c; font-size: 14px;">${totalDue}</td>
        </tr>
      `;
    })
    .join('');

  // Build daily log rows HTML
  const entryRowsHtml = entries
    .map((e, idx) => {
      const dateObj = new Date(e.date);
      const formattedDate = dateObj.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      const weekday = dateObj.toLocaleDateString('en-IN', { weekday: 'short' });
      const isSkipped = e.noTiffin || e.mealType === 'none' || e.quantity === 0;
      const mealName = isSkipped ? 'No Tiffin' : (e.mealType || 'Lunch').toUpperCase();
      const qtyText = isSkipped ? '0' : String(e.quantity || e.count || 1);

      // Extra breakdown
      let extraDetails = '-';
      if (!isSkipped && e.extras && Object.keys(e.extras).length > 0) {
        const extraParts = Object.entries(e.extras)
          .filter(([_, q]: [string, any]) => q > 0)
          .map(([mId, q]) => {
            const memberObj = data.members.find(
              (m: any) => String(m._id || m.userId) === mId
            );
            return `${memberObj?.name || 'Member'}: +${q}`;
          });
        if (extraParts.length > 0) {
          extraDetails = extraParts.join(', ');
        }
      }

      return `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f9fafb'}; border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 9px 12px; font-weight: 600; color: #111827;">${formattedDate} <span style="font-size: 11px; color: #6b7280;">(${weekday})</span></td>
          <td style="padding: 9px 12px; text-align: center;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; background-color: ${isSkipped ? '#fee2e2' : '#ffedd5'}; color: ${isSkipped ? '#b91c1c' : '#c2410c'};">
              ${mealName}
            </span>
          </td>
          <td style="padding: 9px 12px; text-align: center; color: #374151;">${qtyText}</td>
          <td style="padding: 9px 12px; font-size: 12px; color: #4b5563;">${extraDetails}</td>
          <td style="padding: 9px 12px; font-size: 12px; color: #6b7280;">${e.notes ? e.notes : (isSkipped ? 'No one took tiffin' : '-')}</td>
          <td style="padding: 9px 12px; text-align: right; font-weight: 700; color: ${isSkipped ? '#9ca3af' : '#111827'};">₹${e.totalPrice || 0}</td>
        </tr>
      `;
    })
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${groupName} - Tiffin Report</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #111827;
            margin: 0;
            padding: 0;
            background-color: #ffffff;
            -webkit-print-color-adjust: exact;
          }
          .header-banner {
            background: linear-gradient(135deg, #ea580c 0%, #f97316 100%);
            border-radius: 14px;
            padding: 24px;
            color: #ffffff;
            margin-bottom: 24px;
          }
          .header-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          .brand-title {
            font-size: 24px;
            font-weight: 900;
            letter-spacing: -0.5px;
            margin: 0 0 4px 0;
          }
          .brand-sub {
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 1px;
            text-transform: uppercase;
            opacity: 0.9;
          }
          .group-name {
            font-size: 20px;
            font-weight: 800;
            margin: 0 0 4px 0;
            text-align: right;
          }
          .period-badge {
            background-color: rgba(255, 255, 255, 0.25);
            padding: 4px 10px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 700;
            display: inline-block;
          }
          .meta-row {
            margin-top: 14px;
            padding-top: 12px;
            border-top: 1px solid rgba(255, 255, 255, 0.2);
            font-size: 11px;
            display: flex;
            justify-content: space-between;
            opacity: 0.9;
          }
          .metrics-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 24px;
          }
          .metric-card {
            background-color: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 14px;
            text-align: center;
          }
          .metric-val {
            font-size: 20px;
            font-weight: 800;
            color: #ea580c;
            margin-bottom: 4px;
          }
          .metric-lbl {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            color: #6b7280;
            letter-spacing: 0.5px;
          }
          .section-title {
            font-size: 16px;
            font-weight: 800;
            color: #111827;
            margin: 20px 0 10px 0;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .section-sub {
            font-size: 12px;
            color: #6b7280;
            margin-bottom: 12px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin-bottom: 20px;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            overflow: hidden;
          }
          th {
            background-color: #f3f4f6;
            color: #374151;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 10px;
            letter-spacing: 0.5px;
            padding: 10px 12px;
          }
          .total-footer {
            background-color: #fff7ed;
            border-top: 2px solid #fdba74;
            font-weight: 800;
          }
          .footer-note {
            margin-top: 30px;
            padding-top: 14px;
            border-top: 1px solid #e5e7eb;
            font-size: 11px;
            color: #9ca3af;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <!-- Header Banner -->
        <div class="header-banner">
          <div class="header-top">
            <div>
              <div class="brand-title">XpenseFlow</div>
              <div class="brand-sub">TIFFIN TRACK & EXPENSE AUDIT</div>
            </div>
            <div style="text-align: right;">
              <div class="group-name">${groupName}</div>
              <div class="period-badge">Period: ${monthLabel}</div>
            </div>
          </div>
          <div class="meta-row">
            <span>Official Mess Monthly Summary Report</span>
            <span>Generated on: ${generatedDateStr}</span>
          </div>
        </div>

        <!-- 4 Summary Metrics -->
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-val">₹${activeRate}</div>
            <div class="metric-lbl">Rate / Meal</div>
          </div>
          <div class="metric-card">
            <div class="metric-val">${totalMeals}</div>
            <div class="metric-lbl">Total Meals</div>
          </div>
          <div class="metric-card">
            <div class="metric-val">₹${totalCost.toLocaleString('en-IN')}</div>
            <div class="metric-lbl">Total Group Bill</div>
          </div>
          <div class="metric-card">
            <div class="metric-val">${memberCount}</div>
            <div class="metric-lbl">Active Members</div>
          </div>
        </div>

        <!-- Member Dues Table -->
        <div class="section-title">👥 Individual Member Logs & Dues (${monthLabel})</div>
        <div class="section-sub">Base shared meals split evenly among members + guest extra tiffins billed directly to individuals.</div>
        <table>
          <thead>
            <tr>
              <th style="text-align: left;">Member</th>
              <th style="text-align: center;">Meals Eaten</th>
              <th style="text-align: center;">Extra Tiffins</th>
              <th style="text-align: right;">Base Share</th>
              <th style="text-align: right;">Extra Cost</th>
              <th style="text-align: right;">Total Due</th>
            </tr>
          </thead>
          <tbody>
            ${memberRowsHtml || '<tr><td colspan="6" style="padding: 16px; text-align: center; color: #9ca3af;">No member expenses recorded for this month.</td></tr>'}
            <tr class="total-footer">
              <td colspan="5" style="padding: 12px; font-size: 13px; color: #111827;">Total Group Due for ${monthLabel}:</td>
              <td style="padding: 12px; text-align: right; font-size: 16px; color: #ea580c;">₹${totalCost.toLocaleString('en-IN')}</td>
            </tr>
          </tbody>
        </table>

        <!-- Daily Ledger Table -->
        <div class="section-title">📋 Date-Wise Daily Meal Ledger (${entries.length} records)</div>
        <div class="section-sub">Chronological audit of all breakfast, lunch, dinner, and zero-cost skipped meal entries.</div>
        <table>
          <thead>
            <tr>
              <th style="text-align: left;">Date</th>
              <th style="text-align: center;">Meal</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: left;">Member Extras (Guest/Brother)</th>
              <th style="text-align: left;">Notes</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${entryRowsHtml || '<tr><td colspan="6" style="padding: 16px; text-align: center; color: #9ca3af;">No daily meal logs recorded for this month.</td></tr>'}
          </tbody>
        </table>

        <!-- Footer -->
        <div class="footer-note">
          Generated securely with XpenseFlow Tiffin Tracker • Smart Group Meal Manager & Shared Ledger
        </div>
      </body>
    </html>
  `;

  // Generate printable PDF file with base64 for reliable native sharing
  const { uri: tempUri, base64 } = await Print.printToFileAsync({
    html,
    base64: true,
  });

  // Ensure file is in a share-permitted document/cache directory with a friendly file name
  const sanitizedGroup = (groupName || 'Tiffin').replace(/[^a-zA-Z0-9]/g, '_');
  const sanitizedMonth = (monthLabel || 'Report').replace(/[^a-zA-Z0-9]/g, '_');
  const targetPdfName = `XpenseFlow_${sanitizedGroup}_${sanitizedMonth}.pdf`;
  const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
  const targetUri = `${baseDir}${targetPdfName}`;

  let shareableUri = tempUri;
  if (base64) {
    try {
      await FileSystem.writeAsStringAsync(targetUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      shareableUri = targetUri;
    } catch (writeErr) {
      console.warn('Could not write base64 to documentDirectory, fallback to tempUri:', writeErr);
    }
  }

  // Ensure URI starts with file://
  if (!shareableUri.startsWith('file://')) {
    shareableUri = `file://${shareableUri}`;
  }

  // Share PDF via Native OS Share Sheet (WhatsApp, Email, Drive, Print)
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(shareableUri, {
      UTI: 'com.adobe.pdf',
      mimeType: 'application/pdf',
      dialogTitle: `Share ${groupName} Tiffin Report (${monthLabel})`,
    });
  }
};
