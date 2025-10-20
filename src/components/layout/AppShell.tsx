import { useState, useEffect, type ReactNode } from 'react'

type AppShellProps = {
  header: ReactNode
  sidebar: ReactNode
  children: ReactNode
}

export const AppShell = ({ header, sidebar, children }: AppShellProps) => {
  const [isMobile, setIsMobile] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        {header}
        {isMobile && (
          <button 
            className="app-shell__mobile-menu" 
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? 'Cerrar opciones' : 'Ver opciones'}
          </button>
        )}
      </header>
      <div className="app-shell__body">
        <aside className={`app-shell__sidebar ${isMobile ? 'mobile' : ''} ${sidebarOpen ? 'open' : ''}`}>
          {sidebar}
        </aside>
        <main className="app-shell__content">{children}</main>
      </div>
    </div>
  )
}
