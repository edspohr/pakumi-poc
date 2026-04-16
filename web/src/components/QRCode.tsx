import { useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface QRCodeProps {
  url: string;
  petName: string;
}

export function QRCode({ url, petName }: QRCodeProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleDownload = useCallback(() => {
    const svg = wrapperRef.current?.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `pakumi-qr-${petName.replace(/\s+/g, '-').toLowerCase()}.png`;
      a.click();
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
  }, [petName]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        ref={wrapperRef}
        className="bg-white border border-gray-200 rounded-lg p-4 shadow-inner"
      >
        <QRCodeSVG value={url} size={256} />
      </div>

      <p className="text-xs text-gray-500 break-all text-center max-w-xs">
        {url}
      </p>

      <button
        onClick={handleDownload}
        className="bg-brand hover:bg-brand-hover text-white font-medium rounded-lg py-2 px-6 transition"
      >
        Descargar QR
      </button>
    </div>
  );
}
