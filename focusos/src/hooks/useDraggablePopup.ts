"use client";

import * as React from "react";

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  rect: DOMRect;
}

const VIEWPORT_MARGIN = 12;

interface UseDraggablePopupOptions {
  baseTransform?: string;
}

export function useDraggablePopup<T extends HTMLElement>({
  baseTransform = "",
}: UseDraggablePopupOptions = {}) {
  const popupRef = React.useRef<T>(null);
  const dragStateRef = React.useRef<DragState | null>(null);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);

  const endDrag = React.useCallback(() => {
    dragStateRef.current = null;
    setIsDragging(false);
    document.body.style.userSelect = "";
  }, []);

  React.useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const state = dragStateRef.current;
      if (!state || event.pointerId !== state.pointerId) return;

      event.preventDefault();
      const deltaX = event.clientX - state.startX;
      const deltaY = event.clientY - state.startY;
      const minX = VIEWPORT_MARGIN - state.rect.left;
      const maxX = window.innerWidth - VIEWPORT_MARGIN - state.rect.right;
      const minY = VIEWPORT_MARGIN - state.rect.top;
      const maxY = window.innerHeight - VIEWPORT_MARGIN - state.rect.bottom;

      setPosition({
        x: clamp(state.originX + deltaX, state.originX + minX, state.originX + maxX),
        y: clamp(state.originY + deltaY, state.originY + minY, state.originY + maxY),
      });
    }

    function handlePointerUp(event: PointerEvent) {
      if (event.pointerId === dragStateRef.current?.pointerId) {
        endDrag();
      }
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      document.body.style.userSelect = "";
    };
  }, [endDrag]);

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0 || !event.isPrimary) return;
      const popup = popupRef.current;
      if (!popup) return;

      event.preventDefault();
      dragStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: position.x,
        originY: position.y,
        rect: popup.getBoundingClientRect(),
      };
      setIsDragging(true);
      document.body.style.userSelect = "none";
    },
    [position.x, position.y]
  );

  return {
    popupRef,
    dragHandleProps: {
      onPointerDown: handlePointerDown,
    },
    dragStyle: {
      transform: `${baseTransform ? `${baseTransform} ` : ""}translate3d(${position.x}px, ${position.y}px, 0)`,
    } satisfies React.CSSProperties,
    isDragging,
  };
}

function clamp(value: number, min: number, max: number) {
  if (min > max) return value;
  return Math.min(Math.max(value, min), max);
}
