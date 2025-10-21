import { useState, useEffect, type ReactNode } from 'react'
import clsx from 'clsx'

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

  // Gestos: abrir con barrido desde el borde izquierdo y cerrar con barrido sobre el cajón
  useEffect(() => {
    if (!isMobile) return

    let startX = 0
    let startY = 0
    let tracking = false

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      const t = e.touches[0]
      // activar sólo si empezamos muy cerca del borde izquierdo
      if (!sidebarOpen && t.clientX < 24) {
        tracking = true
        startX = t.clientX
        startY = t.clientY
      }
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!tracking) return
      const t = e.touches[0]
      const dx = t.clientX - startX
      const dy = Math.abs(t.clientY - startY)
      if (dx > 40 && dy < 30) {
        setSidebarOpen(true)
        tracking = false
      }
    }
    const onTouchEnd = () => {
      tracking = false
    }

    const onDrawerTouchStart = (e: TouchEvent) => {
      if (!sidebarOpen || e.touches.length !== 1) return
      const t = e.touches[0]
      startX = t.clientX
      startY = t.clientY
      tracking = true
    }
    const onDrawerTouchMove = (e: TouchEvent) => {
      if (!tracking) return
      const t = e.touches[0]
      const dx = t.clientX - startX
      const dy = Math.abs(t.clientY - startY)
      if (dx < -40 && dy < 30) {
        setSidebarOpen(false)
        tracking = false
      }
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })

    const el = document.getElementById(sidebarId)
    el?.addEventListener('touchstart', onDrawerTouchStart, { passive: true })
    el?.addEventListener('touchmove', onDrawerTouchMove, { passive: true })

    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      el?.removeEventListener('touchstart', onDrawerTouchStart)
      el?.removeEventListener('touchmove', onDrawerTouchMove)
    }
  }, [isMobile, sidebarOpen])

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        {isMobile ? (
          <div className="app-shell__header-mobile">
            <button
              type="button"
              className={`app-shell__mobile-menu ${sidebarOpen ? 'app-shell__mobile-menu--active' : ''}`}
              onClick={toggleSidebar}
              aria-controls={sidebarId}
              aria-expanded={sidebarOpen}
              aria-label={sidebarOpen ? 'Ocultar panel de opciones' : 'Mostrar panel de opciones'}
            >
              <span aria-hidden="true">{sidebarOpen ? '◀' : '▶'}</span>
            </button>
            <div className="app-shell__header-mobile-content">{header}</div>
          </div>
        ) : (
          header
        )}
      </header>
      {/* Botón fijo arriba a la izquierda solo para móvil */}
      {isMobile ? (
        <button
          type="button"
          className={clsx('app-shell__fixed-toggle', {
            'app-shell__fixed-toggle--active': sidebarOpen
          })}
          onClick={toggleSidebar}
          aria-controls={sidebarId}
          aria-expanded={sidebarOpen}
          aria-label={sidebarOpen ? 'Ocultar panel de opciones' : 'Mostrar panel de opciones'}
        >
          {sidebarOpen ? '◀' : '▶'}
        </button>
      ) : null}
      {isMobile ? (
        <button
          type="button"
          className={clsx('app-shell__drawer-handle', {
            'app-shell__drawer-handle--open': sidebarOpen
          })}
          onClick={toggleSidebar}
          aria-controls={sidebarId}
          aria-expanded={sidebarOpen}
          aria-label={sidebarOpen ? 'Ocultar panel de opciones' : 'Mostrar panel de opciones'}
        >
          <span className="app-shell__drawer-handle__icon" aria-hidden="true">
            {sidebarOpen ? '◀' : '▶'}
          </span>
          <span className="app-shell__drawer-handle__label">Opciones</span>
        </button>
      ) : null}
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
