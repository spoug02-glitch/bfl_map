/** 안내·정책 페이지가 같은 모양의 소제목을 쓰도록 모아둔다. */
export default function DocSection({
  title, children,
}: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-on-surface">{title}</h2>
      <div className="mt-2 space-y-2 text-on-surface">{children}</div>
    </section>
  );
}
