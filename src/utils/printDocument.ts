import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

export interface PrintOptions {
  title?: string;
  format?: 'a4' | 'thermal';
  element?: HTMLElement | null;
  elementId?: string;
  filename?: string;
}

/**
 * Collect all active stylesheets and CSS rules from the main document.
 */
function getDocumentStyles(): string {
  let styles = '';
  try {
    const styleTags = document.querySelectorAll('style, link[rel="stylesheet"]');
    styleTags.forEach(tag => {
      if (tag.tagName.toLowerCase() === 'style') {
        styles += tag.outerHTML + '\n';
      } else if (tag.tagName.toLowerCase() === 'link') {
        styles += tag.outerHTML + '\n';
      }
    });
  } catch (e) {
    console.warn('Could not extract all document styles:', e);
  }
  return styles;
}

/**
 * Bulletproof print function:
 * 1. Tries hidden iframe print (doesn't disturb current page UI).
 * 2. Falls back to window.print() if iframe print fails.
 * 3. Falls back to opening a dedicated printable tab/window or direct PDF export if sandbox blocks printing.
 */
export async function printElement(options: PrintOptions): Promise<{ success: boolean; fallbackUsed?: boolean; error?: string }> {
  const { title = 'Document', format = 'a4', elementId, filename = 'document' } = options;
  const targetElement = options.element || (elementId ? document.getElementById(elementId) : null);

  if (!targetElement) {
    console.error('printElement: Target element not found');
    return { success: false, error: 'Target element not found' };
  }

  const documentStyles = getDocumentStyles();
  const isThermal = format === 'thermal';

  const printCss = `
    @page {
      size: ${isThermal ? '80mm auto' : 'A4 portrait'};
      margin: ${isThermal ? '2mm 3mm' : '10mm 14mm'};
    }
    *, *::before, *::after {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: ${isThermal ? 'monospace, "Courier New", Courier, monospace' : 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'} !important;
      font-size: ${isThermal ? '10px' : '12px'} !important;
      line-height: ${isThermal ? '1.35' : '1.5'} !important;
    }
    body {
      width: ${isThermal ? '72mm' : '100%'} !important;
      max-width: ${isThermal ? '72mm' : '210mm'} !important;
      margin: 0 auto !important;
      padding: ${isThermal ? '2mm' : '8px'} !important;
    }
    .no-print, button, .receipt-actions {
      display: none !important;
    }
    table {
      width: 100% !important;
      border-collapse: collapse !important;
    }
    img {
      max-width: 100% !important;
    }
    /* Ensure borders and backgrounds print cleanly */
    .border, [class*="border-"] {
      border-color: #cbd5e1 !important;
    }
    .bg-muted, .bg-muted\\/40, .bg-muted\\/50 {
      background-color: #f1f5f9 !important;
    }
    .text-muted-foreground {
      color: #475569 !important;
    }
    .text-foreground {
      color: #0f172a !important;
    }
    .badge {
      border: 1px solid #cbd5e1 !important;
    }
  `;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title}</title>
        ${documentStyles}
        <style>
          ${printCss}
        </style>
      </head>
      <body>
        ${targetElement.outerHTML}
      </body>
    </html>
  `;

  // Strategy 1: Hidden Iframe Printing (best UX, isolates print from modal/UI)
  try {
    let iframe = document.getElementById('__isolated_print_frame__') as HTMLIFrameElement;
    if (iframe) {
      iframe.remove();
    }

    iframe = document.createElement('iframe');
    iframe.id = '__isolated_print_frame__';
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = isThermal ? '80mm' : '210mm';
    iframe.style.height = '1000px';
    iframe.style.border = '0';
    iframe.style.opacity = '0.01';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>${title}</title>
            ${documentStyles}
            <style>
              ${printCss}
            </style>
          </head>
          <body>
            ${targetElement.outerHTML}
            <script>
              window.addEventListener('load', function() {
                setTimeout(function() {
                  try {
                    window.focus();
                    window.print();
                  } catch (e) {
                    console.warn('iframe auto-print exception:', e);
                  }
                }, 200);
              });
            </script>
          </body>
        </html>
      `);
      iframeDoc.close();

      // Wait for assets/images to load
      await new Promise(resolve => setTimeout(resolve, 300));

      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => {
          try {
            iframe.remove();
          } catch (_) {}
        }, 5000);
        return { success: true };
      }
    }
  } catch (iframeErr: any) {
    console.warn('Iframe print failed or was blocked by sandbox:', iframeErr);
  }

  // Strategy 2: Popup / Clean Tab with printable HTML blob (Best for Thermal POS printers)
  try {
    const blobHtml = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${title}</title>
          ${documentStyles}
          <style>
            ${printCss}
            .print-prompt-bar {
              background: #f1f5f9;
              border-bottom: 1px solid #cbd5e1;
              padding: 10px;
              text-align: center;
              font-family: sans-serif;
              font-size: 13px;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 12px;
            }
            .print-prompt-bar button {
              padding: 6px 16px;
              background: #0284c7;
              color: #ffffff;
              font-weight: bold;
              border: none;
              border-radius: 6px;
              cursor: pointer;
            }
            @media print {
              .print-prompt-bar { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="print-prompt-bar">
            <span>Select your printer (e.g. Thermal 80mm/58mm or standard):</span>
            <button onclick="window.print()">Print Document</button>
          </div>
          ${targetElement.outerHTML}
          <script>
            window.addEventListener('load', function() {
              setTimeout(function() {
                try {
                  window.focus();
                  window.print();
                } catch(e) {}
              }, 250);
            });
          </script>
        </body>
      </html>
    `;
    const blob = new Blob([blobHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank', isThermal ? 'width=450,height=700' : 'width=850,height=900');
    if (win) {
      win.focus();
      return { success: true, fallbackUsed: true };
    }
  } catch (popupErr: any) {
    console.warn('Popup print fallback failed:', popupErr);
  }

  // Strategy 3: Direct window.print() fallback
  try {
    window.print();
    return { success: true };
  } catch (winPrintErr: any) {
    console.warn('Direct window.print() failed:', winPrintErr);
  }

  // Strategy 4: Direct PDF Export fallback
  try {
    await exportElementToPdf(targetElement, filename, format);
    return { success: true, fallbackUsed: true };
  } catch (pdfErr: any) {
    console.error('All printing and PDF export strategies failed:', pdfErr);
    return { success: false, error: 'Printing blocked by browser environment' };
  }
}

/**
 * High-quality client-side PDF export using html2canvas and jsPDF.
 * Bypasses browser print dialog entirely and directly downloads a clean .pdf file.
 */
export async function exportElementToPdf(
  element: HTMLElement,
  filename: string = 'document',
  format: 'a4' | 'thermal' = 'a4'
): Promise<void> {
  const isThermal = format === 'thermal';

  // Clone element to avoid modifying the screen DOM
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.position = 'fixed';
  clone.style.left = '-9999px';
  clone.style.top = '0';
  clone.style.background = '#ffffff';
  clone.style.color = '#000000';
  clone.style.boxShadow = 'none';
  clone.style.border = 'none';
  clone.style.width = isThermal ? '320px' : '794px'; // ~80mm or A4 width in px @ 96dpi
  clone.style.padding = isThermal ? '12px' : '28px';
  clone.style.zIndex = '-9999';
  clone.style.display = 'block';
  clone.style.visibility = 'visible';

  // Remove any no-print / action buttons in clone
  clone.querySelectorAll('.no-print, button, .receipt-actions').forEach(el => el.remove());

  document.body.appendChild(clone);

  try {
    const canvas = await html2canvas(clone, {
      scale: 2, // 2x resolution for crisp text
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: isThermal ? 360 : 1024,
    });

    const imgData = canvas.toDataURL('image/png');

    if (isThermal) {
      // 80mm roll: dynamic height based on aspect ratio
      const pdfWidth = 80;
      const pdfHeight = Math.max(80, (canvas.height * pdfWidth) / canvas.width);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [pdfWidth, pdfHeight],
      });
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${filename.replace(/\.pdf$/i, '')}.pdf`);
    } else {
      // Standard A4 portrait
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const contentHeight = (canvas.height * pdfWidth) / canvas.width;

      if (contentHeight <= pdfHeight) {
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, contentHeight);
      } else {
        // Multi-page slicing for longer documents (e.g. detailed statement of account)
        let heightLeft = contentHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, contentHeight);
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
          position -= pdfHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, contentHeight);
          heightLeft -= pdfHeight;
        }
      }

      pdf.save(`${filename.replace(/\.pdf$/i, '')}.pdf`);
    }
  } finally {
    clone.remove();
  }
}
