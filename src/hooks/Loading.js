import CircularProgress from "@mui/material/CircularProgress";
import Link from "@mui/material/Link";
import Divider from "@mui/material/Divider";

/**
 * 全局或者局部通用的 Loading 加载中 React 占位组件
 * 显示 ImmerTranslate 名称、更新日期，以及一个圆形的加载指示。
 */
export default function Loading() {
  return (
    <center>
      <Divider>
        <Link
          href={process.env.REACT_APP_HOMEPAGE}
        >{`${process.env.REACT_APP_NAME} ${process.env.REACT_APP_VERSION}`}</Link>
      </Divider>
      <CircularProgress />
    </center>
  );
}
