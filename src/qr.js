import QRCode from 'qrcode';

export async function generateQRDataURL(url) {
  return QRCode.toDataURL(url, {
    width: 300,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  });
}

export async function generateQRSVG(url) {
  return QRCode.toString(url, { type: 'svg', margin: 2 });
}
