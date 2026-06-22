const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let browser = null;

  try {
    const { sowHTML, styles, filename } = JSON.parse(event.body);

    // Full HTML page with all styles embedded
    const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    /* Page setup */
    @page {
      size: A4;
      margin: 0;
    }
    @page :first {
      margin: 0;
    }
    @page :not(:first) {
      margin: 14mm 14mm 14mm 14mm;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background: white;
      font-family: 'Poppins', Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    /* Prevent page breaks inside key elements */
    tr, td, .sow-pricing-block, .sow-responsibility-block,
    .sow-tc-heading-inline, .sow-responsibility-section-label {
      page-break-inside: avoid;
    }
    .sow-tc-page-break { page-break-before: always; }
    .sow-billing-start  { page-break-before: always; }
    /* Cover: full bleed, no margin */
    .sow-cover { margin: 0 !important; padding: 0 !important; }
    .sow-cover-top-img { width: 100%; display: block; }
    .sow-cover-content {
      padding: 20px 60px 28px !important;
    }
    /* Body pages get margin via @page so we don't add padding here */
    .sow-body { padding: 0 !important; }
    /* Fix two-col table */
    .sow-tc-table { width: 100%; }
    .sow-tc-col-left, .sow-tc-col-right { vertical-align: top; }
    ${styles}
  </style>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet">
</head>
<body>
  <div class="sow-doc">
    ${sowHTML}
  </div>
</body>
</html>`;

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    // Set content and wait for fonts/images
    await page.setContent(fullHTML, { waitUntil: ['networkidle0', 'load'] });

    // Wait a little extra for web fonts
    await page.waitForTimeout(1500);

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      displayHeaderFooter: false,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename || 'TPL_SOW.pdf'}"`,
        'Content-Length': pdf.length.toString(),
      },
      body: pdf.toString('base64'),
      isBase64Encoded: true,
    };

  } catch (err) {
    console.error('PDF generation error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  } finally {
    if (browser) await browser.close();
  }
};
