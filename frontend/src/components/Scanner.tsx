import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Info } from 'lucide-react';
import { Button, Notice, Sheet } from './ui';

export function Scanner({
  open,
  onClose,
  onScan,
  title = 'Scan QR code',
}: {
  open: boolean;
  onClose: () => void;
  onScan: (text: string) => void;
  title?: string;
}) {
  const elementId = 'rift-scanner-region';
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const secure = typeof window !== 'undefined' && window.isSecureContext;

  useEffect(() => {
    if (!open) return;
    if (!secure) return;
    let cancelled = false;
    setStarting(true);
    setError('');

    (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;
        const scanner = new Html5Qrcode(elementId, { verbose: false });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
          (decoded) => {
            onScan(decoded);
            scanner.stop().catch(() => undefined);
            onClose();
          },
          () => undefined,
        );
      } catch (err) {
        if (!cancelled) {
          setError(
            (err as Error)?.message?.includes('Permission')
              ? 'Camera permission was denied. Use the paste fallback.'
              : 'Camera could not start. Use the paste fallback.',
          );
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        scanner
          .stop()
          .catch(() => undefined)
          .finally(() => {
            try {
              scanner.clear();
            } catch {
              /* already cleared */
            }
          });
      }
    };
  }, [open, secure, onScan, onClose]);

  return (
    <Sheet open={open} onClose={onClose} title={title} subtitle="Point the camera at the QR code" size="sm">
      {!secure ? (
        <div className="space-y-4">
          <Notice tone="rift">
            Camera scanning needs HTTPS or localhost. This origin is not secure, so use the paste-token
            fallback — it works everywhere and is part of the demo.
          </Notice>
          <div className="grid place-items-center rounded-2xl border border-dashed border-line bg-raised py-12 text-text-3">
            <CameraOff className="h-10 w-10" />
            <p className="mt-3 text-[12px]">Camera unavailable on this origin</p>
          </div>
          <Button variant="secondary" className="w-full" onClick={onClose}>
            Use pasted token
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl border border-line bg-black">
            <div id={elementId} className="min-h-[260px] w-full [&_video]:rounded-2xl" />
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="h-[220px] w-[220px] rounded-2xl border-2 border-brand/60 shadow-[0_0_0_999px_rgba(0,0,0,.35)]" />
            </div>
            {starting && (
              <div className="absolute inset-0 grid place-items-center bg-black/60 text-[12px] text-white">
                <span className="flex items-center gap-2">
                  <Camera className="h-4 w-4" /> Starting camera…
                </span>
              </div>
            )}
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          <Notice tone="info">
            <span className="inline-flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" /> Camera frames never leave this device. Verification is local.
            </span>
          </Notice>
          <Button variant="secondary" className="w-full" onClick={onClose}>
            Cancel
          </Button>
        </div>
      )}
    </Sheet>
  );
}
