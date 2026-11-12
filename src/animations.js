/*
 * Predefined bar animations. Selected through the `animation` option and
 * applied as a class on the root element. Reduced motion disables all of them.
 */

export const ANIMATIONS = ["none", "slide", "fade", "pulse", "shimmer"];
export const DEFAULT_ANIMATION = "slide";

/** Animations that replay a keyframe when the displayed state changes. */
const CHANGE_ANIMATIONS = ["fade", "pulse"];

export function animationClass(name) {
  return `anim-${ANIMATIONS.includes(name) ? name : DEFAULT_ANIMATION}`;
}

export function playsOnChange(name) {
  return CHANGE_ANIMATIONS.includes(name);
}

/** Restart the CSS keyframe animation bound to the `changed` class. */
export function restartAnimation(el) {
  el.classList.remove("changed");
  void el.offsetWidth;
  el.classList.add("changed");
}

export function animationCss() {
  return `
    .anim-slide .carrier, .anim-shimmer .carrier,
    .anim-slide .fill, .anim-shimmer .fill {
      transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1), clip-path 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .dragging .carrier, .dragging .fill { transition: none !important; }
    .anim-fade .content.changed { animation: slabton-fade 0.45s ease; }
    .anim-pulse .handle.changed { animation: slabton-pulse 0.45s ease; }
    .anim-shimmer .fill::after {
      content: ""; position: absolute; inset: 0;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.35), transparent);
      transform: translateX(-100%);
      animation: slabton-shimmer 2.2s linear infinite;
    }
    .o-v.anim-shimmer .fill::after {
      background: linear-gradient(0deg, transparent, rgba(255, 255, 255, 0.35), transparent);
      transform: translateY(100%);
      animation-name: slabton-shimmer-v;
    }
    @keyframes slabton-fade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slabton-pulse { 0% { transform: scale(1); } 40% { transform: scale(1.18); } 100% { transform: scale(1); } }
    @keyframes slabton-shimmer { to { transform: translateX(100%); } }
    @keyframes slabton-shimmer-v { to { transform: translateY(-100%); } }
    @media (prefers-reduced-motion: reduce) {
      .root *, .root *::before, .root *::after { animation: none !important; transition: none !important; }
    }
  `;
}
