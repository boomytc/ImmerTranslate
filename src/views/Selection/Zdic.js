import { useEffect, useState } from "react";
import {
  Typography,
  Stack,
  Divider,
  CircularProgress,
  Box,
} from "@mui/material";
import { apiZdic } from "../../apis/zdic";
import { useI18n } from "../../hooks/I18n";
import { kissLog } from "../../libs/log";
import { AudioBtn } from "./AudioBtn";

/**
 * 汉典释义渲染组件 (用于在查询单个中文字符时提供拼音、部首、五笔、繁体及字义释义)
 *
 * @param {Object} props
 * @param {string} props.text - 查询的汉字
 */
export default function Zdic({ text }) {
  const i18n = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setData(null);
    if (!text) {
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);

    apiZdic(text)
      .then((res) => {
        if (active) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          kissLog("zdic lookup", err);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [text]);

  if (loading) {
    return (
      <Stack alignItems="center" justifyContent="center" py={2}>
        <CircularProgress size={20} />
      </Stack>
    );
  }

  if (!data) {
    return (
      <Stack spacing={1}>
        <Typography
          variant="subtitle1"
          sx={{
            fontSize: "var(--kt-text-heading, 15px)",
            fontWeight: 600,
            lineHeight: 1.35,
          }}
        >
          {text}
        </Typography>
        <Divider />
        <Typography
          variant="body2"
          sx={{
            color: "var(--kt-onv)",
            fontSize: "var(--kt-text-sm, 13px)",
            lineHeight: 1.5,
          }}
        >
          {i18n("dict_no_data")}
        </Typography>
      </Stack>
    );
  }

  const metaItems = [
    data.bushou && { label: i18n("zdic_radical"), value: data.bushou },
    data.wubi && { label: i18n("zdic_wubi"), value: data.wubi },
    data.fanti && { label: i18n("zdic_traditional"), value: data.fanti },
    data.yiti && { label: i18n("zdic_variant"), value: data.yiti },
  ].filter(Boolean);

  const foreignItems = [
    data.en && { label: i18n("zdic_en"), value: data.en },
    data.de && { label: i18n("zdic_de"), value: data.de },
    data.fr && { label: i18n("zdic_fr"), value: data.fr },
  ].filter(Boolean);

  return (
    <Stack spacing={1.25}>
      <Typography
        variant="subtitle1"
        sx={{
          fontSize: "var(--kt-text-heading, 15px)",
          fontWeight: 600,
          lineHeight: 1.35,
        }}
      >
        {data.text}
      </Typography>
      <Divider />

      {metaItems.length > 0 && (
        <div className="kt-dict-meta-grid">
          {metaItems.map(({ label, value }) => (
            <span className="kt-dict-meta-item" key={label}>
              <span className="kt-dict-meta-label">{label}</span>
              <span className="kt-dict-meta-value">{value}</span>
            </span>
          ))}
        </div>
      )}

      {data.results && data.results.length > 0 && (
        <Stack spacing={1.25}>
          {data.results.map((res, idx) => (
            <Box key={idx}>
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <Typography
                  component="span"
                  sx={{
                    color: "var(--kt-pri)",
                    fontSize: "var(--kt-text-body, 14px)",
                    fontWeight: 600,
                    lineHeight: 1.4,
                  }}
                >
                  {res.pinyin}
                </Typography>
                {res.audioUrl && <AudioBtn src={res.audioUrl} />}
              </Stack>
              {res.definitions && res.definitions.length > 0 && (
                <ol className="kt-dict-list">
                  {res.definitions.map((def, i) => (
                    <li key={i}>{def}</li>
                  ))}
                </ol>
              )}
            </Box>
          ))}
        </Stack>
      )}

      {foreignItems.length > 0 && (
        <Stack spacing={0.5}>
          {foreignItems.map(({ label, value }) => (
            <div className="kt-dict-meta-item" key={label}>
              <span className="kt-dict-meta-label">{label}</span>
              <span
                className="kt-dict-meta-value"
                style={{ wordBreak: "break-word" }}
              >
                {value}
              </span>
            </div>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
