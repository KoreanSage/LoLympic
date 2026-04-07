import sharp from 'sharp';

interface SegmentBox {
  boxX: number | null;
  boxY: number | null;
  boxWidth: number | null;
  boxHeight: number | null;
  semanticRole?: string;
  confidence?: number;
}

/**
 * Generate a binary mask for inpainting
 * White areas = text to remove, Black areas = keep
 */
export async function generateInpaintingMask(
  segments: SegmentBox[],
  imgWidth: number,
  imgHeight: number
): Promise<Buffer> {
  // Filter: exclude WATERMARK, require valid box coordinates
  const targetSegments = segments.filter(seg => {
    if (seg.semanticRole === 'WATERMARK' || seg.semanticRole === 'LABEL') return false;
    if (seg.boxX == null || seg.boxY == null || seg.boxWidth == null || seg.boxHeight == null) return false;
    return true;
  });

  if (targetSegments.length === 0) {
    // No text to remove — return black mask
    return sharp({
      create: { width: imgWidth, height: imgHeight, channels: 3, background: { r: 0, g: 0, b: 0 } }
    }).png().toBuffer();
  }

  // Determine if coordinates are in 0-1 range or 0-1000 range
  const maxCoord = Math.max(
    ...targetSegments.map(s => Math.max(s.boxX!, s.boxY!, s.boxX! + s.boxWidth!, s.boxY! + s.boxHeight!))
  );
  // Detect coordinate range: 0-1 (fractional), 0-100 (percentage), or 0-1000
  const normFactor = maxCoord > 100 ? 1000 : maxCoord > 1.5 ? 100 : 1;

  const svgRects = targetSegments.map(seg => {
    const x = seg.boxX! / normFactor;
    const y = seg.boxY! / normFactor;
    const bw = seg.boxWidth! / normFactor;
    const bh = seg.boxHeight! / normFactor;

    // 5% padding — tight to text, avoids damaging surrounding image
    const padX = bw * imgWidth * 0.05;
    const padY = bh * imgHeight * 0.05;

    const absX = Math.max(0, (x * imgWidth) - padX);
    const absY = Math.max(0, (y * imgHeight) - padY);
    const absW = Math.min(imgWidth - absX, (bw * imgWidth) + (padX * 2));
    const absH = Math.min(imgHeight - absY, (bh * imgHeight) + (padY * 2));

    // Rounded corners for more natural inpainting
    const rx = Math.min(absW, absH) * 0.1;

    return `<rect x="${absX}" y="${absY}" width="${absW}" height="${absH}" rx="${rx}" ry="${rx}" fill="white" />`;
  }).join('\n');

  const svgMask = `
    <svg width="${imgWidth}" height="${imgHeight}">
      <rect width="100%" height="100%" fill="black" />
      ${svgRects}
    </svg>
  `;

  return sharp(Buffer.from(svgMask)).png().toBuffer();
}
