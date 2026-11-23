import {
  Routes,
  Route,
  HashRouter,
  Navigate,
  useLocation,
} from "react-router-dom";
import About from "./About";
import Rules from "./Rules";
import Setting from "./Setting";
import Layout from "./Layout";
import SyncSetting from "./SyncSetting";
import { SettingProvider } from "../../hooks/Setting";
import { useI18n } from "../../hooks/I18n";
import M3Theme from "../../hooks/M3Theme";
import ThemeProvider from "./OptionsTheme";
import { useEffect, useRef, useState } from "react";
import { AlertProvider } from "../../hooks/Alert";
import { ConfirmProvider } from "../../hooks/Confirm";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Apis from "./Apis";
import Prompts from "./Prompts";
import InputSetting from "./InputSetting";
import Tranbox from "./Tranbox";
import MouseHoverSetting from "./MouseHover";
import SubtitleSetting from "./Subtitle";
import StylesSetting from "./StylesSetting";
import Backdrop from "@mui/material/Backdrop";
import CircularProgress from "@mui/material/CircularProgress";
import InteractionLock from "./InteractionLock";
import {
  createOptionsStartup,
  getRequiredOptionsSyncKeys,
  OPTIONS_SYNC_KEYS,
} from "./startup";

export { normalizeOptionsPath as normalizeOptionsHashPath } from "./paths";

function SyncBackdrop({ open }) {
  const i18n = useI18n();
  return (
    <Backdrop
      aria-label={i18n("syncing_required_data")}
      role="status"
      open={open}
      sx={(theme) => ({
        color: "#fff",
        zIndex: theme.zIndex.modal + 1,
      })}
    >
      <CircularProgress color="inherit" size={72} />
    </Backdrop>
  );
}

function OptionsContent({ pendingKeys, children }) {
  const { pathname } = useLocation();
  const syncing = getRequiredOptionsSyncKeys(pathname).some((key) =>
    pendingKeys.includes(key)
  );

  return (
    <>
      <InteractionLock locked={syncing}>{children}</InteractionLock>
      <SyncBackdrop open={syncing} />
    </>
  );
}

export default function Options() {
  const [error, setError] = useState("");
  const [pendingKeys, setPendingKeys] = useState(OPTIONS_SYNC_KEYS);
  const startupRef = useRef(null);

  useEffect(() => {
    let active = true;
    // Reuse the work when StrictMode subscribes to this effect a second time.
    if (!startupRef.current) startupRef.current = createOptionsStartup();
    const reportError = (err) => {
      if (active) setError(err?.message || String(err));
    };

    Object.entries(startupRef.current.completed).forEach(([key, completed]) => {
      completed.then(() => {
        if (active) {
          setPendingKeys((pending) => pending.filter((item) => item !== key));
        }
      }, reportError);
    });

    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <M3Theme standaloneRoot>
        <Box
          sx={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: 3,
          }}
        >
          <Stack spacing={2} sx={{ width: "min(560px, 100%)" }}>
            <Divider>
              <Link
                href={process.env.REACT_APP_HOMEPAGE}
                target="_blank"
                rel="noopener noreferrer"
              >{`${process.env.REACT_APP_NAME} ${process.env.REACT_APP_VERSION}`}</Link>
            </Divider>
            <Alert severity="error">{error}</Alert>
          </Stack>
        </Box>
      </M3Theme>
    );
  }

  return (
    <SettingProvider context="options">
      <ThemeProvider>
        <HashRouter>
          <OptionsContent pendingKeys={pendingKeys}>
            <AlertProvider>
              <ConfirmProvider>
                <Routes>
                  <Route path="/" element={<Layout />}>
                    <Route index element={<Setting />} />
                    <Route path="rules" element={<Rules />} />
                    <Route path="styles" element={<StylesSetting />} />
                    <Route path="input" element={<InputSetting />} />
                    <Route path="tranbox" element={<Tranbox />} />
                    <Route path="mousehover" element={<MouseHoverSetting />} />
                    <Route path="subtitle" element={<SubtitleSetting />} />
                    <Route path="apis" element={<Apis />} />
                    <Route path="prompts" element={<Prompts />} />
                    <Route path="sync" element={<SyncSetting />} />
                    <Route path="about" element={<About />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Routes>
              </ConfirmProvider>
            </AlertProvider>
          </OptionsContent>
        </HashRouter>
      </ThemeProvider>
    </SettingProvider>
  );
}
