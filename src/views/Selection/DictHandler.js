import Typography from "@mui/material/Typography";
import { AudioBtn, BaiduAudioBtn } from "./AudioBtn";
import { OPT_DICT_BING, OPT_DICT_YOUDAO } from "../../config";
import { apiMicrosoftDict, apiYoudaoDict } from "../../apis";

function renderHighlightedSentence(sentence, word) {
  if (!sentence || !word) return sentence;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(${escaped})`, "gi");
  return sentence.split(pattern).map((part, index) =>
    index % 2 === 1 ? (
      <span key={index} style={{ fontWeight: 600, color: "var(--kt-pri)" }}>
        {part}
      </span>
    ) : (
      <span key={index}>{part}</span>
    )
  );
}

/**
 * 各种英文词典的解析与渲染处理器策略映射表
 */
export const dictHandlers = {
  // ------------------ 必应词典 (Bing Dictionary) ------------------
  [OPT_DICT_BING]: {
    apiFn: apiMicrosoftDict,
    reWord: (data) => data?.word,
    toText: (data) =>
      data?.trs?.map(({ pos, def }) => `${pos ? `[${pos}] ` : ""}${def}`) || [],
    uiAudio: (data) => (
      <div className="kt-dict-meta-grid">
        {data?.aus?.map(({ key, audio, phonetic }) => (
          <span className="kt-dict-meta-item" key={key}>
            <span className="kt-dict-meta-label">{key}</span>
            {phonetic && (
              <span className="kt-dict-meta-value">{`/${phonetic}/`}</span>
            )}
            <AudioBtn src={audio} />
          </span>
        ))}
      </div>
    ),
    uiTrans: (data, i18n) => (
      <div>
        <ul className="kt-dict-list">
          {data?.trs?.map(({ pos, def }, idx) => (
            <li key={idx}>
              {pos && <span className="kt-dict-pos">{pos}</span>}
              <span>{def}</span>
            </li>
          ))}
        </ul>

        {data?.presents?.length > 0 && (
          <Typography
            component="div"
            sx={{
              mt: 1.25,
              color: "var(--kt-onv)",
              fontSize: "var(--kt-text-sm, 13px)",
              lineHeight: 1.5,
            }}
          >
            {data.presents.join(", ")}
          </Typography>
        )}

        {data?.ecs?.length > 0 && (
          <div style={{ marginTop: "12px" }}>
            <div className="kt-dict-section-title">
              {i18n("dict_bilingual")}
            </div>
            {data.ecs.map(({ pos, lis }) => (
              <div key={pos} style={{ marginTop: "6px" }}>
                <div className="kt-dict-pos">{pos}</div>
                <ul className="kt-dict-list">
                  {lis.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {data?.sentences?.length > 0 && (
          <div style={{ marginTop: "12px" }}>
            <div className="kt-dict-section-title">{i18n("dict_examples")}</div>
            {data.sentences.slice(0, 2).map((sentence, idx) => (
              <div className="kt-dict-example" key={idx}>
                <div>{renderHighlightedSentence(sentence.eng, data.word)}</div>
                <div className="kt-dict-example__trans">{sentence.chs}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    ),
  },

  // ------------------ 有道词典 (Youdao Dictionary) ------------------
  [OPT_DICT_YOUDAO]: {
    apiFn: apiYoudaoDict,
    reWord: (data) => data?.ec?.word?.["return-phrase"],
    toText: (data) =>
      data?.ec?.word?.trs?.map(
        ({ pos, tran }) => `${pos ? `[${pos}] ` : ""}${tran}`
      ) || [],
    uiAudio: (data, i18n) => (
      <div className="kt-dict-meta-grid">
        <span className="kt-dict-meta-item">
          <span className="kt-dict-meta-label">{i18n("dict_uk")}</span>
          {data?.ec?.word?.ukphone && (
            <span className="kt-dict-meta-value">
              {`/${data.ec.word.ukphone}/`}
            </span>
          )}
          <BaiduAudioBtn text={data?.ec?.word?.["return-phrase"]} lan="uk" />
        </span>
        <span className="kt-dict-meta-item">
          <span className="kt-dict-meta-label">{i18n("dict_us")}</span>
          {data?.ec?.word?.usphone && (
            <span className="kt-dict-meta-value">
              {`/${data.ec.word.usphone}/`}
            </span>
          )}
          <BaiduAudioBtn text={data?.ec?.word?.["return-phrase"]} lan="en" />
        </span>
      </div>
    ),
    uiTrans: (data, i18n) => (
      <div>
        <ul className="kt-dict-list">
          {data?.ec?.word?.trs?.map(({ pos, tran }, idx) => (
            <li key={idx}>
              {pos && <span className="kt-dict-pos">{pos}</span>}
              <span>{tran}</span>
            </li>
          ))}
        </ul>

        {data?.blng_sents_part?.["sentence-pair"]?.length > 0 && (
          <div style={{ marginTop: "12px" }}>
            <div className="kt-dict-section-title">{i18n("dict_examples")}</div>
            {data.blng_sents_part["sentence-pair"]
              .slice(0, 2)
              .map((sentence, idx) => (
                <div className="kt-dict-example" key={idx}>
                  <div>
                    {renderHighlightedSentence(
                      sentence.sentence,
                      data.ec?.word?.["return-phrase"]
                    )}
                  </div>
                  <div className="kt-dict-example__trans">
                    {sentence["sentence-translation"]}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    ),
  },
};
