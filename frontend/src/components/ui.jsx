export function Field({ label, id, children, ...props }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children || <input id={id} {...props} />}
    </div>
  )
}

export function Alert({ error, success }) {
  if (error) return <div className="error" role="alert">{error}</div>
  if (success) return <div className="success-msg">{success}</div>
  return null
}

export function Button({ variant = '', small, loading, children, ...props }) {
  return (
    <button
      className={`btn ${variant} ${small ? 'small' : ''}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? 'Memproses...' : children}
    </button>
  )
}

// columns: [{ header, render: (row) => node }]
export function DataTable({ columns, rows, empty = 'Belum ada data.' }) {
  if (!rows.length) return <p className="muted">{empty}</p>
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((c) => <th key={c.header}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id ?? i}>
              {columns.map((c) => <td key={c.header}>{c.render(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export const rupiah = (n) => 'Rp ' + Number(n).toLocaleString('id-ID')
