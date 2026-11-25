import Button from "@mui/material/Button";
import { useI18n } from "../../hooks/I18n";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";

/**
 * 统一的帮助文档跳转链接按钮组件
 *
 * @param {Object} props
 * @param {string} props.url - 点击后跳转的帮助说明网页链接 URL
 * @param {string} [props.variant="text"] - MUI Button 样式变体
 */
export default function HelpButton({ url, variant = "text" }) {
  const i18n = useI18n();
  return (
    <Button
      component="a"
      size="small"
      variant={variant}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      startIcon={<HelpOutlineRoundedIcon />}
    >
      {i18n("help")}
    </Button>
  );
}
