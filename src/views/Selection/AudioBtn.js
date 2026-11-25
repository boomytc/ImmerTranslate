import IconButton from "@mui/material/IconButton";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import { useEffect, useRef, useState } from "react";
import { useAudio } from "../../hooks/Audio";
import { useI18n } from "../../hooks/I18n";
import { canSpeak, speak } from "../../libs/speech";
import queryString from "query-string";

/**
 * Basic audio playback button.
 *
 * @param {Object} props
 * @param {string} props.src - Audio source URL.
 */
export function AudioBtn({ src, title, pauseTitle }) {
  const i18n = useI18n();
  const effectiveTitle = title ?? i18n("read_aloud");
  const effectivePauseTitle = pauseTitle ?? i18n("audio_pause");
  // Track audio loading and playback with useAudio.
  const { error, ready, playing, onPlay, onPause } = useAudio(src);

  // Disable playback while loading or after an audio error.
  if (error || !ready) {
    return (
      <IconButton
        disabled
        size="small"
        title={effectiveTitle}
        aria-label={effectiveTitle}
        aria-busy={!error && !ready}
      >
        <VolumeUpRoundedIcon fontSize="inherit" />
      </IconButton>
    );
  }

  // Highlight the icon with the primary color during playback.
  if (playing) {
    return (
      <IconButton
        color="primary"
        size="small"
        onClick={onPause}
        title={effectivePauseTitle}
        aria-label={effectivePauseTitle}
        aria-pressed="true"
      >
        <VolumeUpRoundedIcon fontSize="inherit" />
      </IconButton>
    );
  }

  // Start playback when the ready button is clicked.
  return (
    <IconButton
      onClick={onPlay}
      size="small"
      title={effectiveTitle}
      aria-label={effectiveTitle}
      aria-pressed="false"
    >
      <VolumeUpRoundedIcon fontSize="inherit" />
    </IconButton>
  );
}

/**
 * Baidu Translate TTS button.
 *
 * @param {Object} props
 * @param {string} props.text - Text to speak.
 * @param {string} [props.lan="uk"] - Accent: British "uk" or American "en".
 * @param {number} [props.spd=3] - Speech rate, defaulting to 3.
 */
export function BaiduAudioBtn({ text, lan = "uk", spd = 3 }) {
  if (!text) return null;

  // Build the public Baidu Translate TTS URL.
  const src = `https://fanyi.baidu.com/gettts?${queryString.stringify({ lan, text, spd })}`;
  return <AudioBtn src={src} />;
}

export function BrowserTtsBtn({ text, lang = "en-US", title }) {
  const i18n = useI18n();
  const effectiveTitle = title ?? i18n("read_aloud");
  const [speaking, setSpeaking] = useState(false);
  const speakingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      speakingRef.current = false;
    };
  }, []);

  if (!text?.trim() || !canSpeak()) return null;

  const handleSpeak = () => {
    if (speakingRef.current) return;

    // Browser TTS has no audio element, so the button tracks playback itself.
    speakingRef.current = true;
    setSpeaking(true);
    const onEnd = () => {
      speakingRef.current = false;
      if (mountedRef.current) setSpeaking(false);
    };
    const started = speak(text, lang, { onEnd });

    if (!started) onEnd();
  };

  return (
    <IconButton
      color={speaking ? "primary" : "default"}
      // A native disabled button loses keyboard focus while speech is starting.
      aria-disabled={speaking}
      onClick={handleSpeak}
      size="small"
      title={effectiveTitle}
      aria-label={effectiveTitle}
      aria-busy={speaking}
      aria-pressed={speaking}
      sx={{
        ml: 0.5,
        verticalAlign: "middle",
        cursor: speaking ? "default" : undefined,
      }}
    >
      <VolumeUpRoundedIcon fontSize="inherit" />
    </IconButton>
  );
}
