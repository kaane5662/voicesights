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
  const startX = useRef<number | null>(null);
  const startWidth = useRef<number | null>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only allow resize when clicking near left border (8px)
    const bounds = e.currentTarget.getBoundingClientRect();
    if (e.clientX - bounds.left <= 8) {
      setIsResizing(true);
      startX.current = e.clientX;
      startWidth.current = bounds.width;
      // Prevent user selection during resize
      document.body.style.userSelect = "none";
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isResizing && startX.current !== null && startWidth.current !== null) {
      const dx = e.clientX - startX.current;
      // Only allow shrinking (moving left)
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth.current - dx));
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
      onMouseDown={handleMouseDown}
      style={{ ...style, width, minWidth, maxWidth,  }}
      className={className}
    >
      {children}
    </div>
  );
};

export default Resizeable;
