import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import IconButton from "@mui/material/IconButton";
import Logo from "../../components/Logo";
import { useI18n } from "../../hooks/I18n";

export default function Header({ onClose, openSeparateWindow, openSettings }) {
  const i18n = useI18n();
  const appName = i18n("app_name");
  const openSeparateWindowLabel = i18n("popup_open_separate_window");
  const openSeparateWindowName = `${openSeparateWindowLabel} · ${i18n("popup_text_translation")}`;

  const handleHomepage = () => {
    window.open(
      process.env.REACT_APP_HOMEPAGE,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <header className="kt-popup-header">
      {onClose && (
        <span className="kt-popup-header__drag" aria-hidden="true">
          <DragIndicatorRoundedIcon fontSize="small" />
        </span>
      )}
      <button
        type="button"
        className="kt-popup-brand-button"
        onClick={handleHomepage}
        aria-label={appName}
      >
        <Logo size={20} className="kt-popup-header__logo" />
        <span className="kt-popup-header__title">{appName}</span>
      </button>
      <span className="kt-popup-header__spacer" />
      {onClose ? (
        <IconButton onClick={onClose} aria-label={i18n("close")}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      ) : (
        <span className="kt-popup-header__actions">
          <IconButton
            className="kt-popup-header__window"
            onClick={openSeparateWindow}
            aria-label={openSeparateWindowName}
            title={openSeparateWindowName}
          >
            <OpenInNewRoundedIcon fontSize="small" aria-hidden="true" />
          </IconButton>
          <IconButton
            onClick={openSettings}
            aria-label={i18n("setting")}
            title={i18n("setting")}
          >
            <SettingsRoundedIcon fontSize="small" aria-hidden="true" />
          </IconButton>
        </span>
      )}
    </header>
  );
}
