import { Income } from '../types';

export interface ThermalOptions {
  paperWidth: '80mm' | '58mm';
  baudRate: number; // 9600, 19200, 38400, 115200
  cutPaper: boolean;
  openCashDrawer: boolean;
  feedLines: number;
}

export const DEFAULT_THERMAL_OPTIONS: ThermalOptions = {
  paperWidth: '80mm',
  baudRate: 9600,
  cutPaper: true,
  openCashDrawer: false,
  feedLines: 2,
};

/**
 * Generate a clean, 1-bit high-contrast black-and-white monochrome image
 * for thermal printers using HTML5 Canvas and Floyd-Steinberg error diffusion dithering.
 * Eliminates blurry midtones, gradients, and muddy gray artifacts on thermal paper rolls.
 */
export async function generateMonochromeThermalLogo(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    if (!imageUrl || typeof document === 'undefined') {
      resolve(imageUrl || '');
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        // Limit width to 384px (standard 80mm thermal printhead resolution)
        const maxWidth = 384;
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageUrl);
          return;
        }

        // Fill background with solid white (thermal paper base)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // Render source image
        ctx.drawImage(img, 0, 0, width, height);

        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // Step 1: Alpha compositing, Grayscale conversion & Contrast expansion
        const gray = new Float32Array(width * height);
        for (let i = 0; i < width * height; i++) {
          const idx = i * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const a = data[idx + 3] / 255;

          // Composite onto white background
          const compR = r * a + 255 * (1 - a);
          const compG = g * a + 255 * (1 - a);
          const compB = b * a + 255 * (1 - a);

          // Standard ITU-R BT.601 perceptual luminance
          let luma = 0.299 * compR + 0.587 * compG + 0.114 * compB;

          // Apply contrast boost centered around 128
          const contrast = 1.35;
          luma = (luma - 128) * contrast + 128;
          gray[i] = Math.max(0, Math.min(255, luma));
        }

        // Step 2: Floyd-Steinberg error diffusion dithering
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const oldVal = gray[idx];
            const newVal = oldVal < 145 ? 0 : 255;
            gray[idx] = newVal;
            const err = oldVal - newVal;

            if (x + 1 < width) {
              gray[y * width + (x + 1)] += (err * 7) / 16;
            }
            if (x - 1 >= 0 && y + 1 < height) {
              gray[(y + 1) * width + (x - 1)] += (err * 3) / 16;
            }
            if (y + 1 < height) {
              gray[(y + 1) * width + x] += (err * 5) / 16;
            }
            if (x + 1 < width && y + 1 < height) {
              gray[(y + 1) * width + (x + 1)] += (err * 1) / 16;
            }
          }
        }

        // Step 3: Write pure 1-bit monochrome pixels back
        for (let i = 0; i < width * height; i++) {
          const val = gray[i] < 128 ? 0 : 255;
          const idx = i * 4;
          data[idx] = val;
          data[idx + 1] = val;
          data[idx + 2] = val;
          data[idx + 3] = 255; // fully opaque
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        console.warn('Thermal monochrome logo generation failed, falling back:', err);
        resolve(imageUrl);
      }
    };
    img.onerror = () => {
      resolve(imageUrl);
    };
    img.src = imageUrl;
  });
}

/**
 * Check if Web Serial API is supported in current browser (Chrome, Edge, Opera).
 */
export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

/**
 * Check if WebUSB API is supported in current browser.
 */
export function isWebUsbSupported(): boolean {
  return typeof navigator !== 'undefined' && 'usb' in navigator;
}

/**
 * Format two columns of text to fit exact printer character width.
 * 80mm thermal printers typically have 48 columns (Font A) or 42 columns.
 * 58mm thermal printers typically have 32 columns.
 */
function formatTwoColumns(left: string, right: string, maxCols: number): string {
  const leftStr = left || '';
  const rightStr = right || '';
  const spacesNeeded = maxCols - (leftStr.length + rightStr.length);

  if (spacesNeeded >= 1) {
    return leftStr + ' '.repeat(spacesNeeded) + rightStr;
  }
  // If too long to fit on one line, return left on one line and right right-aligned on next
  const indent = Math.max(0, maxCols - rightStr.length);
  return `${leftStr}\n${' '.repeat(indent)}${rightStr}`;
}

/**
 * Build standard ESC/POS binary command buffer for 80mm or 58mm thermal receipt printer.
 */
export function buildEscPosReceipt(
  receipt: Income,
  settings: any,
  options: Partial<ThermalOptions> = {}
): Uint8Array {
  const opts = { ...DEFAULT_THERMAL_OPTIONS, ...options };
  const cols = opts.paperWidth === '80mm' ? 48 : 32;
  const divider = '-'.repeat(cols);
  const doubleDivider = '='.repeat(cols);

  const bytes: number[] = [];

  // Helper pushers
  const push = (...b: number[]) => bytes.push(...b);
  const pushText = (text: string) => {
    // Encode text as ASCII / latin1 bytes
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      // Map currency symbols or special characters if needed
      if (code <= 127) {
        bytes.push(code);
      } else {
        // Fallback for non-ASCII characters to prevent corrupting ESC/POS stream
        bytes.push(63); // '?'
      }
    }
  };
  const pushLine = (text: string = '') => {
    pushText(text);
    push(0x0a); // LF
  };

  // 1. Initialize printer
  push(0x1b, 0x40); // ESC @ (Reset/Init)

  // 2. Select Character Code Table 0 (PC437 Standard USA)
  push(0x1b, 0x74, 0x00);

  // 3. Header: Center aligned, Double height + width, Bold
  push(0x1b, 0x61, 0x01); // ESC a 1 (Center align)
  push(0x1b, 0x45, 0x01); // ESC E 1 (Bold ON)
  push(0x1d, 0x21, 0x11); // GS ! 0x11 (Double height & width)

  const schoolName = (settings.school_name || 'ELITE INTERNATIONAL SCHOOL').toUpperCase();
  pushLine(schoolName);

  // Normal text size for subtitle
  push(0x1d, 0x21, 0x00); // GS ! 0x00 (Normal size)
  push(0x1b, 0x45, 0x00); // ESC E 0 (Bold OFF)
  pushLine('FINANCE OFFICE');

  if (settings.address) {
    pushLine(settings.address);
  }
  const contactParts: string[] = [];
  if (settings.phone) contactParts.push(`Tel: ${settings.phone}`);
  if (settings.email) contactParts.push(settings.email);
  if (contactParts.length > 0) {
    pushLine(contactParts.join(' | '));
  }

  // Divider
  pushLine(divider);

  // 4. Receipt Metadata
  push(0x1b, 0x61, 0x00); // ESC a 0 (Left align)
  push(0x1b, 0x45, 0x00); // Bold OFF for normal labels
  pushLine(formatTwoColumns('RECEIPT NO:', receipt.receipt_no || 'OFFICE-REC', cols));
  pushLine(formatTwoColumns('DATE:', receipt.date || new Date().toISOString().split('T')[0], cols));
  pushLine(formatTwoColumns('TIME:', new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), cols));

  pushLine(divider);

  // 5. Payer & Student Information (Labels normal weight to prevent smudging on thermal paper)
  push(0x1b, 0x45, 0x00);
  pushText('RECEIVED FROM: ');
  pushLine(receipt.payer_name || 'N/A');

  if (receipt.student_first_name) {
    pushText('STUDENT: ');
    const stuLine = `${receipt.student_first_name} ${receipt.student_last_name || ''}${receipt.application_no ? ` (${receipt.application_no})` : ''}`;
    pushLine(stuLine);
  }

  pushText('PAYMENT METHOD: ');
  pushLine(receipt.payment_method || 'Cash');

  if (receipt.reference_no) {
    pushText('REF NO: ');
    pushLine(receipt.reference_no);
  }

  pushText('FEE CATEGORY: ');
  pushLine(receipt.source || 'Tuition / Admission Fee');

  if (receipt.notes) {
    pushText('NOTES: ');
    pushLine(receipt.notes);
  }

  pushLine(doubleDivider);

  // 6. Amount Received (Centered, Double-Size, Bold) - ONLY area with emphasis
  const currency = settings.currency_symbol || 'LKR';
  const formattedAmount = `${currency} ${Number(receipt.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  push(0x1b, 0x61, 0x01); // Center align
  push(0x1b, 0x45, 0x01); // Bold ON
  pushLine('AMOUNT RECEIVED:');

  push(0x1d, 0x21, 0x11); // Double height + width
  pushLine(formattedAmount);
  push(0x1d, 0x21, 0x00); // Normal size
  push(0x1b, 0x45, 0x00); // Bold OFF

  pushLine(doubleDivider);

  // 7. Cashier / Officer Info
  push(0x1b, 0x61, 0x00); // Left align
  const cashier = receipt.received_by_staff_name || 'Authorized Staff';
  pushLine(formatTwoColumns('CASHIER / STAFF:', cashier, cols));

  // 8. Signature & Official Stamp Section (compacted to prevent roll waste)
  push(0x1b, 0x61, 0x01); // Center align
  pushLine('___________________________________');
  pushLine('Authorized Cashier Signature & Stamp');

  // 9. Footer Notice
  const notice = settings.receipt_footer_notice || 'Thank you for your prompt remittance. Fees once paid are non-refundable.';
  pushLine(notice);
  pushLine('*** COMPUTER GENERATED OFFICIAL RECEIPT ***');

  // 10. Feed Lines (tightened from 4 to 2)
  for (let i = 0; i < opts.feedLines; i++) {
    push(0x0a);
  }

  // 11. Optional: Cash drawer kick (ESC p m t1 t2)
  if (opts.openCashDrawer) {
    push(0x1b, 0x70, 0x00, 0x19, 0xfa);
  }

  // 12. Paper Cut (GS V A n)
  if (opts.cutPaper) {
    push(0x1d, 0x56, 0x41, 0x03); // Feed paper and cut
  }

  return new Uint8Array(bytes);
}

/**
 * Generate a quick test ticket to verify thermal printer communication.
 */
export function buildTestTicket(settings: any, options: Partial<ThermalOptions> = {}): Uint8Array {
  const dummyIncome: Income = {
    id: 'test-rec',
    receipt_no: 'TEST-DIAG-001',
    date: new Date().toISOString().split('T')[0],
    amount: 100.0,
    source: 'Thermal Printer Diagnostic Test',
    payment_method: 'Cash',
    payer_name: 'Printer Diagnostic Self-Test',
    applicant_id: null,
    family_id: null,
    received_by_staff_id: null,
    received_by_staff_name: 'POS System Admin',
    reference_no: 'TEST-REF',
    notes: 'If this ticket prints cleanly, your thermal printer is connected and operational.',
    created_at: new Date().toISOString(),
  };

  return buildEscPosReceipt(dummyIncome, settings, options);
}

// Retain active SerialPort reference in memory so subsequent prints don't re-prompt
let activeSerialPort: any = null;

/**
 * Connect and print directly to a physical thermal printer via Web Serial API.
 * Standard across Google Chrome, Microsoft Edge, Opera.
 */
export async function printViaWebSerial(
  data: Uint8Array,
  baudRate: number = 9600
): Promise<{ success: boolean; message: string; error?: any }> {
  if (!isWebSerialSupported()) {
    return {
      success: false,
      message: 'Web Serial is not supported in this browser. Please use Google Chrome or Microsoft Edge for direct thermal printer connection, or use the Direct Print Window.',
    };
  }

  const serial = (navigator as any).serial;

  try {
    let port = activeSerialPort;

    // If we don't have an active open port, prompt user to select printer
    if (!port || !port.readable) {
      try {
        port = await serial.requestPort();
        activeSerialPort = port;
      } catch (reqErr: any) {
        if (reqErr.name === 'NotFoundError') {
          return { success: false, message: 'No printer device was selected.' };
        }
        throw reqErr;
      }
    }

    // Open port if not open
    if (!port.isOpen) {
      await port.open({
        baudRate: baudRate || 9600,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none',
      });
    }

    // Write ESC/POS bytes
    const writer = port.writable.getWriter();
    await writer.write(data);
    writer.releaseLock();

    return {
      success: true,
      message: 'Receipt sent to thermal printer successfully!',
    };
  } catch (err: any) {
    console.error('Web Serial print error:', err);
    // Reset active port if it became invalid
    activeSerialPort = null;
    return {
      success: false,
      message: err.message || 'Failed to send data to thermal printer port.',
      error: err,
    };
  }
}

/**
 * Disconnect/forget current active serial port.
 */
export async function disconnectWebSerial(): Promise<void> {
  if (activeSerialPort) {
    try {
      if (activeSerialPort.isOpen) {
        await activeSerialPort.close();
      }
    } catch (_) {}
    activeSerialPort = null;
  }
}

/**
 * Connect and print directly via WebUSB API.
 */
export async function printViaWebUsb(
  data: Uint8Array
): Promise<{ success: boolean; message: string; error?: any }> {
  if (!isWebUsbSupported()) {
    return {
      success: false,
      message: 'WebUSB is not supported in this browser.',
    };
  }

  const usb = (navigator as any).usb;

  try {
    const device = await usb.requestDevice({
      filters: [], // Allow selecting any connected USB device / POS printer
    });

    await device.open();
    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }

    // Locate printer interface
    const iface = device.configuration.interfaces[0];
    await device.claimInterface(iface.interfaceNumber);

    // Find out endpoint
    const outEndpoint = iface.alternate.endpoints.find(
      (e: any) => e.direction === 'out'
    );

    if (!outEndpoint) {
      throw new Error('Could not find USB OUT data endpoint on thermal printer.');
    }

    await device.transferOut(outEndpoint.endpointNumber, data);
    await device.close();

    return {
      success: true,
      message: 'Receipt sent directly to USB thermal printer!',
    };
  } catch (err: any) {
    console.error('WebUSB print error:', err);
    return {
      success: false,
      message: err.message || 'Failed to send data via WebUSB.',
      error: err,
    };
  }
}

/**
 * Trigger download of raw ESC/POS binary file (.bin).
 * Useful for command line printing (e.g. `copy /b receipt.bin PRN` or `lp -d Thermal receipt.bin`)
 * or mobile printing utilities (RawBT, PrintNode).
 */
export function downloadEscPosFile(data: Uint8Array, filename: string = 'receipt.bin'): void {
  const blob = new Blob([data], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.bin') ? filename : `${filename}.bin`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 500);
}

/**
 * Open a dedicated, clean, un-sandboxed printable window specifically tailored
 * for 80mm / 58mm thermal rolls.
 * This completely bypasses iframe sandboxing and ensures the browser's system printer dialog
 * detects the thermal printer with zero margins and crisp monochrome fonts.
 */
export function openThermalPrintWindow(
  receipt: Income,
  settings: any,
  paperWidth: '80mm' | '58mm' = '80mm'
): { success: boolean; window?: Window | null; message?: string } {
  const is80 = paperWidth === '80mm';
  const widthMm = is80 ? '72mm' : '48mm';
  const currency = settings.currency_symbol || 'LKR';
  const formattedAmount = `${currency} ${Number(receipt.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Receipt_${receipt.receipt_no}</title>
  <style>
    @page {
      size: ${paperWidth} auto;
      margin: 0;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: monospace, "Courier New", Courier, monospace;
      font-size: ${is80 ? '11px' : '9.5px'};
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .thermal-container {
      width: ${widthMm};
      margin: 0 auto;
      padding: 2mm 1.5mm;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .font-medium { font-weight: 500; }
    .font-large { font-size: ${is80 ? '14px' : '12px'}; }
    .divider { border-top: 1px dashed #000; margin: 3px 0; }
    .double-divider { border-top: 2px solid #000; margin: 3.5px 0; }
    .row { display: flex; justify-content: space-between; margin: 1.5px 0; }
    .field-label { font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500; color: #222; }
    .seal-box {
      width: 28mm;
      height: 16mm;
      border: 1px dashed #666;
      margin: 4px auto 3px auto;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 7.5px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .no-print {
      margin-bottom: 12px;
      padding: 8px;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      text-align: center;
      font-family: sans-serif;
      font-size: 12px;
    }
    @media print {
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()" style="padding: 6px 16px; font-weight: bold; background: #0284c7; color: #fff; border: none; border-radius: 4px; cursor: pointer;">
      Print to Thermal Printer
    </button>
    <div style="font-size: 10px; color: #64748b; margin-top: 4px;">
      Tip: In the print dialog, select your thermal printer (e.g. POS-80 / XP-80) and set Margins to "None".
    </div>
  </div>

  <div class="thermal-container">
    <div class="text-center">
      ${(settings.school_logo_url_thermal || settings.school_logo_url) ? `<img src="${settings.school_logo_url_thermal || settings.school_logo_url}" alt="Logo" style="max-width: 32mm; max-height: 16mm; margin: 0 auto 3px auto; display: block;" />` : ''}
      <div class="font-bold font-large">${(settings.school_name || 'ELITE INTERNATIONAL SCHOOL').toUpperCase()}</div>
      <div style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 1px;">Finance Office</div>
      ${settings.address ? `<div style="font-size: 8px; margin-top: 1px;">${settings.address}</div>` : ''}
      <div style="font-size: 8px;">
        ${settings.phone ? `Tel: ${settings.phone}` : ''} ${settings.email ? `• ${settings.email}` : ''}
      </div>
    </div>

    <div class="divider"></div>

    <div class="row">
      <span class="field-label">RECEIPT NO:</span>
      <span style="font-family: monospace;">${receipt.receipt_no}</span>
    </div>
    <div class="row">
      <span class="field-label">DATE:</span>
      <span>${receipt.date}</span>
    </div>
    <div class="row">
      <span class="field-label">TIME:</span>
      <span>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    </div>

    <div class="divider"></div>

    <div style="margin: 2px 0;">
      <div class="field-label">RECEIVED FROM:</div>
      <div>${receipt.payer_name}</div>
    </div>

    ${receipt.student_first_name ? `
    <div style="margin: 2px 0;">
      <div class="field-label">STUDENT:</div>
      <div>${receipt.student_first_name} ${receipt.student_last_name || ''} ${receipt.application_no ? `(${receipt.application_no})` : ''}</div>
    </div>` : ''}

    <div style="margin: 2px 0;">
      <span class="field-label">PAYMENT METHOD:</span> ${receipt.payment_method}
    </div>

    ${receipt.reference_no ? `
    <div style="margin: 2px 0;">
      <span class="field-label">REF NO:</span> ${receipt.reference_no}
    </div>` : ''}

    <div style="margin: 2px 0;">
      <span class="field-label">FEE CATEGORY:</span> ${receipt.source}
    </div>

    ${receipt.notes ? `
    <div style="margin: 2px 0;">
      <span class="field-label">NOTES:</span> ${receipt.notes}
    </div>` : ''}

    <div class="double-divider"></div>

    <div class="text-center" style="padding: 2.5px 0;">
      <div style="font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">AMOUNT RECEIVED</div>
      <div class="font-bold font-large" style="margin-top: 1px;">${formattedAmount}</div>
    </div>

    <div class="double-divider"></div>

    <div style="margin-top: 2.5px;">
      <span class="field-label">PROCESSED BY:</span> ${receipt.received_by_staff_name || 'Accounts Staff'}
    </div>

    <div class="text-center" style="margin-top: 8px;">
      <div style="width: 40mm; border-bottom: 1px solid #000; margin: 0 auto 2px auto;"></div>
      <span style="font-size: 7.5px; text-transform: uppercase; letter-spacing: 0.5px;">Cashier Signature</span>
    </div>

    <div class="seal-box">Official Seal</div>

    <div class="text-center" style="font-size: 7.5px; font-style: italic; margin-top: 4px; line-height: 1.2;">
      ${settings.receipt_footer_notice || 'Thank you for your prompt remittance. Fees once paid are non-refundable.'}
    </div>
  </div>

  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.print();
      }, 200);
    });
  </script>
</body>
</html>`;

  try {
    const printWindow = window.open('', '_blank', 'width=450,height=700');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      return { success: true, window: printWindow };
    }
  } catch (err: any) {
    console.warn('window.open blocked:', err);
  }

  // Fallback: create blob URL if window.open was blocked
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  const win = window.open(blobUrl, '_blank');

  if (win) {
    return { success: true, window: win };
  }

  return {
    success: false,
    message: 'Browser popup was blocked. Please allow popups or use direct USB/Serial printing.',
  };
}
