import 'temporal-polyfill/global';
import { createCalendar, createViewWeek } from '@schedule-x/calendar';
import { createDragAndDropPlugin } from '@schedule-x/drag-and-drop';
import { createEventsServicePlugin } from '@schedule-x/events-service';

window.addEventListener('error', (event) => {
  window.outcome ??= { kind: 'threw', detail: event.message };
});

createCalendar({
  views: [createViewWeek()],
  selectedDate: Temporal.PlainDate.from('2026-11-11'),
  timezone: 'UTC',
  isResponsive: false,
  events: [
    {
      id: '1',
      title: 'Drag me',
      start: Temporal.ZonedDateTime.from('2026-11-11T10:00[UTC]'),
      end: Temporal.ZonedDateTime.from('2026-11-11T11:00[UTC]'),
    },
  ],
  plugins: [createEventsServicePlugin(), createDragAndDropPlugin()],
  callbacks: {
    onEventUpdate: (event) => {
      window.outcome ??= { kind: 'updated', detail: `event ${event.id} now ${event.start} to ${event.end}` };
    },
  },
}).render(document.getElementById('calendar'));
