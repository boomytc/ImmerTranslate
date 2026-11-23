import FileDownloadIcon from "@mui/icons-material/FileDownload";
import LoadingButton from "@mui/lab/LoadingButton";
import { useEffect, useRef, useState } from "react";
import { kissLog } from "../../libs/log";
import { downloadBlobFile } from "../../libs/utils";
import { useAlert } from "../../hooks/Alert";
import { useI18n } from "../../hooks/I18n";

/**
 * 备份文件数据导出下载按钮组件 (带有加载态)
 *
 * @param {Object} props
 * @param {Function} props.handleData - 异步获取/生成待下载的 Blob 数据的回调函数
 * @param {string} props.text - 按钮文字展示内容
 * @param {string} props.fileName - 保存的文件名称
 */
export default function DownloadButton({ handleData, text, fileName }) {
  const i18n = useI18n();
  const alert = useAlert();
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleClick = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const data = await handleData();
      downloadBlobFile(data, fileName);
    } catch (err) {
      kissLog("download", err);
      alert.error(i18n("export_failed"));
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  return (
    <LoadingButton
      size="small"
      variant="outlined"
      onClick={handleClick}
      loading={loading}
      startIcon={<FileDownloadIcon />}
    >
      {text}
    </LoadingButton>
  );
}
