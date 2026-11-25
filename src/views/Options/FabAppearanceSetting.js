import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import FormHelperText from "@mui/material/FormHelperText";
import Slider from "@mui/material/Slider";
import Typography from "@mui/material/Typography";
import FloatingButton from "../../components/FloatingButton";
import { FLOATING_BUTTON_STYLES } from "../../components/FloatingButton.styles";
import {
  FAB_MIN_OPACITY,
  FAB_MIN_SIZE,
  FAB_MAX_SIZE,
  DEFAULT_FAB,
  normalizeFabAppearance,
} from "../../config/fab";
import { useI18n } from "../../hooks/I18n";
import { createM3CssVariables, resolveM3Colors } from "../../styles/m3";
import { SettingsSegmented } from "./SettingsCard";

export default function FabAppearanceSetting({ fab, onChange }) {
  const i18n = useI18n();
  const { opacity, size } = normalizeFabAppearance(fab);
  const [opacityPercent, setOpacityPercent] = useState(
    Math.round(opacity * 100)
  );
  const [sizePixels, setSizePixels] = useState(size);
  const [previewTheme, setPreviewTheme] = useState("light");
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const colors = resolveM3Colors(previewTheme);
  const isHalfHide = Boolean(fab?.halfHide);
  const isActive = hovered || focused;

  useEffect(() => {
    setOpacityPercent(Math.round(opacity * 100));
  }, [opacity]);

  useEffect(() => {
    setSizePixels(size);
  }, [size]);

  return (
    <Box
      component="div"
      className="kt-fab-appearance"
      aria-labelledby="fab-appearance-title"
    >
      <style>{FLOATING_BUTTON_STYLES}</style>
      <Box className="kt-fab-appearance__header">
        <Typography
          component="h3"
          id="fab-appearance-title"
          className="kt-fab-appearance__title"
        >
          {i18n("fab_appearance")}
        </Typography>
        <SettingsSegmented
          className="kt-preview-stage__toggle"
          value={previewTheme}
          label={i18n("fab_appearance")}
          onChange={setPreviewTheme}
          items={[
            { value: "light", label: i18n("preview_bg_light") },
            { value: "dark", label: i18n("preview_bg_dark") },
          ]}
        />
      </Box>
      <Box className="kt-fab-appearance-layout">
        <Box className="kt-fab-preview">
          <Box
            className="kt-fab-preview-stage kt-m3-root"
            data-theme={previewTheme}
            style={{
              ...createM3CssVariables(colors),
              colorScheme: previewTheme,
            }}
            onPointerEnter={() => setHovered(true)}
            onPointerLeave={() => setHovered(false)}
            onPointerCancel={() => setHovered(false)}
          >
            <Box className="kt-fab-preview-page" aria-hidden="true">
              <span className="kt-fab-preview-line kt-fab-preview-line--short" />
              <span className="kt-fab-preview-line" />
              <span className="kt-fab-preview-line kt-fab-preview-line--mid" />
              <span className="kt-fab-preview-line kt-fab-preview-line--short" />
            </Box>
            <Box
              className={`kt-fab-preview-dock ${
                isHalfHide ? "kt-fab-preview-dock--half-hide" : ""
              } ${isActive ? "kt-fab-preview-dock--active" : ""}`.trim()}
            >
              <Box
                className="kt-fab-preview-opacity"
                style={{ opacity: isActive ? 1 : opacityPercent / 100 }}
              >
                <FloatingButton
                  size={sizePixels}
                  opensMenu={fab?.fabClickAction !== 1}
                  className="kt-fab-preview-button"
                  aria-label={i18n("fab_appearance")}
                  onClick={(event) => {
                    if (event.detail > 0) event.currentTarget.blur();
                  }}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                />
              </Box>
            </Box>
            <Typography
              component="span"
              className="kt-fab-preview-dimensions"
              aria-hidden="true"
            >
              {sizePixels} × {sizePixels} px
            </Typography>
          </Box>
        </Box>
        <Box className="kt-fab-appearance-controls">
          <Box>
            <Box className="kt-fab-appearance-label-row">
              <Typography
                component="label"
                id="fab-opacity-label"
                htmlFor="fab-opacity-input"
              >
                {i18n("fab_opacity")}
              </Typography>
              <Typography id="fab-opacity-value" component="output">
                {opacityPercent}%
              </Typography>
            </Box>
            <Slider
              name="opacity"
              aria-labelledby="fab-opacity-label"
              componentsProps={{
                input: {
                  id: "fab-opacity-input",
                  "aria-describedby": "fab-opacity-helper",
                },
              }}
              value={opacityPercent}
              min={FAB_MIN_OPACITY * 100}
              max={100}
              step={5}
              getAriaValueText={(value) => `${value}%`}
              onChange={(_event, value) => setOpacityPercent(value)}
              onChangeCommitted={(_event, value) =>
                onChange({ opacity: value / 100 })
              }
            />
            <FormHelperText
              id="fab-opacity-helper"
              className="kt-fab-appearance-helper"
            >
              {i18n("fab_opacity_helper")}
            </FormHelperText>
          </Box>
          <Box>
            <Box className="kt-fab-appearance-label-row">
              <Typography
                component="label"
                id="fab-size-label"
                htmlFor="fab-size-input"
              >
                {i18n("fab_size")}
              </Typography>
              <Typography id="fab-size-value" component="output">
                {sizePixels} px
              </Typography>
            </Box>
            <Slider
              name="size"
              aria-labelledby="fab-size-label"
              componentsProps={{
                input: {
                  id: "fab-size-input",
                  "aria-describedby": "fab-size-helper",
                },
              }}
              value={sizePixels}
              min={FAB_MIN_SIZE}
              max={FAB_MAX_SIZE}
              step={4}
              getAriaValueText={(value) => `${value} px`}
              onChange={(_event, value) => setSizePixels(value)}
              onChangeCommitted={(_event, value) => onChange({ size: value })}
            />
            <FormHelperText
              id="fab-size-helper"
              className="kt-fab-appearance-helper"
            >
              {i18n("fab_size_helper")
                .replace("{min}", FAB_MIN_SIZE)
                .replace("{max}", FAB_MAX_SIZE)
                .replace("{default}", DEFAULT_FAB.size)}
            </FormHelperText>
          </Box>
        </Box>
      </Box>
      <FormHelperText className="kt-fab-appearance-refresh">
        {i18n("fab_preview_refresh_helper")}
      </FormHelperText>
    </Box>
  );
}
