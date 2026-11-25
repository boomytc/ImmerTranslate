import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import Button from "@mui/material/Button";
import { useI18n } from "../../hooks/I18n";

/**
 * 可折叠的高级设置展开/折叠控制按钮
 *
 * @param {Object} props
 * @param {Function} props.onChange - 控制 showMore 状态改变的回调函数
 * @param {boolean} props.showMore - 是否展示更多高级配置
 */
export default function ShowMoreButton({ onChange, showMore }) {
  const i18n = useI18n();
  // 切换折叠显示状态
  const handleClick = () => {
    onChange((prev) => !prev);
  };

  return (
    <Button
      size="small"
      variant="text"
      aria-expanded={Boolean(showMore)}
      onClick={handleClick}
      startIcon={
        showMore ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />
      }
    >
      {showMore ? i18n("less") : i18n("more")}
    </Button>
  );
}
