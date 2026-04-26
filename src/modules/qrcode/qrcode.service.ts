import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';

@Injectable()
export class QrCodeService {
  private getFrontendBaseUrl(): string {
    const fallback =
      process.env.NODE_ENV === 'production' ? 'https://lotfood.ru' : 'http://localhost:3001';
    return (
      process.env.FRONTEND_URL ||
      process.env.PUBLIC_FRONTEND_URL ||
      fallback
    ).replace(/\/$/, '');
  }

  private escapeHtml(text: string | null | undefined): string {
    if (text == null || text === '') return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Absolute URL for images in downloaded HTML (relative /uploads/... is broken as file://) */
  private resolvePublicAssetUrl(pathOrUrl: string | null | undefined): string {
    if (!pathOrUrl) return '';
    const fallbackBackendBase =
      process.env.NODE_ENV === 'production' ? 'https://lotfood.ru' : 'http://localhost:3000';
    const base = (
      process.env.PUBLIC_BACKEND_URL ||
      process.env.BACKEND_PUBLIC_URL ||
      fallbackBackendBase
    ).replace(/\/$/, '');

    // Keep data URLs unchanged.
    if (pathOrUrl.startsWith('data:')) {
      return pathOrUrl;
    }

    // Rewrite localhost-based absolute URLs to public backend URL for downloaded HTML portability.
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      try {
        const parsed = new URL(pathOrUrl);
        if (
          parsed.hostname === 'localhost' ||
          parsed.hostname === '127.0.0.1' ||
          parsed.hostname === '0.0.0.0'
        ) {
          return `${base}${parsed.pathname}`;
        }
      } catch {
        // If URL parsing fails, fall back to original value.
      }
      return pathOrUrl;
    }

    const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
    return `${base}${path}`;
  }

  async generateQRCode(data: string): Promise<string> {
    try {
      // Generate QR code as data URL
      const qrCodeDataUrl = await QRCode.toDataURL(data, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 300,
        margin: 2,
      });
      return qrCodeDataUrl;
    } catch (error) {
      throw new Error('Failed to generate QR code');
    }
  }

  async generateBusinessCard(seller: {
    name: string;
    shopName: string;
    shopDescription: string;
    shopLogo: string;
    contactPhone: string;
    contactEmail: string;
    slug: string;
  }): Promise<string> {
    const referralUrl = `${this.getFrontendBaseUrl()}/ref/${seller.slug}`;
    const qrCode = await this.generateQRCode(referralUrl);
    const logoSrc = this.resolvePublicAssetUrl(seller.shopLogo);

    // Return HTML for business card
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 12px;
      font-family: Arial, sans-serif;
      background: #f5f5f5;
    }
    .card {
      width: 100%;
      max-width: 600px;
      background: white;
      border-radius: 16px;
      padding: 28px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      margin: 0 auto;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      object-fit: cover;
      margin-bottom: 20px;
    }
    .shop-name {
      font-size: 32px;
      font-weight: bold;
      color: #FF8C00;
      margin: 10px 0;
    }
    .owner-name {
      font-size: 18px;
      color: #666;
      margin: 5px 0;
    }
    .description {
      font-size: 16px;
      color: #444;
      line-height: 1.6;
      margin: 20px 0;
      text-align: center;
    }
    .contacts {
      margin: 30px 0;
      padding: 20px;
      background: #FFF5E6;
      border-radius: 12px;
    }
    .contact-item {
      font-size: 16px;
      color: #333;
      margin: 10px 0;
      display: flex;
      align-items: center;
    }
    .contact-icon {
      margin-right: 10px;
      font-size: 20px;
    }
    .qr-section {
      text-align: center;
      margin-top: 30px;
      padding-top: 30px;
      border-top: 2px dashed #FF8C00;
    }
    .qr-title {
      font-size: 20px;
      font-weight: bold;
      color: #FF8C00;
      margin-bottom: 15px;
    }
    .qr-code {
      display: inline-block;
      padding: 15px;
      background: white;
      border: 3px solid #FF8C00;
      border-radius: 12px;
    }
    .qr-hint {
      font-size: 14px;
      color: #666;
      margin-top: 15px;
    }
    @media (max-width: 640px) {
      body {
        padding: 0;
      }
      .card {
        min-height: 100vh;
        border-radius: 0;
        padding: 20px 16px;
        box-shadow: none;
      }
      .shop-name {
        font-size: 28px;
      }
      .qr-code img {
        width: 220px;
        height: 220px;
      }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      ${logoSrc ? `<img src="${this.escapeHtml(logoSrc)}" alt="Logo" class="logo">` : ''}
      <div class="shop-name">${this.escapeHtml(seller.shopName || 'Магазин')}</div>
      <div class="owner-name">${this.escapeHtml(seller.name)}</div>
    </div>

    ${seller.shopDescription ? `<div class="description">${this.escapeHtml(seller.shopDescription)}</div>` : ''}

    <div class="contacts">
      ${seller.contactPhone ? `
        <div class="contact-item">
          <span class="contact-icon">📱</span>
          <span>${this.escapeHtml(seller.contactPhone)}</span>
        </div>
      ` : ''}
      ${seller.contactEmail ? `
        <div class="contact-item">
          <span class="contact-icon">✉️</span>
          <span>${this.escapeHtml(seller.contactEmail)}</span>
        </div>
      ` : ''}
    </div>

    <div class="qr-section">
      <div class="qr-title">Сканируйте для заказа</div>
      <div class="qr-code">
        <img src="${qrCode}" alt="QR Code" width="250" height="250">
      </div>
      <div class="qr-hint">Наведите камеру телефона на QR-код</div>
    </div>
  </div>
</body>
</html>
    `;
  }
}
