import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import IconButton from "@mui/material/IconButton";
import { NavLink } from "react-router-dom";
import Logo from "../../components/Logo";
import { useI18n } from "../../hooks/I18n";
import DarkModeButton from "./DarkModeButton";

export default function Header({
  onDrawerToggle,
  navigationOpen,
  scrolled = false,
}) {
  const i18n = useI18n();
  return (
    <header
      className={`kt-options-compact-header ${
        scrolled ? "kt-options-compact-header--scrolled" : ""
      }`.trim()}
    >
      <IconButton
        onClick={onDrawerToggle}
        aria-label={i18n("options_open_navigation")}
        aria-controls="kt-options-navigation"
        aria-expanded={navigationOpen}
      >
        <MenuRoundedIcon />
      </IconButton>
      <NavLink to="/" end className="kt-options-compact-header__brand">
        <Logo size={24} />
        <span className="kt-options-compact-header__name">
          {i18n("app_name")}
        </span>
      </NavLink>
      <DarkModeButton />
    </header>
  );
}
