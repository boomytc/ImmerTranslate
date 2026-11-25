import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import { apiBaiduSuggest, apiYoudaoSuggest } from "../../apis";
import Stack from "@mui/material/Stack";
import { OPT_SUG_BAIDU, OPT_SUG_YOUDAO } from "../../config";
import { useAsyncNow } from "../../hooks/Fetch";
import { useI18n } from "../../hooks/I18n";

function SugList({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <ul className="kt-sug-list">
      {items.map(({ term, desc }) => (
        <li className="kt-sug-list__item" key={term}>
          <div className="kt-sug-list__term">{term}</div>
          {desc && <div className="kt-sug-list__desc">{desc}</div>}
        </li>
      ))}
    </ul>
  );
}

/**
 * 百度输入建议/联想词列表组件
 */
function SugBaidu({ text }) {
  const { loading, error, data } = useAsyncNow(apiBaiduSuggest, text);

  if (loading) {
    return <CircularProgress size={16} />;
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!data) {
    return null;
  }

  return <SugList items={data.map(({ k, v }) => ({ term: k, desc: v }))} />;
}

/**
 * 有道输入建议/联想词列表组件
 */
function SugYoudao({ text }) {
  const { loading, error, data } = useAsyncNow(apiYoudaoSuggest, text);

  if (loading) {
    return <CircularProgress size={16} />;
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!data) {
    return null;
  }

  return (
    <SugList
      items={data.map(({ entry, explain }) => ({ term: entry, desc: explain }))}
    />
  );
}

/**
 * 输入联想面板容器组件
 *
 * @param {Object} props
 * @param {string} props.text - 当前输入的搜索文本
 * @param {string} props.enSug - 选择的建议联想服务类型 (OPT_SUG_BAIDU 或 OPT_SUG_YOUDAO)
 */
export default function SugCont({ text, enSug }) {
  const i18n = useI18n();

  return (
    <Stack spacing={1}>
      <Divider />
      {enSug === OPT_SUG_BAIDU ? (
        <SugBaidu text={text} />
      ) : enSug === OPT_SUG_YOUDAO ? (
        <SugYoudao text={text} />
      ) : (
        <Typography
          variant="body2"
          sx={{
            color: "var(--kt-onv)",
            fontSize: "var(--kt-text-sm, 13px)",
            lineHeight: 1.5,
          }}
        >
          {i18n("sug_not_supported")}
        </Typography>
      )}
    </Stack>
  );
}
