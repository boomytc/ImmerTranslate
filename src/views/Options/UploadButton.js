import { useRef } from "react";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import { useI18n } from "../../hooks/I18n";
import { useAlert } from "../../hooks/Alert";
import Button from "@mui/material/Button";

/**
 * 统一的本地备份/配置规则导入上传按钮组件
 *
 * @param {Object} props
 * @param {Function} props.handleImport - 读取文件数据内容后的解析导入回调
 * @param {string} props.text - 按钮上的提示文案
 * @param {string} [props.fileType="json"] - 限制的文件 MIME/类型匹配
 * @param {Array} [props.fileExts=[".json"]] - 文件浏览器支持的选择文件后缀列表
 */
export default function UploadButton({
  handleImport,
  text,
  fileType = "json",
  fileExts = [".json"],
}) {
  const i18n = useI18n();
  const alert = useAlert();
  const inputRef = useRef(null);

  const handleClick = () => {
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.click();
    }
  };

  const onChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    const fileName = (file.name || "").toLowerCase();
    const matchesMime = Boolean(file.type) && file.type.includes(fileType);
    const matchesExt = fileExts.some((ext) =>
      fileName.endsWith(ext.toLowerCase())
    );
    if (!matchesMime && !matchesExt) {
      alert.error(i18n("error_wrong_file_type"));
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      await handleImport(event.target.result);
    };
    reader.onerror = () => {
      alert.error(i18n("import_failed"));
    };
    reader.readAsText(file);
  };

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        onClick={handleClick}
        startIcon={<FileUploadIcon />}
      >
        {text}
      </Button>
      <input
        type="file"
        accept={fileExts.join(", ")}
        ref={inputRef}
        onChange={onChange}
        hidden
      />
    </>
  );
}
