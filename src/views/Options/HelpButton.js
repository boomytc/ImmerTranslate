import Button from "@mui/material/Button";
import { useI18n } from "../../hooks/I18n";
import HelpIcon from "@mui/icons-material/Help";

/**
 * 统一的帮助文档跳转按钮组件
 *
 * @param {Object} props
 * @param {string} props.url - 点击后跳转的帮助说明网页链接 URL
 */
export default function HelpButton({ url }) {
  const i18n = useI18n();
  return (
    <Button
      component="a"
      size="small"
      variant="outlined"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      startIcon={<HelpIcon />}
    >
      {i18n("help")}
    </Button>
  );
}
