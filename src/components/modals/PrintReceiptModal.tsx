import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';
import {
  X,
  Printer,
  Receipt,
  CheckCircle,
  Smartphone,
  Download,
  Loader2,
  Cable,
  Settings2,
  ExternalLink,
  HelpCircle,
  Scissors,
  Check,
  RefreshCw,
  FileCode,
} from 'lucide-react';
import { Income } from '../../types';
import { formatCurrency } from '../../utils/format';
import { printElement, exportElementToPdf } from '../../utils/printDocument';
import {
  isWebSerialSupported,
  printViaWebSerial,
  buildEscPosReceipt,
  buildTestTicket,
  downloadEscPosFile,
  openThermalPrintWindow,
  disconnectWebSerial,
  ThermalOptions,
  DEFAULT_THERMAL_OPTIONS,
} from '../../utils/thermalPrinter';
import { useNotification } from '../../context/NotificationContext';

interface PrintReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptId: string;
}

export const PrintReceiptModal: React.FC<PrintReceiptModalProps> = ({
  isOpen,
  onClose,
  receiptId,
}) => {
  const { showToast } = useNotification();
  const [receipt, setReceipt] = useState<Income | null>(null);
  const [settings, setSettings] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [previewThermal, setPreviewThermal] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSerialPrinting, setIsSerialPrinting] = useState(false);
  const [isTestingPrinter, setIsTestingPrinter] = useState(false);
  const [showThermalSettings, setShowThermalSettings] = useState(false);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);
  const [thermalOptions, setThermalOptions] = useState<ThermalOptions>(DEFAULT_THERMAL_OPTIONS);

  const standardReceiptRef = useRef<HTMLDivElement>(null);
  const thermalReceiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && receiptId) {
      setIsLoading(true);
      Promise.all([
        fetch(`/api/income/${receiptId}`).then(r => r.json()),
        fetch('/api/settings').then(r => r.json()),
      ])
        .then(([receiptData, settingsData]) => {
          setReceipt(receiptData);
          setSettings(settingsData || {});
        })
        .catch(err => console.error(err))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, receiptId]);

  useLockBodyScroll(isOpen && !!receiptId);

  if (!isOpen) return null;

  // Direct USB / Serial ESC/POS Hardware Printing
  const handleDirectUsbPrint = async () => {
    if (!receipt) return;
    setIsSerialPrinting(true);
    try {
      const data = buildEscPosReceipt(receipt, settings, thermalOptions);
      const res = await printViaWebSerial(data, thermalOptions.baudRate);
      if (res.success) {
        showToast('Receipt printed directly on thermal printer!', 'success');
      } else {
        showToast(res.message, 'error');
        // If web serial is not supported (e.g. Firefox or Safari), suggest the dedicated thermal print window
        if (!isWebSerialSupported()) {
          handleOpenThermalWindow();
        }
      }
    } catch (err: any) {
      console.error('Direct USB print failed:', err);
      showToast(err.message || 'Thermal printer communication failed', 'error');
    } finally {
      setIsSerialPrinting(false);
    }
  };

  // Dedicated un-sandboxed thermal print window (Bypasses iframe sandbox)
  const handleOpenThermalWindow = () => {
    if (!receipt) return;
    const res = openThermalPrintWindow(receipt, settings, thermalOptions.paperWidth);
    if (res.success) {
      showToast('Thermal print window opened with 80mm/58mm formatting', 'info');
    } else {
      showToast(res.message || 'Pop-up was blocked. Please allow pop-ups for this site.', 'error');
    }
  };

  // Send a diagnostic test ticket to physical thermal printer
  const handleTestPrinter = async () => {
    setIsTestingPrinter(true);
    try {
      const data = buildTestTicket(settings, thermalOptions);
      const res = await printViaWebSerial(data, thermalOptions.baudRate);
      if (res.success) {
        showToast('Diagnostic test ticket sent to thermal printer!', 'success');
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Test ticket failed', 'error');
    } finally {
      setIsTestingPrinter(false);
    }
  };

  // Download raw ESC/POS binary file (.bin)
  const handleDownloadEscPos = () => {
    if (!receipt) return;
    const data = buildEscPosReceipt(receipt, settings, thermalOptions);
    downloadEscPosFile(data, `receipt_${receipt.receipt_no}`);
    showToast('Raw ESC/POS binary (.bin) downloaded', 'success');
  };

  const handlePrint = async () => {
    if (!receipt) return;
    setIsPrinting(true);
    try {
      const target = previewThermal ? thermalReceiptRef.current : standardReceiptRef.current;
      const res = await printElement({
        element: target,
        format: previewThermal ? 'thermal' : 'a4',
        title: `Payment Receipt - ${receipt.receipt_no}`,
        filename: `receipt_${receipt.receipt_no}`,
      });
      if (res.fallbackUsed) {
        showToast('Receipt opened in printable window or downloaded (sandbox fallback)', 'info');
      } else {
        showToast('Print dialog initiated', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('Could not initiate print dialog. Trying PDF download...', 'error');
      handleDownloadPdf();
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!receipt) return;
    setIsDownloading(true);
    try {
      const target = previewThermal ? thermalReceiptRef.current : standardReceiptRef.current;
      if (!target) return;
      await exportElementToPdf(
        target,
        `receipt_${receipt.receipt_no}`,
        previewThermal ? 'thermal' : 'a4'
      );
      showToast('Receipt downloaded as PDF', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to generate PDF receipt', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  const currency = settings.currency_symbol ? `${settings.currency_symbol} ` : 'LKR ';
  const serialAvailable = isWebSerialSupported();

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal !max-w-3xl !p-6" onClick={e => e.stopPropagation()}>
        {/* Actions bar */}
        <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-border receipt-actions">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Receipt className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-serif font-bold text-sm text-foreground truncate">Payment Receipt</h3>
                <span className="text-[10px] font-mono bg-muted/80 text-muted-foreground px-2 py-0.5 rounded-full border border-border/80 whitespace-nowrap shrink-0">
                  {previewThermal ? `${thermalOptions.paperWidth} Thermal Mode` : 'Standard Voucher'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setPreviewThermal(!previewThermal)}
              className={`btn ${previewThermal ? 'btn-primary' : 'btn-soft'} !h-8 !px-3 inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium whitespace-nowrap leading-none transition-all shadow-2xs cursor-pointer`}
              title="Toggle between standard voucher and thermal receipt format"
            >
              <Smartphone className="w-3.5 h-3.5 shrink-0" />
              <span>{previewThermal ? 'Standard View' : 'Thermal Mode'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloading || isLoading}
              className="btn btn-soft !h-8 !px-3 inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium whitespace-nowrap leading-none transition-all shadow-2xs cursor-pointer"
              title="Download clean offline PDF receipt"
            >
              {isDownloading ? (
                <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              )}
              <span>PDF</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting || isLoading}
              className="btn btn-primary !h-8 !px-3.5 inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold whitespace-nowrap leading-none transition-all shadow-xs cursor-pointer"
              title="Print document"
            >
              {isPrinting ? (
                <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
              ) : (
                <Printer className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{isPrinting ? 'Printing...' : 'Print'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost !h-8 !w-8 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 cursor-pointer"
              title="Close"
              aria-label="Close"
            >
              <X className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </div>

        {/* Thermal Hardware Connect Control Strip (Shown prominently in Thermal Mode) */}
        {previewThermal && (
          <div className="mb-4 p-3 bg-card border border-primary/20 rounded-xl space-y-3 no-print">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Cable className="w-3 h-3" />
                  Thermal POS Connect
                </span>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  Connect via USB/Serial or System Driver
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Direct USB/Serial ESC/POS Button */}
                <button
                  type="button"
                  onClick={handleDirectUsbPrint}
                  disabled={isSerialPrinting || isLoading}
                  className="btn btn-primary !h-8 !px-3 inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg shadow-sm cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white border-none"
                  title="Direct hardware print to USB thermal printer (ESC/POS)"
                >
                  {isSerialPrinting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Cable className="w-3.5 h-3.5" />
                  )}
                  <span>{isSerialPrinting ? 'Sending...' : 'Direct USB Print'}</span>
                </button>

                {/* Direct Un-sandboxed Thermal Window Button */}
                <button
                  type="button"
                  onClick={handleOpenThermalWindow}
                  disabled={isLoading}
                  className="btn btn-soft !h-8 !px-2.5 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg cursor-pointer"
                  title="Open dedicated thermal print window for Windows/Mac printer driver"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Print Window</span>
                </button>

                {/* Settings Toggle */}
                <button
                  type="button"
                  onClick={() => setShowThermalSettings(!showThermalSettings)}
                  className={`btn-ghost !h-8 !px-2 inline-flex items-center gap-1 text-xs rounded-lg transition-colors cursor-pointer ${showThermalSettings ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground'}`}
                  title="Thermal printer configuration"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>Options</span>
                </button>

                {/* Troubleshoot Toggle */}
                <button
                  type="button"
                  onClick={() => setShowTroubleshoot(!showTroubleshoot)}
                  className={`btn-ghost !h-8 !w-8 inline-flex items-center justify-center rounded-lg transition-colors cursor-pointer ${showTroubleshoot ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
                  title="Thermal connection help"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Thermal Settings Panel */}
            {showThermalSettings && (
              <div className="pt-3 border-t border-border grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs bg-muted/20 p-3 rounded-lg">
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    Paper Roll Width
                  </label>
                  <select
                    className="input !h-8 !text-xs w-full"
                    value={thermalOptions.paperWidth}
                    onChange={e =>
                      setThermalOptions({
                        ...thermalOptions,
                        paperWidth: e.target.value as '80mm' | '58mm',
                      })
                    }
                  >
                    <option value="80mm">80mm (Standard POS - 72mm printable)</option>
                    <option value="58mm">58mm (Compact Roll - 48mm printable)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    USB Baud Rate
                  </label>
                  <select
                    className="input !h-8 !text-xs w-full"
                    value={thermalOptions.baudRate}
                    onChange={e =>
                      setThermalOptions({
                        ...thermalOptions,
                        baudRate: Number(e.target.value),
                      })
                    }
                  >
                    <option value={9600}>9600 (Standard Default)</option>
                    <option value={19200}>19200</option>
                    <option value={38400}>38400</option>
                    <option value={115200}>115200 (High Speed)</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end space-y-1.5">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px]">
                    <input
                      type="checkbox"
                      checked={thermalOptions.cutPaper}
                      onChange={e =>
                        setThermalOptions({ ...thermalOptions, cutPaper: e.target.checked })
                      }
                      className="rounded border-border"
                    />
                    <span>Auto-cut paper (GS V)</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px]">
                    <input
                      type="checkbox"
                      checked={thermalOptions.openCashDrawer}
                      onChange={e =>
                        setThermalOptions({
                          ...thermalOptions,
                          openCashDrawer: e.target.checked,
                        })
                      }
                      className="rounded border-border"
                    />
                    <span>Kick cash drawer (ESC p)</span>
                  </label>
                </div>

                <div className="flex items-end gap-1.5">
                  <button
                    type="button"
                    onClick={handleTestPrinter}
                    disabled={isTestingPrinter}
                    className="btn btn-soft !h-8 !text-xs flex-1 inline-flex items-center justify-center gap-1 cursor-pointer"
                    title="Send a 4-line diagnostic test ticket to thermal printer"
                  >
                    {isTestingPrinter ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                    <span>Test Printer</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadEscPos}
                    className="btn btn-soft !h-8 !px-2.5 inline-flex items-center justify-center cursor-pointer"
                    title="Download ESC/POS raw binary file (.bin)"
                  >
                    <FileCode className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            )}

            {/* Troubleshooting Guide */}
            {showTroubleshoot && (
              <div className="pt-3 border-t border-border text-xs text-muted-foreground space-y-2 bg-muted/30 p-3 rounded-lg">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-primary" />
                  How to connect your thermal printer:
                </div>
                <ol className="list-decimal pl-4 space-y-1 leading-relaxed">
                  <li>
                    <strong className="text-foreground">Direct USB Printing (Recommended):</strong> Click{' '}
                    <span className="font-semibold text-emerald-600">"Direct USB Print"</span>. Chrome/Edge
                    will open a port selection popup. Select your connected USB thermal printer (or USB-to-Serial
                    port) and click Connect. It will print instantly without any dialog!
                  </li>
                  <li>
                    <strong className="text-foreground">Windows / Mac Printer Driver:</strong> If your printer
                    is installed as a driver (e.g., POS-80, Epson TM-T88, XP-80), click{' '}
                    <span className="font-semibold text-foreground">"Print Window"</span>. In the browser
                    print dialog, select your thermal printer and set Margins to{' '}
                    <span className="font-semibold text-foreground">"None"</span>.
                  </li>
                  <li>
                    <strong className="text-foreground">If nothing prints:</strong> Check that the printer is
                    powered on, the paper roll is inserted right-side up, and the USB cable is firmly plugged
                    into your PC. If using Direct USB, try switching the baud rate to 115200 or 9600.
                  </li>
                </ol>
              </div>
            )}
          </div>
        )}

        {isLoading || !receipt ? (
          <div className="p-8 text-center text-muted-foreground">Loading receipt details...</div>
        ) : (
          <>
            {/* 1. STANDARD VISUALLY RICH VIEW (Standard App Design System & A4 Printable) */}
            <div
              ref={standardReceiptRef}
              className={`receipt-print-screen ${previewThermal ? 'hidden' : 'block'} bg-card border-2 border-primary/20 p-6 rounded-xl shadow-sm space-y-4 text-foreground`}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  {settings.school_logo_url ? (
                    <div className="w-11 h-11 rounded-lg border border-border/80 p-0.5 bg-muted/40 flex items-center justify-center flex-shrink-0">
                      <img
                        src={settings.school_logo_url}
                        alt={settings.school_name || 'School Logo'}
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : null}
                  <div>
                    <h2 className="font-serif font-bold text-lg text-primary">{settings.school_name || 'Elite International School'}</h2>
                    <p className="text-[11px] text-muted-foreground font-mono uppercase tracking-wider">Office of the Bursar</p>
                    <p className="text-[10px] text-muted-foreground">{settings.address || '[School Address Not Set]'} • {settings.email || '[Email Not Set]'} • {settings.phone || '[Phone Not Set]'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="mono font-bold text-sm text-foreground">{receipt.receipt_no}</div>
                  <div className="text-xs text-muted-foreground">Date: {receipt.date}</div>
                </div>
              </div>

              {/* Receipt Body */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
                  <div className="eyebrow mb-1">Received From (Payer)</div>
                  <div className="font-bold text-foreground text-sm">{receipt.payer_name}</div>
                  {receipt.student_first_name && (
                    <div className="text-muted-foreground mt-1">
                      Student: <span className="font-semibold text-foreground">{receipt.student_first_name} {receipt.student_last_name}</span> ({receipt.application_no})
                    </div>
                  )}
                </div>

                <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
                  <div className="eyebrow mb-1">Payment Method & Reference</div>
                  <div className="font-bold text-foreground text-sm">{receipt.payment_method}</div>
                  <div className="text-muted-foreground mt-1">
                    Ref: <span className="mono font-medium text-foreground">{receipt.reference_no || 'OFFICE-REC'}</span>
                  </div>
                </div>
              </div>

              {/* Amount Banner */}
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
                <div>
                  <span className="eyebrow block">Classification / Fee Category</span>
                  <span className="font-bold text-foreground text-sm">{receipt.source}</span>
                  {receipt.notes && <p className="text-xs text-muted-foreground mt-0.5">{receipt.notes}</p>}
                </div>
                <div className="text-right">
                  <span className="eyebrow block">Amount Received</span>
                  <span className="mono font-bold text-2xl text-[hsl(162,30%,35%)] dark:text-emerald-400">
                    {currency}{formatCurrency(receipt.amount)}
                  </span>
                </div>
              </div>

              {/* Signatures & Footer notice */}
              <div className="pt-4 border-t border-border flex items-end justify-between text-[11px] text-muted-foreground">
                <div>
                  <div className="flex items-center gap-1.5 text-foreground font-medium mb-1">
                    <CheckCircle className="w-3.5 h-3.5 text-[hsl(162,30%,40%)]" />
                    Received & Processed By: <span className="font-bold">{receipt.received_by_staff_name || 'Accounts Staff'}</span>
                  </div>
                  <p className="italic max-w-sm text-[10px]">
                    {settings.receipt_footer_notice || 'Thank you for your prompt remittance. Fees once paid are non-refundable.'}
                  </p>
                </div>

                <div className="text-right">
                  <div className="w-32 border-b border-foreground/40 mb-1 ml-auto"></div>
                  <span className="font-mono text-[10px]">Official Stamp / Signature</span>
                </div>
              </div>
            </div>

            {/* 2. ON-SCREEN & PRINTABLE THERMAL VIEW (Monochrome 80mm/58mm Roll Format) */}
            <div
              ref={thermalReceiptRef}
              className={`receipt-print-thermal ${previewThermal ? 'block' : 'hidden'} p-4 bg-muted/30 rounded-xl border border-border flex flex-col items-center`}
            >
              <div className="text-xs text-muted-foreground mb-3 font-mono no-print">
                {thermalOptions.paperWidth} POS Thermal Paper Format (Monochrome / Single-Column / {thermalOptions.paperWidth === '80mm' ? '72mm' : '48mm'} Printable)
              </div>
              <div
                style={{ width: thermalOptions.paperWidth === '80mm' ? '72mm' : '48mm' }}
                className="bg-white text-black p-[2.5mm] rounded shadow-md border border-neutral-300 font-sans text-[9.5px] leading-snug"
              >
                {/* Thermal Header with Logo / Fallback */}
                <div className="text-center mb-1.5">
                  {(settings.school_logo_url_thermal || settings.school_logo_url) ? (
                    <div className="flex justify-center mb-1">
                      <img
                        src={settings.school_logo_url_thermal || settings.school_logo_url}
                        alt={settings.school_name || 'School Logo'}
                        className="w-[32mm] max-h-[16mm] object-contain mx-auto"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : null}
                  <div className="font-medium text-[11px] uppercase tracking-wide">
                    {settings.school_name || 'Elite International School'}
                  </div>
                  <div className="font-mono text-[8.5px] uppercase tracking-wider mt-0.5 text-neutral-800">
                    Finance Office
                  </div>
                  <div className="text-[8px] leading-tight text-neutral-700 mt-0.5">
                    {settings.address || '[School Address Not Set]'}
                  </div>
                  <div className="text-[8px] leading-tight text-neutral-700">
                    {settings.email || '[Email Not Set]'} • Tel: {settings.phone || '[Phone Not Set]'}
                  </div>
                </div>

                <div className="border-t border-black border-dashed my-1.5" />

                <div className="flex justify-between text-[8.5px] font-mono">
                  <span className="font-medium text-neutral-800 tracking-wider">RECEIPT NO:</span>
                  <span className="font-semibold">{receipt.receipt_no}</span>
                </div>
                <div className="flex justify-between text-[8.5px]">
                  <span className="font-medium text-neutral-800 tracking-wider">DATE:</span>
                  <span>{receipt.date}</span>
                </div>

                <div className="border-t border-black border-dashed my-1.5" />

                <div className="space-y-1 text-[8.5px]">
                  <div>
                    <span className="font-medium uppercase tracking-wider text-neutral-800">RECEIVED FROM:</span>
                    <div className="font-normal">{receipt.payer_name}</div>
                  </div>

                  {receipt.student_first_name && (
                    <div>
                      <span className="font-medium uppercase tracking-wider text-neutral-800">STUDENT:</span>
                      <div>{receipt.student_first_name} {receipt.student_last_name} ({receipt.application_no})</div>
                    </div>
                  )}

                  <div>
                    <span className="font-medium uppercase tracking-wider text-neutral-800">PAYMENT METHOD:</span>
                    <div>{receipt.payment_method}</div>
                  </div>

                  <div>
                    <span className="font-medium uppercase tracking-wider text-neutral-800">REFERENCE NO:</span>
                    <div className="font-mono">{receipt.reference_no || 'OFFICE-REC'}</div>
                  </div>

                  <div>
                    <span className="font-medium uppercase tracking-wider text-neutral-800">FEE CATEGORY:</span>
                    <div>{receipt.source}</div>
                  </div>

                  {receipt.notes && (
                    <div>
                      <span className="font-medium uppercase tracking-wider text-neutral-800">NOTES:</span>
                      <div>{receipt.notes}</div>
                    </div>
                  )}
                </div>

                <div className="border-t border-black border-dashed my-1.5" />

                <div className="py-1 text-center border-y border-black border-double my-1.5">
                  <div className="text-[9px] font-medium uppercase tracking-wider">AMOUNT RECEIVED</div>
                  <div className="text-sm font-medium font-mono tracking-tight mt-0.5">
                    {currency}{formatCurrency(receipt.amount)}
                  </div>
                </div>

                <div className="mt-1.5 text-[8.5px]">
                  <div className="font-medium uppercase tracking-wider text-neutral-800">RECEIVED & PROCESSED BY:</div>
                  <div>{receipt.received_by_staff_name || 'Accounts Staff'}</div>
                </div>

                {/* Cashier Signature & Official Stamp Line */}
                <div className="mt-3 flex flex-col items-center text-center">
                  <div className="w-[40mm] border-b border-black mb-1"></div>
                  <span className="text-[7.5px] uppercase tracking-wider font-mono text-neutral-700">Cashier Signature</span>
                </div>

                {/* Compact Official Seal Stamp Placeholder Box */}
                <div className="mt-2 flex justify-center">
                  <div className="w-[28mm] h-[16mm] border border-dashed border-neutral-400 flex items-center justify-center text-[7.5px] font-mono uppercase text-neutral-400 text-center px-1">
                    Official Seal
                  </div>
                </div>

                <div className="mt-2 pt-1.5 border-t border-black border-dashed text-[7.5px] italic leading-tight text-center">
                  {settings.receipt_footer_notice || 'Thank you for your prompt remittance. Fees once paid are non-refundable.'}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};
