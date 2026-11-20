import PDFDocument from "pdfkit";

/**
 * Generates a professional, strictly single-page daily PDF report for a monitored API.
 *
 * Sections:
 *  1. Header: "APIWatch – Daily Report"
 *  2. API name / method / folder / URL, report date, health status badge
 *  3. KPI cards: availability, avg response time, total checks, failed checks
 *  4. Insights strip: peak hour, fastest hour, hours with failures, coverage
 *  5. Hourly average response-time chart (00:00–23:00 IST) with average line + legend
 *  6. Hourly breakdown table (two side-by-side columns)
 *  7. Footer
 *
 * Why this is guaranteed to stay on ONE page:
 *  - The bottom margin is 0, so pdfkit never auto-inserts a page when the footer
 *    is drawn close to the page edge (this was the cause of the 2nd page before).
 *  - Every text call uses absolute x/y coordinates and a fixed width.
 *  - A final check aborts with a clear error if a page was ever added.
 */

// ---------- Theme ----------
const C = {
  ink: "#0f172a",
  body: "#334155",
  muted: "#64748b",
  faint: "#94a3b8",
  line: "#e2e8f0",
  soft: "#f1f5f9",
  zebra: "#f8fafc",
  brand: "#059669",
  good: "#10b981",
  info: "#06b6d4",
  warn: "#f59e0b",
  bad: "#ef4444",
  goodText: "#059669",
  warnText: "#d97706",
  badText: "#dc2626",
  blueText: "#0284c7",
};

const STATUS_STYLES = {
  UP: { bg: "#dcfce7", border: "#86efac", text: "#166534" },
  SLOW: { bg: "#fef3c7", border: "#fde68a", text: "#92400e" },
  DOWN: { bg: "#fee2e2", border: "#fca5a5", text: "#991b1b" },
  PENDING: { bg: "#e2e8f0", border: "#cbd5e1", text: "#475569" },
};

// ---------- Helpers ----------
const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const fmtInt = (v) => Math.round(num(v)).toLocaleString("en-US");
const fmtMs = (v) => `${fmtInt(v)} ms`;
const pad2 = (h) => String(h).padStart(2, "0");

/** Round up to a "nice" 1-2-5-10 scale so 5 gridlines land on whole numbers. */
const niceCeil = (val) => {
  const v = Math.max(val, 50);
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 5, 10]) {
    if (v <= m * pow) return m * pow;
  }
  return 10 * pow;
};

/** Normalise whatever the caller passes into exactly 24 clean hour buckets. */
const normaliseHours = (hourlyStats) =>
  Array.from({ length: 24 }, (_, h) => {
    const src = (hourlyStats && hourlyStats[h]) || {};
    return {
      hour: h,
      avgLatency: Math.round(num(src.avgLatency)),
      count: num(src.count),
      failedCount: num(src.failedCount),
    };
  });

export async function generateDailyPdfReport({
  monitor = {},
  dateStr,
  formattedDate = dateStr || "",
  stats = {},
  hourlyStats = [],
}) {
  return new Promise((resolve, reject) => {
    try {
      const apiName = monitor.name || "API Monitor";

      const doc = new PDFDocument({
        size: "A4",
        // bottom: 0 -> footer text can sit near the edge without triggering a new page
        margins: { top: 36, left: 36, right: 36, bottom: 0 },
        autoFirstPage: true,
        info: {
          Title: `APIWatch Daily Report - ${apiName} - ${formattedDate}`,
          Author: "APIWatch Cloud Monitoring Platform",
          Subject: `Daily Health & Performance Report for ${apiName}`,
          Keywords: "API, Health, Monitoring, SLA, Report",
        },
      });

      // Safety net: if anything ever adds a page, fail loudly instead of shipping 2 pages.
      let pageCount = 1;
      doc.on("pageAdded", () => {
        pageCount += 1;
      });

      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => {
        if (pageCount !== 1) {
          return reject(new Error(`Daily report overflowed to ${pageCount} pages`));
        }
        resolve(Buffer.concat(chunks));
      });
      doc.on("error", reject);

      const pageWidth = doc.page.width; // 595.28
      const pageHeight = doc.page.height; // 841.89
      const margin = 36;
      const contentWidth = pageWidth - margin * 2; // ~523.28

      const hours = normaliseHours(hourlyStats);
      const withData = hours.filter((h) => h.count > 0);

      // ---- Derived numbers ----
      const totalChecks = num(stats.totalChecks);
      const failedChecks = num(stats.failedChecks);
      const successfulChecks = num(stats.successfulChecks, totalChecks - failedChecks);
      const hasChecks = totalChecks > 0;
      const availability = hasChecks
        ? num(stats.availabilityPercentage, (successfulChecks / totalChecks) * 100)
        : null;
      const avgLatency = Math.round(num(stats.avgLatency));
      const minLatency = Math.round(num(stats.minLatency));
      const maxLatency = Math.round(num(stats.maxLatency));

      const rawStatus = String(stats.healthStatus || monitor.currentStatus || "").toUpperCase();
      const status = STATUS_STYLES[rawStatus] ? rawStatus : hasChecks ? "UP" : "PENDING";
      const st = STATUS_STYLES[status];

      // ==========================================
      // 1. Brand bar
      // ==========================================
      doc.rect(0, 0, pageWidth, 6).fill(C.brand);

      // ==========================================
      // 2. Header
      // ==========================================
      const headerY = 24;
      doc.font("Helvetica-Bold").fontSize(22).fillColor(C.ink);
      doc.text("APIWatch", margin, headerY, { continued: true, lineBreak: false });
      doc.fillColor(C.brand).text(" \u2013 Daily Report", { lineBreak: false });

      doc.font("Helvetica-Bold").fontSize(8).fillColor(C.brand);
      doc.text("API MONITORING REPORT", margin, headerY + 30, {
        width: 200,
        lineBreak: false,
      });

      // Right-aligned generation stamp
      const generatedAt = new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      doc.font("Helvetica").fontSize(7.5).fillColor(C.faint);
      doc.text(`Generated ${generatedAt} IST`, margin + contentWidth - 200, headerY + 4, {
        width: 200,
        align: "right",
        lineBreak: false,
      });

      doc
        .strokeColor(C.line)
        .lineWidth(1)
        .moveTo(margin, headerY + 46)
        .lineTo(margin + contentWidth, headerY + 46)
        .stroke();

      // ==========================================
      // 3. API & report metadata box
      // ==========================================
      const metaY = headerY + 56;
      const metaH = 72;
      doc.roundedRect(margin, metaY, contentWidth, metaH, 5).fillAndStroke("#f8fafc", C.line);

      // Status-colored accent on the left edge of the box
      doc.roundedRect(margin, metaY, 4, metaH, 2).fill(st.text);

      const leftX = margin + 16;
      doc.font("Helvetica-Bold").fontSize(13).fillColor(C.ink);
      doc.text(apiName, leftX, metaY + 11, { width: 310, height: 16, ellipsis: true });

      doc.font("Helvetica").fontSize(8.5).fillColor("#475569");
      doc.text(
        `[${monitor.method || "GET"}]  \u2022  Folder: ${monitor.folder || "General"}  \u2022  ID: ${monitor.id ?? "\u2014"}`,
        leftX,
        metaY + 31,
        { width: 320, height: 11, ellipsis: true }
      );

      doc.font("Courier").fontSize(8).fillColor(C.muted);
      doc.text(monitor.url || "", leftX, metaY + 48, { width: 320, height: 11, ellipsis: true });

      const rightX = margin + 360;
      doc.font("Helvetica").fontSize(7.5).fillColor(C.muted);
      doc.text("REPORT DATE", rightX, metaY + 11, { width: 140, lineBreak: false });
      doc.font("Helvetica-Bold").fontSize(11).fillColor(C.ink);
      doc.text(formattedDate, rightX, metaY + 22, { width: 150, lineBreak: false });

      const badgeW = 104;
      const badgeH = 20;
      const badgeY = metaY + 43;
      doc.roundedRect(rightX, badgeY, badgeW, badgeH, 4).fillAndStroke(st.bg, st.border);
      doc.font("Helvetica-Bold").fontSize(9).fillColor(st.text);
      doc.text(`STATUS: ${status}`, rightX, badgeY + 5.5, {
        width: badgeW,
        align: "center",
        lineBreak: false,
      });

      // ==========================================
      // 4. KPI cards
      // ==========================================
      const cardsY = metaY + metaH + 12;
      const cardH = 62;
      const gap = 9;
      const cardW = (contentWidth - gap * 3) / 4;

      const availColor = availability === null ? C.faint : availability >= 99 ? C.goodText : C.badText;
      const kpis = [
        {
          label: "AVAILABILITY",
          value: availability === null ? "\u2014" : `${Number(availability.toFixed(2))}%`,
          sub: `${fmtInt(successfulChecks)} / ${fmtInt(totalChecks)} checks up`,
          color: availColor,
        },
        {
          label: "AVG RESPONSE TIME",
          value: fmtMs(avgLatency),
          sub: `Min ${fmtInt(minLatency)} ms  |  Max ${fmtInt(maxLatency)} ms`,
          color: avgLatency > 2000 ? C.warnText : C.blueText,
        },
        {
          label: "TOTAL CHECKS",
          value: fmtInt(totalChecks),
          sub: `Across ${withData.length} of 24 hours`,
          color: C.ink,
        },
        {
          label: "FAILED CHECKS",
          value: fmtInt(failedChecks),
          sub: failedChecks === 0 ? "Zero outages recorded" : "Errors recorded",
          color: failedChecks > 0 ? C.badText : C.goodText,
        },
      ];

      kpis.forEach((k, i) => {
        const x = margin + i * (cardW + gap);
        doc.roundedRect(x, cardsY, cardW, cardH, 5).fillAndStroke("#ffffff", C.line);
        doc.rect(x + 8, cardsY, 22, 2).fill(k.color); // small colored tab on top

        doc.font("Helvetica-Bold").fontSize(7).fillColor(C.muted);
        doc.text(k.label, x + 10, cardsY + 10, { width: cardW - 20, lineBreak: false });

        doc.font("Helvetica-Bold").fontSize(16).fillColor(k.color);
        doc.text(k.value, x + 10, cardsY + 23, { width: cardW - 20, lineBreak: false });

        doc.font("Helvetica").fontSize(6.8).fillColor(C.faint);
        doc.text(k.sub, x + 10, cardsY + 46, { width: cardW - 20, height: 9, ellipsis: true });
      });

      // ==========================================
      // 5. Insights strip
      // ==========================================
      const insY = cardsY + cardH + 12;
      const insH = 34;
      doc.roundedRect(margin, insY, contentWidth, insH, 5).fillAndStroke(C.zebra, C.line);

      const latencyHours = withData.filter((h) => h.avgLatency > 0);
      const peak = latencyHours.length
        ? latencyHours.reduce((a, b) => (b.avgLatency > a.avgLatency ? b : a))
        : null;
      const best = latencyHours.length
        ? latencyHours.reduce((a, b) => (b.avgLatency < a.avgLatency ? b : a))
        : null;
      const failHours = hours.filter((h) => h.failedCount > 0).length;

      const insights = [
        {
          label: "PEAK LATENCY HOUR",
          value: peak ? `${pad2(peak.hour)}:00 \u2022 ${fmtMs(peak.avgLatency)}` : "\u2014",
        },
        {
          label: "FASTEST HOUR",
          value: best ? `${pad2(best.hour)}:00 \u2022 ${fmtMs(best.avgLatency)}` : "\u2014",
        },
        {
          label: "HOURS WITH FAILURES",
          value: `${failHours} of 24`,
        },
        {
          label: "MONITORING COVERAGE",
          value: `${Math.round((withData.length / 24) * 100)}%`,
        },
      ];

      const insW = contentWidth / insights.length;
      insights.forEach((it, i) => {
        const x = margin + i * insW;
        if (i > 0) {
          doc.strokeColor(C.line).lineWidth(0.8).moveTo(x, insY + 6).lineTo(x, insY + insH - 6).stroke();
        }
        doc.font("Helvetica-Bold").fontSize(6.3).fillColor(C.muted);
        doc.text(it.label, x + 12, insY + 7, { width: insW - 16, lineBreak: false });
        doc.font("Helvetica-Bold").fontSize(9).fillColor(C.ink);
        doc.text(it.value, x + 12, insY + 18, { width: insW - 16, lineBreak: false });
      });

      // ==========================================
      // 6. Hourly response-time chart
      // ==========================================
      const chartTitleY = insY + insH + 14;
      doc.font("Helvetica-Bold").fontSize(10.5).fillColor(C.ink);
      doc.text("Response Time Throughout the Day (00:00 to 23:00 IST)", margin, chartTitleY, {
        width: contentWidth,
        lineBreak: false,
      });
      doc.font("Helvetica").fontSize(7.5).fillColor(C.muted);
      doc.text("Hourly average response time in milliseconds across 24 hours", margin, chartTitleY + 14, {
        width: contentWidth,
        lineBreak: false,
      });

      const chartBoxY = chartTitleY + 29;
      const chartBoxH = 196;
      doc.roundedRect(margin, chartBoxY, contentWidth, chartBoxH, 5).fillAndStroke("#ffffff", C.line);

      const maxHourLatency = hours.reduce((m, h) => Math.max(m, h.avgLatency), 0);
      const maxScale = niceCeil(maxHourLatency * 1.08);

      const innerX = margin + 46;
      const innerY = chartBoxY + 16;
      const innerW = contentWidth - 60;
      const innerH = 134;
      const baseY = innerY + innerH;

      // Gridlines + Y labels
      const gridSteps = 5;
      for (let s = 0; s <= gridSteps; s++) {
        const ratio = s / gridSteps;
        const y = baseY - ratio * innerH;

        doc.font("Helvetica").fontSize(6.5).fillColor(C.faint);
        doc.text(`${Math.round(ratio * maxScale).toLocaleString("en-US")} ms`, margin + 4, y - 3, {
          width: 38,
          align: "right",
          lineBreak: false,
        });

        doc.save();
        doc.strokeColor(s === 0 ? "#cbd5e1" : C.soft).lineWidth(s === 0 ? 1 : 0.8);
        if (s > 0) doc.dash(3, { space: 3 });
        doc.moveTo(innerX, y).lineTo(innerX + innerW, y).stroke();
        doc.undash();
        doc.restore();
      }

      // Bars
      const slotW = innerW / 24;
      const barW = Math.max(Math.min(slotW - 5, 14), 6);

      hours.forEach((h) => {
        const cx = innerX + h.hour * slotW + slotW / 2;
        const bx = cx - barW / 2;

        if (h.count > 0 && h.avgLatency > 0) {
          const bh = Math.min(Math.max((h.avgLatency / maxScale) * innerH, 3), innerH);
          const by = baseY - bh;

          let fill = C.good;
          if (h.failedCount > 0) fill = C.bad;
          else if (h.avgLatency > 2000) fill = C.warn;
          else if (h.avgLatency > 500) fill = C.info;

          doc.roundedRect(bx, by, barW, bh, Math.min(2, barW / 3)).fill(fill);

          // Value label above bar (only if there is room above the bar)
          if (by - innerY > 9) {
            doc.font("Helvetica").fontSize(5.6).fillColor(C.muted);
            doc.text(String(h.avgLatency), cx - slotW / 2, by - 8, {
              width: slotW,
              align: "center",
              lineBreak: false,
            });
          }
        } else if (h.count > 0) {
          doc.rect(bx, baseY - 2, barW, 2).fill(C.good);
        } else {
          doc.rect(cx - 1, baseY - 1, 2, 2).fill("#cbd5e1"); // no checks in this hour
        }

        // X labels every 3 hours, plus the last hour
        if (h.hour % 3 === 0 || h.hour === 23) {
          doc.font("Helvetica").fontSize(6.3).fillColor(C.muted);
          doc.text(`${pad2(h.hour)}:00`, cx - 12, baseY + 5, {
            width: 24,
            align: "center",
            lineBreak: false,
          });
        }
      });

      // Daily average reference line
      if (avgLatency > 0 && avgLatency <= maxScale) {
        const ay = baseY - (avgLatency / maxScale) * innerH;
        doc.save();
        doc.strokeColor("#475569").lineWidth(0.8).dash(4, { space: 3 });
        doc.moveTo(innerX, ay).lineTo(innerX + innerW, ay).stroke();
        doc.undash();
        doc.restore();

        const tag = `avg ${fmtInt(avgLatency)} ms`;
        const tagW = 52;
        doc.roundedRect(innerX + innerW - tagW, ay - 10, tagW, 9, 2).fill("#475569");
        doc.font("Helvetica-Bold").fontSize(5.8).fillColor("#ffffff");
        doc.text(tag, innerX + innerW - tagW, ay - 8.2, { width: tagW, align: "center", lineBreak: false });
      }

      // Legend
      const legendY = chartBoxY + chartBoxH - 18;
      const legend = [
        [C.good, "Fast (\u2264 500 ms)"],
        [C.info, "Moderate (500\u20132000 ms)"],
        [C.warn, "Slow (> 2000 ms)"],
        [C.bad, "Failures in hour"],
        ["#cbd5e1", "No checks"],
      ];
      let lx = innerX;
      legend.forEach(([color, text]) => {
        doc.roundedRect(lx, legendY + 1.5, 7, 7, 1.5).fill(color);
        doc.font("Helvetica").fontSize(6.8).fillColor(C.muted);
        doc.text(text, lx + 11, legendY + 2, { width: 100, lineBreak: false });
        lx += 11 + doc.widthOfString(text) + 16;
      });

      // ==========================================
      // 7. Hourly breakdown table
      // ==========================================
      const tableTitleY = chartBoxY + chartBoxH + 14;
      doc.font("Helvetica-Bold").fontSize(10.5).fillColor(C.ink);
      doc.text("Hourly Performance Breakdown (Asia/Kolkata IST)", margin, tableTitleY, {
        width: contentWidth,
        lineBreak: false,
      });

      const tableY = tableTitleY + 18;
      const colW = (contentWidth - 12) / 2;
      const headH = 16;
      const rowH = 14.5;

      const renderColumn = (startHour, endHour, x) => {
        doc.roundedRect(x, tableY, colW, headH, 3).fill(C.soft);
        doc.font("Helvetica-Bold").fontSize(6.5).fillColor("#475569");
        doc.text("HOUR (IST)", x + 8, tableY + 5, { width: 60, lineBreak: false });
        doc.text("CHECKS", x + 70, tableY + 5, { width: 45, align: "right", lineBreak: false });
        doc.text("AVG LATENCY", x + 122, tableY + 5, { width: 62, align: "right", lineBreak: false });
        doc.text("FAILURES", x + colW - 62, tableY + 5, { width: 54, align: "right", lineBreak: false });

        for (let h = startHour; h <= endHour; h++) {
          const d = hours[h];
          const rowY = tableY + headH + (h - startHour) * rowH;

          if ((h - startHour) % 2 === 0) doc.rect(x, rowY, colW, rowH).fill(C.zebra);

          doc.font("Helvetica").fontSize(7).fillColor(C.body);
          doc.text(`${pad2(h)}:00 - ${pad2(h)}:59`, x + 8, rowY + 3.8, { width: 62, lineBreak: false });

          doc.font("Helvetica").fontSize(7).fillColor(d.count > 0 ? C.ink : C.faint);
          doc.text(d.count > 0 ? fmtInt(d.count) : "\u2014", x + 70, rowY + 3.8, {
            width: 45,
            align: "right",
            lineBreak: false,
          });

          let latColor = C.ink;
          if (d.count === 0) latColor = C.faint;
          else if (d.avgLatency > 2000) latColor = C.warnText;
          doc.font("Helvetica").fontSize(7).fillColor(latColor);
          doc.text(d.count > 0 ? fmtMs(d.avgLatency) : "\u2014", x + 122, rowY + 3.8, {
            width: 62,
            align: "right",
            lineBreak: false,
          });

          doc
            .font("Helvetica-Bold")
            .fontSize(7)
            .fillColor(d.count === 0 ? C.faint : d.failedCount > 0 ? C.badText : C.goodText);
          doc.text(d.count > 0 ? fmtInt(d.failedCount) : "\u2014", x + colW - 62, rowY + 3.8, {
            width: 54,
            align: "right",
            lineBreak: false,
          });
        }

        const totalH = headH + (endHour - startHour + 1) * rowH;
        doc.roundedRect(x, tableY, colW, totalH, 3).strokeColor(C.line).lineWidth(0.8).stroke();
      };

      renderColumn(0, 11, margin);
      renderColumn(12, 23, margin + colW + 12);

      // ==========================================
      // 8. Footer (pinned to the bottom of the page)
      // ==========================================
      const footerY = pageHeight - 36;
      doc
        .strokeColor(C.line)
        .lineWidth(0.8)
        .moveTo(margin, footerY)
        .lineTo(margin + contentWidth, footerY)
        .stroke();

      doc.font("Helvetica").fontSize(7).fillColor(C.faint);
      doc.text(
        "Generated by APIWatch Platform \u2022 Timezone: Asia/Kolkata (IST) \u2022 Audit & SLA Verification Report",
        margin,
        footerY + 8,
        { width: contentWidth - 150, lineBreak: false }
      );

      doc.font("Helvetica-Bold").fontSize(7).fillColor(C.muted);
      doc.text("Page 1 of 1 \u2022 Official Daily Audit", margin + contentWidth - 150, footerY + 8, {
        width: 150,
        align: "right",
        lineBreak: false,
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export default generateDailyPdfReport;