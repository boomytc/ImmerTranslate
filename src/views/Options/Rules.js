import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import CodeField from "./CodeField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import InputAdornment from "@mui/material/InputAdornment";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
  GLOBAL_KEY,
  DEFAULT_RULE,
  GLOBLA_RULE,
  OPT_LANGS_FROM_REVERSED as OPT_LANGS_FROM,
  OPT_LANGS_TO_REVERSED as OPT_LANGS_TO,
  URL_KISS_RULES_NEW_ISSUE,
  DEFAULT_TRANS_TAG,
  OPT_SPLIT_PARAGRAPH_DISABLE,
  OPT_SPLIT_PARAGRAPH_ALL,
} from "../../config";
import { useState, useEffect, useMemo } from "react";
import { useI18n } from "../../hooks/I18n";
import Typography from "@mui/material/Typography";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useRules } from "../../hooks/Rules";
import MenuItem from "@mui/material/MenuItem";
import Grid from "@mui/material/Grid";
import Switch from "@mui/material/Switch";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import DeleteIcon from "@mui/icons-material/Delete";
import { useAlert } from "../../hooks/Alert";
import { debounce } from "../../libs/utils";
import ClearAllIcon from "@mui/icons-material/ClearAll";
import HelpButton from "./HelpButton";
import DownloadButton from "./DownloadButton";
import UploadButton from "./UploadButton";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import CancelIcon from "@mui/icons-material/Cancel";
import SaveIcon from "@mui/icons-material/Save";
import ValidationInput from "../../hooks/ValidationInput";
import { kissLog } from "../../libs/log";
import { useApiList, getApiDisplayName } from "../../hooks/Api";
import ShowMoreButton from "./ShowMoreButton";
import { useConfirm } from "../../hooks/Confirm";
import { useAllTextStyles } from "../../hooks/CustomStyles";
import { sameRulePattern } from "../../libs/siteMatch";

// 存储里的个人规则可以是稀疏的（popup / FAB 只写 pattern + transOpen），
// 编辑器在这里用整份默认结构补齐缺的字段。
const calculateInitialValues = (rule) => {
  const base = rule?.pattern === GLOBAL_KEY ? GLOBLA_RULE : DEFAULT_RULE;
  return { ...base, ...(rule || {}) };
};

// 编辑保存只写用户改过的字段，稀疏规则保持稀疏。
const ruleEditPatch = (storedRule, values) => {
  const before = calculateInitialValues(storedRule);
  return Object.fromEntries(
    Object.entries(values).filter(([key, value]) => before[key] !== value)
  );
};

const BOOLEAN_RULE_FIELDS = [
  { name: "autoScan", labelKey: "auto_scan_page" },
  { name: "hasRichText", labelKey: "has_rich_text" },
  { name: "hasShadowroot", labelKey: "has_shadowroot" },
  { name: "scanAll", labelKey: "scan_all_nodes" },
  { name: "isPlainText", labelKey: "plain_text_translate" },
  { name: "transOnly", labelKey: "show_only_translations" },
  { name: "transOnlyRevert", labelKey: "transonly_revert" },
  { name: "transTitle", labelKey: "translate_page_title" },
  { name: "wrapOriginal", labelKey: "wrap_original" },
];

// 规则编辑/添加表单字段组件
function RuleFields({ rule, rules, setShow, setKeyword }) {
  const editMode = useMemo(() => !!rule, [rule]);

  const i18n = useI18n();
  const alert = useAlert();
  const confirm = useConfirm();
  const [disabled, setDisabled] = useState(editMode);
  const [errors, setErrors] = useState({});
  const [initialFormValues, setInitialFormValues] = useState(() =>
    calculateInitialValues(rule)
  );
  const [formValues, setFormValues] = useState(initialFormValues);
  const [showMore, setShowMore] = useState(!rules);
  const { enabledApis } = useApiList();
  const { allTextStyles } = useAllTextStyles();

  useEffect(() => {
    const newInitialValues = calculateInitialValues(rule);
    setInitialFormValues(newInitialValues);
    setFormValues(newInitialValues);
  }, [rule]);

  const {
    pattern,
    selector,
    keepSelector = "",
    blockSelector = "",
    rootsSelector = "",
    ignoreSelector = "",
    terms,
    aiTerms,
    termsStyle = "",
    highlightStyle = "color: red;",
    textExtStyle = "",
    selectStyle = "",
    parentStyle = "",
    grandStyle = "",
    injectCss = "",
    apiSlug,
    fromLang,
    toLang,
    textStyle,
    wrapOriginal = "false",
    originalTextStyle = "style_none",
    transOpen,
    transOnlyRevertDelay = "0.5",
    autoScan = "true",
    transTag = DEFAULT_TRANS_TAG,
    splitParagraph = OPT_SPLIT_PARAGRAPH_DISABLE,
    splitLength = 0,
    transOrder,
  } = formValues;

  const parsedRevertDelay =
    transOnlyRevertDelay !== "" &&
    transOnlyRevertDelay !== null &&
    transOnlyRevertDelay !== undefined
      ? Number(transOnlyRevertDelay)
      : NaN;
  const revertDelayValue = Number.isFinite(parsedRevertDelay)
    ? parsedRevertDelay
    : Number(GLOBLA_RULE.transOnlyRevertDelay);

  const isGlobalRule = rule?.pattern === GLOBAL_KEY;
  const globalRule = rules?.list?.find((item) => item.pattern === GLOBAL_KEY);
  const effectiveWrapOriginal =
    wrapOriginal === GLOBAL_KEY
      ? globalRule?.wrapOriginal === "true"
      : wrapOriginal === "true";

  const isModified = useMemo(
    () => JSON.stringify(initialFormValues) !== JSON.stringify(formValues),
    [initialFormValues, formValues]
  );

  // 仅新增或更改 pattern 时查重，允许保留历史别名的其他字段编辑。
  const hasSamePattern = (str) => {
    if (str === rule?.pattern) return false;
    for (const item of rules.list) {
      if (
        sameRulePattern(item.pattern, str) &&
        item.pattern !== rule?.pattern
      ) {
        return true;
      }
    }
    return false;
  };

  const handleFocus = (e) => {
    e.preventDefault();
    const { name } = e.target;
    setErrors((pre) => ({ ...pre, [name]: "" }));
  };

  const handlePatternChange = useMemo(
    () =>
      debounce(async (patterns) => {
        setKeyword?.(patterns.trim());
      }, 500),
    [setKeyword]
  );

  const updateFormValue = (name, value) => {
    setFormValues((pre) => ({ ...pre, [name]: value }));
    if (name === "pattern" && !editMode) {
      handlePatternChange(value);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    updateFormValue(e.target.name, e.target.value);
  };

  const handleCancel = (e) => {
    e.preventDefault();
    if (editMode) {
      setDisabled(true);
    } else {
      setShow(false);
    }
    setErrors({});
    setFormValues(initialFormValues);
  };

  const handleRestore = async (e) => {
    e.preventDefault();
    const targetName = isGlobalRule
      ? i18n("global_rule")
      : rule?.pattern || pattern;
    const confirmed = await confirm({
      message: i18n("restore_rule_confirm").replace("{name}", targetName),
      confirmText: i18n("restore_default"),
      cancelText: i18n("cancel"),
    });
    if (!confirmed) return;

    setFormValues(({ pattern: currentPattern }) => ({
      ...(currentPattern === GLOBAL_KEY ? GLOBLA_RULE : DEFAULT_RULE),
      pattern: currentPattern,
    }));
  };

  const handleDelete = async (e) => {
    e.preventDefault();
    const confirmed = await confirm({
      message: i18n("delete_rule_confirm").replace("{name}", rule.pattern),
      confirmText: i18n("delete"),
      cancelText: i18n("cancel"),
    });
    if (confirmed) {
      try {
        await rules.del(rule.pattern);
      } catch (err) {
        kissLog("delete rule", err);
        alert.error(i18n("error_got_some_wrong"));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (!pattern.trim()) {
      nextErrors.pattern = i18n("error_cant_be_blank");
    }
    if (hasSamePattern(pattern)) {
      nextErrors.pattern = i18n("error_duplicate_values");
    }
    if (pattern === GLOBAL_KEY && !nextErrors.pattern && !selector.trim()) {
      nextErrors.selector = i18n("error_cant_be_blank");
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      if (editMode) {
        const patch = ruleEditPatch(rule, formValues);
        if (Object.keys(patch).length > 0) {
          await rules.put(rule.pattern, patch);
          alert.success(i18n("save_success"));
        }
        setDisabled(true);
      } else {
        await rules.add(formValues);
        alert.success(i18n("save_success"));
        setShow(false);
        setFormValues(initialFormValues);
      }
    } catch (err) {
      kissLog("save rule", err);
      alert.error(i18n("error_got_some_wrong"));
    }
  };

  const GlobalItem = !isGlobalRule && (
    <MenuItem key={GLOBAL_KEY} value={GLOBAL_KEY}>
      {GLOBAL_KEY}
    </MenuItem>
  );

  // 失效下拉值兜底，避免指向已禁用服务或已删除样式时触发 MUI out-of-range 警告
  const hasApiOption =
    (!isGlobalRule && apiSlug === GLOBAL_KEY) ||
    enabledApis.some((api) => api.apiSlug === apiSlug);
  const hasTextStyleOption =
    (!isGlobalRule && textStyle === GLOBAL_KEY) ||
    allTextStyles.some((item) => item.styleSlug === textStyle);
  const hasOriginalStyleOption =
    (!isGlobalRule && originalTextStyle === GLOBAL_KEY) ||
    allTextStyles.some((item) => item.styleSlug === originalTextStyle);
  const hasFromLangOption =
    (!isGlobalRule && fromLang === GLOBAL_KEY) ||
    OPT_LANGS_FROM.some(([lang]) => lang === fromLang);
  const hasToLangOption =
    (!isGlobalRule && toLang === GLOBAL_KEY) ||
    OPT_LANGS_TO.some(([lang]) => lang === toLang);

  return (
    <form onSubmit={handleSubmit}>
      <Stack spacing={2}>
        <CodeField
          size="small"
          label={i18n("pattern")}
          error={!!errors.pattern}
          helperText={errors.pattern || i18n("rule_pattern_helper")}
          name="pattern"
          value={pattern}
          disabled={isGlobalRule || disabled}
          onChange={handleChange}
          onFocus={handleFocus}
        />
        <CodeField
          size="small"
          label={i18n("root_selector")}
          helperText={i18n("root_selector_helper")}
          name="rootsSelector"
          value={rootsSelector}
          disabled={disabled}
          onChange={handleChange}
        />
        <CodeField
          size="small"
          label={i18n("ignore_selector")}
          helperText={i18n("ignore_selector_helper")}
          name="ignoreSelector"
          value={ignoreSelector}
          disabled={disabled}
          onChange={handleChange}
        />
        <CodeField
          size="small"
          label={i18n("target_selector")}
          error={!!errors.selector}
          helperText={errors.selector || i18n("selector_helper")}
          name="selector"
          value={selector}
          disabled={autoScan === "true" || disabled}
          onChange={handleChange}
          onFocus={handleFocus}
        />
        <CodeField
          size="small"
          label={i18n("keep_selector")}
          helperText={i18n("keep_selector_helper")}
          name="keepSelector"
          value={keepSelector}
          disabled={disabled}
          onChange={handleChange}
        />
        <CodeField
          size="small"
          label={i18n("block_selector")}
          helperText={i18n("block_selector_helper")}
          name="blockSelector"
          value={blockSelector}
          disabled={disabled}
          onChange={handleChange}
        />

        <Box>
          <Grid container spacing={2} columns={12}>
            <Grid item xs={12} sm={12} md={6} lg={6}>
              <TextField
                select
                size="small"
                fullWidth
                name="transOpen"
                value={transOpen}
                label={i18n("translate_alt")}
                disabled={disabled}
                onChange={handleChange}
              >
                {GlobalItem}
                <MenuItem value={"true"}>{i18n("default_enabled")}</MenuItem>
                <MenuItem value={"false"}>{i18n("default_disabled")}</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={12} md={6} lg={6}>
              <TextField
                select
                size="small"
                fullWidth
                name="apiSlug"
                value={apiSlug}
                label={i18n("translate_service")}
                disabled={disabled}
                onChange={handleChange}
              >
                {GlobalItem}
                {!hasApiOption && apiSlug && (
                  <MenuItem value={apiSlug} disabled>
                    {`${apiSlug} (${i18n("unavailable_option")})`}
                  </MenuItem>
                )}
                {enabledApis.map((api) => (
                  <MenuItem key={api.apiSlug} value={api.apiSlug}>
                    {getApiDisplayName(api)}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={12} md={6} lg={6}>
              <TextField
                select
                size="small"
                fullWidth
                name="fromLang"
                value={fromLang}
                label={i18n("from_lang")}
                disabled={disabled}
                onChange={handleChange}
              >
                {GlobalItem}
                {!hasFromLangOption && fromLang && (
                  <MenuItem value={fromLang} disabled>
                    {fromLang}
                  </MenuItem>
                )}
                {OPT_LANGS_FROM.map(([lang, name]) => (
                  <MenuItem key={lang} value={lang}>
                    {name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={12} md={6} lg={6}>
              <TextField
                select
                size="small"
                fullWidth
                name="toLang"
                value={toLang}
                label={i18n("to_lang")}
                disabled={disabled}
                onChange={handleChange}
              >
                {GlobalItem}
                {!hasToLangOption && toLang && (
                  <MenuItem value={toLang} disabled>
                    {toLang}
                  </MenuItem>
                )}
                {OPT_LANGS_TO.map(([lang, name]) => (
                  <MenuItem key={lang} value={lang}>
                    {name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {BOOLEAN_RULE_FIELDS.map(({ name, labelKey }) => (
              <Grid item xs={12} sm={12} md={6} lg={6} key={name}>
                <TextField
                  select
                  size="small"
                  fullWidth
                  name={name}
                  value={formValues[name] ?? "false"}
                  label={i18n(labelKey)}
                  disabled={disabled}
                  onChange={handleChange}
                >
                  {GlobalItem}
                  <MenuItem value={"false"}>{i18n("disable")}</MenuItem>
                  <MenuItem value={"true"}>{i18n("enable")}</MenuItem>
                </TextField>
              </Grid>
            ))}

            <Grid item xs={12} sm={12} md={6} lg={6}>
              <TextField
                select
                size="small"
                fullWidth
                name="transOrder"
                value={transOrder}
                label={i18n("trans_order")}
                disabled={disabled}
                onChange={handleChange}
              >
                {GlobalItem}
                <MenuItem value="original-first">
                  {i18n("original_first")}
                </MenuItem>
                <MenuItem value="translation-first">
                  {i18n("translation_first")}
                </MenuItem>
              </TextField>
            </Grid>

            {isGlobalRule && (
              <Grid item xs={12} sm={12} md={6} lg={6}>
                <ValidationInput
                  size="small"
                  fullWidth
                  isFloat
                  min={0}
                  name="transOnlyRevertDelay"
                  value={revertDelayValue}
                  label={i18n("transonly_revert_delay")}
                  disabled={disabled}
                  onChange={(e) =>
                    updateFormValue(
                      "transOnlyRevertDelay",
                      String(e.target.value)
                    )
                  }
                  inputProps={{ step: 0.1 }}
                />
              </Grid>
            )}

            <Grid item xs={12} sm={12} md={6} lg={6}>
              <TextField
                select
                size="small"
                fullWidth
                name="splitParagraph"
                value={splitParagraph}
                label={i18n("split_paragraph")}
                disabled={disabled}
                onChange={handleChange}
              >
                {GlobalItem}
                {OPT_SPLIT_PARAGRAPH_ALL.map((item) => (
                  <MenuItem key={item} value={item}>
                    {i18n(item)}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={12} md={6} lg={6}>
              <ValidationInput
                fullWidth
                size="small"
                label={i18n("split_length")}
                type="number"
                name="splitLength"
                value={splitLength}
                disabled={disabled}
                onChange={handleChange}
                min={0}
                max={1000}
              />
            </Grid>

            <Grid item xs={12} sm={12} md={6} lg={6}>
              <TextField
                select
                size="small"
                fullWidth
                name="transTag"
                value={transTag}
                label={i18n("translation_element_tag")}
                disabled={disabled}
                onChange={handleChange}
              >
                {GlobalItem}
                <MenuItem value={"span"}>{`<span>`}</MenuItem>
                <MenuItem value={"font"}>{`<font>`}</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} sm={12} md={6} lg={6}>
              <TextField
                select
                size="small"
                fullWidth
                name="textStyle"
                value={textStyle}
                label={i18n("text_style")}
                disabled={disabled}
                onChange={handleChange}
              >
                {GlobalItem}
                {!hasTextStyleOption && textStyle && (
                  <MenuItem value={textStyle} disabled>
                    {`${textStyle} (${i18n("unavailable_option")})`}
                  </MenuItem>
                )}
                {allTextStyles.map((item) => (
                  <MenuItem key={item.styleSlug} value={item.styleSlug}>
                    {item.styleName}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {effectiveWrapOriginal && (
              <Grid item xs={12} sm={12} md={6} lg={6}>
                <TextField
                  select
                  size="small"
                  fullWidth
                  name="originalTextStyle"
                  value={originalTextStyle}
                  label={i18n("original_text_style")}
                  disabled={disabled}
                  onChange={handleChange}
                >
                  {GlobalItem}
                  {!hasOriginalStyleOption && originalTextStyle && (
                    <MenuItem value={originalTextStyle} disabled>
                      {`${originalTextStyle} (${i18n("unavailable_option")})`}
                    </MenuItem>
                  )}
                  {allTextStyles.map((item) => (
                    <MenuItem key={item.styleSlug} value={item.styleSlug}>
                      {item.styleName}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            )}
          </Grid>
        </Box>

        {showMore && (
          <>
            <TextField
              size="small"
              label={i18n("terms")}
              helperText={i18n("terms_helper")}
              name="terms"
              value={terms}
              disabled={disabled}
              onChange={handleChange}
              multiline
              maxRows={10}
            />
            <TextField
              size="small"
              label={i18n("ai_terms")}
              helperText={i18n("ai_terms_helper")}
              name="aiTerms"
              value={aiTerms}
              disabled={disabled}
              onChange={handleChange}
              multiline
              maxRows={10}
            />
            <CodeField
              size="small"
              label={i18n("terms_style")}
              name="termsStyle"
              value={termsStyle}
              disabled={disabled}
              onChange={handleChange}
              maxRows={10}
            />
            <CodeField
              size="small"
              label={i18n("highlight_style")}
              name="highlightStyle"
              value={highlightStyle}
              disabled={disabled}
              onChange={handleChange}
              maxRows={10}
            />
            <CodeField
              size="small"
              label={i18n("text_ext_style")}
              name="textExtStyle"
              value={textExtStyle}
              disabled={disabled}
              onChange={handleChange}
              maxRows={10}
            />
            <CodeField
              size="small"
              label={i18n("selector_style")}
              name="selectStyle"
              value={selectStyle}
              disabled={disabled}
              onChange={handleChange}
              maxRows={10}
            />
            <CodeField
              size="small"
              label={i18n("selector_parent_style")}
              name="parentStyle"
              value={parentStyle}
              disabled={disabled}
              onChange={handleChange}
              maxRows={10}
            />
            <CodeField
              size="small"
              label={i18n("selector_grand_style")}
              name="grandStyle"
              value={grandStyle}
              disabled={disabled}
              onChange={handleChange}
              maxRows={10}
            />
            <CodeField
              size="small"
              label={i18n("inject_css")}
              helperText={i18n("inject_css_helper")}
              name="injectCss"
              value={injectCss}
              disabled={disabled}
              onChange={handleChange}
              maxRows={10}
            />
          </>
        )}

        {rules &&
          (editMode ? (
            <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
              {disabled ? (
                <>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={(e) => {
                      e.preventDefault();
                      setDisabled(false);
                    }}
                    startIcon={<EditIcon />}
                  >
                    {i18n("edit")}
                  </Button>
                  {!isGlobalRule && (
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={handleDelete}
                      startIcon={<DeleteIcon />}
                    >
                      {i18n("delete")}
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Button
                    size="small"
                    variant="contained"
                    type="submit"
                    startIcon={<SaveIcon />}
                    disabled={!isModified}
                  >
                    {i18n("save")}
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleCancel}
                    startIcon={<CancelIcon />}
                  >
                    {i18n("cancel")}
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleRestore}
                  >
                    {i18n("restore_default")}
                  </Button>
                </>
              )}
              <ShowMoreButton showMore={showMore} onChange={setShowMore} />
            </Stack>
          ) : (
            <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
              <Button
                size="small"
                variant="contained"
                type="submit"
                startIcon={<SaveIcon />}
              >
                {i18n("save")}
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={handleCancel}
                startIcon={<CancelIcon />}
              >
                {i18n("cancel")}
              </Button>
              <ShowMoreButton showMore={showMore} onChange={setShowMore} />
            </Stack>
          ))}
      </Stack>
    </form>
  );
}

// 规则折叠面板组件，用于展示和启用/禁用单个规则
function RuleAccordion({ rule, rules, isExpanded = false }) {
  const i18n = useI18n();
  const [expanded, setExpanded] = useState(isExpanded);
  const isPersonalRule = !!rules && rule.pattern !== GLOBAL_KEY;
  const isRuleEnabled = isPersonalRule ? rule.enabled !== false : true;
  const alert = useAlert();

  const handleChange = () => {
    setExpanded((pre) => !pre);
  };

  const titleOpacity = isPersonalRule
    ? isRuleEnabled
      ? 1
      : 0.5
    : rules
      ? 1
      : 0.5;

  const ruleSwitch = isPersonalRule ? (
    <Switch
      size="small"
      checked={isRuleEnabled}
      inputProps={{
        "aria-label": i18n("toggle_personal_rule").replace(
          "{name}",
          rule.pattern
        ),
      }}
      onChange={async (event) => {
        const enabled = event.target.checked;
        try {
          await rules.put(rule.pattern, { enabled });
          alert.success(i18n(enabled ? "rule_enabled" : "rule_disabled"));
        } catch (err) {
          kissLog("toggle rule", err);
          alert.error(i18n("error_got_some_wrong"));
        }
      }}
    />
  ) : null;

  return (
    <Box
      className={`kt-rule-accordion ${
        ruleSwitch ? "kt-rule-accordion--with-switch" : ""
      }`.trim()}
    >
      {ruleSwitch && <Box className="kt-rule-enable-control">{ruleSwitch}</Box>}
      <Accordion expanded={expanded} onChange={handleChange}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography
            sx={{
              opacity: titleOpacity,
              overflowWrap: "anywhere",
              flex: 1,
            }}
          >
            {rule.pattern === GLOBAL_KEY
              ? `[${i18n("global_rule")}] ${rule.pattern}`
              : rule.pattern}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          {expanded && <RuleFields rule={rule} rules={rules} />}
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}

// 个人自定义规则面板组件
function UserRules({ rules }) {
  const i18n = useI18n();
  const alert = useAlert();
  const [showAdd, setShowAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [patternKeyword, setPatternKeyword] = useState("");
  const confirm = useConfirm();

  const handleImport = async (data) => {
    try {
      const parsed = JSON.parse(data);
      if (
        !Array.isArray(parsed) ||
        parsed.some(
          (item) =>
            !item ||
            typeof item !== "object" ||
            Array.isArray(item) ||
            typeof item.pattern !== "string"
        )
      ) {
        alert.error(i18n("import_failed"));
        return;
      }
      await rules.merge(parsed);
      alert.success(i18n("import_success"));
    } catch (err) {
      kissLog("import rules", err);
      alert.error(i18n("import_failed"));
    }
  };

  const handleClearAll = async () => {
    const isConfirmed = await confirm({
      message: i18n("clear_all_rules_confirm"),
      confirmText: i18n("clear_all"),
      cancelText: i18n("cancel"),
    });
    if (isConfirmed) {
      try {
        await rules.clear();
        alert.success(i18n("clear_success"));
      } catch (err) {
        kissLog("clear rules", err);
        alert.error(i18n("error_got_some_wrong"));
      }
    }
  };

  useEffect(() => {
    if (!showAdd) {
      setPatternKeyword("");
    }
  }, [showAdd]);

  if (!rules.list) {
    return null;
  }

  const personalRules = rules.list.filter(
    (rule) => rule.pattern !== GLOBAL_KEY
  );
  const activeFilter = (searchQuery || (showAdd ? patternKeyword : ""))
    .trim()
    .toLowerCase();
  const visibleRules = activeFilter
    ? personalRules.filter((rule) => {
        const lowerPattern = rule.pattern.toLowerCase();
        return (
          lowerPattern.includes(activeFilter) ||
          activeFilter.includes(lowerPattern)
        );
      })
    : personalRules;

  return (
    <Stack spacing={3}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={2}
        useFlexGap
        flexWrap="wrap"
      >
        <Button
          size="small"
          variant="contained"
          disabled={showAdd}
          onClick={(e) => {
            e.preventDefault();
            setShowAdd(true);
          }}
          startIcon={<AddIcon />}
        >
          {i18n("add")}
        </Button>

        <UploadButton text={i18n("import")} handleImport={handleImport} />
        <DownloadButton
          handleData={() => JSON.stringify([...rules.list], null, 2)}
          text={i18n("export")}
          fileName={`immer-rules_v2_${Date.now()}.json`}
        />

        <Button
          size="small"
          variant="outlined"
          color="error"
          disabled={personalRules.length === 0}
          onClick={handleClearAll}
          startIcon={<ClearAllIcon />}
        >
          {i18n("clear_all")}
        </Button>

        <HelpButton url={URL_KISS_RULES_NEW_ISSUE} />
      </Stack>

      <TextField
        size="small"
        fullWidth
        type="search"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        placeholder={i18n("search_personal_rules")}
        inputProps={{ "aria-label": i18n("search_personal_rules") }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchRoundedIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      {showAdd && (
        <RuleFields
          rules={rules}
          setShow={setShowAdd}
          setKeyword={setPatternKeyword}
        />
      )}

      <Box>
        {visibleRules.length > 0 ? (
          visibleRules.map((rule) => (
            <RuleAccordion key={rule.pattern} rule={rule} rules={rules} />
          ))
        ) : (
          <div className="kt-empty-state">
            {personalRules.length === 0
              ? i18n("personal_rules_empty")
              : i18n("options_no_results")}
          </div>
        )}
      </Box>
    </Stack>
  );
}

function GlobalRule({ rules }) {
  const globalRule = useMemo(
    () => rules.list?.find((item) => item.pattern === GLOBAL_KEY),
    [rules.list]
  );

  if (!globalRule) {
    return null;
  }

  return (
    <Stack spacing={3}>
      <RuleAccordion
        key={globalRule.pattern}
        rule={globalRule}
        rules={rules}
        isExpanded={true}
      />
    </Stack>
  );
}

export default function Rules() {
  const i18n = useI18n();
  const [activeTab, setActiveTab] = useState(0);
  const rules = useRules();

  const handleTabChange = (_e, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Box>
      <Stack spacing={3}>
        <Alert severity="info">
          {i18n("rules_warn_1")}
          <br />
          {i18n("rules_warn_2")}
          <br />
          {i18n("rules_warn_3")}
        </Alert>

        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          aria-label={i18n("rules_setting")}
        >
          <Tab
            id="kt-rules-global-tab"
            aria-controls="kt-rules-global-panel"
            label={i18n("global_rule")}
          />
          <Tab
            id="kt-rules-personal-tab"
            aria-controls="kt-rules-personal-panel"
            label={i18n("personal_rules")}
          />
        </Tabs>
        <div
          id="kt-rules-global-panel"
          role="tabpanel"
          aria-labelledby="kt-rules-global-tab"
          hidden={activeTab !== 0}
        >
          {activeTab === 0 && <GlobalRule rules={rules} />}
        </div>
        <div
          id="kt-rules-personal-panel"
          role="tabpanel"
          aria-labelledby="kt-rules-personal-tab"
          hidden={activeTab !== 1}
        >
          {activeTab === 1 && <UserRules rules={rules} />}
        </div>
      </Stack>
    </Box>
  );
}
