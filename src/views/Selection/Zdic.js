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
  // 存放汉典接口返回的数据
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  // 监听 text 变化，发起汉典查询
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
        <CircularProgress size={24} />
      </Stack>
    );
  }

  // 无汉典数据时的备用占位显示
  if (!data) {
    return (
      <Stack spacing={1}>
        <Typography variant="subtitle1" style={{ fontWeight: "bold" }}>
          {text}
        </Typography>
        <Divider />
        <Typography variant="body2" color="text.secondary">
          {i18n("dict_no_data")}
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={1}>
      {/* 汉字标题 */}
      <Typography variant="subtitle1" style={{ fontWeight: "bold" }}>
        {data.text}
      </Typography>
      <Divider />

      {/* 部首与五笔信息 */}
      {(data.bushou || data.wubi) && (
        <Typography variant="body2" color="text.secondary">
          {data.bushou && `[${i18n("zdic_radical")}]: ${data.bushou}  `}
          {data.wubi && `[${i18n("zdic_wubi")}]: ${data.wubi}`}
        </Typography>
      )}

      {/* 繁体与异体字信息 */}
      {(data.fanti || data.yiti) && (
        <Typography variant="body2" color="text.secondary">
          {data.fanti && `[${i18n("zdic_traditional")}]: ${data.fanti}  `}
          {data.yiti && `[${i18n("zdic_variant")}]: ${data.yiti}`}
        </Typography>
      )}

      {/* 字音、拼音发音以及汉典释义多分支 */}
      {data.results && data.results.length > 0 && (
        <Stack spacing={1} mt={1}>
          {data.results.map((res, idx) => (
            <Box key={idx}>
              <Stack direction="row" alignItems="center" spacing={1}>
                {/* 拼音 */}
                <Typography
                  variant="body2"
                  color="primary"
                  style={{ fontWeight: "bold" }}
                >
                  [{res.pinyin}]
                </Typography>
                {/* 汉字发音音频按钮 */}
                {res.audioUrl && <AudioBtn src={res.audioUrl} />}
              </Stack>
              {/* 字义解释列表 */}
              <Box component="ol" sx={{ pl: 3, m: 0, mt: 0.5 }}>
                {res.definitions &&
                  res.definitions.map((def, i) => (
                    <Typography
                      component="li"
                      key={i}
                      variant="body2"
                      sx={{ mb: 0.5 }}
                    >
                      {def}
                    </Typography>
                  ))}
              </Box>
            </Box>
          ))}
        </Stack>
      )}

      {/* 外语英法德翻译对照 (若有) */}
      {(data.en || data.de || data.fr) && (
        <Stack spacing={0.5} mt={1}>
          {data.en && (
            <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
              {`[${i18n("zdic_en")}]: ${data.en}`}
            </Typography>
          )}
          {data.de && (
            <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
              {`[${i18n("zdic_de")}]: ${data.de}`}
            </Typography>
          )}
          {data.fr && (
            <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
              {`[${i18n("zdic_fr")}]: ${data.fr}`}
            </Typography>
          )}
        </Stack>
      )}
    </Stack>
  );
}
