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

  useEffect(() => {
    if (!isMobile && sidebarOpen) {
      setSidebarOpen(false)
    }
  }, [isMobile, sidebarOpen])

  useEffect(() => {
    if (!isMobile) {
      document.body.style.removeProperty('overflow')
      return
    }

    if (sidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.removeProperty('overflow')
    }

    return () => {
      document.body.style.removeProperty('overflow')
    }
  }, [isMobile, sidebarOpen])

  useEffect(() => {
    if (!sidebarOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSidebarOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sidebarOpen])

  const toggleSidebar = () => setSidebarOpen((prev) => !prev)
  const closeSidebar = () => setSidebarOpen(false)
  const sidebarId = 'app-shell-sidebar'

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        {header}
        {isMobile && (
          <button
            type="button"
            className={`app-shell__mobile-menu ${sidebarOpen ? 'app-shell__mobile-menu--active' : ''}`}
            onClick={toggleSidebar}
            aria-controls={sidebarId}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? 'Ocultar opciones' : 'Ver opciones'}
          </button>
        )}
      </header>
      <div className="app-shell__body">
        {isMobile ? (
          <div
            className={`app-shell__scrim ${sidebarOpen ? 'app-shell__scrim--visible' : ''}`}
            onClick={closeSidebar}
            aria-hidden="true"
          />
        ) : null}
        <aside
          id={sidebarId}
          className={`app-shell__sidebar ${isMobile ? 'mobile' : ''} ${sidebarOpen ? 'open' : ''}`}
        >
          {sidebar}
        </aside>
        <main className="app-shell__content">{children}</main>
      </div>
    </div>
  )
}
