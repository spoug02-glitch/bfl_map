/**
 * 구조화 데이터 한 덩어리.
 *
 * React가 <script> 안의 문자열을 그대로 두지 않으므로 dangerouslySetInnerHTML로 넣는다.
 * 넣는 값은 우리가 만든 객체뿐이지만 상호는 수집해온 남의 문자열이다 — 거기에
 * `</script>`가 섞여 있으면 문서가 그 자리에서 끊긴다. `<`를 유니코드 이스케이프로
 * 바꾸면 JSON 의미는 그대로면서 그 경로가 막힌다.
 */
export default function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
