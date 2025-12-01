import { useEffect, useMemo, useRef, useState } from 'react'
import { useTizenKeys } from './hooks/useTizenKeys'
import './App.css'

/**
 * PUBLIC INTERFACE
 * addEvent, updateEvent, deleteEvent, listEventsByDate are exposed through the App for internal usage.
 * This component renders a Month view calendar with a sidebar and modals to manage events.
 */

const COLORS = {
  primary: '#2563EB',
  secondary: '#F59E0B',
  success: '#F59E0B',
  error: '#EF4444',
  background: '#f9fafb',
  surface: '#ffffff',
  text: '#111827',
}

function safeRandomUUID() {
  // Prefer Web Crypto if available (browser, Node 19+ with webcrypto in globalThis)
  const g = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : {}
  const c = g.crypto || (g.require?.('crypto')?.webcrypto) || null

  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID()
  }

  // Use getRandomValues if available
  let bytes = null
  if (c && typeof c.getRandomValues === 'function') {
    bytes = new Uint8Array(16)
    c.getRandomValues(bytes)
  } else {
    // Lightweight Math.random fallback (not cryptographically secure)
    bytes = Uint8Array.from({ length: 16 }, () => Math.floor(Math.random() * 256))
  }

  // Set version and variant
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  const hex = toHex(bytes)
  return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20, 32)}`
}

function startOfMonth(date) {
  const d = new Date(date)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfMonth(date) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + 1, 0)
  d.setHours(23, 59, 59, 999)
  return d
}

function getMonthMatrix(viewDate) {
  const start = startOfMonth(viewDate)
  const end = endOfMonth(viewDate)
  const startDay = start.getDay() // 0-6, Sun-Sat
  const daysInMonth = end.getDate()

  // We render a 6x7 grid
  const matrix = []
  let current = new Date(start)
  current.setDate(current.getDate() - startDay)

  for (let i = 0; i < 6; i++) {
    const row = []
    for (let j = 0; j < 7; j++) {
      row.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }
    matrix.push(row)
  }
  return matrix
}

// PUBLIC_INTERFACE
function formatDateKey(d) {
  /** Returns YYYY-MM-DD for date keys. */
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function loadEvents() {
  try {
    const raw = localStorage.getItem('calendar_events_v1')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveEvents(events) {
  localStorage.setItem('calendar_events_v1', JSON.stringify(events))
}

function useEventStore() {
  const [events, setEvents] = useState(() => loadEvents())
  const timersRef = useRef(new Map())

  useEffect(() => {
    saveEvents(events)
  }, [events])

  // Clear scheduled timers on unmount
  useEffect(() => {
    const map = timersRef.current
    return () => {
      map.forEach((id) => clearTimeout(id))
      map.clear()
    }
  }, [])

  const scheduleReminder = (event) => {
    // Placeholder scheduler; logs to console at reminder time
    // Clears previous
    const existing = timersRef.current.get(event.id)
    if (existing) clearTimeout(existing)

    if (!event.reminderEnabled || !event.reminderMinutes) return

    const startMs = new Date(`${event.date}T${event.time || '00:00'}`).getTime()
    const remindMs = startMs - event.reminderMinutes * 60_000
    const now = Date.now()
    const delay = remindMs - now
    if (delay <= 0) {
      // If already passed, skip scheduling
      return
    }
    const timeoutId = setTimeout(() => {
      // If Tizen Notification API exists, integrate here.
      // Placeholder: log to console
      console.log(
        `[Reminder] ${event.title} at ${event.time} on ${event.date} - (${event.reminderMinutes}m before)`
      )
    }, delay)
    timersRef.current.set(event.id, timeoutId)
  }

  const rescheduleAll = () => {
    const map = timersRef.current
    map.forEach((id) => clearTimeout(id))
    map.clear()
    events.forEach(scheduleReminder)
  }

  useEffect(() => {
    rescheduleAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // only on mount

  // PUBLIC_INTERFACE
  const addEvent = (evt) => {
    /** Adds an event to the store. Expects: {title, date(YYYY-MM-DD), time(HH:MM), description, reminderEnabled, reminderMinutes} */
    const newEvt = {
      ...evt,
      id: safeRandomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setEvents((prev) => {
      const next = [...prev, newEvt]
      return next
    })
    // Schedule after state update tick
    setTimeout(() => scheduleReminder(newEvt), 0)
    return newEvt
  }

  // PUBLIC_INTERFACE
  const updateEvent = (id, updates) => {
    /** Updates an event by id. */
    setEvents((prev) => {
      const next = prev.map((e) =>
        e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e
      )
      return next
    })
    // Re-schedule after state updates; find the event after change
    setTimeout(() => {
      const evt = events.find((e) => e.id === id)
      if (evt) scheduleReminder({ ...evt, ...updates })
    }, 0)
  }

  // PUBLIC_INTERFACE
  const deleteEvent = (id) => {
    /** Deletes an event by id. */
    setEvents((prev) => prev.filter((e) => e.id !== id))
    const existing = timersRef.current.get(id)
    if (existing) {
      clearTimeout(existing)
      timersRef.current.delete(id)
    }
  }

  // PUBLIC_INTERFACE
  const listEventsByDate = (dateKey) => {
    /** Returns events for the given date key (YYYY-MM-DD), sorted by time. */
    return events
      .filter((e) => e.date === dateKey)
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  }

  return { events, addEvent, updateEvent, deleteEvent, listEventsByDate }
}

function Header({ viewDate, onPrev, onNext, onToday }) {
  const label = useMemo(() => {
    return viewDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
  }, [viewDate])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '16px 24px',
        background:
          'linear-gradient(90deg, rgba(37,99,235,0.10) 0%, rgba(249,250,251,1) 100%)',
        borderBottom: `1px solid rgba(17,24,39,0.08)`,
      }}
    >
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          aria-label="Previous month"
          onClick={onPrev}
          className="btn"
        >
          ‹
        </button>
        <button
          aria-label="Next month"
          onClick={onNext}
          className="btn"
        >
          ›
        </button>
        <button
          aria-label="Go to today"
          onClick={onToday}
          className="btn btn-secondary"
        >
          Today
        </button>
      </div>
      <h2 style={{ marginLeft: 16, color: COLORS.text }}>{label}</h2>
    </div>
  )
}

function DayCell({ date, inCurrentMonth, isToday, hasEvents, isSelected, onClick }) {
  return (
    <button
      onClick={() => onClick(date)}
      className="day-cell"
      aria-label={`${date.toDateString()}${hasEvents ? ' has events' : ''}`}
      aria-pressed={isSelected}
      style={{
        opacity: inCurrentMonth ? 1 : 0.45,
        borderColor: isSelected ? COLORS.primary : 'transparent',
        outline: isToday ? `2px dashed ${COLORS.secondary}` : 'none',
      }}
    >
      <div className="day-number">{date.getDate()}</div>
      {hasEvents ? <div className="dot" /> : null}
    </button>
  )
}

function MonthGrid({ viewDate, eventsByDay, selectedDate, onSelectDay }) {
  const matrix = useMemo(() => getMonthMatrix(viewDate), [viewDate])
  const currMonth = viewDate.getMonth()
  const todayKey = formatDateKey(new Date())

  return (
    <div className="month-grid" role="grid" aria-label="Month view calendar">
      <div className="week-header" role="row">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} role="columnheader" className="week-day">
            {d}
          </div>
        ))}
      </div>
      {matrix.map((row, i) => (
        <div key={i} className="week-row" role="row">
          {row.map((d) => {
            const key = formatDateKey(d)
            const inCurrent = d.getMonth() === currMonth
            const isToday = key === todayKey
            const hasEvents = (eventsByDay[key] || []).length > 0
            const isSelected = key === formatDateKey(selectedDate)
            return (
              <DayCell
                key={key}
                date={d}
                inCurrentMonth={inCurrent}
                isToday={isToday}
                hasEvents={hasEvents}
                isSelected={isSelected}
                onClick={onSelectDay}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

function Sidebar({ dateKey, events, onAdd, onEdit, onDelete }) {
  return (
    <aside className="sidebar" aria-label="Event list">
      <div className="sidebar-header">
        <h3 style={{ color: COLORS.text }}>
          {new Date(dateKey).toLocaleDateString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </h3>
        <button className="btn btn-primary" onClick={() => onAdd(dateKey)}>
          + Add Event
        </button>
      </div>
      <div className="event-list" role="list">
        {events.length === 0 ? (
          <div className="empty">No events for this day.</div>
        ) : (
          events.map((e) => (
            <div key={e.id} className="event-card" role="listitem">
              <div className="event-time">{e.time || 'All day'}</div>
              <div className="event-title">{e.title}</div>
              {e.description ? <div className="event-desc">{e.description}</div> : null}
              <div className="event-actions">
                <button className="btn btn-secondary" onClick={() => onEdit(e)}>
                  Edit
                </button>
                <button className="btn btn-danger" onClick={() => onDelete(e.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}

function Modal({ isOpen, title, children, onClose, initialFocusRef }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    if (isOpen && initialFocusRef?.current) {
      initialFocusRef.current.focus()
    }
  }, [isOpen, initialFocusRef])

  if (!isOpen) return null
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal" ref={dialogRef}>
        <div className="modal-header">
          <h4>{title}</h4>
          <button aria-label="Close" className="btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

function EventForm({ initial, onCancel, onSave }) {
  const [title, setTitle] = useState(initial?.title || '')
  const [date, setDate] = useState(initial?.date || formatDateKey(new Date()))
  const [time, setTime] = useState(initial?.time || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [reminderEnabled, setReminderEnabled] = useState(
    initial?.reminderEnabled ?? true
  )
  const [reminderMinutes, setReminderMinutes] = useState(
    initial?.reminderMinutes ?? 10
  )

  const submitRef = useRef(null)

  const onSubmit = (e) => {
    e.preventDefault()
    if (!title.trim()) return
    onSave({
      title: title.trim(),
      date,
      time,
      description: description.trim(),
      reminderEnabled,
      reminderMinutes: Number(reminderMinutes) || 0,
    })
  }

  return (
    <form className="event-form" onSubmit={onSubmit}>
      <label>
        Title
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Event title"
          required
        />
      </label>
      <div className="row">
        <label>
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Event date"
          />
        </label>
        <label>
          Time
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            aria-label="Event time"
          />
        </label>
      </div>
      <label>
        Description
        <textarea
          rows="3"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-label="Event description"
        />
      </label>
      <div className="row">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={reminderEnabled}
            onChange={(e) => setReminderEnabled(e.target.checked)}
            aria-label="Enable reminder"
          />
          Reminder
        </label>
        <label>
          Minutes before
          <input
            type="number"
            min="0"
            step="1"
            value={reminderMinutes}
            onChange={(e) => setReminderMinutes(e.target.value)}
            aria-label="Reminder minutes"
          />
        </label>
      </div>
      <div className="actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button ref={submitRef} type="submit" className="btn btn-primary">
          Save
        </button>
      </div>
    </form>
  )
}

function App() {
  const { events, addEvent, updateEvent, deleteEvent, listEventsByDate } = useEventStore()
  const [viewDate, setViewDate] = useState(() => startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  // Map events by date for month indicators
  const eventsByDay = useMemo(() => {
    const map = {}
    events.forEach((e) => {
      if (!map[e.date]) map[e.date] = []
      map[e.date].push(e)
    })
    return map
  }, [events])

  const selectedKey = formatDateKey(selectedDate)
  const eventsForSelected = listEventsByDate(selectedKey)

  const gotoPrevMonth = () => {
    const d = new Date(viewDate)
    d.setMonth(d.getMonth() - 1)
    setViewDate(startOfMonth(d))
  }
  const gotoNextMonth = () => {
    const d = new Date(viewDate)
    d.setMonth(d.getMonth() + 1)
    setViewDate(startOfMonth(d))
  }
  const gotoToday = () => {
    const today = new Date()
    setViewDate(startOfMonth(today))
    setSelectedDate(today)
  }

  const handleSelectDay = (d) => {
    setSelectedDate(d)
  }

  const openAddModal = (dateKey) => {
    setEditing({ date: dateKey })
    setIsModalOpen(true)
  }

  const openEditModal = (evt) => {
    setEditing(evt)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditing(null)
  }

  const handleSave = (payload) => {
    if (editing?.id) {
      updateEvent(editing.id, payload)
    } else {
      addEvent({ ...payload })
    }
    closeModal()
  }

  // Tizen remote keys: basic navigation to modal buttons and grid could be added later; ensure back closes modal
  useTizenKeys({
    onBack: () => {
      if (isModalOpen) {
        closeModal()
      }
    },
  })

  return (
    <div className="app-shell">
      <Header viewDate={viewDate} onPrev={gotoPrevMonth} onNext={gotoNextMonth} onToday={gotoToday} />
      <div className="content-grid">
        <div className="calendar-surface">
          <MonthGrid
            viewDate={viewDate}
            eventsByDay={eventsByDay}
            selectedDate={selectedDate}
            onSelectDay={handleSelectDay}
          />
        </div>
        <Sidebar
          dateKey={selectedKey}
          events={eventsForSelected}
          onAdd={openAddModal}
          onEdit={openEditModal}
          onDelete={deleteEvent}
        />
      </div>

      <Modal
        isOpen={isModalOpen}
        title={editing?.id ? 'Edit Event' : 'Add Event'}
        onClose={closeModal}
      >
        <EventForm
          initial={
            editing?.id
              ? editing
              : {
                  date: editing?.date || selectedKey,
                  reminderEnabled: true,
                  reminderMinutes: 10,
                }
          }
          onCancel={closeModal}
          onSave={handleSave}
        />
      </Modal>
    </div>
  )
}

export default App
