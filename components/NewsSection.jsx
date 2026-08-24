import { useCallback, useEffect, useRef, useState } from "react";
import "./NewsSection.css";

const NEWS_ITEMS = [
  {
    id: 1,
    image:
      "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=1600&auto=format&fit=crop",
    title:
      "Nfinite Named Finalist in Packaging Europe’s Sustainability Awards 2026",
    date: "Press release – July 14, 2026",
    url: "#",
  },
  {
    id: 2,
    image:
      "https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=1600&auto=format&fit=crop",
    title:
      "Nfinite one of 9 start-ups selected for Mondelēz International’s CoLab Tech 2026 Program",
    date: "Press release – June 16, 2026",
    url: "#",
  },
  {
    id: 3,
    image:
      "https://images.unsplash.com/photo-1439405326854-014607f694d7?q=80&w=1600&auto=format&fit=crop",
    title:
      "Nfinite joins Canada’s Ocean Supercluster to accelerate sustainable packaging innovation",
    date: "Press release – April 28, 2026",
    url: "#",
  },
];

export default function NewsSection({ items = NEWS_ITEMS, id = "news" }) {
  const sectionRef = useRef(null);
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const dragRef = useRef({ active: false, startX: 0, startT: 0, moved: false });

  const [index, setIndex] = useState(0);
  const [metrics, setMetrics] = useState({ step: 0, maxScroll: 0 });
  const [revealed, setRevealed] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;
    const measure = () => {
      const children = track.children;
      if (children.length < 2) return;
      const step =
        children[1].getBoundingClientRect().left -
        children[0].getBoundingClientRect().left;
      const maxScroll = Math.max(
        0,
        track.scrollWidth - viewport.clientWidth
      );
      setMetrics({ step, maxScroll });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(viewport);
    ro.observe(track);
    return () => ro.disconnect();
  }, [items]);

  const { step, maxScroll } = metrics;
  const target = Math.min(index * step, maxScroll);
  const canPrev = index > 0;
  const canNext = index * step < maxScroll - 1;

  const goPrev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(
    () => setIndex((i) => Math.min(items.length - 1, i + 1)),
    [items.length]
  );

  const onPointerDown = (e) => {
    const d = dragRef.current;
    d.active = true;
    d.startX = e.clientX;
    d.startT = -target;
    d.moved = false;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragging(true);
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d.active) return;
    const delta = e.clientX - d.startX;
    if (Math.abs(delta) > 4) d.moved = true;
    let next = d.startT + delta;
    if (next > 0) next *= 0.35;
    if (next < -maxScroll) next = -maxScroll + (next + maxScroll) * 0.35;
    setDragOffset(next + target);
  };

  const endDrag = () => {
    const d = dragRef.current;
    if (!d.active) return;
    d.active = false;
    setDragging(false);
    const delta = dragOffset;
    setDragOffset(0);
    const threshold = Math.min(step * 0.25, 90);
    if (delta < -threshold && canNext) setIndex((i) => i + 1);
    else if (delta > threshold && canPrev) setIndex((i) => i - 1);
  };

  const onClickCapture = (e) => {
    if (dragRef.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current.moved = false;
    }
  };

  return (
    <section
      ref={sectionRef}
      id={id}
      className={`ns-section${revealed ? " ns-revealed" : ""}`}
    >
      <h2 className="ns-heading">
        <span>Our</span>
        <span>News</span>
      </h2>

      <div className="ns-carousel">
        <div className="ns-viewport" ref={viewportRef}>
          <div
            ref={trackRef}
            className={`ns-track${dragging ? " ns-dragging" : ""}`}
            style={{
              transform: `translate3d(${-(target) + dragOffset}px, 0, 0)`,
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onPointerLeave={endDrag}
            onClickCapture={onClickCapture}
          >
            {items.map((item, i) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="ns-card"
                style={{ "--d": `${i * 110}ms` }}
                draggable="false"
              >
                <div className="ns-media">
                  <img
                    src={item.image}
                    alt={item.title}
                    loading={i === 0 ? "eager" : "lazy"}
                    draggable="false"
                  />
                </div>
                <span className="ns-scrim" aria-hidden="true" />
                <div className="ns-overlay">
                  <div className="ns-meta">
                    <h3>{item.title}</h3>
                    <p>{item.date}</p>
                  </div>
                  <span className="ns-arrow" aria-hidden="true">
                    <svg viewBox="0 0 21 21" fill="none">
                      <path
                        d="m7.5 4.5 6 6-6 6"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>

        <div className="ns-controls">
          <button
            type="button"
            className="ns-nav-btn"
            onClick={goPrev}
            disabled={!canPrev}
            aria-label="Previous news"
          >
            <svg viewBox="0 0 20 20" fill="none">
              <path
                d="M12.5 4.5 6.5 10l6 5.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            className="ns-nav-btn"
            onClick={goNext}
            disabled={!canNext}
            aria-label="Next news"
          >
            <svg viewBox="0 0 20 20" fill="none">
              <path
                d="m7.5 4.5 6 5.5-6 5.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
