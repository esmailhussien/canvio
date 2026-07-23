import React from 'react';
import { UserPresence } from '../../hooks/useCollaboration';
import { useCanvasStore } from '../../store/canvasStore';
import './Cursors.css';

interface CursorsProps {
  users: UserPresence[];
}

export const Cursors: React.FC<CursorsProps> = ({ users }) => {
  const viewport = useCanvasStore((s) => s.viewport);

  return (
    <div className="cursors-layer">
      {users.map((user) => {
        if (!user.cursor) return null;

        // Convert world coordinates to screen coordinates
        // The cursor positions from awareness are in world space;
        // we need to apply the same viewport transform as canvas__world
        const screenX = (user.cursor.x + viewport.x) * viewport.zoom;
        const screenY = (user.cursor.y + viewport.y) * viewport.zoom;

        return (
          <div
            key={user.id}
            className="remote-cursor"
            style={{
              transform: `translate(calc(50vw + ${screenX}px), calc(50vh + ${screenY}px))`,
            }}
          >
            {/* SVG Cursor Pointer with user color */}
            <svg
              className="remote-cursor__pointer"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4.5 3V20.0858C4.5 20.9774 5.57818 21.4239 6.20857 20.7935L11.2384 15.7637C11.4259 15.5762 11.6798 15.4711 11.9446 15.4711H19.5858C20.4774 15.4711 20.9239 14.3929 20.2935 13.7626L4.79352 3.20857C4.69352 3.10857 4.5 3 4.5 3Z"
                fill={user.color}
                stroke="#ffffff"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>

            {/* User Name Badge */}
            <div
              className="remote-cursor__label"
              style={{ backgroundColor: user.color }}
            >
              {user.name}
            </div>
          </div>
        );
      })}
    </div>
  );
};
