// Budget icon: the review stack. Petal-cut cards (big radius top-left/bottom-right, small elsewhere: Sakura's
// signature corner), the front one tilted right like a card being swiped to confirm, with a drawn peso sign.
const petal = (x, y, w, h, R, r) =>
  `M${x + R} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - R}Q${x + w} ${y + h} ${x + w - R} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + R}Q${x} ${y} ${x + R} ${y}Z`;

export function mark() {
  const card = petal(-128, -164, 256, 328, 96, 14);
  return `
  <defs>
    <filter id="lift" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="6" dy="16" stdDeviation="16" flood-color="#3D0F24" flood-opacity=".42"/>
    </filter>
  </defs>
  <path d="${card}" fill="#F08DB0" transform="translate(222 262) rotate(-13)"/>
  <g transform="translate(272 258) rotate(8)" filter="url(#lift)">
    <path d="${card}" fill="#FFF4F7"/>
    <g fill="none" stroke="#3D1F33" stroke-linecap="round" stroke-linejoin="round" transform="translate(-6 0) scale(1.18)">
      <path d="M-36 -64V68" stroke-width="36"/>
      <path d="M-36 -64H8A44 44 0 0 1 8 24H-36" stroke-width="36"/>
      <path d="M-66 -34H72M-66 -4H72" stroke-width="15"/>
    </g>
  </g>`;
}

export const rounded = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="116" fill="#C2306A"/>${mark()}</svg>`;
// Full-bleed square for maskable/apple icons: the OS applies its own shape; the mark sits in the safe zone.
export const square = (scale = 0.8) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#C2306A"/><g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${mark()}</g></svg>`;
