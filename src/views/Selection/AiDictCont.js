import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { apiDict } from "../../apis";
import { useI18n } from "../../hooks/I18n";
import { BrowserTtsBtn } from "./AudioBtn";
import CopyBtn from "./CopyBtn";

const pendingRequests = new Map();

/**
 * Build a deduplication key for AI dictionary requests.
 *
 * React rerenders or StrictMode can trigger duplicate requests in one panel.
 * Include the complete input, language, API settings, and context to avoid reusing unrelated results.
 */
function getRequestKey({ text, fromLang, toLang, apiSettingKey, context }) {
  return JSON.stringify({
    text,
    fromLang,
    toLang,
    apiSettingKey,
    context,
  });
}

/**
 * AI dictionary result view.
 *
 * Handles request deduplication, streaming Markdown, errors, copying, and speech.
 * Delegates dictionary generation to `apiDict` so the UI only manages display state.
 */
export default function AiDictCont({
  text,
  fromLang,
  speechLang,
  toLang,
  apiSetting,
  context = "",
}) {
  const i18n = useI18n();
  const [markdown, setMarkdown] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const apiSettingKey = JSON.stringify(apiSetting || {});

  useEffect(() => {
    if (!text?.trim() || !apiSetting?.apiSlug) {
      setMarkdown("");
      setLoading(false);
      setError("");
      return;
    }

    let active = true;
    const requestKey = getRequestKey({
      text,
      fromLang,
      toLang,
      apiSettingKey,
      context,
    });

    const handleStreamChunk = ({ markdown: chunkMarkdown }) => {
      if (active && chunkMarkdown) {
        setMarkdown(chunkMarkdown);
      }
    };

    (async () => {
      try {
        setLoading(true);
        setMarkdown("");
        setError("");

        // Identical component instances share an in-flight request to avoid duplicate API calls.
        let pending = pendingRequests.get(requestKey);
        if (!pending) {
          const controller = new AbortController();
          pending = {
            controller,
            subscribers: new Set(),
            promise: null,
          };
          pending.promise = apiDict({
            text,
            fromLang,
            toLang,
            apiSetting,
            context,
            signal: controller.signal,
            onStreamChunk: (chunk) => {
              pending.subscribers.forEach((subscriber) => subscriber(chunk));
            },
          }).finally(() => {
            if (pendingRequests.get(requestKey) === pending) {
              pendingRequests.delete(requestKey);
            }
          });
          pendingRequests.set(requestKey, pending);
        }

        pending.subscribers.add(handleStreamChunk);
        const result = await pending.promise;

        if (active) {
          setMarkdown(result);
        }
      } catch (err) {
        if (err?.name === "AbortError") {
          return;
        }

        if (active) {
          setError(err.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
      const pending = pendingRequests.get(requestKey);
      if (!pending) return;
      pending.subscribers.delete(handleStreamChunk);
      if (pending.subscribers.size === 0) {
        pending.controller.abort();
        pendingRequests.delete(requestKey);
      }
    };
  }, [text, fromLang, toLang, apiSettingKey, context]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (loading && !markdown) {
    return <CircularProgress size={16} />;
  }

  if (!markdown) {
    return null;
  }

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        columnGap: 1,
        alignItems: "start",
        fontSize: "var(--kt-text-body, 14px)",
        lineHeight: 1.6,
        "& > :first-of-type": { mt: 0 },
        "& > :last-child": { mb: 0 },
        "& h1, & h2, & h3, & h4, & h5, & h6": {
          fontSize: "var(--kt-text-heading, 15px)",
          fontWeight: 600,
          lineHeight: 1.4,
          mt: 1.25,
          mb: 0.75,
        },
        "& p": { my: 0.75, maxWidth: "65ch" },
        "& ul, & ol": { pl: 2.5, my: 0.75, maxWidth: "65ch" },
        "& li + li": { mt: 0.35 },
        "& blockquote": {
          m: 0,
          my: 0.75,
          pl: 1.5,
          borderLeft: "2px solid var(--kt-line)",
          color: "var(--kt-onv)",
          maxWidth: "65ch",
        },
        "& code": {
          px: 0.5,
          py: 0.1,
          borderRadius: "var(--kt-radius-sm, 6px)",
          bgcolor: "var(--kt-sf1)",
          fontFamily: "var(--kt-font-mono)",
          fontSize: "var(--kt-text-sm, 13px)",
        },
      }}
    >
      <Box
        sx={{
          gridColumn: 2,
          gridRow: 1,
          display: "flex",
          alignItems: "center",
        }}
      >
        {loading && (
          <CircularProgress size={14} sx={{ mr: 0.5, flexShrink: 0 }} />
        )}
        <BrowserTtsBtn
          text={text}
          lang={speechLang || fromLang || "en-US"}
          title={i18n("read_aloud")}
        />
        <CopyBtn
          text={markdown}
          title={i18n("copy")}
          copiedLabel={i18n("copy_success", "Copied")}
        />
      </Box>
      <Typography
        component="div"
        sx={{
          gridColumn: 1,
          gridRow: 1,
          minWidth: 0,
          fontSize: "var(--kt-text-body, 14px)",
          lineHeight: 1.6,
        }}
      >
        <ReactMarkdown>{markdown}</ReactMarkdown>
      </Typography>
    </Box>
  );
}
