import Button from "@mui/material/Button";
import Logo from "../../components/Logo";
import { useI18n } from "../../hooks/I18n";

export default function About() {
  const i18n = useI18n();

  return (
    <section className="kt-about">
      <div className="kt-about__identity">
        <Logo size={48} className="kt-about__logo" />
        <div className="kt-about__copy">
          <h2>{i18n("app_name")}</h2>
          <p>{i18n("settings_about_description")}</p>
        </div>
      </div>

      <dl className="kt-about__meta">
        <div className="kt-about__meta-row">
          <dt>{i18n("about_version")}</dt>
          <dd>{process.env.REACT_APP_VERSION}</dd>
        </div>
        <div className="kt-about__meta-row">
          <dt>{i18n("about_license")}</dt>
          <dd>{i18n("settings_about_license")}</dd>
        </div>
        {process.env.REACT_APP_SITEURL && (
          <div className="kt-about__meta-row">
            <dt>{i18n("about_homepage")}</dt>
            <dd>
              <a
                className="kt-about__link"
                href={process.env.REACT_APP_SITEURL}
                target="_blank"
                rel="noopener noreferrer"
              >
                {i18n("settings_project_website")}
              </a>
            </dd>
          </div>
        )}
      </dl>

      <div className="kt-about__actions">
        <Button
          component="a"
          variant="contained"
          href={process.env.REACT_APP_HOMEPAGE}
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </Button>
      </div>
    </section>
  );
}
