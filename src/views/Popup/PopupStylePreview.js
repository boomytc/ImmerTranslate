import { ClassNames, keyframes } from "@emotion/react";
import {
  OPT_STYLE_BLINK,
  OPT_STYLE_GLOW,
  OPT_STYLE_GRADIENT,
} from "../../config/styles";

const popupGradientFlow = keyframes`
  to { background-position: 200% center; }
`;
const popupBlink = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.25; }
`;
const popupGlow = keyframes`
  from {
    text-shadow: 0 0 8px color-mix(in oklab, var(--kt-pri) 45%, transparent);
  }
  to {
    text-shadow: 0 0 14px color-mix(in oklab, var(--kt-pri) 85%, transparent);
  }
`;

const activePreviewSelector =
  ".kt-popup-style-chip:hover &, .kt-popup-style-chip:focus-visible &, .kt-popup-style-chip[aria-pressed='true'] &";

const popupPreviewAnimationStyles = {
  [OPT_STYLE_GRADIENT]: {
    "@media (prefers-reduced-motion: no-preference)": {
      [activePreviewSelector]: {
        animation: `${popupGradientFlow} 4s linear infinite`,
      },
    },
  },
  [OPT_STYLE_BLINK]: {
    "@media (prefers-reduced-motion: no-preference)": {
      [activePreviewSelector]: {
        animation: `${popupBlink} 1.2s ease-out infinite`,
      },
    },
  },
  [OPT_STYLE_GLOW]: {
    "@media (prefers-reduced-motion: no-preference)": {
      [activePreviewSelector]: {
        animation: `${popupGlow} 1.8s ease-out infinite alternate`,
      },
    },
  },
};

export default function PopupStylePreview({ styleSlug, previewCode, label }) {
  return (
    <ClassNames>
      {({ css }) => (
        <span
          className={
            previewCode
              ? css(previewCode, popupPreviewAnimationStyles[styleSlug])
              : undefined
          }
        >
          {label}
        </span>
      )}
    </ClassNames>
  );
}
