// INSERT_YOUR_CODE
import React, { useRef, useState } from "react";

type ResizeableProps = {
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
};

const Resizeable: React.FC<ResizeableProps> = ({
  minWidth = 300,
  maxWidth = 900,
  defaultWidth = 800,
  className = "",
  style = {},
  children,
}) => {
  const [width, setWidth] = useState(defaultWidth);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startX = useRef<number | null>(null);
  const startWidth = useRef<number | null>(null);

  // Only the handle can start resize. Container does not listen for mouse down.
  const handleBarMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsResizing(true);
    startX.current = e.clientX;
    if (containerRef.current) {
      startWidth.current = containerRef.current.getBoundingClientRect().width;
    }
    document.body.style.userSelect = "none";
    e.stopPropagation();
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isResizing && startX.current !== null && startWidth.current !== null) {
      const dx = e.clientX - startX.current;
      // Only allow shrinking (moving left) by moving the handle
      const newWidth = Math.max(
        minWidth,
        Math.min(maxWidth, startWidth.current - dx)
      );
      setWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    setIsResizing(false);
    document.body.style.userSelect = "";
  };

  React.useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isResizing]);

  return (
    <div
      ref={containerRef}
      style={{ ...style, width, minWidth, maxWidth, position: "relative" }}
      className={className}
    >
      {/* Left Resize Handle (absolutely positioned over left border - 8px wide) */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 8,
          height: "100%",
          cursor: "ew-resize",
          zIndex: 20,
          // Only show visible handle when hovered for accessible UX
          background: isResizing ? "rgba(125,125,255,0.13)" : "transparent",
          transition: "background 0.15s"
        }}
        onMouseDown={handleBarMouseDown}
        onDoubleClick={e => {
          setWidth(defaultWidth);
          e.stopPropagation();
        }}
        tabIndex={-1}
        aria-label="Resize sidebar"
        role="separator"
      />
      {children}
    </div>
  );
};

export default Resizeable;
