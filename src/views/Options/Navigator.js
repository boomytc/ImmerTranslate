import { useMemo, useState } from "react";
import ApiRoundedIcon from "@mui/icons-material/ApiRounded";
import CloudSyncRoundedIcon from "@mui/icons-material/CloudSyncRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import KeyboardRoundedIcon from "@mui/icons-material/KeyboardRounded";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import SegmentRoundedIcon from "@mui/icons-material/SegmentRounded";
import PaletteRoundedIcon from "@mui/icons-material/PaletteRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import SelectAllRoundedIcon from "@mui/icons-material/SelectAllRounded";
import SubtitlesRoundedIcon from "@mui/icons-material/SubtitlesRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import { NavLink } from "react-router-dom";
import Logo from "../../components/Logo";
import { useI18n } from "../../hooks/I18n";
import { useSetting } from "../../hooks/Setting";
import DarkModeButton from "./DarkModeButton";

const NAV_KEYWORDS = {
  overview:
    "通用 概览 快捷键 黑名单 缓存 悬浮球 浮球 右键菜单 语言检测 导入 导出 日志 剪贴板 csp general overview shortcut hotkey blacklist cache fab floating button context menu detector import export log clipboard",
  appearance:
    "外观 样式 主题 深色 浅色 界面语言 自定义 css 字体 appearance theme dark light mode language custom css style",
  web: "网页翻译 规则 全局规则 个人规则 域名 选择器 术语 专有名词 仅译文 切分 标题 web translation rules global personal domain selector terms glossary split title",
  selection:
    "划词 选中 翻译框 词典 必应 有道 ai词典 快捷键 跟随选区 黑名单 selection tranbox popup dictionary bing youdao shortcut blacklist",
  hover:
    "段落 悬停 鼠标 长按 气泡 快捷键 黑名单 paragraph hover mouse hold bubble shortcut blacklist",
  input:
    "输入框 打字 连击 触发符 红点 快捷键 黑名单 input box typing combo trigger sign dot shortcut blacklist",
  subtitle:
    "字幕 视频 youtube 双语 断句 预翻译 样式 字体 阴影 subtitle video youtube bilingual segmentation style font shadow",
  apis: "翻译服务 接口 密钥 api key 模型 流式 上下文 思考 温度 并发 自定义 测试 service provider model stream context thinking temperature batch custom test",
  prompts:
    "提示词 模板 系统提示词 用户提示词 占位符 词典 断句 prompt template system user placeholder",
  sync: "同步 备份 云端 webdav gist 坚果云 nextcloud 加密 口令 分享码 sync backup cloud encryption key share token",
  about: "关于 版本 许可证 github 官网 主页 about version license homepage",
};

function normalizeSearchText(text, uiLang) {
  try {
    return text.toLocaleLowerCase(uiLang?.replace(/_/g, "-") || undefined);
  } catch {
    return text.toLocaleLowerCase();
  }
}

export default function Navigator({ open, compact = false, onClose }) {
  const i18n = useI18n();
  const {
    setting: { uiLang },
  } = useSetting();
  const [query, setQuery] = useState("");

  const groups = useMemo(
    () => [
      {
        label: i18n("options_group_general"),
        items: [
          ["overview", i18n("options_overview"), "/", TuneRoundedIcon],
          [
            "appearance",
            i18n("options_appearance"),
            "/styles",
            PaletteRoundedIcon,
          ],
        ],
      },
      {
        label: i18n("options_group_scenarios"),
        items: [
          [
            "web",
            i18n("options_web_translation"),
            "/rules",
            LanguageRoundedIcon,
          ],
          [
            "selection",
            i18n("selection_translate"),
            "/tranbox",
            SelectAllRoundedIcon,
          ],
          [
            "hover",
            i18n("paragraph_translate"),
            "/mousehover",
            SegmentRoundedIcon,
          ],
          ["input", i18n("input_translate"), "/input", KeyboardRoundedIcon],
          [
            "subtitle",
            i18n("subtitle_translate"),
            "/subtitle",
            SubtitlesRoundedIcon,
          ],
        ],
      },
      {
        label: i18n("options_group_services"),
        items: [
          [
            "apis",
            i18n("options_translation_services"),
            "/apis",
            ApiRoundedIcon,
          ],
          [
            "prompts",
            i18n("prompt_management"),
            "/prompts",
            DescriptionRoundedIcon,
          ],
        ],
      },
      {
        label: i18n("options_group_data"),
        items: [
          ["sync", i18n("options_data_sync"), "/sync", CloudSyncRoundedIcon],
        ],
      },
      {
        label: "",
        items: [["about", i18n("about"), "/about", InfoRoundedIcon]],
      },
    ],
    [i18n]
  );

  const normalizedQuery = normalizeSearchText(query.trim(), uiLang);
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter(([id, label]) => {
        if (!normalizedQuery) return true;
        const searchable = `${label} ${group.label} ${NAV_KEYWORDS[id] || ""}`;
        return normalizeSearchText(searchable, uiLang).includes(
          normalizedQuery
        );
      }),
    }))
    .filter((group) => group.items.length);

  return (
    <aside
      id="kt-options-navigation"
      className={`kt-options-sidebar ${open ? "kt-options-sidebar--open" : ""}`.trim()}
      role={compact ? "dialog" : undefined}
      aria-modal={compact && open ? "true" : undefined}
      aria-hidden={compact && !open ? "true" : undefined}
      inert={compact && !open ? "" : undefined}
      aria-labelledby={compact ? "kt-options-navigation-title" : undefined}
      tabIndex={compact ? -1 : undefined}
    >
      <div className="kt-options-brand-row">
        <a
          className="kt-options-brand"
          href={process.env.REACT_APP_HOMEPAGE}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Logo size={30} />
          <span className="kt-options-brand__text">
            <span
              id="kt-options-navigation-title"
              className="kt-options-brand__name"
            >
              {i18n("app_name")}
            </span>
            <span className="kt-options-brand__version">
              {process.env.REACT_APP_VERSION}
            </span>
          </span>
        </a>
        {compact ? (
          <button
            type="button"
            className="kt-options-sidebar__close"
            aria-label={i18n("options_close_navigation")}
            onClick={() => onClose?.(true)}
          >
            <CloseRoundedIcon />
          </button>
        ) : (
          <DarkModeButton />
        )}
      </div>
      <label className="kt-options-search">
        <SearchRoundedIcon />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={i18n("options_search")}
          aria-label={i18n("options_search")}
        />
      </label>
      <nav className="kt-options-nav">
        {visibleGroups.length ? (
          visibleGroups.map((group) => (
            <section
              className="kt-options-nav__group"
              key={group.label || "other"}
            >
              {group.label && (
                <h2 className="kt-options-nav__label">{group.label}</h2>
              )}
              {group.items.map(([id, label, path, Icon]) => (
                <NavLink
                  className="kt-options-nav__link"
                  to={path}
                  end={path === "/"}
                  key={id}
                  onClick={compact ? () => onClose?.(false) : undefined}
                >
                  <Icon />
                  <span>{label}</span>
                </NavLink>
              ))}
            </section>
          ))
        ) : (
          <div className="kt-options-nav__empty">
            {i18n("options_no_results")}
          </div>
        )}
      </nav>
    </aside>
  );
}
