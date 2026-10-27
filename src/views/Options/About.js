import Box from "@mui/material/Box";
import { useI18n } from "../../hooks/I18n";
import Button from "@mui/material/Button";
import Logo from "../../components/Logo";
export default function About() {
  const i18n = useI18n();

  return (
    <Box className="kt-about-page">
      <section className="kt-about-hero">
        <Logo size={72} className="kt-about-hero__logo" />
        <h2>{i18n("app_name")}</h2>
        <div className="kt-about-hero__version">
          v{process.env.REACT_APP_VERSION}
        </div>
        <p>{i18n("settings_about_description")}</p>
        <small>{i18n("settings_about_license")}</small>
        <div className="kt-about-hero__actions">
          <Button
            component="a"
            variant="contained"
            href={process.env.REACT_APP_HOMEPAGE}
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </Button>
          <Button
            component="a"
            variant="outlined"
            href={process.env.REACT_APP_SITEURL}
            target="_blank"
            rel="noreferrer"
          >
            {i18n("settings_project_website")}
          </Button>
        </div>
      </section>
    </Box>
  );
}
