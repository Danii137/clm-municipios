import type { ReactNode } from 'react'

type AppShellProps = {
  header: ReactNode
  sidebar: ReactNode
  children: ReactNode
}

export const AppShell = ({ header, sidebar, children }: AppShellProps) => {
  return (
    <div className="app-shell">
      <header className="app-shell__header">{header}</header>
      <div className="app-shell__body">
        <aside className="app-shell__sidebar">{sidebar}</aside>
        <main className="app-shell__content">{children}</main>
      </div>
    </div>
  )
}
