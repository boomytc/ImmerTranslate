import TranBtn from "./TranBtn";
import TranBox from "./TranBox";
import useTranBoxState from "../../hooks/useTranBoxState";
import useSelectionController from "../../hooks/useSelectionController";
import useTranboxShortcuts from "../../hooks/useTranboxShortcuts";
import { useFab } from "../../hooks/Fab";
import { useI18n } from "../../hooks/I18n";
import ThemeProvider from "../../hooks/M3Theme";
import { SettingProvider } from "../../hooks/Setting";
import { SELECTION_STYLES } from "./styles";
import { normalizeFabAppearance } from "../../config/fab";

function SelectionContent({
  contextMenuType,
  tranboxSetting,
  transApis,
  prompts,
  langDetector,
  translateVariants = true,
  parseLatex = false,
}) {
  const i18n = useI18n();
  const { fab } = useFab();
  const { size: fabSize } = normalizeFabAppearance(fab);

  // 1. Manage the panel's size, position, simple mode, and click-away behavior.
  const {
    boxSize,
    setBoxSize,
    boxPosition,
    setBoxPosition,
    simpleStyle,
    setSimpleStyle,
    hideClickAway,
    setHideClickAway,
    followSelection,
    setFollowSelection,
    boxOffsetX,
    boxOffsetY,
  } = useTranBoxState(tranboxSetting);

  // 2. Listen for global selection changes to position and show the button and panel.
  const {
    showBox,
    setShowBox,
    showBtn,
    text,
    setText,
    textContext,
    position,
    handleOpenTranbox,
    handleToggleTranbox,
    btnEvent,
  } = useSelectionController({
    tranboxSetting,
    followSelection,
    boxOffsetX,
    boxOffsetY,
    boxSize,
    setBoxPosition,
    hideClickAway,
    fabSize,
  });

  // 3. Register global panel shortcuts, including Escape to close.
  useTranboxShortcuts({
    showBox,
    setShowBox,
    handleOpenTranbox,
    handleToggleTranbox,
    contextMenuType,
  });

  return (
    <>
      <style>{SELECTION_STYLES}</style>
      {/* Render the draggable, resizable selection translation panel. */}
      <TranBox
        showBox={showBox}
        text={text}
        setText={setText}
        boxSize={boxSize}
        setBoxSize={setBoxSize}
        boxPosition={boxPosition}
        setBoxPosition={setBoxPosition}
        tranboxSetting={tranboxSetting}
        transApis={transApis}
        prompts={prompts}
        setShowBox={setShowBox}
        simpleStyle={simpleStyle}
        setSimpleStyle={setSimpleStyle}
        hideClickAway={hideClickAway}
        setHideClickAway={setHideClickAway}
        followSelection={followSelection}
        setFollowSelection={setFollowSelection}
        langDetector={langDetector}
        translateVariants={translateVariants}
        parseLatex={parseLatex}
        selectionContext={textContext}
      />

      {/* Show the floating translation action beside the current selection. */}
      {showBtn && (
        <TranBtn
          position={position}
          btnEvent={btnEvent}
          label={i18n("tranbtn_label")}
          size={fabSize}
          onTrigger={(e) => {
            e.stopPropagation();
            handleOpenTranbox();
          }}
        />
      )}
    </>
  );
}

/**
 * Entry point for selection translation interactions.
 *
 * @param {Object} props
 * @param {string} props.contextMenuType - Browser context menu type or configuration.
 * @param {Object} props.tranboxSetting - Selection translation panel settings.
 * @param {Array} props.transApis - Enabled translation API settings.
 * @param {Object} props.langDetector - Language detector settings.
 */
export default function Selection({ extStyles, ...props }) {
  return (
    <SettingProvider context="tranbox">
      <ThemeProvider styles={extStyles} isolateRem>
        <SelectionContent {...props} />
      </ThemeProvider>
    </SettingProvider>
  );
}
