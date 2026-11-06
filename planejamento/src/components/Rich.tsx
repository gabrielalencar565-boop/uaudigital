/** Converte **palavra** em negrito com o degradê da UAU. */
export default function Rich({ text, gradient = true }: { text: string; gradient?: boolean }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <b key={i} className={gradient ? "grad-text" : undefined}>
            {part}
          </b>
        ) : (
          part
        ),
      )}
    </>
  );
}
