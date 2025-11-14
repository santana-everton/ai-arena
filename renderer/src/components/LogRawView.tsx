type LogRawViewProps = {
  lines: string[]
}

export default function LogRawView({ lines }: LogRawViewProps) {
  if (!lines.length) {
    return (
      <div className="pane-content" style={{ opacity: 0.6 }}>
        Nenhuma linha recebida ainda.
      </div>
    )
  }

  return (
    <div className="pane-content log-lines">
      {lines.map((line, idx) => (
        <div key={`${idx}-${line.slice(0, 10)}`}>{line}</div>
      ))}
    </div>
  )
}

